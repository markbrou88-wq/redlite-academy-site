import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // adjust if your path is different

type Row = {
  player_id: string;
  player: string;
  team: string;
  gp: number;
  g: number;
  a: number;
  pts: number;
};

export default function Leaders() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data, error } = await supabase
        .from('leaders_current')
        .select('*')
        .order('pts', { ascending: false })
        .order('g', { ascending: false })
        .order('player', { ascending: true });

      if (error) {
        console.error('leaders_current error', error);
      } else if (alive) {
        setRows((data ?? []) as Row[]);
      }
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <h3 className="text-xl font-bold">Leaders</h3>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr className="p-2">
              <th className="p-2">Player</th>
              <th className="p-2">Team</th>
              <th className="p-2">GP</th>
              <th className="p-2">G</th>
              <th className="p-2">A</th>
              <th className="p-2">PTS</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-2" colSpan={6}>Loading…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-2" colSpan={6}>No data</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.player_id} className="border-t">
                <td className="p-2 font-semibold">{r.player}</td>
                <td className="p-2">{r.team}</td>
                <td className="p-2">{r.gp}</td>
                <td className="p-2">{r.g}</td>
                <td className="p-2">{r.a}</td>
                <td className="p-2">{r.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
