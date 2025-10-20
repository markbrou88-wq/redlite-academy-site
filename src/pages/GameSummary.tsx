import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import supabase from "../lib/supabase";

type Team = {
  id: string;
  name: string;
  short_name: "RLR" | "RLB" | "RLN" | string;
};

type Game = {
  id: string;
  slug: string;
  status: "scheduled" | "live" | "final" | string;
  game_date: string; // ISO
  home_team_id: string;
  away_team_id: string;
};

type EventRow = {
  id: string;
  game_id: string;
  team_id: string;
  period: number;
  time_mmss: string; // "MM:SS"
  event: "goal" | string;
  scorer_id: string | null;
  assist1_id: string | null;
  assist2_id: string | null;
};

type Player = {
  id: string;
  name: string;
  number: number | null;
};

function teamLogoUrl(shortName?: string) {
  // Map short names to your public logos (public/logos/*.png)
  const key = (shortName || "").toLowerCase(); // rlr / rlb / rln
  if (key === "rlr" || key === "rlb" || key === "rln") {
    return `/logos/${key}.png`;
  }
  return ""; // fallback – nothing
}

function niceTeamCode(short?: string, name?: string) {
  if (short && ["RLR", "RLB", "RLN"].includes(short)) return short;
  // fallback from name:
  if (!name) return "";
  if (/blue/i.test(name)) return "RLB";
  if (/black|noir/i.test(name)) return "RLN";
  return "RLR";
}

function byTime(a: EventRow, b: EventRow) {
  if (a.period !== b.period) return a.period - b.period;
  // "MM:SS" safely sortable by minutes then seconds
  const [am, as] = a.time_mmss.split(":").map((x) => parseInt(x || "0", 10));
  const [bm, bs] = b.time_mmss.split(":").map((x) => parseInt(x || "0", 10));
  if (am !== bm) return am - bm;
  return as - bs;
}

export default function GameSummary() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<Game | null>(null);
  const [home, setHome] = useState<Team | null>(null);
  const [away, setAway] = useState<Team | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [playersById, setPlayersById] = useState<Record<string, Player>>({});

  // fetch everything
  useEffect(() => {
    let isCancelled = false;

    async function run() {
      try {
        setLoading(true);

        // 1) game
        const { data: g, error: gErr } = await supabase
          .from("games")
          .select("id, slug, status, game_date, home_team_id, away_team_id")
          .eq("slug", slug)
          .single();

        if (gErr) throw gErr;
        if (!g) throw new Error("Game not found");

        // 2) teams
        const teamIds = [g.home_team_id, g.away_team_id];
        const { data: teams, error: tErr } = await supabase
          .from("teams")
          .select("id, name, short_name")
          .in("id", teamIds);

        if (tErr) throw tErr;
        const homeTeam = teams?.find((t) => t.id === g.home_team_id) || null;
        const awayTeam = teams?.find((t) => t.id === g.away_team_id) || null;

        // 3) events for this game (goals only)
        const { data: ev, error: eErr } = await supabase
          .from("events")
          .select(
            "id, game_id, team_id, period, time_mmss, event, scorer_id, assist1_id, assist2_id"
          )
          .eq("game_id", g.id)
          .eq("event", "goal");

        if (eErr) throw eErr;

        // 4) fetch players referenced in those events
        const playerIds = Array.from(
          new Set(
            (ev || [])
              .flatMap((r) => [r.scorer_id, r.assist1_id, r.assist2_id])
              .filter((x): x is string => !!x)
          )
        );

        let playersDict: Record<string, Player> = {};
        if (playerIds.length) {
          const { data: players, error: pErr } = await supabase
            .from("players")
            .select("id, name, number")
            .in("id", playerIds);

          if (pErr) throw pErr;
          players?.forEach((p) => (playersDict[p.id] = p));
        }

        if (isCancelled) return;

        setGame(g);
        setHome(homeTeam);
        setAway(awayTeam);
        setEvents((ev || []).sort(byTime));
        setPlayersById(playersDict);
      } catch (err) {
        console.error(err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    run();
    return () => {
      isCancelled = true;
    };
  }, [slug]);

  const homeCode = useMemo(() => niceTeamCode(home?.short_name, home?.name), [home]);
  const awayCode = useMemo(() => niceTeamCode(away?.short_name, away?.name), [away]);

  const score = useMemo(() => {
    const h = events.filter((e) => e.team_id === home?.id).length;
    const a = events.filter((e) => e.team_id === away?.id).length;
    return { home: h, away: a };
  }, [events, home, away]);

  const grouped = useMemo(() => {
    const out: Record<number, EventRow[]> = {};
    for (const e of events) {
      if (!out[e.period]) out[e.period] = [];
      out[e.period].push(e);
    }
    return out;
  }, [events]);

  if (loading || !game || !home || !away) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-sm text-gray-500">Loading game…</p>
      </div>
    );
  }

  const dateLabel = new Date(game.game_date).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <Link to="/league/games" className="text-sm text-blue-600 hover:underline">
          ← Return to games
        </Link>
      </div>

      {/* Header: logos + score */}
      <div className="grid grid-cols-3 items-center gap-4 rounded-lg border bg-white p-4 shadow-sm">
        {/* Away */}
        <div className="flex items-center gap-3">
          {awayCode && (
            <img
              src={teamLogoUrl(awayCode)}
              alt={away.name}
              className="h-14 w-auto object-contain"
            />
          )}
          <div>
            <div className="text-xs uppercase text-gray-500">Away</div>
            <div className="font-medium">{away.name}</div>
          </div>
        </div>

        {/* Score + date */}
        <div className="text-center">
          <div className="text-4xl font-semibold tracking-tight">
            {score.away} <span className="mx-2 text-gray-400">–</span> {score.home}
          </div>
          <div className="mt-1 text-sm text-gray-500">
            {dateLabel} • <span className="uppercase">{game.status}</span>
          </div>
        </div>

        {/* Home */}
        <div className="flex flex-row-reverse items-center gap-3">
          {homeCode && (
            <img
              src={teamLogoUrl(homeCode)}
              alt={home.name}
              className="h-14 w-auto object-contain"
            />
          )}
          <div className="text-right">
            <div className="text-xs uppercase text-gray-500">Home</div>
            <div className="font-medium">{home.name}</div>
          </div>
        </div>
      </div>

      {/* Events by period */}
      <div className="mt-8 space-y-8">
        {Object.keys(grouped)
          .map((k) => parseInt(k, 10))
          .sort((a, b) => a - b)
          .map((period) => (
            <div key={period} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-4 text-lg font-semibold">
                {period}e période
              </div>

              <ul className="space-y-2">
                {grouped[period].map((ev) => {
                  const isHomeTeam = ev.team_id === home.id;
                  const code = isHomeTeam ? homeCode : awayCode;

                  const scorer = ev.scorer_id ? playersById[ev.scorer_id] : undefined;
                  const a1 = ev.assist1_id ? playersById[ev.assist1_id] : undefined;
                  const a2 = ev.assist2_id ? playersById[ev.assist2_id] : undefined;

                  const parts: string[] = [];
                  if (scorer) {
                    parts.push(
                      `${scorer.name}${scorer.number ? ` (#${scorer.number})` : ""}`
                    );
                  }
                  const assists: string[] = [];
                  if (a1)
                    assists.push(
                      `${a1.name}${a1.number ? ` (#${a1.number})` : ""}`
                    );
                  if (a2)
                    assists.push(
                      `${a2.name}${a2.number ? ` (#${a2.number})` : ""}`
                    );

                  return (
                    <li
                      key={ev.id}
                      className="flex items-start gap-3 rounded-md bg-gray-50 p-2"
                    >
                      <div className="w-14 shrink-0 text-sm font-medium tabular-nums text-gray-600">
                        {ev.time_mmss}
                      </div>
                      <div className="grow">
                        <div className="text-sm">
                          <span className="mr-1 font-semibold">BUT</span>
                          <span className="text-gray-600">({code}) :</span>{" "}
                          <span className="font-medium">{parts.join(" ")}</span>
                          {assists.length > 0 && (
                            <>
                              {" "}
                              <span className="text-gray-500"> ASS :</span>{" "}
                              <span className="text-gray-800">
                                {assists.join(", ")}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
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
