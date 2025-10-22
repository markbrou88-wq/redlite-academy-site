// src/pages/Games.tsx
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

export default function Games() {
  const [games, setGames] = useState<any[]>([]);

  const loadGames = async () => {
    const { data } = await supabase.from("games").select("*").order("game_date", { ascending: false });
    setGames(data ?? []);
  };

  useEffect(() => {
    loadGames();
  }, []);

  const deleteGame = async (id: string) => {
    if (!confirm("Delete this game and its events?")) return;
    await supabase.from("events").delete().eq("game_id", id);
    const { error } = await supabase.from("games").delete().eq("id", id);
    if (error) alert(error.message);
    await loadGames();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Games</h1>
      <table className="min-w-full border">
        <thead>
          <tr><th>Date</th><th>Home</th><th>Away</th><th>Score</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.id}>
              <td>{new Date(g.game_date).toLocaleString()}</td>
              <td>{g.home_team}</td>
              <td>{g.away_team}</td>
              <td>{g.home_score}-{g.away_score}</td>
              <td>{g.status}</td>
              <td><button onClick={() => deleteGame(g.id)} className="text-red-600">🗑</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
