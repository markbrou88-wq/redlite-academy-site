// Games.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type GameRow = {
  id: string;
  slug: string;
  game_date: string;
  status: "final" | "scheduled";
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
};

function teamKeyFromName(name: string): "RLR" | "RLB" | "RLN" | undefined {
  const n = name.toLowerCase();
  if (n.includes("blue")) return "RLB";
  if (n.includes("black")) return "RLN";
  if (n.includes("red")) return "RLR";
  return undefined;
}
function TeamWithLogo({ name }: { name: string }) {
  const key = teamKeyFromName(name);
  const src =
    key === "RLR" ? "/logos/rlr.png" :
    key === "RLB" ? "/logos/rlb.png" :
    key === "RLN" ? "/logos/rln.png" : undefined;
  return (
    <div className="flex items-center gap-2">
      {src && <img src={src} alt={name} className="h-6 w-auto" />}
      <span>{name}</span>
    </div>
  );
}

export default function Games() {
  const [rows, setRows] = useState<GameRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from("games_with_names")
      .select("id, slug, game_date, status, home_team, away_team, home_score, away_score")
      .order("game_date", { ascending: false });
    if (error) setErr(error.message);
    else setRows((data || []) as GameRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function deleteGame(id: string) {
    if (!confirm("Delete this game?")) return;
    const { error } = await supabase.from("games").delete().eq("id", id);
    if (error) alert(error.message);
    else setRows(rows.filter(r => r.id !== id));
  }

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Games</h1>
      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-sm text-gray-500">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Home</th>
            <th className="px-3 py-2">Away</th>
            <th className="px-3 py-2">Score</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => {
            const d = new Date(g.game_date);
            const score = `${g.home_score}–${g.away_score}`;
            return (
              <tr key={g.id} className="bg-white rounded shadow-sm">
                <td className="px-3 py-3 whitespace-nowrap">
                  <Link to={`/league/games/${g.slug}`} className="text-blue-600 hover:underline">
                    {d.toLocaleString(undefined, {
                      year: "numeric", month: "short", day: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </Link>
                </td>
                <td className="px-3 py-3"><TeamWithLogo name={g.home_team} /></td>
                <td className="px-3 py-3"><TeamWithLogo name={g.away_team} /></td>
                <td className="px-3 py-3 font-medium">{score}</td>
                <td className="px-3 py-3 capitalize">{g.status}</td>
                <td className="px-3 py-3 text-right">
                  <button title="Delete game" className="text-red-600 hover:underline" onClick={() => deleteGame(g.id)}>🗑</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
