// src/pages/Scorer.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Team = { id: string; name: string; short_name: string | null };
type Player = { id: string; name: string; team_id: string };

type Game = {
  id: string;
  slug: string;
  game_date: string;
  status: "scheduled" | "final";
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
  key: string;                 // period|time|team_id
  period: number;
  time_mmss: string;
  team_id: string;
  team_short: string;
  team_name: string;
  scorer?: string;             // player name
  assists: string[];           // player names
};

export default function Scorer() {
  const [userId, setUserId] = useState<string>("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");

  // new game form
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [awayId, setAwayId] = useState("");
  const [homeId, setHomeId] = useState("");

  // goal form
  const [teamSide, setTeamSide] = useState<"away" | "home">("away");
  const [period, setPeriod] = useState(1);
  const [mmss, setMMSS] = useState("00:00");
  const [scorerId, setScorerId] = useState("");
  const [assist1Id, setAssist1Id] = useState("");
  const [assist2Id, setAssist2Id] = useState("");

  const [events, setEvents] = useState<EventRow[]>([]);
  const [msg, setMsg] = useState<string>("");

  // ---- helpers ----
  const selectedGame = useMemo(
    () => games.find(g => g.id === selectedGameId) ?? null,
    [games, selectedGameId]
  );

  const selectedTeamId = useMemo(() => {
    if (!selectedGame) return "";
    return teamSide === "away" ? selectedGame.away_team_id : selectedGame.home_team_id;
  }, [selectedGame, teamSide]);

  const teamPlayers = useMemo(
    () => players.filter(p => p.team_id === selectedTeamId),
    [players, selectedTeamId]
  );

  const goalLines: GoalLine[] = useMemo(() => {
    const map = new Map<string, GoalLine>();
    for (const e of events) {
      const tid = e.team?.id ?? "";
      const key = `${e.period}|${e.time_mmss}|${tid}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          period: e.period,
          time_mmss: e.time_mmss,
          team_id: tid,
          team_short: e.team?.short_name ?? "",
          team_name: e.team?.name ?? "",
          assists: [],
        });
      }
      const gl = map.get(key)!;
      if (e.event === "goal") gl.scorer = e.player?.name ?? "";
      if (e.event === "assist" && e.player?.name) gl.assists.push(e.player.name);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.period !== b.period) return a.period - b.period;
      return a.time_mmss.localeCompare(b.time_mmss);
    });
  }, [events]);

  // ---- loaders ----
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: p }, { data: g }] = await Promise.all([
        supabase.from("teams").select("id, name, short_name").order("name"),
        supabase.from("players").select("id, name, team_id").order("name"),
        supabase
          .from("games")
          .select(`
            id, slug, game_date, status, home_team_id, away_team_id,
            home_team:home_team_id ( id, name, short_name ),
            away_team:away_team_id ( id, name, short_name )
          `)
          .order("game_date", { ascending: false })
          .limit(200),
      ]);
      setTeams((t ?? []) as Team[]);
      setPlayers((p ?? []) as Player[]);
      setGames((g ?? []) as Game[]);
    })();
  }, []);

  useEffect(() => {
    if (!selectedGame) { setEvents([]); return; }
    loadEventsForGame(selectedGame.id);
  }, [selectedGame?.id]);

  async function loadEventsForGame(gameId: string) {
    const { data } = await supabase
      .from("events")
      .select(`
        id, game_id, event, period, time_mmss,
        team:team_id ( id, name, short_name ),
        player:player_id ( id, name )
      `)
      .eq("game_id", gameId)
      .order("period")
      .order("time_mmss");
    setEvents((data ?? []) as EventRow[]);
  }

  // ---- recompute and update scores in `games` after a change ----
  async function recomputeAndUpdateScores(game: Game) {
    // count away/home goals from events
    const { data } = await supabase
      .from("events")
      .select("team_id, event")
      .eq("game_id", game.id)
      .eq("event", "goal");

    let home = 0, away = 0;
    for (const r of (data ?? []) as any[]) {
      if (r.team_id === game.home_team_id) home++;
      else if (r.team_id === game.away_team_id) away++;
    }
    await supabase.from("games").update({
      home_score: home,
      away_score: away,
    }).eq("id", game.id);
  }

  // ---- create game ----
  async function createGame() {
    try {
      setMsg("");
      if (!date || !time || !awayId || !homeId) {
        setMsg("Choose date, time, away & home teams.");
        return;
      }
      const dt = new Date(`${date}T${time}`);
      const yyyy = dt.getFullYear();
      const mm = `${dt.getMonth() + 1}`.padStart(2, "0");
      const dd = `${dt.getDate()}`.padStart(2, "0");

      const awayShort = teams.find(t => t.id === awayId)?.short_name ?? "AWY";
      const homeShort = teams.find(t => t.id === homeId)?.short_name ?? "HOM";
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
          home_score: 0,
          away_score: 0,
        })
        .select(`
          id, slug, game_date, status, home_team_id, away_team_id,
          home_team:home_team_id ( id, name, short_name ),
          away_team:away_team_id ( id, name, short_name )
        `)
        .single();
      if (error) throw error;

      setGames([data as Game, ...games]);
      setSelectedGameId((data as Game).id);
      setMsg(`Created ${slug}`);
    } catch (e: any) {
      setMsg(e.message ?? "Create failed");
    }
  }

  // ---- mark FINAL / UNFINAL ----
  async function toggleFinal() {
    if (!selectedGame) return;
    const newStatus = selectedGame.status === "final" ? "scheduled" : "final";
    const { error } = await supabase
      .from("games")
      .update({ status: newStatus })
      .eq("id", selectedGame.id);
    if (!error) {
      setGames(games.map(g => g.id === selectedGame.id ? { ...g, status: newStatus } as Game : g));
      setMsg(`Game marked ${newStatus.toUpperCase()}`);
    }
  }

  // ---- save goal (with up to 2 assists) ----
  async function saveGoal() {
    try {
      setMsg("");
      if (!selectedGame) return setMsg("Pick a game first.");
      if (!scorerId) return setMsg("Pick a scorer.");
      if (!/^\d{2}:\d{2}$/.test(mmss)) return setMsg("Time must be MM:SS");

      const team_id = selectedTeamId;
      const base = {
        game_id: selectedGame.id,
        team_id,
        period,
        time_mmss: mmss,
        created_by: userId || null,
      };

      // goal
      const { error: gErr } = await supabase.from("events")
        .insert([{ ...base, event: "goal", player_id: scorerId }]);
      if (gErr) throw gErr;

      // assists
      const assists: any[] = [];
      if (assist1Id) assists.push({ ...base, event: "assist", player_id: assist1Id });
      if (assist2Id) assists.push({ ...base, event: "assist", player_id: assist2Id });
      if (assists.length) {
        const { error: aErr } = await supabase.from("events").insert(assists);
        if (aErr) throw aErr;
      }

      await recomputeAndUpdateScores(selectedGame);
      await loadEventsForGame(selectedGame.id);
      setAssist1Id(""); setAssist2Id("");
      setMsg("Saved goal.");
    } catch (e: any) {
      setMsg(e.message ?? "Save failed (RLS?)");
    }
  }

  // ---- delete a goal line (goal + its assists) ----
  async function deleteGoalLine(gl: GoalLine) {
    if (!selectedGame) return;
    if (!confirm(`Delete goal at ${gl.time_mmss} (period ${gl.period})?`)) return;

    // delete all events that match same key (goal + assists)
    const { error } = await supabase
      .from("events")
      .delete()
      .match({
        game_id: selectedGame.id,
        team_id: gl.team_id,
        period: gl.period,
        time_mmss: gl.time_mmss,
      });

    if (error) {
      alert(error.message ?? "Delete failed (RLS?)");
      return;
    }
    await recomputeAndUpdateScores(selectedGame);
    await loadEventsForGame(selectedGame.id);
  }

  // ---- delete whole game (from Scorer) ----
  async function deleteCurrentGame() {
    if (!selectedGame) return;
    if (!confirm(`Delete game "${selectedGame.slug}"?`)) return;
    // delete events first
    await supabase.from("events").delete().eq("game_id", selectedGame.id);
    // delete game
    const { error } = await supabase.from("games").delete().eq("id", selectedGame.id);
    if (error) {
      alert(error.message ?? "Delete failed (RLS?)");
      return;
    }
    setGames(games.filter(g => g.id !== selectedGame.id));
    setSelectedGameId("");
    setEvents([]);
    setMsg("Game deleted.");
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Scorer</h1>
      {msg && <div className="text-sm">{msg}</div>}

      {/* Create game */}
      <section className="space-y-3 border rounded p-4">
        <h2 className="font-semibold">New game</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="block">
            <div>Date</div>
            <input type="date" className="border p-2 w-full" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label className="block">
            <div>Time</div>
            <input type="time" className="border p-2 w-full" value={time} onChange={e => setTime(e.target.value)} />
          </label>
          <label className="block">
            <div>Away team</div>
            <TeamSelect teams={teams} value={awayId} onChange={setAwayId} />
          </label>
          <label className="block">
            <div>Home team</div>
            <TeamSelect teams={teams} value={homeId} onChange={setHomeId} />
          </label>
        </div>
        <button className="bg-black text-white px-4 py-2 rounded" onClick={createGame}>Create game</button>
      </section>

      {/* Pick game */}
      <section className="space-y-3">
        <label className="block">
          <div className="font-semibold">Game (slug)</div>
          <select
            className="border p-2 w-full"
            value={selectedGameId}
            onChange={(e) => setSelectedGameId(e.target.value)}
          >
            <option value="">-- choose --</option>
            {games.map(g => (
              <option key={g.id} value={g.id}>
                {g.slug}
              </option>
            ))}
          </select>
        </label>

        {!!selectedGame && (
          <div className="flex items-center gap-3 text-sm">
            Status: <span className="font-semibold">{selectedGame.status}</span>
            <button className="underline" onClick={toggleFinal}>
              {selectedGame.status === "final" ? "Unfinal" : "Mark FINAL"}
            </button>
            <span className="flex-1"></span>
            <button className="text-red-600 underline" onClick={deleteCurrentGame}>Delete game</button>
          </div>
        )}
      </section>

      {/* Goal entry */}
      {!!selectedGame && (
        <section className="space-y-4">
          <div className="flex gap-6 items-center">
            <label className="flex items-center gap-2">
              <input type="radio" checked={teamSide === "away"} onChange={() => setTeamSide("away")} />
              <span>{selectedGame.away_team?.short_name || "AWY"}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={teamSide === "home"} onChange={() => setTeamSide("home")} />
              <span>{selectedGame.home_team?.short_name || "HOM"}</span>
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
                onChange={e => setPeriod(parseInt(e.target.value || "1"))}
              />
            </label>
            <label className="block">
              <div>Time (MM:SS)</div>
              <input
                type="text"
                className="border p-2 w-full"
                value={mmss}
                onChange={e => setMMSS(e.target.value)}
                placeholder="00:00"
              />
            </label>
            <label className="block md:col-span-3">
              <div>Scorer</div>
              <select
                className="border p-2 w-full"
                value={scorerId}
                onChange={e => setScorerId(e.target.value)}
              >
                <option value="">-- choose --</option>
                {teamPlayers.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div>Assist 1 (optional)</div>
              <select
                className="border p-2 w-full"
                value={assist1Id}
                onChange={e => setAssist1Id(e.target.value)}
              >
                <option value="">-- none --</option>
                {teamPlayers.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </label>

            <label className="block">
              <div>Assist 2 (optional)</div>
              <select
                className="border p-2 w-full"
                value={assist2Id}
                onChange={e => setAssist2Id(e.target.value)}
              >
                <option value="">-- none --</option>
                {teamPlayers.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </label>
          </div>

          <button className="bg-black text-white px-4 py-2 rounded" onClick={saveGoal}>
            Save goal
          </button>
        </section>
      )}

      {/* Current goals with trash */}
      {!!selectedGame && (
        <section className="space-y-2">
          <h2 className="font-semibold">
            Current goals — {selectedGame.away_team?.name} vs {selectedGame.home_team?.name}
          </h2>

          {goalLines.length === 0 ? (
            <div className="text-sm text-gray-600">No goals yet.</div>
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
                {goalLines.map(gl => (
                  <tr key={gl.key} className="border-t">
                    <td className="p-2">{gl.period}</td>
                    <td className="p-2">{gl.time_mmss}</td>
                    <td className="p-2">{gl.team_short || "-"}</td>
                    <td className="p-2">
                      {gl.scorer || "—"}
                      {gl.assists.length > 0 && (
                        <span className="text-gray-600">
                          {"  "}ASS: {gl.assists.join(", ")}
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

function TeamSelect({
  teams, value, onChange,
}: { teams: Team[]; value: string; onChange: (v: string) => void }) {
  return (
    <select className="border p-2 w-full" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">-- choose --</option>
      {teams.map(t => (
        <option key={t.id} value={t.id}>
          {(t.short_name || t.name) + " — " + t.name}
        </option>
      ))}
    </select>
  );
}
