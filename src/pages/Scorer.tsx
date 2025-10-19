import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Team = { id: string; name: string; short_name: string | null };
type Player = { id: string; name: string; team_id: string; number: number | null };
type GameRow = {
  id: string;
  slug: string;
  game_date: string;
  status: string | null;
  away_team_id: string;
  home_team_id: string;
};
type GoalEvent = {
  id: string;
  game_id: string;
  team_id: string;
  player_id: string;
  period: number;
  time_mmss: string;
  event: "goal" | "assist";
  created_by: string | null;
};
type GoalLine = GoalEvent & { player_name: string | null };

type GoalGroup = {
  period: number;
  time_mmss: string;
  team_id: string;
  lines: GoalLine[];
};

function two(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function ymd(d: Date) { return `${d.getFullYear()}-${two(d.getMonth()+1)}-${two(d.getDate())}`; }
function mmddyyyyDots(d: Date) { return `${two(d.getMonth()+1)}.${two(d.getDate())}.${d.getFullYear()}`; }

function groupGoalLines(lines: GoalLine[]): GoalGroup[] {
  const map = new Map<string, GoalGroup>();
  for (const l of lines) {
    const key = `${l.period}|${l.time_mmss}|${l.team_id}`;
    const g = map.get(key);
    if (g) g.lines.push(l);
    else map.set(key, { period: l.period, time_mmss: l.time_mmss, team_id: l.team_id, lines: [l] });
  }
  return Array.from(map.values()).sort((a, b) => a.period - b.period || a.time_mmss.localeCompare(b.time_mmss));
}

export default function Scorer() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const teamMap = useMemo(() => { const m = new Map<string, Team>(); teams.forEach(t => m.set(t.id, t)); return m; }, [teams]);

  const [games, setGames] = useState<GameRow[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");

  const [period, setPeriod] = useState<number>(1);
  const [time, setTime] = useState<string>("00:00");
  const [teamSide, setTeamSide] = useState<"away"|"home">("away");
  const [scorerId, setScorerId] = useState<string>("");
  const [assist1Id, setAssist1Id] = useState<string>("");
  const [assist2Id, setAssist2Id] = useState<string>("");

  const [ngDate, setNgDate] = useState<string>(ymd(new Date()));
  const [ngTime, setNgTime] = useState<string>("16:00");
  const [ngAwayId, setNgAwayId] = useState<string>("");
  const [ngHomeId, setNgHomeId] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const [currentGoals, setCurrentGoals] = useState<GoalLine[]>([]);

  useEffect(() => { (async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) { navigate("/signin", { replace: true }); return; }
    setUserId(data.user.id);
  })(); }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setMsg("");
      const [{ data: tData, error: tErr }, { data: pData, error: pErr }, { data: gData, error: gErr }] =
        await Promise.all([
          supabase.from("teams").select("id,name,short_name").order("name"),
          supabase.from("players").select("id,name,team_id,number").order("name"),
          supabase.from("games").select("id,slug,game_date,status,away_team_id,home_team_id").order("game_date", { ascending: false }),
        ]);
      if (tErr) setMsg(tErr.message);
      if (pErr) setMsg(pErr.message);
      if (gErr) setMsg(gErr.message);
      if (tData) setTeams(tData as Team[]);
      if (pData) setPlayers(pData as Player[]);
      if (gData) setGames(gData as GameRow[]);
    })();
  }, [userId]);

  const selectedGame = useMemo(() => games.find(g => g.slug === selectedSlug), [games, selectedSlug]);

  const selectedTeamId = useMemo(() => {
    if (!selectedGame) return "";
    return teamSide === "away" ? selectedGame.away_team_id : selectedGame.home_team_id;
  }, [selectedGame, teamSide]);

  const teamPlayers = useMemo(() => players.filter(p => p.team_id === selectedTeamId), [players, selectedTeamId]);

  useEffect(() => { if (!selectedGame) { setCurrentGoals([]); return; } refreshGoals(); }, [selectedGame?.id]);

  async function refreshGoals() {
    if (!selectedGame) return;
    const { data, error } = await supabase
      .from("events")
      .select(`id, game_id, team_id, player_id, period, time_mmss, event, created_by, player:player_id(name)`)
      .eq("game_id", selectedGame.id)
      .order("period", { ascending: true })
      .order("time_mmss", { ascending: true });
    if (error) { setMsg(error.message); return; }
    const lines: GoalLine[] = (data as any[])?.map(r => ({ ...r, player_name: r.player?.name ?? null })) ?? [];
    setCurrentGoals(lines);
  }

  async function handleSaveGoal() {
    setMsg("");
    if (!selectedGame) { setMsg("Pick a game."); return; }
    if (!userId) { setMsg("Not authenticated."); return; }
    if (!/^\d{2}:\d{2}$/.test(time)) { setMsg("Time must be MM:SS."); return; }
    if (!scorerId) { setMsg("Choose a scorer."); return; }

    setSaving(true);
    try {
      const goalRow = { game_id: selectedGame.id, team_id: selectedTeamId, player_id: scorerId, period, time_mmss: time, event: "goal" as const, created_by: userId };
      const { error: gErr } = await supabase.from("events").insert(goalRow);
      if (gErr) throw gErr;

      const assists: GoalEvent[] = [];
      if (assist1Id) assists.push({ id: "" as any, game_id: selectedGame.id, team_id: selectedTeamId, player_id: assist1Id, period, time_mmss: time, event: "assist", created_by: userId });
      if (assist2Id) assists.push({ id: "" as any, game_id: selectedGame.id, team_id: selectedTeamId, player_id: assist2Id, period, time_mmss: time, event: "assist", created_by: userId });
      if (assists.length) {
        const { error: aErr } = await supabase.from("events").insert(assists);
        if (aErr) throw aErr;
      }

      setMsg("Saved!");
      await refreshGoals();
      setAssist1Id("");
      setAssist2Id("");
    } catch (e: any) { setMsg(e.message ?? "Could not save goal."); }
    finally { setSaving(false); }
  }

  async function handleDeleteLine(eventId: string) {
    if (!selectedGame) return;
    setSaving(true);
    setMsg("");
    try {
      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw error;
      await refreshGoals();
      setMsg("Event deleted.");
    } catch (e: any) { setMsg(e.message ?? "Could not delete event."); }
    finally { setSaving(false); }
  }

  async function handleCreateGame() {
    setMsg("");
    if (!ngAwayId || !ngHomeId) { setMsg("Pick away and home teams."); return; }
    const localDateTime = new Date(`${ngDate}T${ngTime}`);
    const labelDate = mmddyyyyDots(localDateTime);
    const dayKey = ymd(localDateTime);
    const sameDayCount = games.filter(g => g.game_date.slice(0, 10) === dayKey).length + 1;
    const slug = `${ngAwayId}_vs_${ngHomeId}_${labelDate}_game_${sameDayCount}`;
    try {
      setSaving(true);
      const insertRow = { slug, game_date: localDateTime.toISOString(), status: "scheduled", away_team_id: ngAwayId, home_team_id: ngHomeId };
      const { data, error } = await supabase.from("games").insert(insertRow).select("id,slug,game_date,status,away_team_id,home_team_id").single();
      if (error) throw error;
      setGames(prev => [data as GameRow, ...prev]);
      setSelectedSlug((data as GameRow).slug);
      setMsg("Game created.");
    } catch (e: any) { setMsg(e.message ?? "Could not create game."); }
    finally { setSaving(false); }
  }

  async function handleMarkFinal() {
    if (!selectedGame) return;
    setSaving(true);
    setMsg("");
    try {
      const { error } = await supabase.from("games").update({ status: "final" }).eq("id", selectedGame.id);
      if (error) throw error;
      setGames(prev => prev.map(g => (g.id === selectedGame.id ? { ...g, status: "final" } : g)));
      setMsg("Game marked as FINAL.");
    } catch (e: any) { setMsg(e.message ?? "Could not mark final."); }
    finally { setSaving(false); }
  }

  const selectedGameRow = useMemo(() => games.find(g => g.slug === selectedSlug), [games, selectedSlug]);
  const grouped = useMemo(() => groupGoalLines(currentGoals), [currentGoals]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Scorer</h1>
      {msg && <div className="text-sm">{msg}</div>}

      {/* New game */}
      <section className="border rounded p-4 space-y-3">
        <h2 className="font-semibold">New game</h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <label className="md:col-span-2">
            <div className="text-sm font-medium">Date</div>
            <input type="date" className="border p-2 w-full" value={ngDate} onChange={(e) => setNgDate(e.target.value)} />
          </label>
          <label className="md:col-span-2">
            <div className="text-sm font-medium">Time</div>
            <input type="time" className="border p-2 w-full" value={ngTime} onChange={(e) => setNgTime(e.target.value)} />
          </label>
          <label className="md:col-span-4">
            <div className="text-sm font-medium">Away team</div>
            <select className="border p-2 w-full" value={ngAwayId} onChange={(e) => setNgAwayId(e.target.value)}>
              <option value="">-- choose --</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.id} — {t.name}</option>)}
            </select>
          </label>
          <label className="md:col-span-4">
            <div className="text-sm font-medium">Home team</div>
            <select className="border p-2 w-full" value={ngHomeId} onChange={(e) => setNgHomeId(e.target.value)}>
              <option value="">-- choose --</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.id} — {t.name}</option>)}
            </select>
          </label>
        </div>
        <button className="bg-black text-white px-4 py-2 rounded disabled:opacity-50" onClick={handleCreateGame} disabled={saving}>
          Create game
        </button>
      </section>

      {/* Pick game by slug */}
      <section className="space-y-3">
        <label className="block">
          <div className="font-semibold">Game (slug)</div>
          <select className="border p-2 w-full" value={selectedSlug} onChange={(e) => setSelectedSlug(e.target.value)}>
            <option value="">-- choose --</option>
            {games.map((g) => <option key={g.id} value={g.slug}>{g.slug}</option>)}
          </select>
        </label>

        {selectedGameRow && (
          <div className="flex gap-6 items-center">
            <label className="flex items-center gap-2">
              <input type="radio" checked={teamSide === "away"} onChange={() => setTeamSide("away")} />
              <span>{selectedGameRow.away_team_id}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={teamSide === "home"} onChange={() => setTeamSide("home")} />
              <span>{selectedGameRow.home_team_id}</span>
            </label>

            <div className="ml-auto text-sm">Status: <span className="font-medium">{selectedGameRow.status ?? "scheduled"}</span></div>
            <button className="text-sm underline" onClick={handleMarkFinal} disabled={!selectedGameRow || saving} title="Mark this game as FINAL">
              Mark FINAL
            </button>
          </div>
        )}
      </section>

      {/* Event entry */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <label className="md:col-span-2">
            <div className="text-sm font-medium">Period</div>
            <input type="number" className="border p-2 w-full" value={period} min={1} max={9} onChange={(e) => setPeriod(Number(e.target.value))} />
          </label>
          <label className="md:col-span-2">
            <div className="text-sm font-medium">Time (MM:SS)</div>
            <input type="text" className="border p-2 w-full" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>

        <label className="block">
          <div className="text-sm font-medium">Scorer</div>
          <select className="border p-2 w-full" value={scorerId} onChange={(e) => setScorerId(e.target.value)} disabled={!selectedTeamId}>
            <option value="">-- choose --</option>
            {teamPlayers.map((p) => <option key={p.id} value={p.id}>{p.name} {p.number ? `(#${p.number})` : ""}</option>)}
          </select>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm font-medium">Assist 1 (optional)</div>
            <select className="border p-2 w-full" value={assist1Id} onChange={(e) => setAssist1Id(e.target.value)} disabled={!selectedTeamId}>
              <option value="">-- none --</option>
              {teamPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-sm font-medium">Assist 2 (optional)</div>
            <select className="border p-2 w-full" value={assist2Id} onChange={(e) => setAssist2Id(e.target.value)} disabled={!selectedTeamId}>
              <option value="">-- none --</option>
              {teamPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>

        <button className="bg-black text-white px-4 py-2 rounded disabled:opacity-50" onClick={handleSaveGoal} disabled={saving || !selectedGameRow}>
          Save goal
        </button>
      </section>

      {/* Current goals (line-by-line delete) */}
      {selectedGameRow && (
        <section className="space-y-3">
          <h3 className="font-semibold">
            Current goals — {teamMap.get(selectedGameRow.away_team_id)?.name ?? selectedGameRow.away_team_id} vs{" "}
            {teamMap.get(selectedGameRow.home_team_id)?.name ?? selectedGameRow.home_team_id}
          </h3>

          {currentGoals.length === 0 ? (
            <div className="text-sm text-gray-600">No goals saved yet for this game.</div>
          ) : (
            groupGoalLines(currentGoals).map((grp) => (
              <div key={`${grp.period}-${grp.time_mmss}-${grp.team_id}`} className="border rounded p-2">
                <div className="font-medium mb-1">[{grp.period}] {grp.time_mmss} — {grp.team_id}</div>
                <ul className="text-sm">
                  {grp.lines.map((l) => (
                    <li key={l.id} className="flex items-center justify-between py-1 border-t first:border-t-0">
                      <div>
                        {l.event.toUpperCase()}: {l.player_name ?? l.player_id}
                      </div>
                      <button
                        className="text-red-600 hover:underline"
                        title="Delete this event"
                        onClick={() => handleDeleteLine(l.id)}
                        disabled={saving}
                      >
                        🗑
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
