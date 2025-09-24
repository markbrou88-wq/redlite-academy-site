import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Team = { name: string };
type Game = {
  id: string;
  slug: string;
  game_date: string;
  status?: string | null;
  home_team: Team | null;
  away_team: Team | null;
};

export default function Game() {
  const { slug } = useParams<{ slug: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!slug) return;
      const { data, error } = await supabase
        .from("games")
        .select(`
          id,
          slug,
          game_date,
          status,
          home_team:home_team_id(name),
          away_team:away_team_id(name)
        `)
        .eq("slug", slug)
        .single();

      if (!error && alive) setGame(data as Game);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [slug]);

  if (loading) return <div className="p-4">Loading…</div>;
  if (!game) return <div className="p-4">Game not found.</div>;

  return (
    <div className="p-4 space-y-4">
      <Link to="/games" className="text-blue-600 hover:underline">← Back to Games</Link>

      <h1 className="text-2xl font-bold">
        {game.home_team?.name} vs {game.away_team?.name}
      </h1>
      <div className="text-gray-700">
        <div>Date: {new Date(game.game_date).toLocaleString()}</div>
        <div>Status: {game.status ?? "-"}</div>
        <div>Slug: {game.slug}</div>
        <div>Game ID: {game.id}</div>
      </div>

      {/* Example: you can now query events or game_stats using game.id */}
      {/* <BoxScore gameId={game.id} /> */}
    </div>
  );
}
