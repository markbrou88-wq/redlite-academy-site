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
  team_short: string | null;     // e.g. RLR / RLB / RLC
  scorer_name: string | null;    // “BUT : …”
  assists: string | null;   // first assist (may be null)
  
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
      if (!slug) {
        setErr("Slug de match manquant.");
        setLoading(false);
        return;
      }

      // 1) Charger le match
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
        if (alive) { setErr(gErr.message); setLoading(false); }
        return;
      }
      if (!gameData) {
        if (alive) { setErr("Partie introuvable."); setLoading(false); }
        return;
      }
      if (alive) setGame(gameData as Game);

      // 2) Charger les buts via la vue goal_lines_extended
      const { data: glData, error: glErr } = await supabase
        .from("goal_lines_ext_v2") // <- name of the view
        .select(`
          period,
          time_mmss,
          team_short,
          scorer_name,
          assists
          
        `)
        .eq("slug", slug)
        .order("period", { ascending: true })
        .order("time_mmss", { ascending: true });

      if (glErr) {
        if (alive) { setErr(glErr.message); setLoading(false); }
        return;
      }

      if (alive) {
        setGoals((glData ?? []) as GoalLine[]);
        setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [slug]);

  // Regrouper par période
  const goalsByPeriod = useMemo(() => {
    const m = new Map<number, GoalLine[]>();
    for (const g of goals) {
      const p = g.period ?? 1;
      if (!m.has(p)) m.set(p, []);
      m.get(p)!.push(g);
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
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

  return (
    <div className="p-4 space-y-6">
      <div className="text-sm">
        <Link className="text-blue-600 hover:underline" to="/league/games">
          ← Retour aux matchs
        </Link>
      </div>

      <h1 className="text-2xl font-bold">{dateStr}</h1>

      <h2 className="text-xl">
        {game.home_team?.name ?? "Domicile"}{" "}
        <strong>{game.home_score ?? 0}</strong> vs{" "}
        <strong>{game.away_score ?? 0}</strong>{" "}
        {game.away_team?.name ?? "Visiteur"}
      </h2>

      {goalsByPeriod.length === 0 ? (
        <div className="text-gray-600">Aucun événement pour cette partie.</div>
      ) : (
        <div className="space-y-6">
          {goalsByPeriod.map(([period, lines]) => (
            <div key={period}>
              <h3 className="font-semibold mb-2">
                {period === 1 ? "1re période"
                 : period === 2 ? "2e période"
                 : period === 3 ? "3e période"
                 : `Période ${period}`}
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                {lines.map((g, i) => {
  // Build, clean, and limit assists
  const raw = [g.assist1_name, g.assist2_name].filter(Boolean) as string[];
  // remove scorer if present + dedupe while preserving order
  const cleaned = Array.from(
    new Set(raw.filter((n) => n && n !== g.scorer_name))
  ).slice(0, 2);
  const assists = cleaned.join(", ");

  return (
    <li key={`${period}-${i}`}>
      <span className="text-gray-500 mr-2">{g.time_mmss}</span>
      BUT {g.team_short ? `(${g.team_short}) ` : ""}:
      {g.scorer_name ? ` ${g.scorer_name}` : " —"}
      {assists ? `  ASS : ${assists}` : ""}
    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
