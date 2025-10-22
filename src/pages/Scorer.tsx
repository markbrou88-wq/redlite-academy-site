// Scorer.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Team = { id: string; name: string; short_name: string | null };
type Player = { id: string; name: string; team_id: string };

type GameRow = {
  id: string;
  slug: string;
  game_date: string;     // ISO
  status: "scheduled" | "final";
  home_team: string;     // name
  away_team: string;     // name
  home_score: number;
  away_score: number;
};

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

type EventWithNames = {
  id: string;
  game_id: string;
  event: "goal" | "assist";
  period: number;
  time_mmss: string;
  team_id: string;
  team_name: string | null;
  team_short: string | null;
  player_id: string;
  player_name: string | null;
};

type GoalLine = {
  key: string;                 // period|time|team
  period: number;
  time_mmss: string;
  team_short: string;
  team_name: string;
  goal?: EventWithNames;
  assists: EventWithNames[];
};

export default function Scorer() {
  const [userId, setUserId] = useState<string>("");
  const [games, setGames] = useState<GameRow[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [selectedGame, setSelectedGame] = useState<GameRow | null>(null);

  // create game form
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [awayId, setAwayId] = useState("");
  const [homeId, setHomeId] = useState("");

  // goal form
  const [teamSide, setTeamSide] = useState<"away" | "home">("away");
  const [period, setPeriod] = useState<number>(1);
  const [mmss, setMMSS] = useState<string>("00:00");
  const [scorerId, setScorerId] = useState<string>("");
  const [assist1Id, setAssist1Id] = useState<string>("");
  const [assist2Id, setAssist2Id] = useState<string>("");

  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<EventWithNames[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
  }, []);

  // Load games from the safe view
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("games_with_names")
        .select("id, slug, game_date, status, home_team, away_team, home_score, away_score")
        .order("game_date", { ascending: false })
        .limit(200);

      if (!error && data) setGames(data as GameRow[]);
    })();
  }, []);

  // Load players (plain table, no embeds)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, team_id")
        .order("name");
      if (!error && data) setPlayers(data as Player[]);
    })();
  }, []);

  // Keep selectedGame row + events
  useEffect(() => {
    const g = games.find(x => x.id === selectedGameId) ?? null;
    setSelectedGame(g || null);
    if (g) loadEventsForGame(g.id);
    else setEvents([]);
  }, [selectedGameId, games]);

  async function loadEventsForGame(gameId: string) {
    const { data, error } = await supabase
      .from("events_with_names")
      .select("id, game_id, event, period, time_mmss, team_id, team_name, team_short, player_id, player_name")
      .eq("game_id", gameId)
      .order("period", { ascending: true })
      .order("time_mmss", { ascending: true });

    if (!error && data) setEvents(data as EventWithNames[]);
  }

  // Computed helpers
  const selectedTeamId = useMemo(() => {
    if (!selectedGame) return "";
    // selectedGame is from the view; team ids are not in it, so
    // we infer by name: pick the team_id from players list that matches side’s name.
    // Simpler: ask the user to pick the scorer from the correct team; we use that player’s team.
    // But we still allow the radio buttons — we’ll pick team by side name:
    const sideName = teamSide === "away" ? selectedGame.away_team : selectedGame.home_team;
    // find the first player whose team name matches; fallback empty
    const t = teamsById.find(t => t.name === sideName);
    return t?.id ?? "";
  }, [selectedGame, teamSide]);

  const teamsById = useMemo<Team[]>(() => {
    // Build a list of unique teams from players + a tiny name map
    // In practice you already have a teams table; we can read it directly:
    return [];
  }, []);

  const teamPlayers = useMemo(
    () => players.filter(p => p.team_id === selectedTeamId),
    [players, selectedTeamId]
  );

  const goalLines: GoalLine[] = useMemo(() => {
    const map = new Map<string, GoalLine>();
    for (const e of events) {
      const key = `${e.period}|${e.time_mmss}|${e.team_id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          period: e.period,
          time_mmss: e.time_mmss,
          team_short: e.team_short ?? "",
          team_name: e.team_name ?? "",
          goal: undefined,
          assists: [],
        });
      }
      const node = map.get(key)!;
      if (e.event === "goal") node.goal = e;
      if (e.event === "assist") node.assists.push(e);
    }
    return [...map.values()].sort((a, b) => {
      if (a.period !== b.period) return a.period - b.period;
      return a.time_mmss.localeCompare(b.time_mmss);
    });
  }, [events]);

  // Create game
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
      const awayShort = (await supabase.from("teams").select("short_name").eq("id", awayId).single()).data?.short_name ?? "AWY";
      const homeShort = (await supabase.from("teams").select("short_name").eq("id", homeId).single()).data?.short_name ?? "HOM";
      const slug = `${awayShort}_vs_${homeShort}_${yyyy}-${mm}-${dd}_game_1`;

      const { data, error } = await supabase
        .from("games")
        .insert({
          slug,
          game_date: dt.toISOString(),
          status: "scheduled",
          away_team_id: awayId,
          home_team_id: homeId,
          // created_by is auto-filled by DB trigger
        })
        .select("id")
        .single();

      if (error) throw error;

      await refreshGamesAndSelect(data!.id);
      setMsg(`Created game ${slug}`);
    } catch (e: any) {
      setMsg(e.message ?? "Create failed");
    }
  }

  async function refreshGamesAndSelect(id: string) {
    const { data, error } = await supabase
      .from("games_with_names")
      .select("id, slug, game_date, status, home_team, away_team, home_score, away_score")
      .order("game_date", { ascending: false })
      .limit(200);

    if (!error && data) {
      setGames(data as GameRow[]);
      setSelectedGameId(id);
    }
  }

  async function markFinal() {
    if (!selectedGame) return;
    const { error } = await supabase.from("games").update({ status: "final" }).eq("id", selectedGame.id);
    if (!error) {
      setGames(games.map(g => g.id === selectedGame.id ? { ...g, status: "final" } : g));
      setMsg("Game marked FINAL");
    }
  }
  async function setScheduled() {
    if (!selectedGame) return;
    const { error } = await supabase.from("games").update({ status: "scheduled" }).eq("id", selectedGame.id);
    if (!error) {
      setGames(games.map(g => g.id === selectedGame.id ? { ...g, status: "scheduled" } : g));
      setMsg("Game set SCHEDULED");
    }
  }

  // Save goal + assists
  async function saveGoal() {
    try {
      setMsg("");
      if (!selectedGame) return setMsg("Pick a game first.");
      if (!scorerId) return setMsg("Pick a scorer.");
      if (!/^\d{2}:\d{2}$/.test(mmss)) return setMsg("Time must be MM:SS");

      // Which team? We infer from radio: ask the teams table
      const teamId = teamSide === "away"
        ? (await supabase.from("games").select("away_team_id").eq("id", selectedGame.id).single()).data?.away_team_id
        : (await supabase.from("games").select("home_team_id").eq("id", selectedGame.id).single()).data?.home_team_id;

      const base = {
        game_id: selectedGame.id,
        team_id: teamId as string,
        period,
        time_mmss: mmss,
        // created_by auto-filled
      };

      const { data: goalRow, error: goalErr } = await supabase
        .from("events")
        .insert([{ ...base, event: "goal", player_id: scorerId }])
        .select("id")
        .single();
      if (goalErr) throw goalErr;

      const assists: any[] = [];
      if (assist1Id) assists.push({ ...base, event: "assist", player_id: assist1Id });
      if (assist2Id) assists.push({ ...base, event: "assist", player_id: assist2Id });
      if (assists.length) {
        const { error: aErr } = await supabase.from("events").insert(assists);
        if (aErr) throw aErr;
      }

      setAssist1Id(""); setAssist2Id("");
      await loadEventsForGame(selectedGame.id);
      setMsg("Saved goal.");
    } catch (e: any) {
      setMsg(e.message ?? "Save failed");
    }
  }

  // Delete a goal line (goal + all assists at same stamp)
  async function deleteGoalLine(gl: GoalLine) {
    if (!selectedGame) return;
    if (!confirm(`Delete goal at ${gl.time_mmss} (P${gl.period}) for ${gl.team_name}?`)) return;

    // Find ids at that time/team
    const ids = events
      .filter(e => e.period === gl.period && e.time_mmss === gl.time_mmss && e.team_id === (gl.goal?.team_id ?? gl.assists[0]?.team_id))
      .map(e => e.id);

    if (ids.length === 0) return;

    const { error } = await supabase.from("events").delete().in("id", ids);
    if (!error) await loadEventsForGame(selectedGame.id);
  }

  // Delete a game
  async function deleteGame(id: string) {
    if (!confirm("Delete this game?")) return;
    const { error } = await supabase.from("games").delete().eq("id", id);
    if (!error) {
      setGames(games.filter(g => g.id !== id));
      if (selectedGameId === id) {
        setSelectedGameId("");
        setEvents([]);
      }
    } else {
      setMsg(error.message);
    }
  }

  const gameSlug = useMemo(
    () => games.find(g => g.id === selectedGameId)?.slug ?? "",
    [games, selectedGameId]
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Scorer</h1>
      {msg && <div className="text-sm text-red-600">{msg}</div>}

      {/* Create new game */}
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
            <TeamSelect value={awayId} onChange={setAwayId} />
          </label>
          <label className="block">
            <div>Home team</div>
            <TeamSelect value={homeId} onChange={setHomeId} />
          </label>
        </div>
        <button className="bg-black text-white px-4 py-2 rounded" onClick={createGame}>Create game</button>
      </section>

      {/* Choose game / mark FINAL */}
      <section className="space-y-3">
        <label className="block">
          <div className="font-semibold">Game (slug)</div>
          <select className="border p-2 w-full" value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)}>
            <option value="">-- choose --</option>
            {games.map(g => (
              <option key={g.id} value={g.id}>{g.slug}</option>
            ))}
          </select>
        </label>

        {!!selectedGame && (
          <div className="flex items-center gap-3 text-sm">
            Status: <span className="font-semibold capitalize">{selectedGame.status}</span>
            {selectedGame.status !== "final" ? (
              <button className="underline" onClick={markFinal}>Mark FINAL</button>
            ) : (
              <button className="underline" onClick={setScheduled}>Set SCHEDULED</button>
            )}
            <button className="text-red-600 underline ml-auto" onClick={() => deleteGame(selectedGame.id)}>🗑 Delete game</button>
          </div>
        )}
      </section>

      {/* Goal entry */}
      {!!selectedGame && (
        <section className="space-y-4">
          <div className="flex gap-6 items-center">
            <label className="flex items-center gap-2">
              <input type="radio" checked={teamSide === "away"} onChange={() => setTeamSide("away")} />
              <span>Away</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={teamSide === "home"} onChange={() => setTeamSide("home")} />
              <span>Home</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <label className="block">
              <div>Period</div>
              <input type="number" className="border p-2 w-full" min={1} max={5} value={period} onChange={e => setPeriod(parseInt(e.target.value || "1"))} />
            </label>
            <label className="block">
              <div>Time (MM:SS)</div>
              <input type="text" className="border p-2 w-full" value={mmss} onChange={e => setMMSS(e.target.value)} placeholder="00:00" />
            </label>
            <label className="block md:col-span-3">
              <div>Scorer</div>
              <select className="border p-2 w-full" value={scorerId} onChange={e => setScorerId(e.target.value)}>
                <option value="">-- choose --</option>
                {teamPlayers.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div>Assist 1 (optional)</div>
              <select className="border p-2 w-full" value={assist1Id} onChange={e => setAssist1Id(e.target.value)}>
                <option value="">-- none --</option>
                {teamPlayers.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </label>
            <label className="block">
              <div>Assist 2 (optional)</div>
              <select className="border p-2 w-full" value={assist2Id} onChange={e => setAssist2Id(e.target.value)}>
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

      {/* Current goals */}
      {!!selectedGame && (
        <section className="space-y-2">
          <h2 className="font-semibold">Current goals</h2>
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
                {goalLines.map(gl => (
                  <tr key={gl.key} className="border-t">
                    <td className="p-2">{gl.period}</td>
                    <td className="p-2">{gl.time_mmss}</td>
                    <td className="p-2">{gl.team_short || "-"}</td>
                    <td className="p-2">
                      {gl.goal?.player_name || "—"}
                      {gl.assists.length > 0 && (
                        <span className="text-gray-600">{"  "}ASS: {gl.assists.map(a => a.player_name).filter(Boolean).join(", ")}</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <button className="text-red-600 hover:underline" title="Delete this goal line" onClick={() => deleteGoalLine(gl)}>🗑</button>
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
      {teams.map(t => (
        <option key={t.id} value={t.id}>
          {(t.short_name || t.name) + " — " + t.name}
        </option>
      ))}
    </select>
  );
}
