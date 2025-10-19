import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type GameRow = {
  slug: string;
  game_date: string;          // timestamp / text from view
  status: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_goals: number | null;
  away_goals: number | null;
};

export default function Games() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);

      // ✅ New view
      const { data, error } = await supabase
        .from("games_scores_live")
        .select(
          `
          slug,
          game_date,
          status,
          home_team_name,
          away_team_name,
          home_goals,
          away_goals
        `
        )
        .order("game_date", { ascending: false });

      if (!alive) return;

      if (error) {
        setErr(error.message);
      } else {
        setGames((data ?? []) as GameRow[]);
      }

      setLoading(false);
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
            <th className="p-2">Score</th>
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
              <td className="p-2">{g.home_team_name ?? "-"}</td>
              <td className="p-2">{g.away_team_name ?? "-"}</td>
              <td className="p-2">
                {g.home_goals ?? 0}–{g.away_goals ?? 0}
              </td>
              <td className="p-2">{g.status ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

