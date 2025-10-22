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
  home_score: number | null;
  away_score: number | null;
  went_ot: boolean | null;
};

type EventRow = {
  id: string;
  game_id: string;
  event: "goal" | "assist";
  period: number;
  time_mmss: string;
  team_id: string;     // <- no embedding
  player_id: string;   // <- no embedding
  created_by: string | null;
};

type GoalLine = {
  key: string; // period|time|team_id
  period: number;
  time_mmss: string;
  team_id: string;
  team_short: string;
  team_name: string;
  goalId?: string;
  goalPlayerName?: string;
  assistIds: string[];
  assistNames: string[];
};

function fmtTeam(t: Team | undefined) {
  if (!t) return { short: "", name: "" };
  return { short: t.short_name ?? "", name: t.name };
}

export default function Scorer() {
  const [userId, setUserId] = useState<string>("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [msg, setMsg] = useState("");

  // new game form
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [awayId, setAwayId] = useState("");
  const [homeId, setHomeId] = useState("");

  // goal form
  const [teamSide, setTeamSide] = useState<"away" | "home">("away");
  const [period, setPeriod] = useState<number>(1);
  const [mmss, setMMSS] = useState<string>("00:00");
  const [scorerId, setScorerId] = useState("");
  const [assist1Id, setAssist1Id] = useState("");
  const [assist2Id, setAssist2Id] = useState("");

  // maps
  const teamMap = useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

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
    const result = new Map<string, GoalLine>();
    for (const e of events) {
      const key = `${e.period}|${e.time_mmss}|${e.team_id}`;
      if (!result.has(key)) {
        const t = teamMap.get(e.team_id);
        const { short, name } = fmtTeam(t);
        result.set(key, {
          key,
          period: e.period,
          time_mmss: e.time_mmss,
          team_id: e.team_id,
          team_short: short,
          team_name: name,
          assistIds: [],
          assistNames: [],
        });
      }
      const node = result.get(key)!;
      if (e.event === "goal") {
        node.goalId = e.id;
        node.goalPlayerName = playerMap.get(e.player_id)?.name ?? "";
      } else if (e.event === "assist") {
        node.assistIds.push(e.id);
        const nm = playerMap.get(e.player_id)?.name;
        if (nm) node.assistNames.push(nm);
      }
    }
    return Array.from(result.values()).sort((a, b) => {
      if (a.period !== b.period) return a.period - b.period;
      return a.time_mmss.localeCompare(b.time_mmss);
    });
  }, [events, playerMap, teamMap]);

  // ------------ loaders
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u?.user) setUserId(u.user.id);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      // teams / players (flat)
      const [t, p] = await Promise.all([
        supabase.from("teams").select("id,name,short_name").order("name"),
        supabase.from("players").select("id,name,team_id").order("name"),
      ]);
      if (!t.error && t.data) setTeams(t.data as Team[]);
      if (!p.error && p.data) setPlayers(p.data as Player[]);
    })();
  }, []);

  async function refreshGames(selectId?: string) {
    const { data, error } = await supabase
      .from("games")
      .select("id, slug, game_date, status, home_team_id, away_team_id, home_score, away_score, went_ot")
      .order("game_date", { ascending: false })
      .limit(200);
    if (!error && data) {
      setGames(data as Game[]);
      if (selectId) setSelectedGameId(selectId);
    } else if (error) {
      setMsg(error.message);
    }
  }

  useEffect(() => { refreshGames(); }, []);

  useEffect(() => {
    if (!selectedGame) {
      setEvents([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, game_id, event, period, time_mmss, team_id, player_id, created_by")
        .eq("game_id", selectedGame.id)
        .order("period", { ascending: true })
        .order("time_mmss", { ascending: true });
      if (!error && data) setEvents(data as EventRow[]);
      else if (error) setMsg(error.message);
    })();
  }, [selectedGameId]); // eslint-disable-line

  // ------------ create game
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

      const awayShort = teamMap.get(awayId)?.short_name || "AWY";
      const homeShort = teamMap.get(homeId)?.short_name || "HOM";
      const slug = `${awayShort}_vs_${homeShort}_${yyyy}-${mm}-${dd}_game_1`;

      const { data, error } = await supabase
        .from("games")
        .insert({
          slug,
          game_date: dt.toISOString(),
          status: "scheduled",
          away_team_id: awayId,
          home_team_id: homeId,
          // created_by is auto-filled by our trigger
        })
        .select("id")
        .single();

      if (error) throw error;
      setMsg(`Created game ${slug}`);
      await refreshGames(data!.id);
    } catch (e: any) {
      setMsg(e.message ?? "Create failed");
    }
  }

  async function markFinal(final: boolean) {
    if (!selectedGame) return;
    const nextStatus = final ? "final" : "scheduled";
    const { error } = await supabase.from("games").update({ status: nextStatus }).eq("id", selectedGame.id);
    if (!error) {
      setGames(games.map(g => g.id === selectedGame.id ? { ...g, status: nextStatus as Game["status"] } : g));
      setMsg(final ? "Game marked FINAL" : "Game set to SCHEDULED");
    } else setMsg(error.message);
  }

  // ------------ save goal
  async function saveGoal() {
    try {
      setMsg("");
      if (!selectedGame) { setMsg("Pick a game first."); return; }
      if (!scorerId) { setMsg("Pick a scorer."); return; }
      if (!/^\d{2}:\d{2}$/.test(mmss)) { setMsg("Time must be MM:SS"); return; }

      const team_id = selectedTeamId;
      const base = {
        game_id: selectedGame.id,
        team_id,
        period,
        time_mmss: mmss,
      };

      const { error: gErr } = await supabase.from("events").insert([{ ...base, event: "goal", player_id: scorerId }]);
      if (gErr) throw gErr;

      const assists: any[] = [];
      if (assist1Id) assists.push({ ...base, event: "assist", player_id: assist1Id });
      if (assist2Id) assists.push({ ...base, event: "assist", player_id: assist2Id });
      if (assists.length) {
        const { error: aErr } = await supabase.from("events").insert(assists);
        if (aErr) throw aErr;
      }

      setAssist1Id(""); setAssist2Id("");
      await refreshEventsForSelected();
      setMsg("Saved goal.");
    } catch (e: any) {
      setMsg(e.message ?? "Save failed");
    }
  }

  async function refreshEventsForSelected() {
    if (!selectedGame) return;
    const { data } = await supabase
      .from("events")
      .select("id, game_id, event, period, time_mmss, team_id, player_id, created_by")
      .eq("game_id", selectedGame.id)
      .order("period")
      .order("time_mmss");
    setEvents((data ?? []) as EventRow[]);
  }

  // delete a goal line (goal + assists at same stamp)
  async function deleteGoalLine(gl: GoalLine) {
    if (!selectedGame) return;
    if (!window.confirm(`Delete goal at ${gl.time_mmss} (per ${gl.period}) for ${gl.team_name}?`)) return;

    const ids: string[] = [];
    if (gl.goalId) ids.push(gl.goalId);
    ids.push(...gl.assistIds);
    if (!ids.length) return;

    const { error } = await supabase.from("events").delete().in("id", ids);
    if (!error) await refreshEventsForSelected();
    else setMsg(error.message);
  }

  const homeTeam = selectedGame ? teamMap.get(selectedGame.home_team_id) : undefined;
  const awayTeam = selectedGame ? teamMap.get(selectedGame.away_team_id) : undefined;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Scorer</h1>
      {msg && <div className="text-sm text-red-600">{msg}</div>}

      {/* create game */}
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
            <select className="border p-2 w-full" value={awayId} onChange={e => setAwayId(e.target.value)}>
              <option value="">-- choose --</option>
              {teams.map(t => <option key={t.id} value={t.id}>{(t.short_name || t.name) + " — " + t.name}</option>)}
            </select>
          </label>
          <label className="block">
            <div>Home team</div>
            <select className="border p-2 w-full" value={homeId} onChange={e => setHomeId(e.target.value)}>
              <option value="">-- choose --</option>
              {teams.map(t => <option key={t.id} value={t.id}>{(t.short_name || t.name) + " — " + t.name}</option>)}
            </select>
          </label>
        </div>
        <button className="bg-black text-white px-4 py-2 rounded" onClick={createGame}>Create game</button>
      </section>

      {/* choose game */}
      <section className="space-y-3">
        <label className="block">
          <div className="font-semibold">Game (slug)</div>
          <select className="border p-2 w-full" value={selectedGameId} onChange={e => setSelectedGameId(e.target.value)}>
            <option value="">-- choose --</option>
            {games.map(g => (<option key={g.id} value={g.id}>{g.slug}</option>))}
          </select>
        </label>
        {!!selectedGame && (
          <div className="text-sm">
            Status: <span className="font-semibold">{selectedGame.status}</span>
            {selectedGame.status !== "final" ? (
              <button className="underline ml-2" onClick={() => markFinal(true)}>Mark FINAL</button>
            ) : (
              <button className="underline ml-2" onClick={() => markFinal(false)}>Set SCHEDULED</button>
            )}
          </div>
        )}
      </section>

      {/* goal entry */}
      {!!selectedGame && (
        <section className="space-y-4">
          <div className="flex gap-6 items-center">
            <label className="flex items-center gap-2">
              <input type="radio" checked={teamSide === "away"} onChange={() => setTeamSide("away")} />
              <span>{awayTeam?.short_name || awayTeam?.name || "AWAY"}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={teamSide === "home"} onChange={() => setTeamSide("home")} />
              <span>{homeTeam?.short_name || homeTeam?.name || "HOME"}</span>
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

          <button className="bg-black text-white px-4 py-2 rounded" onClick={saveGoal}>Save goal</button>
        </section>
      )}

      {/* current goals */}
      {!!selectedGame && (
        <section className="space-y-2">
          <h2 className="font-semibold">
            Current goals — {awayTeam?.name} vs {homeTeam?.name}
          </h2>

          {goalLines.length === 0 ? (
            <div className="text-sm text-gray-600">No goals yet for this game.</div>
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
                      {gl.goalPlayerName || "—"}
                      {gl.assistNames.length > 0 && (
                        <span className="text-gray-600">
                          {"  "}ASS: {gl.assistNames.join(", ")}
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
