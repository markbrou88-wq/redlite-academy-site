import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Game = {
  id: string;
  slug: string;
  game_date: string;
  status: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
};

const logoMap: Record<string, string> = {
  "Red Lite Red": "/logos/rlr.png",
  "Red Lite Blue": "/logos/rlb.png",
  "Red Lite Black": "/logos/rln.png",
};

export default function Games() {
  const [games, setGames] = useState<Game[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("games_with_names_v2")
        .select("*")
        .order("game_date", { ascending: false });
      if (error) setErr(error.message);
      else setGames((data || []) as Game[]);
    };
    load();
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Games</h1>
      {err && <div className="text-red-600 mb-3">{err}</div>}
      <table className="w-full border-collapse">
        <thead className="border-b text-left">
          <tr>
            <th className="py-2">Date</th>
            <th>Home</th>
            <th>Away</th>
            <th>Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => {
            const homeLogo = logoMap[g.home_team] || "/logos/rln.png";
            const awayLogo = logoMap[g.away_team] || "/logos/rln.png";
            const score = `${g.home_score ?? 0}–${g.away_score ?? 0}`;

            return (
              <tr key={g.id} className="border-b hover:bg-gray-50">
                <td className="py-2">
                  <Link
                    to={`/league/games/${g.slug}`}
                    className="text-blue-600 hover:underline"
                  >
                    {new Date(g.game_date).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Link>
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={homeLogo}
                      alt={g.home_team}
                      className="w-8 h-8 object-contain"
                    />
                    {g.home_team}
                  </div>
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={awayLogo}
                      alt={g.away_team}
                      className="w-8 h-8 object-contain"
                    />
                    {g.away_team}
                  </div>
                </td>
                <td>{score}</td>
                <td>{g.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
