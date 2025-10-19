import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

// DB types we use here
type Team = { id: string; name: string; short_name: string | null };
type Player = { id: string; name: string; number: number | null; team_id: string };
type GameRow = {
  id: string;
  slug: string;
  game_date: string;
  status: string | null;
  home_team_id: string;
  away_team_id: string;
  home_team: Team | null;
  away_team: Team | null;
};

type GoalLine = {
  // what we read back to display the current goals
  game_id: string;
  period: number;
  time_mmss: string;
  team_id: string | null;
  team_short: string | null;
  scorer_name: string | null;
  assist1_name: string | null;
  assist2_name: string | null;
};

export default function Scorer() {
  const [userId, setUserId] = useState<string | null>(null);

  // Create game form
  const [teams, setTeams] = useState<Team[]>([]);
  const [newDate, setNewDate] = useState<string>("");      // yyyy-mm-dd
  const [newTime, setNewTime] = useState<string>("");      // hh:mm
  const [newAwayId, setNewAwayId] = useState<string>("");
  const [newHomeId, setNewHomeId] = useState<string>("");

  // Existing games + current selection
  const [games, setGames] = useState<GameRow[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const selectedGame = useMemo(
    () => games.find((g) => g.slug === selectedSlug) ?? null,
    [games, selectedSlug]
  );

  // which side is scoring
  const [side, setSide] = useState<"home" | "away">("away");

  // event fields
  const [period, setPeriod] = useState<number>(1);
  const [time, setTime] = useState<string>("00:00");
  const [scorerId, setScorerId] = useState<string>("");
  const [assist1Id, setAssist1Id] = useState<string>("");
  const [assist2Id, setAssist2Id] = useState<string>("");

  // players cache
  const [players, setPlayers] = useState<Player[]>([]);

  // current goals for the selected game (from the view)
  const [goalLines, setGoalLines] = useState<GoalLine[]>([]);

  // messages
  const [msg, setMsg] = useState<string>("");

  // 1) auth
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  // 2) load teams
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, short_name")
        .order("name");
      if (!error && data) setTeams(data as Team[]);
    })();
  }, []);

  // 3) load games (with team names) ordered by date desc
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("games")
        .select(`
          id, slug, game_date, status, home_team_id, away_team_id,
          home_team:home_team_id ( id, name, short_name ),
          away_team:away_team_id ( id, name, short_name )
        `)
        .order("game_date", { ascending: false });

      if (!error && data) setGames(data as unknown as GameRow[]);
    })();
  }, []);

  // 4) load all players once
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, number, team_id")
        .order("name");
      if (!error && data) setPlayers(data as Player[]);
    })();
  }, []);

  // 5) load goal lines for the selected game
  useEffect(() => {
    if (!selectedGame) {
      setGoalLines([]);
      return;
    }
    (async () => {
      // If your view name is different, change it here.
      const { data, error } = await supabase
        .from("goal_lines_ext_v2")
        .select("game_id, period, time_mmss, team_id, team_short, scorer_name, assist1_name, assist2_name")
        .eq("game_id", selectedGame.id)
        .order("period")
        .order("time_mmss");

      if (!error && data) setGoalLines(data as GoalLine[]);
    })();
  }, [selectedGame]);

  // computed: the two short codes for the selected game
  const shortHome = selectedGame?.home_team?.short_name ?? "HOME";
  const shortAway = selectedGame?.away_team?.short_name ?? "AWAY";

  // filter players of the chosen side
  const chosenTeamId = useMemo(() => {
    if (!selectedGame) return "";
    return side === "home" ? selectedGame.home_team_id : selectedGame.away_team_id;
  }, [selectedGame, side]);

  const teamPlayers = useMemo(
    () => players.filter((p) => p.team_id === chosenTeamId),
    [players, chosenTeamId]
  );

  function jerseyName(p: Player) {
    return p.number ? `${p.name} (#${p.number})` : p.name;
  }

  // ---------- Create a game ----------
  function computeSlug(away: Team, home: Team, dateISO: string, index = 1) {
    // dateISO => YYYY-MM-DD
    const yyyy = dateISO.slice(0, 4);
    const mm = dateISO.slice(5, 7);
    const dd = dateISO.slice(8, 10);
    const a = away.short_name ?? "AWY";
    const h = home.short_name ?? "HOM";
    return `${a}_vs_${h}_${yyyy}-${mm}-${dd}_game_${index}`;
  }

  async function handleCreateGame() {
    setMsg("");
    try {
      if (!newDate || !newTime || !newAwayId || !newHomeId) {
        setMsg("Pick date, time, away and home.");
        return;
      }
      const away = teams.find((t) => t.id === newAwayId);
      const home = teams.find((t) => t.id === newHomeId);
      if (!away || !home) {
        setMsg("Invalid team selection.");
        return;
      }

      // Game date as timestamptz
      const gameDate = new Date(`${newDate}T${newTime}:00`);

      // find "game_#" for that day between those teams (simple approach)
      const sameDay = games.filter((g) => g.home_team_id === newHomeId && g.away_team_id === newAwayId)
        .filter((g) => g.game_date.slice(0, 10) === newDate);
      const nextIndex = sameDay.length + 1;

      const slug = computeSlug(away, home, newDate, nextIndex);

      // INSERT; rely on DEFAULT gen_random_uuid() in SQL
      const { data, error } = await supabase
        .from("games")
        .insert([{
          slug,
          game_date: gameDate.toISOString(),
          status: "scheduled",
          home_team_id: newHomeId,
          away_team_id: newAwayId
        }])
        .select();

      if (error) throw error;

      // reload games & select the new one
      const g = data![0] as GameRow;
      setGames((old) => [g, ...old]);
      setSelectedSlug(g.slug);
      setMsg("Game created.");
    } catch (e: any) {
      setMsg(e.message ?? "Create game failed");
    }
  }

  // ---------- Save goal ----------
  async function handleSaveGoal() {
    setMsg("");
    try {
      if (!userId) throw new Error("Not authenticated.");
      if (!selectedGame) throw new Error("Pick a game.");
      if (!scorerId) throw new Error("Pick a scorer.");
      if (!/^\d{2}:\d{2}$/.test(time)) throw new Error("Time must be MM:SS.");

      const game_id = selectedGame.id;
      const team_id = chosenTeamId; // this is a UUID
      if (!team_id) throw new Error("Missing team for this side.");

      const base = {
        game_id,
        team_id,
        period,
        time_mmss: time,
        created_by: userId
      };

      // 1) goal
      const { error: gErr } = await supabase.from("events").insert([{ ...base, player_id: scorerId, event: "goal" }]);
      if (gErr) throw gErr;

      // 2) assists (optional)
      const assists = [];
      if (assist1Id) assists.push({ ...base, player_id: assist1Id, event: "assist" });
      if (assist2Id) assists.push({ ...base, player_id: assist2Id, event: "assist" });
      if (assists.length) {
        const { error: aErr } = await supabase.from("events").insert(assists);
        if (aErr) throw aErr;
      }

      setMsg("Saved!");
      // reset only the selection for players
      setScorerId("");
      setAssist1Id("");
      setAssist2Id("");

      // refresh lines
      const { data, error } = await supabase
        .from("goal_lines_ext_v2")
        .select("game_id, period, time_mmss, team_id, team_short, scorer_name, assist1_name, assist2_name")
        .eq("game_id", selectedGame.id)
        .order("period")
        .order("time_mmss");
      if (!error && data) setGoalLines(data as GoalLine[]);
    } catch (e: any) {
      setMsg(e.message ?? "Save failed");
    }
  }

  // ---------- Delete a goal line (and its assists) ----------
  async function handleDeleteGoalLine(gl: GoalLine) {
    setMsg("");
    if (!selectedGame) return;
    try {
      // delete the set (goal+assists) matching game_id + period + time
      const { error } = await supabase
        .from("events")
        .delete()
        .match({
          game_id: selectedGame.id,
          period: gl.period,
          time_mmss: gl.time_mmss
        });
      if (error) throw error;

      setGoalLines((old) =>
        old.filter((x) => !(x.period === gl.period && x.time_mmss === gl.time_mmss))
      );
      setMsg("Deleted.");
    } catch (e: any) {
      setMsg(e.message ?? "Delete failed");
    }
  }

  // ---------- Mark final ----------
  async function markFinal() {
    setMsg("");
    if (!selectedGame) return;
    try {
      const { error } = await supabase
        .from("games")
        .update({ status: "final" })
        .eq("id", selectedGame.id);
      if (error) throw error;
      setGames((old) =>
        old.map((g) => (g.id === selectedGame.id ? { ...g, status: "final" } : g))
      );
      setMsg("Marked FINAL.");
    } catch (e: any) {
      setMsg(e.message ?? "Update failed");
    }
  }

  const canSave =
    !!selectedGame &&
    !!chosenTeamId &&
    !!scorerId &&
    /^\d{2}:\d{2}$/.test(time) &&
    !!userId;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Scorer</h1>

      {/* Create game */}
      <section className="space-y-3 border p-4 rounded">
        <h2 className="font-semibold">New game</h2>
        <div className="grid gap-3 grid-cols-1 md:grid-cols-4">
          <label className="block">
            <div className="text-sm">Date</div>
            <input type="date" className="border p-2 w-full"
              value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </label>

          <label className="block">
            <div className="text-sm">Time</div>
            <input type="time" className="border p-2 w-full"
              value={newTime} onChange={(e) => setNewTime(e.target.value)} />
          </label>

          <label className="block">
            <div className="text-sm">Away team</div>
            <select className="border p-2 w-full" value={newAwayId} onChange={(e) => setNewAwayId(e.target.value)}>
              <option value="">-- choose --</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.short_name ?? ""} — {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-sm">Home team</div>
            <select className="border p-2 w-full" value={newHomeId} onChange={(e) => setNewHomeId(e.target.value)}>
              <option value="">-- choose --</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.short_name ?? ""} — {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={handleCreateGame}
          disabled={!newDate || !newTime || !newHomeId || !newAwayId}
        >
          Create game
        </button>
      </section>

      {/* Select game by slug */}
      <section className="space-y-3">
        <label className="block">
          <div className="font-semibold">Game (slug)</div>
          <select
            className="border p-2 w-full"
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
          >
            <option value="">-- choose --</option>
            {games.map((g) => (
              <option key={g.id} value={g.slug}>
                {g.slug}
              </option>
            ))}
          </select>
        </label>

        {selectedGame && (
          <div className="text-sm">
            Status: <span className="font-semibold">{selectedGame.status ?? "scheduled"}</span>{" "}
            {selectedGame.status !== "final" && (
              <button onClick={markFinal} className="underline text-blue-600 ml-3">
                Mark FINAL
              </button>
            )}
          </div>
        )}

        {/* Side (uses short names) */}
        {selectedGame && (
          <div className="flex gap-6 items-center pt-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={side === "away"}
                onChange={() => setSide("away")}
              />
              <span>{shortAway}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={side === "home"}
                onChange={() => setSide("home")}
              />
              <span>{shortHome}</span>
            </label>
          </div>
        )}
      </section>

      {/* Enter event */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className="block">
            <div className="text-sm">Period</div>
            <input
              type="number"
              className="border p-2 w-full"
              min={1}
              max={9}
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
            />
          </label>

          <label className="block">
            <div className="text-sm">Time (MM:SS)</div>
            <input
              type="text"
              className="border p-2 w-full"
              placeholder="00:00"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>

          <label className="md:col-span-2 block">
            <div className="text-sm">Scorer</div>
            <select
              className="border p-2 w-full"
              value={scorerId}
              onChange={(e) => setScorerId(e.target.value)}
              disabled={!chosenTeamId}
            >
              <option value="">-- choose --</option>
              {teamPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {jerseyName(p)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm">Assist 1 (optional)</div>
            <select
              className="border p-2 w-full"
              value={assist1Id}
              onChange={(e) => setAssist1Id(e.target.value)}
              disabled={!chosenTeamId}
            >
              <option value="">-- none --</option>
              {teamPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {jerseyName(p)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-sm">Assist 2 (optional)</div>
            <select
              className="border p-2 w-full"
              value={assist2Id}
              onChange={(e) => setAssist2Id(e.target.value)}
              disabled={!chosenTeamId}
            >
              <option value="">-- none --</option>
              {teamPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {jerseyName(p)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={handleSaveGoal}
          disabled={!canSave}
        >
          Save goal
        </button>

        {msg && <div className="text-sm pt-2">{msg}</div>}
      </section>

      {/* Current goals list with delete */}
      {selectedGame && (
        <section className="space-y-2">
          <h3 className="font-semibold">
            Current goals — {selectedGame.away_team?.name} vs {selectedGame.home_team?.name}
          </h3>

          {goalLines.length === 0 ? (
            <div className="text-sm text-gray-600">No goals saved yet for this game.</div>
          ) : (
            <ul className="divide-y border rounded">
              {goalLines.map((g, i) => {
                const line =
                  `${g.time_mmss} — ` +
                  (g.team_short ? `(${g.team_short}) ` : "") +
                  (g.scorer_name ?? "—") +
                  (g.assist1_name || g.assist2_name
                    ? `  ASS : ${[g.assist1_name, g.assist2_name].filter(Boolean).join(", ")}`
                    : "");

                return (
                  <li key={`${g.period}-${g.time_mmss}-${i}`} className="p-2 flex items-center justify-between">
                    <span className="text-sm">{line}</span>
                    <button
                      onClick={() => handleDeleteGoalLine(g)}
                      className="text-red-600 text-sm hover:underline"
                      title="Delete this goal (and assists)"
                    >
                      🗑 Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
