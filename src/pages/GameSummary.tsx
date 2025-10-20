import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

type GameRow = {
  id: string;
  slug: string;
  game_date: string;
  status: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
};

type EventRow = {
  period: number;
  time_mmss: string;
  // your view may expose any of these — accept all gracefully:
  team?: string;
  team_short?: string;
  scorer?: string;
  scorer_name?: string;
  player?: string;
  assist1?: string | null;
  assist2?: string | null;
  assist_1?: string | null;
  assist_2?: string | null;
  a1_name?: string | null;
  a2_name?: string | null;
};

const logoMap: Record<string, string> = {
  "Red Lite Red": "/logos/rlr.png",
  "Red Lite Blue": "/logos/rlb.png",
  "Red Lite Black": "/logos/rln.png",
};

export default function GameSummary() {
  const { slug } = useParams();
  const [game, setGame] = useState<GameRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: gData, error: gErr } = await supabase
        .from("games_with_names_v2")
        .select("*")
        .eq("slug", slug)
        .single();
      if (gErr) {
        setErr(gErr.message);
        return;
      }
      setGame(gData as GameRow);

      const { data: eData, error: eErr } = await supabase
        .from("goal_lines_ext_v2")
        .select("*")
        .eq("game_slug", slug)
        .order("period", { ascending: true })
        .order("time_mmss", { ascending: true });

      if (eErr) setErr(eErr.message);
      else setEvents((eData || []) as EventRow[]);
    };
    load();
  }, [slug]);

  const grouped = useMemo(() => {
    const byP: Record<number, EventRow[]> = {};
    for (const e of events) {
      const p = Number(e.period || 0);
      byP[p] = byP[p] || [];
      byP[p].push(e);
    }
    return Object.entries(byP)
      .map(([p, list]) => ({ period: Number(p), list }))
      .sort((a, b) => a.period - b.period);
  }, [events]);

  if (!game) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Link to="/league/games" className="text-blue-600 hover:underline">
          ← Return to games
        </Link>
        <div className="mt-6">Loading game…</div>
      </div>
    );
  }

  const awayLogo = logoMap[game.away_team] || "/logos/rln.png";
  const homeLogo = logoMap[game.home_team] || "/logos/rln.png";

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link to="/league/games" className="text-blue-600 hover:underline">
        ← Return to games
      </Link>

      {err && <div className="text-red-600 mt-4">{err}</div>}

      {/* Header with big logos + score */}
      <div className="flex items-center justify-between my-8">
        <div className="flex items-center gap-4">
          <img src={awayLogo} alt={game.away_team} className="w-20 h-20" />
          <div className="text-xl font-semibold">{game.away_team}</div>
        </div>

        <div className="text-3xl font-extrabold">
          {(game.away_score ?? 0)} – {(game.home_score ?? 0)}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xl font-semibold">{game.home_team}</div>
          <img src={homeLogo} alt={game.home_team} className="w-20 h-20" />
        </div>
      </div>

      {/* Events grouped by period */}
      {grouped.map(({ period, list }) => (
        <div key={period} className="mb-6">
          <h3 className="font-semibold mb-2">{period}e période</h3>
          <ul className="list-disc pl-6 space-y-1">
            {list.map((e, idx) => {
              const team = e.team_short || e.team || "";
              const scorer = e.scorer_name || e.scorer || e.player || "";
              const a1 =
                e.assist_1 ?? e.assist1 ?? e.a1_name ?? undefined ?? null;
              const a2 =
                e.assist_2 ?? e.assist2 ?? e.a2_name ?? undefined ?? null;

              return (
                <li key={idx}>
                  <span className="tabular-nums">{e.time_mmss}</span>{" "}
                  <b>BUT ({team})</b> : {scorer}
                  {(a1 || a2) && (
                    <>
                      {" "}
                      <span className="text-gray-600">
                        ASS : {a1 ?? "—"}
                        {a2 ? `, ${a2}` : ""}
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
