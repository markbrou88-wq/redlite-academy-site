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
  home_goals: number | null;    // live from view
  away_goals: number | null;    // live from view
};

// ... keep your GoalLine + everything else the same ...

export default function GameSummary() {
  const { slug } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  // keep your other state (goals, loading, etc.)

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!slug) return;

      // Fetch the live score + team names
      const { data: gameData, error: gErr } = await supabase
        .from("games_with_score")
        .select(`
          id,
          game_date,
          status,
          home_goals,
          away_goals,
          home_team:home_team_id(name),
          away_team:away_team_id(name)
        `)
        .eq("slug", slug)
        .maybeSingle();

      if (!gErr && gameData && alive) {
        setGame(gameData as Game);
      }

      // ... keep your logic that loads goal lines (ext_v2) ...
    })();
    return () => { alive = false; };
  }, [slug]);

  // ... keep your grouping + rendering ...

  const dateStr = game
    ? new Date(game.game_date).toLocaleDateString("fr-CA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="p-4 space-y-6">
      <div className="text-sm">
        <Link className="text-blue-600 hover:underline" to="/league/games">
          ← Retour aux matchs
        </Link>
      </div>

      <h1 className="text-2xl font-bold">{dateStr}</h1>

      <h2 className="text-xl">
        {game?.home_team?.name ?? "Domicile"}{" "}
        <strong>{game?.home_goals ?? 0}</strong> vs{" "}
        <strong>{game?.away_goals ?? 0}</strong>{" "}
        {game?.away_team?.name ?? "Visiteur"}
      </h2>

      {/* keep the rest of your summary rendering (goal lines) */}
    </div>
  );
}
