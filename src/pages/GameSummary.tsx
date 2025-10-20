import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Team = { id: string; name: string; short_name: string | null };
type Player = { id: string; name: string; number: number | null; team_id: string; position: string | null };

type GameRow = {
  id: string;
  slug: string;
  game_date: string; // ISO
  status: "scheduled" | "final" | "inprogress" | string;
  home_team_id: string;
  away_team_id: string;
  home_team: Team | null;
  away_team: Team | null;
};

type EventRow = {
  id: string;
  game_id: string;
  team_id: string;
  player_id: string | null;
  period: number;
  time_mmss: string; // "MM:SS"
  event: "goal" | "assist" | "penalty" | string;
};

type GoalLine = {
  period: number;
  time_mmss: string;
  team_id: string;
  team_short: string;
  scorer?: { id: string; name: string; number?: number | null };
  assists: { id: string; name: string; number?: number | null }[];
};

export default function GameSummary() {
  const { slug = "" } = useParams();
  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch game + teams
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // 1) game + teams
      const { data: g, error: gErr } = await supabase
        .from("games")
        .select(
          `
          id, slug, game_date, status,
          home_team_id, away_team_id,
          home_team:home_team_id ( id, name, short_name ),
          away_team:away_team_id ( id, name, short_name )
        `
        )
        .eq("slug", slug)
        .maybeSingle();

      if (gErr) {
        console.error(gErr);
        setLoading(false);
        return;
      }

      // 2) players (for both teams)
      const teamIds: string[] = [g.home_team_id, g.away_team_id].filter(Boolean);
      const { data: pls, error: pErr } = await supabase
        .from("players")
        .select("id, name, number, team_id, position")
        .in("team_id", teamIds);

      if (pErr) {
        console.error(pErr);
        setLoading(false);
        return;
      }

      // 3) events for the game
      const { data: evs, error: eErr } = await supabase
        .from("events")
        .select("id, game_id, team_id, player_id, period, time_mmss, event")
        .eq("game_id", g.id)
        .order("period", { ascending: true })
        .order("time_mmss", { ascending: true });

      if (cancelled) return;

      if (eErr) console.error(eErr);
      setGame(g as unknown as GameRow);
      setPlayers((pls || []) as Player[]);
      setEvents((evs || []) as EventRow[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Helper lookups
  const playerById = useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((p) => map.set(p.id, p));
    return map;
  }, [players]);

  const teamShort = (team_id: string) => {
    if (!game) return "";
    if (game.home_team_id === team_id) return game.home_team?.short_name || "HOME";
    if (game.away_team_id === team_id) return game.away_team?.short_name || "AWAY";
    return "";
  };

  // Build goal lines (goal + its two possible assists)
  const goals: GoalLine[] = useMemo(() => {
    // events are separated; we need to group by (period, time, team)
    // a "goal" at (period,time,team) + any "assist" events at same tuple belong together.
    const key = (e: EventRow) => `${e.period}|${e.time_mmss}|${e.team_id}`;

    // goal events
    const goalEvents = events.filter((e) => e.event === "goal");
    // assists so we can match later
    const assistEvents = events.filter((e) => e.event === "assist");

    const lines: GoalLine[] = goalEvents.map((g) => {
      const scorer = g.player_id ? playerById.get(g.player_id) : undefined;
      const assistsForThisGoal = assistEvents
        .filter((a) => a.period === g.period && a.time_mmss === g.time_mmss && a.team_id === g.team_id)
        .slice(0, 2) // only 2 assists
        .map((a) => (a.player_id ? playerById.get(a.player_id) : undefined))
        .filter(Boolean)
        .map((p) => ({ id: p!.id, name: p!.name, number: p!.number }));

      return {
        period: g.period,
        time_mmss: g.time_mmss,
        team_id: g.team_id,
        team_short: teamShort(g.team_id),
        scorer: scorer ? { id: scorer.id, name: scorer.name, number: scorer.number ?? undefined } : undefined,
        assists: assistsForThisGoal,
      };
    });

    // sort by period then time
    const toSec = (t: string) => {
      const [mm, ss] = t.split(":").map((x) => parseInt(x, 10) || 0);
      return mm * 60 + ss;
    };
    lines.sort((a, b) => (a.period - b.period) || (toSec(a.time_mmss) - toSec(b.time_mmss)));
    return lines;
  }, [events, playerById, game]);

  // Goals by period & team
  const byPeriod = useMemo(() => {
    const out: Record<number, { home: number; away: number }> = {};
    goals.forEach((g) => {
      if (!out[g.period]) out[g.period] = { home: 0, away: 0 };
      const isHome = game?.home_team_id === g.team_id;
      if (isHome) out[g.period].home += 1;
      else out[g.period].away += 1;
    });
    return out;
  }, [goals, game]);

  const totalHome = useMemo(() => goals.filter((g) => g.team_id === game?.home_team_id).length, [goals, game]);
  const totalAway = useMemo(() => goals.filter((g) => g.team_id === game?.away_team_id).length, [goals, game]);

  // Rosters shown = any player that appears in events for that team (unique)
  const roster = useMemo(() => {
    const homeSet = new Map<string, Player>();
    const awaySet = new Map<string, Player>();
    events.forEach((e) => {
      if (!e.player_id) return;
      const p = playerById.get(e.player_id);
      if (!p) return;
      if (p.team_id === game?.home_team_id) homeSet.set(p.id, p);
      if (p.team_id === game?.away_team_id) awaySet.set(p.id, p);
    });
    const asArray = (m: Map<string, Player>) =>
      [...m.values()].sort((a, b) => (a.number || 999) - (b.number || 999) || a.name.localeCompare(b.name));
    return { home: asArray(homeSet), away: asArray(awaySet) };
  }, [events, playerById, game]);

  // Goalie = first goalie on that team from players table (or from roster, if position === 'G')
  const goalies = useMemo(() => {
    const getGoalie = (teamId?: string) => {
      if (!teamId) return undefined;
      const g = players
        .filter((p) => p.team_id === teamId && (p.position ?? "").toUpperCase().startsWith("G"))
        .sort((a, b) => (a.number || 999) - (b.number || 999))[0];
      return g;
    };
    return {
      home: getGoalie(game?.home_team_id),
      away: getGoalie(game?.away_team_id),
    };
  }, [players, game]);

  if (loading || !game) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Link to="/league/games" className="text-sm text-blue-600 hover:underline">
          ← Retour aux matchs
        </Link>
        <div className="mt-6">Loading…</div>
      </div>
    );
  }

  const gameDate = new Date(game.game_date);
  const niceDate = gameDate.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const niceTime = gameDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <Link to="/league/games" className="text-sm text-blue-600 hover:underline">
          ← Retour aux matchs
        </Link>
        <button onClick={() => window.print()} className="px-3 py-1.5 rounded bg-neutral-900 text-white text-sm">
          Print
        </button>
      </div>

      {/* Header */}
      <div className="mt-4 border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <div className="text-xl font-semibold">{niceDate}</div>
            <div className="text-sm text-neutral-600">{niceTime}</div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="uppercase text-xs text-neutral-500">Away</div>
              <div className="text-lg font-semibold">{game.away_team?.name ?? "Away"}</div>
            </div>
            <div className="text-3xl font-bold">
              {totalAway} <span className="mx-1 text-neutral-400">—</span> {totalHome}
            </div>
            <div>
              <div className="uppercase text-xs text-neutral-500">Home</div>
              <div className="text-lg font-semibold">{game.home_team?.name ?? "Home"}</div>
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs tracking-wide uppercase text-neutral-500">
          Status: {game.status === "final" ? "Final" : game.status}
        </div>
      </div>

      {/* Sheet body */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4">
        {/* Left column: Away roster */}
        <div className="border rounded-lg p-4">
          <div className="font-semibold mb-2">{game.away_team?.name} — Roster</div>
          <RosterTable players={roster.away} goalie={goalies.away} />
        </div>

        {/* Center column: Goal log & period totals */}
        <div className="border rounded-lg p-4 lg:col-span-1">
          <div className="font-semibold mb-2">Feuille de match</div>
          <GoalLogTable goals={goals} homeId={game.home_team_id} awayId={game.away_team_id} />
          <div className="mt-4">
            <PeriodTotals byPeriod={byPeriod} />
          </div>
        </div>

        {/* Right column: Home roster */}
        <div className="border rounded-lg p-4">
          <div className="font-semibold mb-2">{game.home_team?.name} — Roster</div>
          <RosterTable players={roster.home} goalie={goalies.home} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Small components ---------- */

function RosterTable({ players, goalie }: { players: Player[]; goalie?: Player }) {
  return (
    <div>
      <table className="w-full text-sm border border-neutral-200">
        <thead className="bg-neutral-50">
          <tr>
            <th className="text-left p-2 w-10">#</th>
            <th className="text-left p-2">Joueurs</th>
            <th className="text-left p-2 w-12">Pos</th>
          </tr>
        </thead>
        <tbody>
          {players.length === 0 && (
            <tr>
              <td className="p-2 text-neutral-500" colSpan={3}>
                Aucun joueur (encore)
              </td>
            </tr>
          )}
          {players.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.number ?? ""}</td>
              <td className="p-2">{p.name}</td>
              <td className="p-2">{p.position ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 text-sm">
        <div className="font-medium">Gardien</div>
        <div className="text-neutral-700">{goalie ? goalie.name : "—"}</div>
      </div>
    </div>
  );
}

function GoalLogTable({
  goals,
  homeId,
  awayId,
}: {
  goals: GoalLine[];
  homeId: string;
  awayId: string;
}) {
  // split by period for nice sections
  const goalsByPeriod = goals.reduce<Record<number, GoalLine[]>>((acc, g) => {
    (acc[g.period] ||= []).push(g);
    return acc;
  }, {});
  const periods = Object.keys(goalsByPeriod)
    .map((x) => parseInt(x, 10))
    .sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      {periods.map((p) => (
        <div key={p}>
          <div className="font-semibold mb-2">{p}re période</div>
          <ul className="space-y-1">
            {goalsByPeriod[p].map((g, idx) => {
              const isHome = g.team_id === homeId;
              const teamLabel = isHome ? "HOME" : "AWAY";
              const who = [
                g.scorer ? g.scorer.name : "But (inconnu)",
                g.assists[0]?.name && `ASS: ${g.assists[0].name}`,
                g.assists[1]?.name && g.assists[1].name,
              ]
                .filter(Boolean)
                .join(" : ");

              return (
                <li key={idx} className="text-sm">
                  <span className="inline-block w-10 text-neutral-500">{g.time_mmss}</span>{" "}
                  <span className="font-medium">{g.team_short}</span>{" "}
                  <span className="text-neutral-800">: {who}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {periods.length === 0 && <div className="text-sm text-neutral-500">Aucun but.</div>}
    </div>
  );
}

function PeriodTotals({ byPeriod }: { byPeriod: Record<number, { home: number; away: number }> }) {
  const rows = Object.keys(byPeriod)
    .map((x) => parseInt(x, 10))
    .sort((a, b) => a - b)
    .map((p) => ({ p, ...byPeriod[p] }));

  if (rows.length === 0) return null;

  const sumHome = rows.reduce((n, r) => n + r.home, 0);
  const sumAway = rows.reduce((n, r) => n + r.away, 0);

  return (
    <table className="w-full text-sm border border-neutral-200">
      <thead className="bg-neutral-50">
        <tr>
          <th className="text-left p-2 w-20">Période</th>
          <th className="text-right p-2">Away</th>
          <th className="text-right p-2">Home</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.p} className="border-t">
            <td className="p-2">{r.p}</td>
            <td className="p-2 text-right">{r.away}</td>
            <td className="p-2 text-right">{r.home}</td>
          </tr>
        ))}
        <tr className="border-t font-semibold">
          <td className="p-2">TOTAL</td>
          <td className="p-2 text-right">{sumAway}</td>
          <td className="p-2 text-right">{sumHome}</td>
        </tr>
      </tbody>
    </table>
  );
}
