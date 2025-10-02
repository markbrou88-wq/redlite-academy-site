import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Row = {
  name: string;   // team name
  gp: number;
  w: number;
  l: number;
  otl: number;    // overtime losses (your view uses this)
  pts: number;
  gf: number;
  ga: number;
  diff: number;   // goal diff in your view
};

export default function Standings() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const load = async () => {
      // your view name from the screenshots
      const { data, error } = await supabase
        .from('standings_from_events_v')
        .select('*');

      if (!error && data) setRows(data as Row[]);
    };

    load();

    // refresh when games change
    const ch = supabase
      .channel('standings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => load())
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, []);

  const ptsPct = (r: Row) => (r.gp > 0 ? (r.pts / (r.gp * 2)).toFixed(3) : '0.000');

  return (
    <section className="space-y-6">
      <h3 className="text-xl font-bold">Standings</h3>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr className="p-2">
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
            {rows.map((r) => (
              <tr key={r.name} className="border-b">
                <td className="p-2 font-semibold">{r.name}</td>
                <td className="p-2">{r.gp}</td>
                <td className="p-2">{r.w}</td>
                <td className="p-2">{r.l}</td>
                <td className="p-2">{r.otl}</td>
                <td className="p-2">{r.gf}</td>
                <td className="p-2">{r.ga}</td>
                <td className="p-2">{r.diff}</td>
                <td className="p-2">{r.pts}</td>
                <td className="p-2">{ptsPct(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
