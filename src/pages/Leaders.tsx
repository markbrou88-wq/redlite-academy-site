import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = {
  player_name: string;
  team_short: string | null;
  g: number | null;
  a: number | null;
  pts: number | null;
};

export default function Leaders() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("leaders_current")
        .select("player_name, team_short, g, a, pts")
        .order("pts", { ascending: false })
        .order("g", { ascending: false });

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
      <h1 className="text-2xl font-bold mb-4">Leaders</h1>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b">
            <th className="p-2">Player</th>
            <th className="p-2">Team</th>
            <th className="p-2">G</th>
            <th className="p-2">A</th>
            <th className="p-2">PTS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b">
              <td className="p-2">{r.player_name}</td>
              <td className="p-2">{r.team_short ?? ""}</td>
              <td className="p-2">{r.g ?? 0}</td>
              <td className="p-2">{r.a ?? 0}</td>
              <td className="p-2">{r.pts ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
