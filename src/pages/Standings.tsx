import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = {
  team_id: string;
  team_name: string;
  short_name: string | null;
  gp: number;
  w?: number;
  l?: number;
  otl?: number;
  gf: number;
  ga: number;
  gd?: number;
  pts?: number;
  pts_pct?: number;
};

export default function Standings() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      setMsg("");
      const { data, error } = await supabase
        .from("standings_current") // 👈 ensure the view exists as above
        .select("*")
        .order("team_name");
      if (error) setMsg(error.message);
      else {
        const safe = (data ?? []).map((r: any) => ({
          ...r,
          gd: (r.gf ?? 0) - (r.ga ?? 0),
        }));
        setRows(safe);
      }
    })();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Standings</h1>
      {msg && <div className="text-sm">{msg}</div>}

      <table className="min-w-full text-sm border rounded">
        <thead className="bg-gray-50 text-left">
          <tr>
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
          {rows.map(r => (
            <tr className="border-t" key={r.team_id}>
              <td className="p-2">{r.team_name}</td>
              <td className="p-2">{r.gp ?? 0}</td>
              <td className="p-2">{r.w ?? 0}</td>
              <td className="p-2">{r.l ?? 0}</td>
              <td className="p-2">{r.otl ?? 0}</td>
              <td className="p-2">{r.gf ?? 0}</td>
              <td className="p-2">{r.ga ?? 0}</td>
              <td className="p-2">{r.gd ?? (r.gf - r.ga)}</td>
              <td className="p-2">{r.pts ?? 0}</td>
              <td className="p-2">{(r.pts_pct ?? 0).toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
