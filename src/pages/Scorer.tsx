// src/pages/Scorer.tsx
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

interface EventRow {
  id: string;
  game_id: string;
  team_id: string;
  period: number;
  time_mmss: string;
  event: string;
  player_id: string;
  assist1_id?: string | null;
  assist2_id?: string | null;
  player?: string;
  assist1?: string | null;
  assist2?: string | null;
  team?: string;
}

export default function Scorer() {
  const [games, setGames] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [team, setTeam] = useState<string>("RLR");
  const [period, setPeriod] = useState<number>(1);
  const [time, setTime] = useState<string>("00:00");
  const [scorer, setScorer] = useState<string>("");
  const [assist1, setAssist1] = useState<string | null>(null);
  const [assist2, setAssist2] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("scheduled");

  // load games
  useEffect(() => {
    const fetchGames = async () => {
      const { data } = await supabase.from("games").select("*").order("game_date", { ascending: false });
      setGames(data ?? []);
    };
    fetchGames();
  }, []);

  // load events for game
  useEffect(() => {
    if (!selectedGame) return;
    const fetchEvents = async () => {
      const { data } = await supabase
        .from("events")
        .select("*, players(name), team_id")
        .eq("game_id", selectedGame)
        .order("period", { ascending: true })
        .order("time_mmss", { ascending: true });
      setEvents(data ?? []);
    };
    fetchEvents();
  }, [selectedGame]);

  // load players
  useEffect(() => {
    const fetchPlayers = async () => {
      const { data } = await supabase.from("players").select("*").order("team_id");
      setPlayers(data ?? []);
    };
    fetchPlayers();
  }, []);

  const handleSaveGoal = async () => {
    if (!selectedGame || !scorer) return alert("Please select a game and scorer");

    const user = await supabase.auth.getUser();
    const createdBy = user.data.user?.id ?? null;

    const { error } = await supabase.from("events").insert([
      {
        game_id: selectedGame,
        team_id: team,
        player_id: scorer,
        period,
        time_mmss: time,
        event: "goal",
        assist1_id: assist1,
        assist2_id: assist2,
        created_by: createdBy,
      },
    ]);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    await refreshEvents();
  };

  const refreshEvents = async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("game_id", selectedGame)
      .order("period", { ascending: true })
      .order("time_mmss", { ascending: true });
    setEvents(data ?? []);
  };

  const deleteGoal = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) alert(error.message);
    else await refreshEvents();
  };

  const toggleFinal = async () => {
    if (!selectedGame) return;
    const nextStatus = status === "Final" ? "Scheduled" : "Final";
    const { error } = await supabase.from("games").update({ status: nextStatus }).eq("id", selectedGame);
    if (error) alert(error.message);
    else setStatus(nextStatus);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Scorer</h1>

      <div className="mb-4">
        <label className="font-medium">Game:</label>
        <select
          className="border p-2 ml-2"
          value={selectedGame}
          onChange={(e) => setSelectedGame(e.target.value)}
        >
          <option value="">-- select game --</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.slug}
            </option>
          ))}
        </select>
        {selectedGame && (
          <button onClick={toggleFinal} className="ml-3 underline">
            {status === "Final" ? "Unmark FINAL" : "Mark FINAL"}
          </button>
        )}
      </div>

      <div className="flex gap-4 mb-4">
        <label>
          <input type="radio" checked={team === "RLR"} onChange={() => setTeam("RLR")} /> RLR
        </label>
        <label>
          <input type="radio" checked={team === "RLB"} onChange={() => setTeam("RLB")} /> RLB
        </label>
        <label>
          <input type="radio" checked={team === "RLN"} onChange={() => setTeam("RLN")} /> RLN
        </label>
      </div>

      <div className="flex gap-2 mb-4">
        <input type="number" value={period} onChange={(e) => setPeriod(+e.target.value)} className="border p-2 w-20" />
        <input value={time} onChange={(e) => setTime(e.target.value)} className="border p-2 w-24" placeholder="MM:SS" />
        <select className="border p-2" value={scorer} onChange={(e) => setScorer(e.target.value)}>
          <option value="">-- Scorer --</option>
          {players.filter(p => p.team_id === team).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select className="border p-2" value={assist1 ?? ""} onChange={(e) => setAssist1(e.target.value || null)}>
          <option value="">-- Assist 1 --</option>
          {players.filter(p => p.team_id === team).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select className="border p-2" value={assist2 ?? ""} onChange={(e) => setAssist2(e.target.value || null)}>
          <option value="">-- Assist 2 --</option>
          {players.filter(p => p.team_id === team).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className="bg-blue-500 text-white px-4 rounded" onClick={handleSaveGoal}>
          Save goal
        </button>
      </div>

      <h2 className="text-lg font-medium mt-6 mb-2">Current goals</h2>
      <table className="min-w-full border">
        <thead>
          <tr>
            <th>Per</th><th>Time</th><th>Team</th><th>Scorer / Assists</th><th></th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => (
            <tr key={ev.id}>
              <td>{ev.period}</td>
              <td>{ev.time_mmss}</td>
              <td>{ev.team_id}</td>
              <td>{ev.player_id}</td>
              <td>
                <button onClick={() => deleteGoal(ev.id)} className="text-red-600">🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
