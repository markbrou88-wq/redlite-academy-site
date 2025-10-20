import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = {
  team_id: string;
  // different migrations used different names — accept both:
  team_name?: string;
  name?: string;

  gp: number;
  w: number;
  l: number;
  otl: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  pts_pct?: number | null;
};

const logoMap: Record<string, string> = {
  "Red Lite Red": "/logos/rlr.png",
  "Red Lite Blue": "/logos/rlb.png",
  "Red Lite Black": "/logos/rln.png",
};

export default function Standings() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase
        .from("standings_current")
        .select("*")
        .order("pts", { ascending: false });
      if (error) {
        setErr(error.message);
      } else {
        setRows((data || []) as Row[]);
      }
    };
    run();
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Standings</h1>

      {err && <div className="text-red-600 mb-3">{err}</div>}

      <table className="w-full border-collapse">
        <thead className="border-b text-left">
          <tr>
            <th className="py-2">Team</th>
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
          {rows.map((r) => {
            const teamName = r.team_name || r.name || "Team";
            const logo = logoMap[teamName] || "/logos/rln.png";
            const ptsPct =
              typeof r.pts_pct === "number"
                ? r.pts_pct.toFixed(3)
                : // if your view doesn’t have pts_pct, compute quickly (W=2 pts; ties not used here)
                  ((r.pts ?? 0) / (r.gp > 0 ? r.gp * 2 : 1)).toFixed(3);

            return (
              <tr key={r.team_id} className="border-b">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={logo}
                      alt={teamName}
                      className="w-7 h-7 object-contain"
                    />
                    {teamName}
                  </div>
                </td>
                <td>{r.gp ?? 0}</td>
                <td>{r.w ?? 0}</td>
                <td>{r.l ?? 0}</td>
                <td>{r.otl ?? 0}</td>
                <td>{r.gf ?? 0}</td>
                <td>{r.ga ?? 0}</td>
                <td>{r.gd ?? (r.gf ?? 0) - (r.ga ?? 0)}</td>
                <td>{r.pts ?? 0}</td>
                <td>{ptsPct}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
