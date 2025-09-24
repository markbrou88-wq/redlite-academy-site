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

type GoalLine = {
  period: number;
  time_mmss: string;
  team_name: string | null;
  team_short?: string | null;
  scorer_name: string | null;
  assist1_name: string | null;
  assist2_name: string | null;
};

export default function GameSummary() {
  const { slug } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [goals, setGoals] = useState<GoalLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!slug) {
          setErr("Missing game slug.");
          setLoading(false);
          return;
        }

        // 1) Load the game header
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

        if (gErr) throw gErr;
        if (!gameData) {
          setErr("Game not found.");
          setLoading(false);
          return;
        }
        if (!alive) return;
        setGame(gameData as Game);

        // 2) Load goal lines from the view
        const { data: lines, error: lErr } = await supabase
          .from("goal_lines_extended")
          .select(
            "period,time_mmss,team_name,team_short,scorer_name,assist1_name,assist2_name"
          )
          .eq("slug", slug)
          .order("period", { ascending: true })
          .order("time_mmss", { ascending: true });

        if (lErr) throw lErr;
        if (!alive) return;
        setGoals((lines ?? []) as GoalLine[]);
        setLoading(false);
      } catch (e: any) {
        if (alive) {
          setErr(e?.message ?? "Unknown error");
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  // Group by period
  const goalsByPeriod = useMemo(() => {
    const map = new Map<number, GoalLine[]>();
    for (const g of goals) {
      const k = g.period ?? 1;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(g);
    }
    // sort each period by time_mmss just in case
    for (const [, arr] of map) {
      arr.sort((a, b) => (a.time_mmss > b.time_mmss ? 1 : a.time_mmss < b.time_mmss ? -1 : 0));
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [goals]);

  if (loading) return <div className="p-4">Chargement…</div>;
  if (err) return <div className="p-4 text-red-600">{err}</div>;
  if (!game) return <div className="p-4">Partie introuvable.</div>;

  const dateStr = new Date(game.game_date).toLocaleDateString("fr-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fmtPeriod = (p: number) =>
    p === 1 ? "1re période" : p === 2 ? "2e période" : p === 3 ? "3e période" : `Période ${p}`;

  // small formatter to print a single goal line
  const renderGoalText = (g: GoalLine) => {
    const parts: string[] = [];
    const teamLabel = g.team_short || g.team_name || "";
    // “BUT” plus team short (optional)
    parts.push("BUT");
    if (teamLabel) parts.push(`(${teamLabel})`);
    // scorer
    if (g.scorer_name) parts.push(`: ${g.scorer_name}`);
    // assists
    const assists = [g.assist1_name, g.assist2_name].filter(Boolean).join(", ");
    if (assists) parts.push(`  ASS : ${assists}`);
    return parts.join(" ");
  };

  return (
    <div className="p-4 space-y-6">
      <div className="text-sm">
        <Link className="text-blue-600 hover:underline" to="/league/games">
          ← Retour aux matchs
        </Link>
      </div>

      <h1 className="text-2xl font-bold">{dateStr}</h1>

      <h2 className="text-xl">
        {game.home_team?.name ?? "Home"} <strong>{game.home_score ?? 0}</strong> vs{" "}
        <strong>{game.away_score ?? 0}</strong> {game.away_team?.name ?? "Away"}
      </h2>

      {goalsByPeriod.length === 0 ? (
        <div className="text-gray-600">Aucun but inscrit.</div>
      ) : (
        <div className="space-y-6">
          {goalsByPeriod.map(([period, arr]) => (
            <div key={period}>
              <h3 className="font-semibold mb-2">{fmtPeriod(period)}</h3>
              <ul className="list-disc pl-6 space-y-1">
                {arr.map((g, i) => (
                  <li key={`${period}-${i}`}>
                    <span className="text-gray-500 mr-2">{g.time_mmss}</span>
                    {renderGoalText(g)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Space for “étoiles du match” later if you compute them */}
      {/* <div className="mt-6">
        <h3 className="font-semibold">Étoiles du match</h3>
        <p>1re étoile : …  2e étoile : …  3e étoile : …</p>
      </div> */}
    </div>
  );
}
