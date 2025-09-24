import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type TeamRef = { id: string; name: string };
type GameRow = {
  id: string;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  status: string;
  // When FKs are present, Supabase can hydrate:
  home?: TeamRef | null;
  away?: TeamRef | null;
};

export default function Games({ onOpen }: { onOpen: (id: string) => void }) {
  const [games, setGames] = useState<GameRow[]>([]);

  useEffect(() => {
    const load = async () => {
      // Try to fetch with relationships (requires FKs):
      const { data, error } = await supabase
        .from('games')
        .select('id, game_date, home_team_id, away_team_id, home_score, away_score, status, home:home_team_id(id,name), away:away_team_id(id,name)')
        .order('game_date', { ascending: false })
        .limit(50);

      if (!error && data) {
        setGames(data as unknown as GameRow[]);
        return;
      }

      // Fallback: fetch games and then resolve names manually (not as efficient)
      const { data: base, error: e2 } = await supabase
        .from('games')
        .select('id, game_date, home_team_id, away_team_id, home_score, away_score, status')
        .order('game_date', { ascending: false })
        .limit(50);
      if (!e2 && base) setGames(base as GameRow[]);
    };

    load();
  }, []);

  const format = (iso: string) => new Date(iso).toLocaleString();

  const nameOf = (g: GameRow, key: 'home' | 'away') =>
    g[key]?.name ?? (key === 'home' ? g.home_team_id : g.away_team_id);

  return (
    <section className="space-y-6">
      <h3 className="text-xl font-bold">Games</h3>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr className="p-2">
              <th className="p-2">Date</th>
              <th className="p-2">Home</th>
              <th className="p-2">Score</th>
              <th className="p-2">Away</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => onOpen(g.id)}>
                <td className="p-2">{format(g.game_date)}</td>
                <td className="p-2 font-semibold">{nameOf(g, 'home')}</td>
                <td className="p-2">
                  {g.home_score} - {g.away_score}
                </td>
                <td className="p-2 font-semibold">{nameOf(g, 'away')}</td>
                <td className="p-2">{g.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
