port { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = {
  team_id: string;
  team_name?: string | null; // preferred
  name?: string | null;      // fallback if your view exposes 'name'
  gp: number;
  w: number;
  l: number;
  otl: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  pts_pct: number | null;
};

function keyFromName(name: string): "RLR" | "RLB" | "RLN" | undefined {
  const n = name.toLowerCase();
  if (n.includes("blue")) return "RLB";
  if (n.includes("black")) return "RLN";
  if (n.includes("red")) return "RLR";
  return undefined;
}

function TeamBadge({ name }: { name: string }) {
  const k = keyFromName(name);
  const src =
    k === "RLR" ? "/logos/rlr.png" : k === "RLB" ? "/logos/rlb.png" : k === "RLN" ? "/logos/rln.png" : undefined;

  return (
    <div className="flex items-center gap-2">
      {src && <img src={src} className="h-6 w-auto" alt={name} />}
      <span>{name}</span>
    </div>
  );
}

export default function Standings() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase
        .from("standings_current")
        .select(
          "team_id, team_name, name, gp, w, l, otl, gf, ga, gd, pts, pts_pct"
        )
        .order("pts", { ascending: false })
        .order("gd", { ascending: false });

      if (error) setErr(error.message);
      else setRows((data || []) as Row[]);
      setLoading(false);
    };
    load();
  }, []);

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Standings</h1>

      <table className="w-full text-left border-separate border-spacing-y-2">
        <thead>
          <tr className="text-sm text-gray-500">
            <th className="px-3 py-2">Team</th>
            <th className="px-3 py-2">GP</th>
            <th className="px-3 py-2">W</th>
            <th className="px-3 py-2">L</th>
            <th className="px-3 py-2">OTL</th>
            <th className="px-3 py-2">GF</th>
            <th className="px-3 py-2">GA</th>
            <th className="px-3 py-2">GD</th>
            <th className="px-3 py-2">PTS</th>
            <th className="px-3 py-2">PTS%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const name = r.team_name ?? r.name ?? "";
            return (
              <tr key={r.team_id} className="bg-white rounded shadow-sm">
                <td className="px-3 py-3">
                  <TeamBadge name={name} />
                </td>
                <td className="px-3 py-3">{r.gp}</td>
                <td className="px-3 py-3">{r.w}</td>
                <td className="px-3 py-3">{r.l}</td>
                <td className="px-3 py-3">{r.otl}</td>
                <td className="px-3 py-3">{r.gf}</td>
                <td className="px-3 py-3">{r.ga}</td>
                <td className="px-3 py-3">{r.gd}</td>
                <td className="px-3 py-3">{r.pts}</td>
                <td className="px-3 py-3">
                  {r.pts_pct != null ? r.pts_pct.toFixed(3) : "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
