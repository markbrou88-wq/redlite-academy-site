// src/pages/GameSummary.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type TeamRow = { name: string };
type Game = {
  id: string;
  game_date: string;
  status: string | null;
  home_team: TeamRow | null;
  away_team: TeamRow | null;
  home_score: number | null;
  away_score: number | null;
};

type EventRow = {
  period: number;
  time_mmss: string;
  event: string;     // 'goal' | 'assist' | etc. (we format goals below)
  team_id: string;   // not used in text line, but available
  player_id: string; // we’ll show player names by joining players table below if needed
  player_name?: string; // optional if you store names in events
  assist_name?: string; // optional if you store assists as separate events/rows
  // If your schema only stores goal lines (and assistants as separate rows),
  // you can keep this simple and just list the rows as-is.
};

export default function GameSummary() {
  const { slug } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!slug) {
        setErr("Missing game slug.");
        setLoading(false);
        return;
      }

      // 1) Load the game & teams
      const { data: gameData, error: gErr } = await supabase
        .from("games")
        .select(`
          id,
          game_date,
          status,
          home_score,
          away_score,
          home_team:home_team_id(name),
          away_team:away_team_id(name)
        `)
        .eq("slug", slug)
        .maybeSingle();

      if (gErr) {
        if (alive) {
          setErr(gErr.message);
          setLoading(false);
        }
        return;
      }
      if (!gameData) {
        if (alive) {
          setErr("Game not found.");
          setLoading(false);
        }
        return;
      }
      if (alive) setGame(gameData as Game);

      // 2) Load events for that game (ordered)
      const gameId = gameData.id as string;

      const { data: evData, error: eErr } = await supabase
        .from("events")
        .select(`
          period,
          time_mmss,
          event,
          team_id,
          player_id
        `)
        .eq("game_id", gameId)
        .order("period", { ascending: true })
        .order("time_mmss", { ascending: true });

      if (eErr) {
        if (alive) {
          setErr(eErr.message);
          setLoading(false);
        }
        return;
      }

      if (alive) {
        setEvents((evData ?? []) as EventRow[]);
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  // Group by period for display
  const eventsByPeriod = useMemo(() => {
    const map = new Map<number, EventRow[]>();
    for (const ev of events) {
      const k = ev.period ?? 1;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(ev);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [events]);

  if (loading) return <div className="p-4">Chargement…</div>;
  if (err) return <div className="p-4 text-red-600">{err}</div>;
  if (!game) return <div className="p-4">Partie introuvable.</div>;

  const dateStr = new Date(game.game_date).toLocaleDateString("fr-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-4 space-y-6">
      <div className="text-sm">
        <Link className="text-blue-600 hover:underline" to="/league/games">
          ← Retour aux matchs
        </Link>
      </div>

      <h1 className="text-2xl font-bold">
        {dateStr}
      </h1>

      <h2 className="text-xl">
        {game.home_team?.name ?? "Home"}{" "}
        <strong>{game.home_score ?? 0}</strong> vs{" "}
        <strong>{game.away_score ?? 0}</strong>{" "}
        {game.away_team?.name ?? "Away"}
      </h2>

      {eventsByPeriod.length === 0 ? (
        <div className="text-gray-600">Aucun événement pour cette partie.</div>
      ) : (
        <div className="space-y-6">
          {eventsByPeriod.map(([period, evs]) => (
            <div key={period}>
              <h3 className="font-semibold mb-2">
                {period === 1 ? "1re période"
                 : period === 2 ? "2e période"
                 : period === 3 ? "3e période"
                 : `Période ${period}`}
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                {evs.map((e, i) => (
                  <li key={`${period}-${i}`}>
                    <span className="text-gray-500 mr-2">{e.time_mmss}</span>
                    {/* Minimum formatting. If you later store player names in events,
                       print "BUT : Nom (n)  ASS : Nom (n)" here. */}
                    {e.event === "goal" ? "BUT" : e.event}
                    {e.player_name ? ` : ${e.player_name}` : ""}
                    {/* If you also fetch assistants, add them here */}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* If you later compute “stars” (étoiles), render them here */}
      {/* <div className="mt-6">
        <h3 className="font-semibold">Étoiles du match</h3>
        <p>1re étoile : …  2e étoile : …  3e étoile : …</p>
      </div> */}
    </div>
  );
}
