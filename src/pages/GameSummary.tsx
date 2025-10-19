import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type GameHeader = {
  id: string;
  slug: string;
  game_date: string;
  status: string | null;
  home_team_name: string;
  away_team_name: string;
  home_goals: number;
  away_goals: number;
};

type GoalLine = {
  period: number;
  time_mmss: string;
  team_short: string | null;
  team_name: string | null;
  scorer_name: string | null;
  assist1_name: string | null;
  assist2_name: string | null;
};

export default function GameSummary() {
  const { slug } = useParams();
  const [game, setGame] = useState<GameHeader | null>(null);
  const [lines, setLines] = useState<GoalLine[]>([]);
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

      // Header
      const { data: gData, error: gErr } = await supabase
        .from("games_scores_with_names")
        .select(
          "id, slug, game_date, status, home_team_name, away_team_name, home_goals, away_goals"
        )
        .eq("slug", slug)
        .maybeSingle();

      if (gErr) {
        if (alive) {
          setErr(gErr.message);
          setLoading(false);
        }
        return;
      }
      if (alive) setGame(gData as GameHeader);

      // Goal lines
      const { data: lData, error: lErr } = await supabase
        .from("goal_lines_ext")
        .select("period, time_mmss, team_short, team_name, scorer_name, assist1_name, assist2_name")
        .eq("slug", slug)
        .order("period", { ascending: true })
        .order("time_mmss", { ascending: true });

      if (lErr) {
        if (alive) {
          setErr(lErr.message);
          setLoading(false);
        }
        return;
      }

      if (alive) {
        setLines((lData ?? []) as GoalLine[]);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const byPeriod = useMemo(() => {
    const m = new Map<number, GoalLine[]>();
    for (const r of lines) {
      const k = r.period ?? 1;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [lines]);

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
      <div className="text-sm">
        <Link className="text-blue-600 hover:underline" to="/league/games">
          ← Retour aux matchs
        </Link>
      </div>

      <h1 className="text-2xl font-bold">{dateStr}</h1>

      <h2 className="text-xl">
        {game.home_team_name} <strong>{game.home_goals}</strong> vs{" "}
        <strong>{game.away_goals}</strong> {game.away_team_name}
      </h2>

      {byPeriod.length === 0 ? (
        <div className="text-gray-600">Aucun but.</div>
      ) : (
        <div className="space-y-6">
          {byPeriod.map(([period, arr]) => (
            <div key={period}>
              <h3 className="font-semibold mb-2">
                {period === 1 ? "1re période" : period === 2 ? "2e période" : `Période ${period}`}
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                {arr.map((g, i) => {
                  const assists = [g.assist1_name, g.assist2_name].filter(Boolean).join(", ");
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
