import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type GameHeader = {
  id: string;
  slug: string;
  game_date: string;
  status: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_goals: number | null;
  away_goals: number | null;
};

type GoalLine = {
  period: number;
  time_mmss: string;
  team_short: string | null;      // e.g. RLR / RLB / RLN
  scorer_name: string | null;
  assist1_name: string | null;    // may be null
  assist2_name: string | null;    // may be null
};

export default function GameSummary() {
  const { slug } = useParams();
  const [game, setGame] = useState<GameHeader | null>(null);
  const [goals, setGoals] = useState<GoalLine[]>([]);
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

      setLoading(true);
      setErr(null);

      // ✅ header from new view
      const { data: gameData, error: gErr } = await supabase
        .from("games_scores_live")
        .select(`
          id,
          slug,
          game_date,
          status,
          home_team_name,
          away_team_name,
          home_goals,
          away_goals
        `)
        .eq("slug", slug)
        .maybeSingle();

      if (!alive) return;

      if (gErr) {
        setErr(gErr.message);
        setLoading(false);
        return;
      }
      if (!gameData) {
        setErr("Game not found.");
        setLoading(false);
        return;
      }

      setGame(gameData as GameHeader);

      // ✅ per-goal lines from ext view (with merged assists)
      const { data: glData, error: glErr } = await supabase
        .from("goal_lines_ext_v2")
        .select(`
          period,
          time_mmss,
          team_short,
          scorer_name,
          assist1_name,
          assist2_name
        `)
        .eq("slug", slug)
        .order("period", { ascending: true })
        .order("time_mmss", { ascending: true });

      if (glErr) {
        setErr(glErr.message);
        setLoading(false);
        return;
      }

      setGoals((glData ?? []) as GoalLine[]);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  const goalsByPeriod = useMemo(() => {
    const map = new Map<number, GoalLine[]>();
    for (const g of goals) {
      const p = g.period ?? 1;
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(g);
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

  return (
    <div className="p-4 space-y-6">
      <div className="text-sm">
        <Link className="text-blue-600 hover:underline" to="/league/games">
          ← Retour aux matchs
        </Link>
      </div>

      <h1 className="text-2xl font-bold">{dateStr}</h1>

      <h2 className="text-xl">
        {game.home_team_name ?? "Domicile"}{" "}
        <strong>{game.home_goals ?? 0}</strong> vs{" "}
        <strong>{game.away_goals ?? 0}</strong>{" "}
        {game.away_team_name ?? "Visiteur"}
      </h2>

      {goalsByPeriod.length === 0 ? (
        <div className="text-gray-600">Aucun événement pour cette partie.</div>
      ) : (
        <div className="space-y-6">
          {goalsByPeriod.map(([period, lines]) => (
            <div key={period}>
              <h3 className="font-semibold mb-2">
                {period === 1
                  ? "1re période"
                  : period === 2
                  ? "2e période"
                  : period === 3
                  ? "3e période"
                  : `Période ${period}`}
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                {lines.map((g, i) => {
                  // Remove duplicates if scorer appears as an assist
                  const scorer = g.scorer_name ?? "";
                  const assistsRaw = [g.assist1_name, g.assist2_name]
                    .filter(Boolean)
                    .map((x) => String(x));
                  const assists = assistsRaw
                    .filter((a) => a !== scorer)
                    .filter((a, idx, arr) => arr.indexOf(a) === idx) // dedupe
                    .join(", ");

                  return (
                    <li key={`${period}-${i}`}>
                      <span className="text-gray-500 mr-2">{g.time_mmss}</span>
                      BUT {g.team_short ? `(${g.team_short}) ` : ""}:
                      {scorer ? ` ${scorer}` : " —"}
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
