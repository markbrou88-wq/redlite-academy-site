import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type GameRow = {
  id: string;
  slug: string;
  game_date: string;
  status: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
};

type GoalRow = {
  slug: string;
  period: number;
  time_mmss: string;
  team_short: "RLR" | "RLB" | "RLN";
  team_name: string;
  scorer_name: string;
  a1_name: string | null;
  a2_name: string | null;
};

function logoForShort(key: "RLR" | "RLB" | "RLN" | undefined) {
  if (!key) return undefined;
  if (key === "RLR") return "/logos/rlr.png";
  if (key === "RLB") return "/logos/rlb.png";
  return "/logos/rln.png";
}

function shortFromName(name: string): "RLR" | "RLB" | "RLN" | undefined {
  const n = name.toLowerCase();
  if (n.includes("blue")) return "RLB";
  if (n.includes("black")) return "RLN";
  if (n.includes("red")) return "RLR";
  return undefined;
}

export default function GameSummary() {
  const { slug = "" } = useParams();
  const [game, setGame] = useState<GameRow | null>(null);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      const gq = supabase
        .from("games_with_names")
        .select("id, slug, game_date, status, home_team, away_team, home_score, away_score")
        .eq("slug", slug)
        .single();

      const glq = supabase
        .from("goal_lines_ext")
        .select("slug, period, time_mmss, team_short, team_name, scorer_name, a1_name, a2_name")
        .eq("slug", slug)
        .order("period", { ascending: true })
        .order("time_mmss", { ascending: true });

      const [{ data: g, error: e1 }, { data: gls, error: e2 }] = await Promise.all([gq, glq]);
      if (e1) setErr(e1.message);
      else setGame(g as GameRow);

      if (e2) setErr(e2.message);
      else setGoals((gls ?? []) as GoalRow[]);

      setLoading(false);
    })();
  }, [slug]);

  const grouped = useMemo(() => {
    const map = new Map<number, GoalRow[]>();
    for (const r of goals) {
      if (!map.has(r.period)) map.set(r.period, []);
      map.get(r.period)!.push(r);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([period, rows]) => ({ period, rows }));
  }, [goals]);

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (loading || !game) return <div className="p-6">Loading…</div>;

  const homeKey = shortFromName(game.home_team);
  const awayKey = shortFromName(game.away_team);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Link to="/league/games" className="text-blue-600 hover:underline">
        ← Back to games
      </Link>

      <div className="mt-4 flex items-center justify-center gap-8">
        <div className="flex items-center gap-2 min-w-[220px] justify-end">
          {awayKey && <img src={logoForShort(awayKey)!} className="h-10 w-auto" alt={game.away_team} />}
          <span className="font-semibold">{game.away_team}</span>
        </div>

        <div className="text-2xl font-bold">
          {game.away_score} <span className="text-gray-400">vs</span> {game.home_score}
        </div>

        <div className="flex items-center gap-2 min-w-[220px]">
          {homeKey && <img src={logoForShort(homeKey)!} className="h-10 w-auto" alt={game.home_team} />}
          <span className="font-semibold">{game.home_team}</span>
        </div>
      </div>

      <div className="text-center text-sm text-gray-500 mt-1 capitalize">
        {new Date(game.game_date).toLocaleString()} — {game.status}
      </div>

      <div className="mt-8 space-y-6">
        {grouped.map(({ period, rows }) => (
          <div key={period}>
            <h2 className="font-semibold mb-2">{period}e période</h2>
            <ul className="list-disc ml-6 space-y-1">
              {rows.map((r, i) => (
                <li key={`${period}-${i}`}>
                  <span className="tabular-nums mr-2">{r.time_mmss}</span>
                  <strong>{r.team_short}</strong>{" "}
                  BUT : {r.scorer_name}
                  {r.a1_name ? `  ASS : ${r.a1_name}` : ""}
                  {r.a2_name ? `, ${r.a2_name}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
