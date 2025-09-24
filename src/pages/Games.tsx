// src/pages/Games.tsx
import { useEffect, useState } from 'react';
import supabase from '../lib/supabase';

type GameRow = {
  slug: string;
  game_date: string;
  status: string;
  home: { name: string } | null;
  away: { name: string } | null;
};

export default function Games({ onOpen }: { onOpen: (slug: string) => void }) {
  const [rows, setRows] = useState<GameRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('games')
        .select(`
          slug,
          game_date,
          status,
          home:home_team_id(name),
          away:away_team_id(name)
        `)
        .order('game_date', { ascending: false });
      if (!error && data) setRows(data as GameRow[]);
    };
    load();
  }, []);

  return (
    <section className="space-y-6">
      <h3 className="text-xl font-bold">Games</h3>
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Date</th>
            <th className="p-2">Home</th>
            <th className="p-2">Score</th>
            <th className="p-2">Away</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.slug} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => onOpen(g.slug)}>
              <td className="p-2">{new Date(g.game_date).toLocaleString()}</td>
              <td className="p-2">{g.home?.name ?? '—'}</td>
              <td className="p-2"> {/* You can compute final score if you store it */}—</td>
              <td className="p-2">{g.away?.name ?? '—'}</td>
              <td className="p-2">{g.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
