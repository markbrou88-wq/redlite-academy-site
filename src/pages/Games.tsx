// src/pages/Games.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type GameRow = {
  slug: string;
  game_date: string;
  status: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
};

export default function Games() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("games_scores_with_names_v2")
          .select(
            "slug, game_date, status, home_team_name, away_team_name, home_score, away_score"
          )
          .order("game_date", { ascending: false });

        if (error) throw error;
        if (alive) setGames((data ?? []) as GameRow[]);
      } catch (e: any) {
        if (alive) setErr(e.message ?? "Failed to load games");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <div className="p-4">Loading games…</div>;
  if (err) return <div className="p-4 text-red-600">{err}</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Games</h1>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b">
            <th className="p-2">Date</th>
            <th className="p-2">Home</th>
            <th className="p-2">Away</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.slug} className="border-b hover:bg-gray-50">
              <td className="p-2">
                <Link
                  className="text-blue-600 hover:underline"
                  to={`/league/games/${g.slug}`}
                >
                  {new Date(g.game_date).toLocaleString()}
                </Link>
              </td>
              <td className="p-2">
                {g.home_team_name ?? "Home"}{" "}
                <strong>{g.home_score ?? 0}</strong>
              </td>
              <td className="p-2">
                {g.away_team_name ?? "Away"}{" "}
                <strong>{g.away_score ?? 0}</strong>
              </td>
              <td className="p-2">{g.status ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
