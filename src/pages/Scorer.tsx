import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/** DB shapes (text IDs, short_name like RLR/RLB/RLN) */
type Team = { id: string; name: string; short_name: string | null };
type Player = { id: string; name: string; team_id: string };

type Game = {
  id: string;
  slug: string;
  game_date: string;
  status: "scheduled" | "Final";
  home_team_id: string;
  away_team_id: string;
  home_team?: Team | null;
  away_team?: Team | null;
};

type EventRow = {
  id: string;
  game_id: string;
  event: "goal" | "assist";
  period: number;
  time_mmss: string;
  team: { id: string; name: string; short_name: string | null } | null;
  player: { id: string; name: string } | null;
};

type GoalLine = {
  key: string; // period|time|team_id
  period: number;
  time_mmss: string;
  team_short: string;
  team_name: string;
  goal?: EventRow;
  assists: EventRow[];
};

export default function Scorer() {
  const [userId, setUserId] = useState<string>("");

  /** dropdowns / data */
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);

  /** create-game form */
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [awayId, setAwayId] = useState<string>("");
  const [homeId, setHomeId] = useState<string>("");

  /** goal form */
  const [teamSide, setTeamSide] = useState<"away" | "home">("away");
  const [period, setPeriod] = useState<number>(1);
  const [mmss, setMMSS] = useState<string>("00:00");
  const [scorerId, setScorerId] = useState<string>("");
  const [assist1Id, setAssist1Id] = useState<string>("");
  const [assist2Id, setAssist2Id] = useState<string>("");

  /** events (raw) and grouped goal lines */
  const [events, setEvents] = useState<EventRow[]>([]);
  const [msg, setMsg] = useState<string>("");

  /** helpers */
  const selectedTeamId = useMemo(() => {
    if (!selectedGame) return "";
    return teamSide === "away" ? selectedGame.away_team_id : selectedGame.home_team_id;
  }, [selectedGame, teamSide]);

  const teamPlayers = useMemo(
    () => players.filter((p) => p.team_id === selectedTeamId),
    [players, selectedTeamId]
  );

  const goalLines: GoalLine[] = useMemo(() => {
    const map = new Map<string, GoalLine>();
    for (const e of events) {
      const teamId = e.team?.id ?? "";
      const key = `${e.period}|${e.time_mmss}|${teamId}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          period: e.period,
          time_mmss: e.time_mmss,
          team_short: e.team?.short_name ?? "",
          team_name: e.team?.name ?? "",
          goal: undefined,
          assists: [],
        });
      }
      const node = map.get(key)!;
      if (e.event === "goal") node.goal = e;
      else if (e.event === "assist") node.assists.push(e);
    }
    return [...map.values()].sort((a, b) => {
      if (a.period !== b.period) return a.period - b.period;
      return a.time_mmss.localeCompare(b.time_mmss);
    });
  }, [events]);

  /** effects */
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u?.user) setUserId(u.user.id);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("games")
        .select(
          `
          id, slug, game_date, status, home_team_id, away_team_id,
          home_team:home_team_id ( id, name, short_name ),
          away_team:away_team_id ( id, name, short_name )
        `
        )
        .order("game_date", { ascending: false })
        .limit(150);
      if (!error && data) setGames(data as any);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("players").select("id, name, team_id").order("name");
      if (!error && data) setPlayers(data as any);
    })();
  }, []);

  useEffect(() => {
    const g = games.find((x) => x.id === selectedGameId) ?? null;
    setSelectedGame(g);
    if (g) loadEventsForGame(g.id);
    else setEvents([]);
  }, [selectedGameId, games]);

  /** loaders */
  async function loadEventsForGame(gameId: string) {
    const { data, error } = await supabase
      .from("events")
      .select(`
        id, game_id, event, period, time_mmss,
        team:team_id ( id, name, short_name ),
        player:player_id ( id, name )
      `)
      .eq("game_id", gameId)
      .order("period", { ascending: true })
      .order("time_mmss", { ascending: true });
    if (!error) setEvents((data ?? []) as any);
  }

  async function refreshGamesAndSelect(id: string) {
    const { data, error } = await supabase
      .from("games")
      .select(
        `
        id, slug, game_date, status, home_team_id, away_team_id,
        home_team:home_team_id ( id, name, short_name ),
        away_team:away_team_id ( id, name, short_name )
      `
      )
      .order("game_date", { ascending: false })
      .limit(150);
    if (!error && data) {
      setGames(data as any);
      setSelectedGameId(id);
    }
  }

  /** create game */
  async function createGame() {
    try {
      setMsg("");
      if (!date || !time || !awayId || !homeId) {
        setMsg("Choose date, time, away & home teams.");
        return;
      }
      const dt = new Date(`${date}T${time}`);

      // build slug: {AWY}_vs_{HOM}_{YYYY-MM-DD}_game_1
      const awayShort =
        (await supabase.from("teams").select("short_name").eq("id", awayId).single()).data?.short_name || "AWY";
      const homeShort =
        (await supabase.from("teams").select("short_name").eq("id", homeId).single()).data?.short_name || "HOM";
      const yyyy = dt.getFullYear();
      const mm = `${dt.getMonth() + 1}`.padStart(2, "0");
      const dd = `${dt.getDate()}`.padStart(2, "0");
      const slug = `${awayShort}_vs_${homeShort}_${yyyy}-${mm}-${dd}_game_1`;

      const { data, error } = await supabase
        .from("games")
        .insert({
          slug,
          game_date: dt.toISOString(),
          status: "scheduled",
          away_team_id: awayId,
          home_team_id: homeId,
          created_by: userId || null,
        })
        .select("id")
        .single();

      if (error) throw error;
      setMsg(`Created game ${slug}`);
      await refreshGamesAndSelect(data!.id);
    } catch (e: any) {
      setMsg(e.message ?? "Create failed");
    }
  }

  /** toggle final/scheduled */
  async function toggleFinal() {
    if (!selectedGame) return;
    const newStatus = selectedGame.status === "Final" ? "scheduled" : "Final";
    const { error } = await supabase.rpc("set_game_status", {
      p_game_id: selectedGame.id,
      p_status: newStatus,
    });
    if (!error) {
      // reflect locally
      setGames((gs) => gs.map((g) => (g.id === selectedGame.id ? { ...g, status: newStatus } : g)));
      setSelectedGame((g) => (g ? { ...g, status: newStatus } : g));
      setMsg(newStatus === "Final" ? "Game marked FINAL" : "Game set to scheduled");
    } else {
      setMsg(error.message);
    }
  }

  /** save goal (plus optional assists at the same timestamp) */
  async function saveGoal() {
    try {
      setMsg("");
      if (!selectedGame) return setMsg("Pick a game first.");
      if (!scorerId) return setMsg("Pick a scorer.");
      if (!/^\d{2}:\d{2}$/.test(mmss)) return setMsg("Time must be MM:SS");

      const base = {
        game_id: selectedGame.id,
        team_id: selectedTeamId,
        period,
        time_mmss: mmss,
        created_by: userId || null,
      };

      // goal
      const { error: gErr } = await supabase
        .from("events")
        .insert([{ ...base, event: "goal", player_id: scorerId }])
        .select("id")
        .single();
      if (gErr) throw gErr;

      // assists (optional)
      const assists: any[] = [];
      if (assist1Id) assists.push({ ...base, event: "assist", player_id: assist1Id });
      if (assist2Id) assists.push({ ...base, event: "assist", player_id: assist2Id });
      if (assists.length) {
        const { error: aErr } = await supabase.from("events").insert(assists);
        if (aErr) throw aErr;
      }

      setMsg("Saved goal.");
      setAssist1Id("");
      setAssist2Id("");

      // refresh events and scores (trigger already recomputed DB score)
      await loadEventsForGame(selectedGame.id);
      await refreshGamesAndSelect(selectedGame.id);
    } catch (e: any) {
      setMsg(e.message ?? "Save failed");
    }
  }

  /** delete a grouped goal line (goal + all assists at same time/period/team) */
  async function deleteGoalLine(gl: GoalLine) {
    if (!selectedGame) return;
    if (!window.confirm(`Delete goal at ${gl.time_mmss} (period ${gl.period}) for ${gl.team_name}?`)) return;

    const ids: string[] = [];
    if (gl.goal?.id) ids.push(gl.goal.id);
    for (const a of gl.assists) if (a.id) ids.push(a.id);
    if (!ids.length) return;

    const { error } = await supabase.from("events").delete().in("id", ids);
    if (!error) {
      await loadEventsForGame(selectedGame.id);
      await refreshGamesAndSelect(selectedGame.id); // update the live score in the header & games view
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Scorer</h1>
      {msg && <div className="text-sm">{msg}</div>}

      {/* Create new game */}
      <section className="space-y-3 border rounded p-4">
        <h2 className="font-semibold">New game</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="block">
            <div>Date</div>
            <input type="date" className="border p-2 w-full" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <div>Time</div>
            <input type="time" className="border p-2 w-full" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className="block">
            <div>Away team</div>
            <TeamSelect value={awayId} onChange={setAwayId} />
          </label>
          <label className="block">
            <div>Home team</div>
            <TeamSelect value={homeId} onChange={setHomeId} />
          </label>
        </div>
        <button className="bg-black text-white px-4 py-2 rounded" onClick={createGame}>
          Create game
        </button>
      </section>

      {/* Choose game / status toggle */}
      <section className="space-y-3">
        <label className="block">
          <div className="font-semibold">Game (slug)</div>
          <select
            className="border p-2 w-full"
            value={selectedGameId}
            onChange={(e) => setSelectedGameId(e.target.value)}
          >
            <option value="">-- choose --</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.slug}
              </option>
            ))}
          </select>
        </label>

        {!!selectedGame && (
          <div className="text-sm">
            Status: <span className="font-semibold">{selectedGame.status}</span>{" "}
            <button className="underline ml-2" onClick={toggleFinal}>
              {selectedGame.status === "Final" ? "Mark SCHEDULED" : "Mark FINAL"}
            </button>
          </div>
        )}
      </section>

      {/* Goal entry */}
      {!!selectedGame && (
        <section className="space-y-4">
          <div className="flex gap-6 items-center">
            <label className="flex items-center gap-2">
              <input type="radio" checked={teamSide === "away"} onChange={() => setTeamSide("away")} />
              <span>{selectedGame.away_team?.short_name || "AWAY"}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={teamSide === "home"} onChange={() => setTeamSide("home")} />
              <span>{selectedGame.home_team?.short_name || "HOME"}</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <label className="block">
              <div>Period</div>
              <input
                type="number"
                className="border p-2 w-full"
                min={1}
                max={5}
                value={period}
                onChange={(e) => setPeriod(parseInt(e.target.value || "1"))}
              />
            </label>
            <label className="block">
              <div>Time (MM:SS)</div>
              <input
                type="text"
                className="border p-2 w-full"
                value={mmss}
                onChange={(e) => setMMSS(e.target.value)}
                placeholder="00:00"
              />
            </label>
            <label className="block md:col-span-3">
              <div>Scorer</div>
              <select className="border p-2 w-full" value={scorerId} onChange={(e) => setScorerId(e.target.value)}>
                <option value="">-- choose --</option>
                {teamPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div>Assist 1 (optional)</div>
              <select className="border p-2 w-full" value={assist1Id} onChange={(e) => setAssist1Id(e.target.value)}>
                <option value="">-- none --</option>
                {teamPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div>Assist 2 (optional)</div>
              <select className="border p-2 w-full" value={assist2Id} onChange={(e) => setAssist2Id(e.target.value)}>
                <option value="">-- none --</option>
                {teamPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button className="bg-black text-white px-4 py-2 rounded" onClick={saveGoal}>
            Save goal
          </button>
        </section>
      )}

      {/* Current goals (grouped) */}
      {!!selectedGame && (
        <section className="space-y-2">
          <h2 className="font-semibold">
            Current goals — {selectedGame.away_team?.name} vs {selectedGame.home_team?.name}
          </h2>

          {goalLines.length === 0 ? (
            <div className="text-sm text-gray-600">No goals saved yet for this game.</div>
          ) : (
            <table className="min-w-full text-sm border rounded">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-2 w-20">Per</th>
                  <th className="p-2 w-24">Time</th>
                  <th className="p-2 w-20">Team</th>
                  <th className="p-2">Scorer / Assists</th>
                  <th className="p-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {goalLines.map((gl) => (
                  <tr key={gl.key} className="border-t">
                    <td className="p-2">{gl.period}</td>
                    <td className="p-2">{gl.time_mmss}</td>
                    <td className="p-2">{gl.team_short || "-"}</td>
                    <td className="p-2">
                      {gl.goal?.player?.name || "—"}
                      {gl.assists.length > 0 && (
                        <span className="text-gray-600">
                          {"  "}ASS: {gl.assists.map((a) => a.player?.name).filter(Boolean).join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <button
                        title="Delete this goal (and its assists)"
                        className="text-red-600 hover:underline"
                        onClick={() => deleteGoalLine(gl)}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}

/** Small team selector */
function TeamSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [teams, setTeams] = useState<Team[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("teams").select("id, name, short_name").order("name");
      setTeams((data ?? []) as any);
    })();
  }, []);
  return (
    <select className="border p-2 w-full" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">-- choose --</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {(t.short_name || t.name) + " — " + t.name}
        </option>
      ))}
    </select>
  );
}
