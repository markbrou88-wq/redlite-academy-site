import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = {
  team_id: string;
  name: string;
  gp: number;
  w: number;
  l: number;
  otl: number;
  gf: number;
  ga: number;
  diff: number;
  pts: number;
};

export default function Standings() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("standings_from_events")
        .select("*")
        .order("pts", { ascending: false })
        .order("diff", { ascending: false })
        .order("gf", { ascending: false });

      if (!error && alive && data) setRows(data as Row[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="p-4">Loading standings…</div>;

  return (
    <div className="p-4">
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
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.team_id} className="border-b">
              <td className="p-2">{r.name}</td>
              <td className="p-2">{r.gp}</td>
              <td className="p-2">{r.w}</td>
              <td className="p-2">{r.l}</td>
              <td className="p-2">{r.otl}</td>
              <td className="p-2">{r.gf}</td>
              <td className="p-2">{r.ga}</td>
              <td className="p-2">{r.diff}</td>
              <td className="p-2">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
