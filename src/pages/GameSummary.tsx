// src/pages/GameSummary.tsx
import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Row = {
  slug: string;
  game_date: string;
  status: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
};

type GoalLine = {
  period: number;
  time_mmss: string;
  team_short: string | null;
  scorer_name: string | null;
  assist1_name: string | null;
  assist2_name: string | null;
};

export default function GameSummary() {
  const { slug } = useParams<{ slug: string }>();

  const [game, setGame] = useState<Row | null>(null);
  const [goals, setGoals] = useState<GoalLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!slug) throw new Error("Missing slug");

        // 1) game row (scores + names)
        const { data: g, error: gErr } = await supabase
          .from("games_scores_with_names_v2")
          .select(
            "slug, game_date, status, home_team_name, away_team_name, home_score, away_score"
          )
          .eq("slug", slug)
          .maybeSingle();

        if (gErr) throw gErr;
        if (alive) setGame(g as Row);

        // 2) goal lines (with assist names)
        const { data: lines, error: lErr } = await supabase
          .from("goal_lines_ext_v2")
          .select("period, time_mmss, team_short, scorer_name, assist1_name, assist2_name")
          .eq("slug", slug)
          .order("period")
          .order("time_mmss");

        if (lErr) throw lErr;
        if (alive) setGoals((lines ?? []) as GoalLine[]);
      } catch (e: any) {
        if (alive) setErr(e.message ?? "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  const grouped = useMemo(() => {
    const m = new Map<number, GoalLine[]>();
    for (const g of goals) {
      const p = g.period ?? 1;
      if (!m.has(p)) m.set(p, []);
      m.get(p)!.push(g);
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [goals]);

  if (loading) return <div className="p-4">Loading…</div>;
  if (err) return <div className="p-4 text-red-600">{err}</div>;
  if (!game) return <div className="p-4">Game not found.</div>;

  const dateStr = new Date(game.game_date).toLocaleDateString("fr-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-4 space-y-6">
      <Link className="text-blue-600 hover:underline" to="/league/games">
        ← Retour aux matchs
      </Link>

      <h1 className="text-2xl font-bold">{dateStr}</h1>

      <h2 className="text-xl">
        {game.home_team_name ?? "Domicile"} <strong>{game.home_score ?? 0}</strong> vs{" "}
        <strong>{game.away_score ?? 0}</strong> {game.away_team_name ?? "Visiteur"}
      </h2>

      <div className="space-y-6">
        {grouped.map(([period, lines]) => (
          <div key={period}>
            <h3 className="font-semibold mb-2">
              {period === 1 ? "1re période" : period === 2 ? "2e période" : `Période ${period}`}
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              {lines.map((gl, i) => {
                const assists = [gl.assist1_name, gl.assist2_name]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <li key={`${period}-${i}`}>
                    <span className="text-gray-500 mr-2">{gl.time_mmss}</span>
                    BUT {gl.team_short ? `(${gl.team_short})` : ""} :{" "}
                    {gl.scorer_name ?? "—"}
                    {assists ? `  ASS : ${assists}` : ""}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
