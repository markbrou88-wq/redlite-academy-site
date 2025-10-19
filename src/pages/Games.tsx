import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Row = {
  id: string;
  slug: string;
  game_date: string;
  status: string | null;
  home_team_name: string;
  away_team_name: string;
  home_goals: number;
  away_goals: number;
};

export default function Games() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("games_scores_with_names")
        .select(
          "id, slug, game_date, status, home_team_name, away_team_name, home_goals, away_goals"
        )
        .order("game_date", { ascending: false });

      if (error) {
        if (alive) setErr(error.message);
      } else if (alive && data) {
        setRows(data as Row[]);
      }
      if (alive) setLoading(false);
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
          {rows.map((g) => (
            <tr key={g.id} className="border-b hover:bg-gray-50">
              <td className="p-2">
                <Link className="text-blue-600 hover:underline" to={`/league/games/${g.slug}`}>
                  {new Date(g.game_date).toLocaleString()}
                </Link>
              </td>
              <td className="p-2">{g.home_team_name}</td>
              <td className="p-2">{g.away_team_name}</td>
              <td className="p-2">
                {g.home_goals}–{g.away_goals}
              </td>
              <td className="p-2">{g.status ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
