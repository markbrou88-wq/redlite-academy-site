import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

/** DB types we actually use on this screen */
type Team = { id: string; name: string; short_name: string | null };
type Player = { id: string; name: string; number: number | null; team_id: string };
type Game = {
  id: string;
  slug: string;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  home: Team | null;
  away: Team | null;
};

type Side = "away" | "home";

export default function Scorer() {
  const navigate = useNavigate();

  // auth gate (simple & silent)
  const [authReady, setAuthReady] = useState(false);

  // data
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  // form state
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [side, setSide] = useState<Side>("away"); // left = away by default
  const [period, setPeriod] = useState<number>(1);
  const [time, setTime] = useState<string>("00:00");
  const [scorerId, setScorerId] = useState<string>("");
  const [assist1Id, setAssist1Id] = useState<string>("");
  const [assist2Id, setAssist2Id] = useState<string>("");

  // UI
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // ------ Auth check ------
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/signin", { replace: true });
        return;
      }
      setAuthReady(true);
    })();
  }, [navigate]);

  // ------ Load games (with team names/short) ------
  useEffect(() => {
    if (!authReady) return;
    (async () => {
      setMsg("");
      const { data, error } = await supabase
        .from("games")
        .select(`
          id, slug, game_date, home_team_id, away_team_id,
          home:home_team_id ( id, name, short_name ),
          away:away_team_id ( id, name, short_name )
        `)
        .order("game_date", { ascending: false })
        .limit(200);

      if (error) {
        setMsg(error.message);
        return;
      }
      const list = (data ?? []) as Game[];
      setGames(list);
      // pick most recent by default
      if (list.length && !selectedSlug) setSelectedSlug(list[0].slug);
    })();
  }, [authReady]);

  // ------ Load all players once ------
  useEffect(() => {
    if (!authReady) return;
    (async () => {
      setMsg("");
      const { data, error } = await supabase
        .from("players")
        .select("id, name, number, team_id")
        .order("name");
      if (error) {
        setMsg(error.message);
        return;
      }
      setPlayers((data ?? []) as Player[]);
    })();
  }, [authReady]);

  const selectedGame = useMemo(
    () => games.find((g) => g.slug === selectedSlug) ?? null,
    [games, selectedSlug]
  );

  // Which team is active for this entry (depends on side)
  const activeTeamId = useMemo(() => {
    if (!selectedGame) return "";
    return side === "away" ? selectedGame.away_team_id : selectedGame.home_team_id;
  }, [selectedGame, side]);

  // Roster filter for active team
  const roster = useMemo(
    () => players.filter((p) => p.team_id === activeTeamId),
    [players, activeTeamId]
  );

  // Helper: label team buttons with team short names
  const awayLabel = selectedGame?.away?.short_name ?? "Away";
  const homeLabel = selectedGame?.home?.short_name ?? "Home";

  // ------ Insert events ------
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!selectedGame) {
      setMsg("Choose a game.");
      return;
    }
    if (!scorerId) {
      setMsg("Choose a scorer.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setMsg("Time must be MM:SS.");
      return;
    }
    // ensure assists are not the same as scorer
    if (assist1Id && assist1Id === scorerId) {
      setMsg("Assist 1 cannot be the scorer.");
      return;
    }
    if (assist2Id && (assist2Id === scorerId || assist2Id === assist1Id)) {
      setMsg("Assist 2 must be different from scorer/assist 1.");
      return;
    }

    setSaving(true);
    try {
      const teamId = activeTeamId;
      if (!teamId) throw new Error("Missing team for this side.");

      const rows: any[] = [
        {
          game_id: selectedGame.id,
          team_id: teamId,
          player_id: scorerId,
          period,
          time_mmss: time,
          event: "goal",
        },
      ];
      if (assist1Id) {
        rows.push({
          game_id: selectedGame.id,
          team_id: teamId,
          player_id: assist1Id,
          period,
          time_mmss: time,
          event: "assist",
        });
      }
      if (assist2Id) {
        rows.push({
          game_id: selectedGame.id,
          team_id: teamId,
          player_id: assist2Id,
          period,
          time_mmss: time,
          event: "assist",
        });
      }

      const { error } = await supabase.from("events").insert(rows);
      if (error) throw error;

      setMsg("Saved!");
      // Keep period as-is; clear only people/time to speed live scoring
      setTime("00:00");
      setScorerId("");
      setAssist1Id("");
      setAssist2Id("");
    } catch (err: any) {
      setMsg(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!authReady) return null;

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Scorer</h1>

      {/* Game & Teams */}
      <form onSubmit={handleSave} className="space-y-4">
        {/* Game (by slug) */}
        <label className="block">
          <div className="font-semibold">Game</div>
          <select
            className="border p-2 w-full"
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
          >
            {games.map((g) => (
              <option key={g.id} value={g.slug}>
                {g.slug}
              </option>
            ))}
          </select>
        </label>

        {/* Side selection, labeled with teams (Away on the left, Home on the right) */}
        <div className="flex items-center gap-8">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="side"
              checked={side === "away"}
              onChange={() => setSide("away")}
            />
            <span>{awayLabel}</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="side"
              checked={side === "home"}
              onChange={() => setSide("home")}
            />
            <span>{homeLabel}</span>
          </label>
        </div>

        {/* Period & Time */}
        <div className="flex gap-4">
          <label className="block">
            <div className="font-semibold">Period</div>
            <input
              type="number"
              min={1}
              max={5}
              className="border p-2 w-24"
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
            />
          </label>
          <label className="block">
            <div className="font-semibold">Time (MM:SS)</div>
            <input
              type="text"
              className="border p-2 w-24"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="13:37"
            />
          </label>
        </div>

        {/* Scorer & Assists (filtered to active team) */}
        <label className="block">
          <div className="font-semibold">Scorer</div>
          <select
            className="border p-2 w-full"
            value={scorerId}
            onChange={(e) => setScorerId(e.target.value)}
            disabled={!activeTeamId}
          >
            <option value="">-- choose --</option>
            {roster.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.number ? `(#${p.number})` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="font-semibold">Assist 1 (optional)</div>
            <select
              className="border p-2 w-full"
              value={assist1Id}
              onChange={(e) => setAssist1Id(e.target.value)}
              disabled={!activeTeamId}
            >
              <option value="">-- none --</option>
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.number ? `(#${p.number})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="font-semibold">Assist 2 (optional)</div>
            <select
              className="border p-2 w-full"
              value={assist2Id}
              onChange={(e) => setAssist2Id(e.target.value)}
              disabled={!activeTeamId}
            >
              <option value="">-- none --</option>
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.number ? `(#${p.number})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={
            saving || !selectedGame || !activeTeamId || !scorerId || !/^\d{2}:\d{2}$/.test(time)
          }
        >
          {saving ? "Saving…" : "Save goal"}
        </button>

        {msg && <div className="text-sm mt-2">{msg}</div>}
      </form>
    </div>
  );
}
