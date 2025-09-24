import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Team = { id: string; name: string };
type Player = { id: string; name: string; team_id: string };
type Game = { id: string; slug: string; game_date: string; home_team_id: string; away_team_id: string };

export default function Scorer() {
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameId, setGameId] = useState<string>("");
  const [teamId, setTeamId] = useState<string>("");
  const [period, setPeriod] = useState<number>(1);
  const [time, setTime] = useState<string>("00:00");
  const [scorerId, setScorerId] = useState<string>("");
  const [assist1Id, setAssist1Id] = useState<string>("");
  const [assist2Id, setAssist2Id] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: g } = await supabase.from("games").select("id, slug, game_date, home_team_id, away_team_id").order("game_date", { ascending: false });
      const { data: t } = await supabase.from("teams").select("id, name").order("name");
      const { data: p } = await supabase.from("players").select("id, name, team_id").order("name");
      setGames((g ?? []) as Game[]);
      setTeams((t ?? []) as Team[]);
      setPlayers((p ?? []) as Player[]);
    })();
  }, []);

  const teamPlayers = players.filter(p => p.team_id === teamId);

  async function savePlay() {
    try {
      setSaving(true);
      setMsg("");
      if (!gameId || !teamId || !scorerId) {
        setMsg("Choisissez match, équipe et marqueur.");
        setSaving(false);
        return;
      }
      const playId = crypto.randomUUID(); // same id for goal + assists

      const rows = [
        { game_id: gameId, team_id: teamId, player_id: scorerId, period, time_mmss: time, event: "goal", play_id: playId },
      ];
      if (assist1Id) rows.push({ game_id: gameId, team_id: teamId, player_id: assist1Id, period, time_mmss: time, event: "assist", play_id: playId });
      if (assist2Id) rows.push({ game_id: gameId, team_id: teamId, player_id: assist2Id, period, time_mmss: time, event: "assist", play_id: playId });

      const { error } = await supabase.from("events").insert(rows);
      if (error) throw error;
      setMsg("Jeu enregistré ✅");
      // reset assists only
      setAssist1Id(""); setAssist2Id("");
    } catch (e: any) {
      setMsg(`Erreur: ${e.message ?? e}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Feuille de match (Live)</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="flex flex-col">
          <span className="text-sm text-gray-600">Match</span>
          <select className="border p-2 rounded" value={gameId} onChange={e=>setGameId(e.target.value)}>
            <option value="">—</option>
            {games.map(g => (
              <option key={g.id} value={g.id}>{g.slug}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-600">Équipe</span>
          <select className="border p-2 rounded" value={teamId} onChange={e=>setTeamId(e.target.value)}>
            <option value="">—</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-600">Période</span>
          <input className="border p-2 rounded" type="number" min={1} max={3} value={period} onChange={e=>setPeriod(parseInt(e.target.value||"1"))}/>
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-600">Temps (MM:SS)</span>
          <input className="border p-2 rounded" value={time} onChange={e=>setTime(e.target.value)} placeholder="08:30"/>
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-600">Buteur</span>
          <select className="border p-2 rounded" value={scorerId} onChange={e=>setScorerId(e.target.value)}>
            <option value="">—</option>
            {teamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-600">Assistance 1 (optionnel)</span>
          <select className="border p-2 rounded" value={assist1Id} onChange={e=>setAssist1Id(e.target.value)}>
            <option value="">—</option>
            {teamPlayers.filter(p=>p.id!==scorerId && p.id!==assist2Id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-sm text-gray-600">Assistance 2 (optionnel)</span>
          <select className="border p-2 rounded" value={assist2Id} onChange={e=>setAssist2Id(e.target.value)}>
            <option value="">—</option>
            {teamPlayers.filter(p=>p.id!==scorerId && p.id!==assist1Id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>

      <button className="px-4 py-2 rounded bg-black text-white" disabled={saving} onClick={savePlay}>
        {saving ? "Enregistrement…" : "Enregistrer le jeu"}
      </button>

      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
