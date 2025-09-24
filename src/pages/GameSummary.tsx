// src/pages/GameSummary.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Team = { id: string; name: string };
type Game = {
  id: string;
  slug: string;
  game_date: string;
  status: string | null;
  home_team: Team | null;
  away_team: Team | null;
  home_score: number | null;
  away_score: number | null;
};

type EventRow = {
  id: string;
  period: number;
  time_mmss: string | null;
  event: "goal" | "assist" | string;
  team_id: string | null;
  player: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
};

type PriorTotals = Record<
  string, // player_id
  { goals: number; assists: number }
>;

function frDate(d: string | Date) {
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    return new Intl.DateTimeFormat("fr-CA", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}

function shortTeam(name?: string | null) {
  if (!name) return "";
  // you can refine these if you want exact outputs like "RDL", "RDB", etc.
  if (/redlite a/i.test(name)) return "RDL A";
  if (/redlite b/i.test(name)) return "RDL B";
  if (/redlite c/i.test(name)) return "RDL C";
  // fallback: first word
  return name.split(" ").slice(0, 2).join(" ");
}

// Group key for “a single play” (goal + 0..2 assists)
function playKey(e: EventRow) {
  // We group by same team, same period, same time_mmss
  return `${e.team_id ?? ""}|${e.period}|${e.time_mmss ?? ""}`;
}

export default function GameSummary() {
  const { slug } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [prior, setPrior] = useState<PriorTotals>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    let alive = true;
    (async () => {
      // 1) get the game info
      const { data: gData, error: gErr } = await supabase
        .from("games")
        .select(
          `
          id, slug, game_date, status,
          home_score, away_score,
          home_team:home_team_id(id, name),
          away_team:away_team_id(id, name)
        `
        )
        .eq("slug", slug)
        .limit(1)
        .maybeSingle();

      if (gErr || !gData) {
        setLoading(false);
        return;
      }

      if (!alive) return;
      const theGame = gData as unknown as Game;
      setGame(theGame);

      // 2) fetch all events for this game
      const { data: evData, error: evErr } = await supabase
        .from("events")
        .select(
          `
          id,
          period,
          time_mmss,
          event,
          team_id,
          player:player_id(id, name),
          team:team_id(id, name)
        `
        )
        .eq("game_id", theGame.id)
        .order("period", { ascending: true })
        .order("time_mmss", { ascending: true });

      if (evErr || !evData) {
        setLoading(false);
        return;
      }

      if (!alive) return;
      const gameEvents = evData as EventRow[];
      setEvents(gameEvents);

      // 3) season-to-date prior totals: count goals/assists for each player
      //    IN ALL GAMES BEFORE this game's date
      const { data: prevData, error: prevErr } = await supabase
        .from("events")
        .select(
          `
          event,
          player:player_id(id),
          game:game_id(game_date)
        `
        )
        .lt("game.game_date", theGame.game_date);
      // Note: if you want “up to the moment” inside the same game (period/time)
      // you could also fetch same-game events and include earlier ones too. For now
      // we do “all prior games”, then we will increment live while we render this game’s events.

      const map: PriorTotals = {};
      if (!prevErr && prevData) {
        for (const row of prevData as {
          event: string;
          player: { id: string } | null;
          game: { game_date: string } | null;
        }[]) {
          const pid = row.player?.id;
          if (!pid) continue;
          if (!map[pid]) map[pid] = { goals: 0, assists: 0 };
          if (row.event === "goal") map[pid].goals += 1;
          if (row.event === "assist") map[pid].assists += 1;
        }
      }
      setPrior(map);

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  // Group events by “play” (goal + 0..2 assists)
  const groupedByPlay = useMemo(() => {
    const groups = new Map<string, EventRow[]>();
    for (const e of events) {
      const key = playKey(e);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    // sort each play by: goal first, then assists
    for (const [k, arr] of groups) {
      arr.sort((a, b) => (a.event === "goal" ? -1 : 1) - (b.event === "goal" ? -1 : 1));
    }
    // convert to an array and sort the plays by period/time order
    const plays = Array.from(groups.values());
    plays.sort((a, b) => {
      const pa = a[0], pb = b[0];
      const pDiff = (pa.period ?? 0) - (pb.period ?? 0);
      if (pDiff !== 0) return pDiff;
      const ta = pa.time_mmss ?? "99:99";
      const tb = pb.time_mmss ?? "99:99";
      return ta.localeCompare(tb);
    });
    return plays;
  }, [events]);

  if (loading || !game) return <div className="p-4">Chargement…</div>;

  // Make a live copy of prior totals so we can increment as we walk
  const liveTotals: PriorTotals = JSON.parse(JSON.stringify(prior));

  // Render header
  const headlineDate = frDate(game.game_date);
  const homeName = game.home_team?.name ?? "";
  const awayName = game.away_team?.name ?? "";
  const homeShort = shortTeam(homeName);
  const awayShort = shortTeam(awayName);
  const homeScore = game.home_score ?? 0;
  const awayScore = game.away_score ?? 0;

  // Helper to format a single “play” into the line you want
  function renderPlayLine(play: EventRow[]) {
    const p = play[0]?.period ?? 1;
    const teamLabel = shortTeam(play[0]?.team?.name ?? "");
    const time = play[0]?.time_mmss ?? "";

    // find goal & assists
    const goals = play.filter((e) => e.event === "goal");
    const assists = play.filter((e) => e.event === "assist");

    let goalPart = "";
    if (goals.length > 0) {
      const g = goals[0];
      const pid = g.player?.id;
      const name = g.player?.name ?? "Inconnu";
      if (pid) {
        const before = liveTotals[pid]?.goals ?? 0;
        const num = before + 1;
        // increment for next times
        if (!liveTotals[pid]) liveTotals[pid] = { goals: 0, assists: 0 };
        liveTotals[pid].goals = num;
        goalPart = `${name} (${num})`;
      } else {
        goalPart = name;
      }
    }

    let assistPart = "";
    if (assists.length > 0) {
      const namesWithNums: string[] = [];
      for (const a of assists) {
        const pid = a.player?.id;
        const name = a.player?.name ?? "Inconnu";
        if (pid) {
          const before = liveTotals[pid]?.assists ?? 0;
          const num = before + 1;
          if (!liveTotals[pid]) liveTotals[pid] = { goals: 0, assists: 0 };
          liveTotals[pid].assists = num;
          namesWithNums.push(`${name} (${num})`);
        } else {
          namesWithNums.push(name);
        }
      }
      assistPart = ` ASS : ${namesWithNums.join(" & ")}`;
    }

    // Build the final line in your style
    return (
      <div key={play[0].id} className="mb-1">
        <strong>{teamLabel} BUT :</strong> {goalPart}
        {assistPart}
        {time ? ` — ${time}` : ""}
      </div>
    );
  }

  // Group plays by period for display
  const playsByPeriod = useMemo(() => {
    const map = new Map<number, EventRow[][]>();
    for (const play of groupedByPlay) {
      const p = play[0]?.period ?? 1;
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(play);
    }
    const out: { period: number; plays: EventRow[][] }[] = [];
    for (const [period, plays] of map) out.push({ period, plays });
    out.sort((a, b) => a.period - b.period);
    return out;
  }, [groupedByPlay]);

  const periodTitle = (p: number) => {
    if (p === 1) return "1re période";
    if (p === 2) return "2e période";
    if (p === 3) return "3e période";
    return `Prolongation (P${p})`;
  };

  return (
    <div className="p-4 prose max-w-none">
      <h2 className="mb-2 capitalize">{headlineDate}</h2>
      <h3 className="mb-4">
        {homeName} {homeScore} vs {awayName} {awayScore}
      </h3>

      {playsByPeriod.length === 0 && <div>Aucun événement pour ce match.</div>}

      {playsByPeriod.map(({ period, plays }) => (
        <section key={period} className="mb-6">
          <h4 className="font-semibold mb-2">{periodTitle(period)}</h4>
          {plays.map((play) => renderPlayLine(play))}
        </section>
      ))}

      {/* Stars, goalies etc. – optional section placeholders */}
      {/* <div className="mt-6">
        <div>1re étoile : …</div>
        <div>2e étoile : …</div>
        <div>3e étoile : …</div>
      </div> */}
    </div>
  );
}
