import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type TTeam = { id: string; name: string };
type TGame = {
  id: string;
  slug: string;
  game_date: string;
  status: string | null;
  home_team: TTeam | null;
  away_team: TTeam | null;
};
type TPlayer = { id: string; name: string; team_id: string };
type TEventRow = {
  id: string;
  period: number;
  time_mmss: string;
  event: "goal" | "assist";
  player_id: string;
  team_id: string;
};

export default function Scorer() {
  const [games, setGames] = useState<TGame[]>([]);
  const [gameId, setGameId] = useState<string>("");
  const [game, setGame] = useState<TGame | null>(null);

  const [players, setPlayers] = useState<TPlayer[]>([]);
  const [homePlayers, setHomePlayers] = useState<TPlayer[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<TPlayer[]>([]);

  const [period, setPeriod] = useState<number>(1);
  const [time, setTime] = useState<string>("02:00");
  const [team, setTeam] = useState<"home" | "away">("home");

  const [scorer, setScorer] = useState<string>("");
  const [assist1, setAssist1] = useState<string>("");
  const [assist2, setAssist2] = useState<string>("");

  const [events, setEvents] = useState<TEventRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load recent games
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("games")
        .select(`
          id,
          slug,
          game_date,
          status,
          home_team:home_team_id(id, name),
          away_team:away_team_id(id, name)
        `)
        .order("game_date", { ascending: false });
      if (!error && data) setGames(data as TGame[]);
    })();
  }, []);

  // When game changes, hydrate details + players + events
  useEffect(() => {
    const found = games.find((g) => g.id === gameId) || null;
    setGame(found);

    if (!found) {
      setPlayers([]);
      setHomePlayers([]);
      setAwayPlayers([]);
      setEvents([]);
      return;
    }

    (async () => {
      const teamIds = [
        found.home_team?.id,
        found.away_team?.id,
      ].filter(Boolean) as string[];

      // players of both teams
      const { data: pl, error: plErr } = await supabase
        .from("players")
        .select("id, name, team_id")
        .in("team_id", teamIds)
        .order("name", { ascending: true });

      if (!plErr && pl) {
        const ps = pl as TPlayer[];
        setPlayers(ps);
        setHomePlayers(ps.filter((p) => p.team_id === found.home_team?.id));
        setAwayPlayers(ps.filter((p) => p.team_id === found.away_team?.id));
      }

      // events for this game
      const { data: ev, error: evErr } = await supabase
        .from("events")
        .select("id, period, time_mmss, event, player_id, team_id")
        .eq("game_id", found.id)
        .order("period", { ascending: true })
        .order("time_mmss", { ascending: true });

      if (!evErr && ev) setEvents(ev as TEventRow[]);
    })();
  }, [gameId, games]);

  const teamId = useMemo(() => {
    if (!game) return "";
    return team === "home" ? game.home_team?.id ?? "" : game.away_team?.id ?? "";
  }, [team, game]);

  const teamPlayers = team === "home" ? homePlayers : awayPlayers;

  async function addGoal() {
    try {
      setErr(null);
      if (!game || !teamId || !scorer) {
        setErr("Pick a game, team and scorer.");
        return;
      }
      setBusy(true);

      const rows: Partial<TEventRow>[] = [
        {
          period,
          time_mmss: time,
          event: "goal",
          player_id: scorer,
          team_id: teamId,
        },
      ];
      if (assist1) {
        rows.push({
          period,
          time_mmss: time,
          event: "assist",
          player_id: assist1,
          team_id: teamId,
        });
      }
      if (assist2) {
        rows.push({
          period,
          time_mmss: time,
          event: "assist",
          player_id: assist2,
          team_id: teamId,
        });
      }

      // insert all rows for this goal
      const { error } = await supabase
        .from("events")
        .insert(rows.map((r) => ({ ...r, game_id: game.id })));
      if (error) throw error;

      // reload events
      const { data: ev, error: evErr } = await supabase
        .from("events")
        .select("id, period, time_mmss, event, player_id, team_id")
        .eq("game_id", game.id)
        .order("period", { ascending: true })
        .order("time_mmss", { ascending: true });

      if (!evErr && ev) setEvents(ev as TEventRow[]);

      // clear fields for next goal
      setScorer("");
      setAssist1("");
      setAssist2("");
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeEvent(id: string) {
    if (!game) return;
    await supabase.from("events").delete().eq("id", id);
    const { data } = await supabase
      .from("events")
      .select("id, period, time_mmss, event, player_id, team_id")
      .eq("game_id", game.id)
      .order("period", { ascending: true })
      .order("time_mmss", { ascending: true });
    if (data) setEvents(data as TEventRow[]);
  }

  function playerName(id: string) {
    return players.find((p) => p.id === id)?.name ?? "Unknown";
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Live Scorer</h1>

      {/* pick game */}
      <div className="space-y-2">
        <label className="block font-semibold">Game</label>
        <select
          className="border rounded px-2 py-1"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
        >
          <option value="">-- Choose a game --</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {new Date(g.game_date).toLocaleString()} — {g.home_team?.name} vs{" "}
              {g.away_team?.name}
            </option>
          ))}
        </select>
      </div>

      {game && (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Entry form */}
            <div className="space-y-3 border rounded p-3">
              <div className="font-semibold mb-2">
                {game.home_team?.name} vs {game.away_team?.name}
              </div>

              <div className="flex gap-4">
                <div>
                  <label className="block text-sm">Period</label>
                  <select
                    className="border rounded px-2 py-1"
                    value={period}
                    onChange={(e) => setPeriod(Number(e.target.value))}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>OT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm">Time (MM:SS)</label>
                  <input
                    className="border rounded px-2 py-1 w-24"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="02:00"
                  />
                </div>

                <div>
                  <label className="block text-sm">Team</label>
                  <div className="flex items-center gap-2">
                    <label>
                      <input
                        type="radio"
                        checked={team === "home"}
                        onChange={() => setTeam("home")}
                      />{" "}
                      Home
                    </label>
                    <label>
                      <input
                        type="radio"
                        checked={team === "away"}
                        onChange={() => setTeam("away")}
                      />{" "}
                      Away
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm">Scorer</label>
                <select
                  className="border rounded px-2 py-1"
                  value={scorer}
                  onChange={(e) => setScorer(e.target.value)}
                >
                  <option value="">-- choose --</option>
                  {teamPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm">Assist 1 (optional)</label>
                  <select
                    className="border rounded px-2 py-1"
                    value={assist1}
                    onChange={(e) => setAssist1(e.target.value)}
                  >
                    <option value="">-- none --</option>
                    {teamPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm">Assist 2 (optional)</label>
                  <select
                    className="border rounded px-2 py-1"
                    value={assist2}
                    onChange={(e) => setAssist2(e.target.value)}
                  >
                    <option value="">-- none --</option>
                    {teamPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {err && <div className="text-red-600 text-sm">{err}</div>}

              <button
                disabled={busy}
                onClick={addGoal}
                className="mt-2 rounded bg-black text-white px-3 py-1 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Add Goal"}
              </button>
            </div>

            {/* Events list */}
            <div className="space-y-2">
              <div className="font-semibold mb-2">Events (this game)</div>
              {events.length === 0 ? (
                <div className="text-sm text-gray-500">No events yet.</div>
              ) : (
                <ul className="space-y-1">
                  {events.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between border rounded px-2 py-1"
                    >
                      <div className="text-sm">
                        <span className="text-gray-500 mr-2">
                          P{e.period} {e.time_mmss}
                        </span>
                        {e.event.toUpperCase()} — {playerName(e.player_id)}
                      </div>
                      <button
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => removeEvent(e.id)}
                      >
                        delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
