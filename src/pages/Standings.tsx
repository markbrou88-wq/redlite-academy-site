import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type StandingRow = {
  team_id: string;
  name: string;     // <- comes from the view as `name`
  gp: number;
  w: number;
  l: number;
  otl: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  pts_pct: number;  // 0..1, already rounded to 3 decimals in SQL
};

export default function Standings() {
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);

      const { data, error } = await supabase
        .from("standings_current")
        .select("*")
        // display by points then GD then GF
        .order("pts", { ascending: false })
        .order("gd", { ascending: false })
        .order("gf", { ascending: false });

      if (!cancelled) {
        if (error) {
          setErr(error.message);
          setRows([]);
        } else {
          setRows((data ?? []) as StandingRow[]);
        }
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Standings</h1>
        <div>Loading…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Standings</h1>
        <div className="text-red-600">{err}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Standings</h1>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Team</th>
              <th className="py-2 pr-4">GP</th>
              <th className="py-2 pr-4">W</th>
              <th className="py-2 pr-4">L</th>
              <th className="py-2 pr-4">OTL</th>
              <th className="py-2 pr-4">GF</th>
              <th className="py-2 pr-4">GA</th>
              <th className="py-2 pr-4">GD</th>
              <th className="py-2 pr-4">PTS</th>
              <th className="py-2 pr-0">PTS%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team_id} className="border-b last:border-b-0">
                <td className="py-2 pr-4">{r.name}</td>
                <td className="py-2 pr-4">{r.gp}</td>
                <td className="py-2 pr-4">{r.w}</td>
                <td className="py-2 pr-4">{r.l}</td>
                <td className="py-2 pr-4">{r.otl}</td>
                <td className="py-2 pr-4">{r.gf}</td>
                <td className="py-2 pr-4">{r.ga}</td>
                <td className="py-2 pr-4">{r.gd}</td>
                <td className="py-2 pr-4">{r.pts}</td>
                <td className="py-2 pr-0">
                  {r.pts_pct ? r.pts_pct.toFixed(3) : "0.000"}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="py-4 text-gray-500" colSpan={10}>
                  No results yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
