import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = {
  team_id: string;
  team_name: string;
  gp: number;
  w: number;
  l: number;
  otl: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  pts_pct: number;
};

export default function Standings() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      setMsg("");
      const { data, error } = await supabase
        .from("standings_live")
        .select("*")
        .order("pts", { ascending: false })
        .order("gd", { ascending: false });
      if (error) setMsg(error.message);
      if (data) setRows(data as Row[]);
    })();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Standings</h1>
      {msg && <div className="text-sm mb-3">{msg}</div>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Team</th>
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
            {rows.map((r) => (
              <tr key={r.team_id} className="border-t">
                <td className="p-2 text-left">{r.team_name}</td>
                <td className="p-2 text-center">{r.gp}</td>
                <td className="p-2 text-center">{r.w}</td>
                <td className="p-2 text-center">{r.l}</td>
                <td className="p-2 text-center">{r.otl}</td>
                <td className="p-2 text-center">{r.gf}</td>
                <td className="p-2 text-center">{r.ga}</td>
                <td className="p-2 text-center">{r.gd}</td>
                <td className="p-2 text-center">{r.pts}</td>
                <td className="p-2 text-center">{r.pts_pct.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
