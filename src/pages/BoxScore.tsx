import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type TeamRef = { id: string; name: string };
type Game = {
  id: string;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  status: string;
  home?: TeamRef | null;
  away?: TeamRef | null;
};

type EventRow = {
  id: string;
  game_id: string;
  period: number | null;
  time_mmss: string | null;
  team?: TeamRef | null;
  players?: { name: string | null; jersey?: string | null } | null;
  // Display text (goal, assist, penalty, shot, etc.)
  event?: string | null;
};

export default function BoxScore({
  gameId,
  onBack,
}: {
  gameId: string;
  onBack: () => void;
}) {
  const [game, setGame] = useState<Game | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);

  useEffect(() => {
    const load = async () => {
      // Fetch the game with related home/away team names (requires FK)
      const { data: g, error: ge } = await supabase
        .from('games')
        .select(
          'id, game_date, home_team_id, away_team_id, home_score, away_score, status, home:home_team_id(id,name), away:away_team_id(id,name)'
        )
        .eq('id', gameId)
        .single();
      if (!ge && g) setGame(g as unknown as Game);

      // Timeline / events for this game. Adjust select if your columns differ
      const { data: ev, error: ee } = await supabase
        .from('events')
        .select('id, game_id, period, time_mmss, event, team:team_id(id,name), players:player_id(name, jersey)')
        .eq('game_id', gameId)
        .order('period', { ascending: true })
        .order('time_mmss', { ascending: true });

      if (!ee && ev) setEvents(ev as unknown as EventRow[]);
    };

    load();
  }, [gameId]);

  const format = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '');

  return (
    <section className="space-y-6">
      <button
        className="text-sm px-3 py-1 rounded bg-gray-100 border hover:bg-gray-200"
        onClick={onBack}
      >
        ← Back to Games
      </button>

      {game && (
        <div className="space-y-2">
          <h3 className="text-xl font-bold">Box Score</h3>
          <div className="text-sm text-gray-600">{format(game.game_date)}</div>
          <div className="text-lg">
            <span className="font-semibold">{game.home?.name ?? game.home_team_id}</span>{' '}
            {game.home_score} - {game.away_score}{' '}
            <span className="font-semibold">{game.away?.name ?? game.away_team_id}</span>
          </div>
          <div className="text-sm text-gray-600">Status: {game.status}</div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr className="p-2">
              <th className="p-2">Period</th>
              <th className="p-2">Time</th>
              <th className="p-2">Team</th>
              <th className="p-2">Player</th>
              <th className="p-2">Event</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b">
                <td className="p-2">{e.period ?? '-'}</td>
                <td className="p-2">{e.time_mmss ?? '-'}</td>
                <td className="p-2">{e.team?.name ?? '-'}</td>
                <td className="p-2">
                  {e.players?.name ?? '-'}
                  {e.players?.jersey ? ` #${e.players.jersey}` : ''}
                </td>
                <td className="p-2">{e.event ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
