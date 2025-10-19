import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = {
  name: string;
  gp: number | null;
  w: number | null;
  l: number | null;
  otl: number | null;
  gf: number | null;
  ga: number | null;
  gd: number | null;
  pts: number | null;
  pts_pct?: number | null; // some views name it pts_pct
};

export default function Standings() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("standings_current")
        .select(
          "name, gp, w, l, otl, gf, ga, gd, pts, pts_pct"
        )
        .order("pts", { ascending: false });

      if (error) {
        if (alive) setErr(error.message);
      } else if (alive) {
        setRows((data ?? []) as Row[]);
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <div className="p-4">Loading…</div>;
  if (err) return <div className="p-4 text-red-600">{err}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Standings</h1>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b">
            <th className="p-2">Team</th>
            <th className="p-2">GP</th>
            <th className="p-2">W</th>
            <th className="p-2">L</th>
            <th className="p-2">OTL</th>
            <th className="p-2">GF</th>
            <th className="p-2">GA</th>
            <th className="p-2">GD</th>
            <th className="p-2">PTS</th>
            <th className="p-2">PTS%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b">
              <td className="p-2">{r.name}</td>
              <td className="p-2">{r.gp ?? 0}</td>
              <td className="p-2">{r.w ?? 0}</td>
              <td className="p-2">{r.l ?? 0}</td>
              <td className="p-2">{r.otl ?? 0}</td>
              <td className="p-2">{r.gf ?? 0}</td>
              <td className="p-2">{r.ga ?? 0}</td>
              <td className="p-2">{r.gd ?? 0}</td>
              <td className="p-2">{r.pts ?? 0}</td>
              <td className="p-2">
                {r.pts_pct != null ? (Math.round(r.pts_pct * 1000) / 1000).toFixed(3) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
