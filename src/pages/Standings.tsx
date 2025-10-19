import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = {
  team_id: string;
  gp: number;
  w: number;
  l: number;
  otl: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  pts_pct?: number | null;
  team?: { name: string | null } | null; // joined
};

export default function Standings() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");
      // Join 'teams' by foreign key = team_id to get the display name
      const { data, error } = await supabase
        .from("standings_current")
        .select(
          `
            team_id, gp, w, l, otl, gf, ga, gd, pts, pts_pct,
            team:team_id ( name )
          `
        )
        .order("pts", { ascending: false });

      if (error) setMsg(error.message);
      if (data) setRows(data as Row[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Standings</h1>
      {msg && <div className="mb-2 text-sm">{msg}</div>}

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="[&>th]:text-left [&>th]:py-2">
              <th>Team</th>
              <th>GP</th>
              <th>W</th>
              <th>L</th>
              <th>OTL</th>
              <th>GF</th>
              <th>GA</th>
              <th>GD</th>
              <th>PTS</th>
              <th>PTS%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team_id} className="[&>td]:py-1 border-t">
                <td>{r.team?.name ?? r.team_id}</td>
                <td>{r.gp}</td>
                <td>{r.w}</td>
                <td>{r.l}</td>
                <td>{r.otl}</td>
                <td>{r.gf}</td>
                <td>{r.ga}</td>
                <td>{r.gd}</td>
                <td>{r.pts}</td>
                <td>{(r.pts_pct ?? 0).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
