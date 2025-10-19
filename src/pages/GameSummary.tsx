import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type HeadRow = {
  slug: string;
  game_date: string;
  status: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_goals: number | null;
  away_goals: number | null;
};

type Line = {
  period: number;
  time_mmss: string;
  team_short: string | null;     // RLR / RLB / RLN
  scorer_name: string | null;
  assist1_name: string | null;
  assist2_name: string | null;
};

export default function GameSummary() {
  const { slug } = useParams();
  const [head, setHead] = useState<HeadRow | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!slug) {
        setErr("Missing slug.");
        setLoading(false);
        return;
      }

      // Header from scores view
      const { data: h, error: hErr } = await supabase
        .from("games_scores_live")
        .select(
          "slug, game_date, status, home_team_name, away_team_name, home_goals, away_goals"
        )
        .eq("slug", slug)
        .maybeSingle();

      if (hErr) {
        if (alive) {
          setErr(hErr.message);
          setLoading(false);
        }
        return;
      }
      if (alive) setHead((h ?? null) as HeadRow | null);

      // Goal/assist lines
      const { data: ev, error: eErr } = await supabase
        .from("goal_lines_ext_v2")
        .select(
          "period, time_mmss, team_short, scorer_name, assist1_name, assist2_name"
        )
        .eq("slug", slug)
        .order("period", { ascending: true })
        .order("time_mmss", { ascending: true });

      if (eErr) {
        if (alive) {
          setErr(eErr.message);
          setLoading(false);
        }
        return;
      }

      if (alive) {
        setLines((ev ?? []) as Line[]);
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  const grouped = useMemo(() => {
    const m = new Map<number, Line[]>();
    for (const r of lines) {
      const p = r.period ?? 1;
      if (!m.has(p)) m.set(p, []);
      m.get(p)!.push(r);
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [lines]);

  if (loading) return <div className="p-4">Loading…</div>;
  if (err) return <div className="p-4 text-red-600">{err}</div>;

  const dateStr =
    head &&
    new Date(head.game_date).toLocaleDateString("fr-CA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <div className="p-6 space-y-6">
      <div className="text-sm">
        <Link className="text-blue-600 hover:underline" to="/league/games">
          ← Retour aux matchs
        </Link>
      </div>

      {head && (
        <>
          <h1 className="text-2xl font-bold">{dateStr}</h1>
          <h2 className="text-xl">
            {head.home_team_name ?? "Home"}{" "}
            <strong>{head.home_goals ?? 0}</strong> vs{" "}
            <strong>{head.away_goals ?? 0}</strong>{" "}
            {head.away_team_name ?? "Away"}
          </h2>
        </>
      )}

      {grouped.length === 0 ? (
        <div className="text-gray-600">Aucun événement pour cette partie.</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([p, arr]) => (
            <div key={p}>
              <h3 className="font-semibold mb-2">
                {p === 1 ? "1re période" : p === 2 ? "2e période" : `Période ${p}`}
              </h3>
              <ul className="list-disc pl-6 space-y-1">
                {arr.map((e, i) => {
                  const assists = [e.assist1_name, e.assist2_name]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <li key={`${p}-${i}`}>
                      <span className="text-gray-500 mr-2">{e.time_mmss}</span>
                      BUT {e.team_short ? `(${e.team_short}) ` : ""}:
                      {e.scorer_name ? ` ${e.scorer_name}` : " —"}
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
