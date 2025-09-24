// src/pages/BoxScore.tsx
import { useEffect, useState } from 'react';
import { supabase } from "../lib/supabase";

type Game = {
  id: string;
  game_date: string;
  status: string;
  home: { name: string } | null;
  away: { name: string } | null;
};

type EventRow = {
  period: number | null;
  time_mmss: string | null;
  players: { name: string } | null;
  team: { name: string } | null;
  event: string | null;
};

export default function BoxScore({ gameSlug, onBack }: { gameSlug: string; onBack: () => void }) {
  const [game, setGame] = useState<Game | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: g, error } = await supabase
        .from('games')
        .select(`
          id,
          game_date,
          status,
          home:home_team_id(name),
          away:away_team_id(name)
        `)
        .eq('slug', gameSlug)
        .single();
      if (error || !g) return;
      setGame(g as Game);

      const { data: ev } = await supabase
        .from('events')
        .select(`
          period,
          time_mmss,
          event,
          players:player_id(name),
          team:team_id(name)
        `)
        .eq('game_id', (g as Game).id)
        .order('period', { ascending: true })
        .order('time_mmss', { ascending: true });

      setEvents((ev ?? []) as EventRow[]);
    };
    load();
  }, [gameSlug]);

  if (!game) return null;

  return (
    <section className="space-y-4">
      <button className="text-blue-600" onClick={onBack}>← Back</button>
      <h3 className="text-xl font-bold">
        {game.home?.name} vs {game.away?.name} — {new Date(game.game_date).toLocaleString()}
      </h3>
      <p className="text-sm text-gray-600">Status: {game.status}</p>

      <table className="w-full text-left mt-4">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Time</th>
            <th className="p-2">Player</th>
            <th className="p-2">Team</th>
            <th className="p-2">Event</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i} className="border-b">
              <td className="p-2">{e.period ?? '—'} • {e.time_mmss ?? '—'}</td>
              <td className="p-2">{e.players?.name ?? '—'}</td>
              <td className="p-2">{e.team?.name ?? '—'}</td>
              <td className="p-2">{e.event ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
