import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type GameLine = {
  id: string;
  slug: string;
  game_date: string;
  status: string;
  home_team_name: string;
  away_team_name: string;
  home_goals: number;
  away_goals: number;
};

export default function Games() {
  const [games, setGames] = useState<GameLine[]>([]);
  const [msg, setMsg] = useState<string>("");

  async function loadGames() {
    setMsg("");
    const { data, error } = await supabase
      .from("games_scores_live") // 👈 change to your actual view name if different
      .select("id, slug, game_date, status, home_team_name, away_team_name, home_goals, away_goals")
      .order("game_date", { ascending: false });

    if (error) setMsg(error.message);
    else setGames(data || []);
  }

  useEffect(() => {
    loadGames();
  }, []);

  async function deleteGame(g: GameLine) {
    if (!window.confirm(`Delete game ${g.slug}? This will also delete its events.`)) return;
    try {
      setMsg("");

      // 1️⃣ delete all events for that game
      const { error: e1 } = await supabase.from("events").delete().eq("game_id", g.id);
      if (e1) throw e1;

      // 2️⃣ delete the game itself
      const { error: e2 } = await supabase.from("games").delete().eq("id", g.id);
      if (e2) throw e2;

      setMsg(`Deleted ${g.slug}`);
      setGames((old) => old.filter((x) => x.id !== g.id));
    } catch (e: any) {
      setMsg(e.message ?? "Delete failed");
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Games</h1>

      {msg && <div className="text-sm">{msg}</div>}

      {games.length === 0 ? (
        <div className="text-gray-600 text-sm">No games found.</div>
      ) : (
        <table className="min-w-full text-sm border rounded">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">Date</th>
              <th className="p-2">Home</th>
              <th className="p-2">Away</th>
              <th className="p-2">Score</th>
              <th className="p-2">Status</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.id} className="border-t">
                <td className="p-2">
                  <Link to={`/league/games/${g.slug}`} className="text-blue-600 underline">
                    {formatDate(g.game_date)}
                  </Link>
                </td>
                <td className="p-2">{g.home_team_name}</td>
                <td className="p-2">{g.away_team_name}</td>
                <td className="p-2">
                  {g.home_goals}–{g.away_goals}
                </td>
                <td className="p-2">{g.status}</td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => deleteGame(g)}
                    className="text-red-600 hover:underline"
                    title="Delete this game"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
