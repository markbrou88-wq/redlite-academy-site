// src/pages/GameSummary.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
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
  team_short: string | null;     // RLR / RLB / RLC
  scorer_name: string | null;
  assist1_name: string | null;
  assist2_name: string | null;
  slug?: string | null;          // not required, but harmless if present
};

export default function GameSummary() {
  const { slug } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [goals, setGoals] = useState<GoalLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // --- loaders ---------------------------------------------------------------

  const loadGame = useCallback(async () => {
    if (!slug) return;
    const { data, error } = await supabase
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
    if (error) throw error;
    if (!data) throw new Error("Partie introuvable.");
    setGame(data as Game);
    return data as Game;
  }, [slug]);

  const loadGoals = useCallback(async (theSlug?: string) => {
    const s = theSlug ?? slug;
    if (!s) return;
    const { data, error } = await supabase
      .from("goal_lines_ext_v2") // <-- your view name (ext_v2)
      .select(`period, time_mmss, team_short, scorer_name, assist1_name, assist2_name`)
      .eq("slug", s)
      .order("period", { ascending: true })
      .order("time_mmss", { ascending: true });
    if (error) throw error;
    setGoals((data ?? []) as GoalLine[]);
  }, [slug]);

  // --- initial load ----------------------------------------------------------

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const g = await loadGame();
        await loadGoals(g.slug);
      } catch (e: any) {
        if (alive) setErr(e.message ?? String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [loadGame, loadGoals]);

  // --- realtime subscriptions ------------------------------------------------

  useEffect(() => {
    if (!game?.id || !slug) return;

    // One channel for both tables
    const channel = supabase
      .channel(`game-summary-${game.id}`)

      // Any change to events for this game -> re-fetch goal lines
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `game_id=eq.${game.id}` },
        async () => {
          try { await loadGoals(slug); } catch {}
        }
      )

      // Score changes on the games row -> patch the score
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${game.id}` },
        (payload) => {
          setGame((g) => {
            if (!g) return g;
            const ns = (payload.new as any).home_score ?? g.home_score;
            const as = (payload.new as any).away_score ?? g.away_score;
            return { ...g, home_score: ns, away_score: as };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id, slug, loadGoals]);

  // --- grouping --------------------------------------------------------------

  const goalsByPeriod = useMemo(() => {
    const m = new Map<number, GoalLine[]>();
    for (const g of goals) {
      const p = g.period ?? 1;
      if (!m.has(p)) m.set(p, []);
      m.get(p)!.push(g);
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [goals]);

  // --- render ----------------------------------------------------------------

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
