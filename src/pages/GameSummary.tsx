// src/pages/GameSummary.tsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type EventRow = {
  id: string;
  period: number;
  time_mmss: string | null;
  event: string;
  player: { name: string } | null;
  team: { name: string } | null;
};

export default function GameSummary() {
  const { slug } = useParams();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select(`
          id,
          period,
          time_mmss,
          event,
          player:player_id(name),
          team:team_id(name),
          game:game_id(slug)
        `)
        .eq("game.slug", slug) // filter by the game slug
        .order("period", { ascending: true })
        .order("time_mmss", { ascending: true });

      if (!error && alive && data) setEvents(data as EventRow[]);
      setLoading(false);
    })();
    return () => { alive = false };
  }, [slug]);

  if (loading) return <div className="p-4">Loading summary…</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Game Summary</h1>
      {events.length === 0 && <div>No events recorded yet.</div>}
      {events.map((e) => (
        <div key={e.id} className="mb-2">
          <strong>Period {e.period}</strong>{" "}
          {e.team?.name}: {e.event} – {e.player?.name}
          {e.time_mmss ? ` (${e.time_mmss})` : ""}
        </div>
      ))}
    </div>
  );
}
