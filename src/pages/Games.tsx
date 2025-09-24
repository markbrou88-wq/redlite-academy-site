import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Team = { name: string };
type GameRow = {
  slug: string;
  game_date: string;
  status?: string | null;
  home_team: Team | null;
  away_team: Team | null;
};

export default function Games() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("games")
        .select(`
          slug,
          game_date,
          status,
          home_team:home_team_id(name),
          away_team:away_team_id(name)
        `)
        .order("game_date", { ascending: false });

      if (!error && alive && data) setGames(data as GameRow[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="p-4">Loading games…</div>;

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
              <td className="p-2">{g.home_team?.name ?? "-"}</td>
              <td className="p-2">{g.away_team?.name ?? "-"}</td>
              <td className="p-2">{g.status ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
