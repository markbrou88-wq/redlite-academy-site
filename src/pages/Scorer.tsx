import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Team = { id: string; name: string; short_name: string | null };
type Player = { id: string; name: string; number: number | null; team_id: string };
type Game = {
  id: string;
  slug: string;
  game_date: string;
  status: string | null;
  home_team_id: string;
  away_team_id: string;
  home_name?: string;
  away_name?: string;
  home_short?: string | null;
  away_short?: string | null;
};

type GoalLine = {
  id: string;
  period: number;
  time_mmss: string;
  team_id: string;
  player_name: string;
  event: string;
};

export default function Scorer() {
  const navigate = useNavigate();

  // auth
  const [userReady, setUserReady] = useState(false);

  // master data
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  // create new game
  const [newDate, setNewDate] = useState<string>("");
  const [newTime, setNewTime] = useState<string>("");
  const [awayTeamId, setAwayTeamId] = useState<string>("");
  const [homeTeamId, setHomeTeamId] = useState<string>("");

  // scoring form
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [teamSide, setTeamSide] = useState<"away" | "home">("away");
  const [period, setPeriod] = useState<number>(1);
  const [timeMMSS, setTimeMMSS] = useState<string>("00:00");
  const [scorerId, setScorerId] = useState<string>("");
  const [assist1Id, setAssist1Id] = useState<string>("");
  const [assist2Id, setAssist2Id] = useState<string>("");

  // UI
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");

  // simple goal list preview
  const [currentGoals, setCurrentGoals] = useState<GoalLine[]>([]);

  // ---------- helpers ----------
  function ymd(dateStr: string) {
    // input from <input type="date" /> already "YYYY-MM-DD"
    return dateStr;
  }

  function toIso(dateStr: string, timeStr: string) {
    // If time is "HH:MM", add ":00"
    const t = timeStr?.length === 5 ? `${timeStr}:00` : timeStr || "00:00:00";
    // Store as local time (no Z). If you want UTC, add 'Z'.
    return `${dateStr}T${t}`;
  }

  function makeSlug(awayShort: string, homeShort: string, dateStr: string) {
    return `${awayShort}_vs_${homeShort}_${dateStr}_game_1`;
  }

  // selected game object
  const selectedGame = useMemo(
    () => games.find(g => g.slug === selectedSlug),
    [games, selectedSlug]
  );

  // selected team id based on side
  const selectedTeamId = useMemo(() => {
    if (!selectedGame) return "";
    return teamSide === "away" ? selectedGame.away_team_id : selectedGame.home_team_id;
  }, [selectedGame, teamSide]);

  // filtered players (by selectedTeamId)
  const teamPlayers = useMemo(
    () => players.filter(p => p.team_id === selectedTeamId),
    [players, selectedTeamId]
  );

  const awayShort = selectedGame?.away_short ?? "AWY";
  const homeShort = selectedGame?.home_short ?? "HME";

  // ---------- load ----------
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/signin", { replace: true });
        return;
      }
      setUserReady(true);

      await Promise.all([loadTeams(), loadPlayers(), loadGames()]);
    })();
  }, [navigate]);

  async function loadTeams() {
    const { data, error } = await supabase
      .from("teams")
      .select("id, name, short_name")
      .order("name");
    if (!error && data) setTeams(data as Team[]);
  }

  async function loadPlayers() {
    const { data, error } = await supabase
      .from("players")
      .select("id, name, number, team_id")
      .order("name");
    if (!error && data) setPlayers(data as Player[]);
  }

  async function loadGames() {
    const { data, error } = await supabase
      .from("games")
      .select(`
        id, slug, game_date, status, home_team_id, away_team_id,
        home:home_team_id ( name, short_name ),
        away:away_team_id ( name, short_name )
      `)
      .order("game_date", { ascending: false });
    if (!error && data) {
      const mapped = (data as any[]).map(row => ({
        id: row.id,
        slug: row.slug,
        game_date: row.game_date,
        status: row.status,
        home_team_id: row.home_team_id,
        away_team_id: row.away_team_id,
        home_name: row.home?.name,
        home_short: row.home?.short_name,
        away_name: row.away?.name,
        away_short: row.away?.short_name,
      })) as Game[];
      setGames(mapped);
    }
  }

  // Load current goals for preview
  useEffect(() => {
    if (!selectedGame) {
      setCurrentGoals([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select(`
          id, event, period, time_mmss, team_id,
          player:player_id(name)
        `)
        .eq("game_id", selectedGame.id)
        .in("event", ["goal", "assist"])
        .order("period", { ascending: true })
        .order("time_mmss", { ascending: true });

      if (!error && data) {
        const mapped = (data as any[]).map(r => ({
          id: r.id,
          event: r.event,
          period: r.period,
          time_mmss: r.time_mmss,
          team_id: r.team_id,
          player_name: r.player?.name ?? "",
        })) as GoalLine[];
        setCurrentGoals(mapped);
      } else {
        setCurrentGoals([]);
      }
    })();
  }, [selectedGame]);

  // ---------- actions ----------

  async function handleCreateGame() {
    setMessage("");

    if (!newDate || !newTime || !awayTeamId || !homeTeamId) {
      setMessage("Pick date, time, away and home teams.");
      return;
    }
    if (awayTeamId === homeTeamId) {
      setMessage("Away and Home teams must be different.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    const awayShortName = teams.find(t => t.id === awayTeamId)?.short_name ?? "AWY";
    const homeShortName = teams.find(t => t.id === homeTeamId)?.short_name ?? "HME";
    const dateYMD = ymd(newDate);
    const gameDateISO = toIso(newDate, newTime);
    const slug = makeSlug(awayShortName, homeShortName, dateYMD);

    setSaving(true);
    try {
      const insertRow = {
        slug,
        game_date: gameDateISO,
        away_team_id: awayTeamId,
        home_team_id: homeTeamId,
        status: "scheduled",
        created_by: user.id,
      };
      const { error, data } = await supabase
        .from("games")
        .insert(insertRow)
        .select("id, slug")
        .single();

      if (error) throw error;

      await loadGames();
      setSelectedSlug(data.slug);
      setMessage("Game created.");
    } catch (e: any) {
      setMessage(e.message ?? "Could not create game.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkFinal() {
    if (!selectedGame) {
      setMessage("Pick a game first.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("games")
        .update({ status: "final" })
        .eq("id", selectedGame.id);
      if (error) throw error;

      await loadGames();
      setMessage("Game marked Final.");
    } catch (e: any) {
      setMessage(e.message ?? "Could not mark final.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!selectedGame) {
      setMessage("Pick a game.");
      return;
    }
    if (!selectedTeamId) {
      setMessage("Pick a team (left/right).");
      return;
    }
    if (!scorerId) {
      setMessage("Pick a scorer.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(timeMMSS)) {
      setMessage("Time must be MM:SS");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    setSaving(true);
    try {
      // 1) goal row
      const base = {
        game_id: selectedGame.id,
        team_id: selectedTeamId,
        period,
        time_mmss: timeMMSS,
        created_by: user.id,
      };

      const goalRow = { ...base, event: "goal", player_id: scorerId };
      let { error } = await supabase.from("events").insert(goalRow);
      if (error) throw error;

      // 2) assists (optional)
      const assists: any[] = [];
      if (assist1Id) assists.push({ ...base, event: "assist", player_id: assist1Id });
      if (assist2Id) assists.push({ ...base, event: "assist", player_id: assist2Id });
      if (assists.length) {
        const { error: aErr } = await supabase.from("events").insert(assists);
        if (aErr) throw aErr;
      }

      setMessage("Saved!");
      setAssist1Id("");
      setAssist2Id("");
      await refreshGoals();
    } catch (err: any) {
      setMessage(err.message ?? "Error saving.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshGoals() {
    if (!selectedGame) return;
    const { data, error } = await supabase
      .from("events")
      .select(`
        id, event, period, time_mmss, team_id,
        player:player_id(name)
      `)
      .eq("game_id", selectedGame.id)
      .in("event", ["goal", "assist"])
      .order("period", { ascending: true })
      .order("time_mmss", { ascending: true });

    if (!error && data) {
      const mapped = (data as any[]).map(r => ({
        id: r.id,
        event: r.event,
        period: r.period,
        time_mmss: r.time_mmss,
        team_id: r.team_id,
        player_name: r.player?.name ?? "",
      })) as GoalLine[];
      setCurrentGoals(mapped);
    }
  }

  // ---------- render ----------
  if (!userReady) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Scorer</h1>

      {/* Create new game */}
      <section className="border rounded p-4 space-y-4">
        <h2 className="font-semibold text-lg">New game</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className="block">
            <div className="text-sm font-medium">Date</div>
            <input
              type="date"
              className="border p-2 w-full"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
            />
          </label>
          <label className="block">
            <div className="text-sm font-medium">Time</div>
            <input
              type="time"
              className="border p-2 w-full"
              value={newTime}
              onChange={e => setNewTime(e.target.value)}
            />
          </label>
          <label className="block">
            <div className="text-sm font-medium">Away team</div>
            <select
              className="border p-2 w-full"
              value={awayTeamId}
              onChange={e => setAwayTeamId(e.target.value)}
            >
              <option value="">-- choose --</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.short_name ? `${t.id} — ${t.name}` : t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-sm font-medium">Home team</div>
            <select
              className="border p-2 w-full"
              value={homeTeamId}
              onChange={e => setHomeTeamId(e.target.value)}
            >
              <option value="">-- choose --</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.short_name ? `${t.id} — ${t.name}` : t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          onClick={handleCreateGame}
          disabled={saving}
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {saving ? "Working…" : "Create game"}
        </button>
      </section>

      {/* Scoring area */}
      <form onSubmit={handleSaveGoal} className="space-y-4">
        <label className="block">
          <div className="text-sm font-medium">Game (slug)</div>
          <select
            className="border p-2 w-full"
            value={selectedSlug}
            onChange={e => setSelectedSlug(e.target.value)}
          >
            <option value="">-- choose --</option>
            {games.map(g => (
              <option key={g.id} value={g.slug}>
                {g.slug}
              </option>
            ))}
          </select>
        </label>

        {/* team side toggle shown as AwayShort/HomeShort */}
        {selectedGame && (
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={teamSide === "away"}
                onChange={() => setTeamSide("away")}
              />
              <span>{awayShort ?? "AWAY"}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={teamSide === "home"}
                onChange={() => setTeamSide("home")}
              />
              <span>{homeShort ?? "HOME"}</span>
            </label>

            <div className="grow" />
            <button
              type="button"
              onClick={handleMarkFinal}
              className="border px-3 py-2 rounded"
            >
              Mark game FINAL
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <label className="block">
            <div className="text-sm font-medium">Period</div>
            <input
              type="number"
              className="border p-2 w-full"
              min={1}
              max={5}
              value={period}
              onChange={e => setPeriod(Number(e.target.value))}
            />
          </label>
          <label className="block md:col-span-4">
            <div className="text-sm font-medium">Time (MM:SS)</div>
            <input
              type="text"
              className="border p-2 w-40"
              value={timeMMSS}
              onChange={e => setTimeMMSS(e.target.value)}
              placeholder="00:00"
            />
          </label>
        </div>

        <label className="block">
          <div className="text-sm font-medium">Scorer</div>
          <select
            className="border p-2 w-full"
            disabled={!selectedTeamId}
            value={scorerId}
            onChange={e => setScorerId(e.target.value)}
          >
            <option value="">-- choose --</option>
            {teamPlayers.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.number ? ` (#${p.number})` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm font-medium">Assist 1 (optional)</div>
            <select
              className="border p-2 w-full"
              disabled={!selectedTeamId}
              value={assist1Id}
              onChange={e => setAssist1Id(e.target.value)}
            >
              <option value="">-- none --</option>
              {teamPlayers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.number ? ` (#${p.number})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-sm font-medium">Assist 2 (optional)</div>
            <select
              className="border p-2 w-full"
              disabled={!selectedTeamId}
              value={assist2Id}
              onChange={e => setAssist2Id(e.target.value)}
            >
              <option value="">-- none --</option>
              {teamPlayers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.number ? ` (#${p.number})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving || !selectedGame}
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save goal"}
        </button>

        {message && <div className="text-sm pt-2">{message}</div>}
      </form>

      {/* Current goals preview */}
      {selectedGame && (
        <section className="space-y-2">
          <h3 className="font-semibold">
            Current goals — {selectedGame.away_name} vs {selectedGame.home_name}
          </h3>
          {currentGoals.length === 0 ? (
            <div className="text-sm text-gray-600">No goals saved yet for this game.</div>
          ) : (
            <ul className="list-disc pl-6 text-sm space-y-1">
              {currentGoals.map(gl => (
                <li key={gl.id}>
                  [{gl.period}] {gl.time_mmss} — {gl.event.toUpperCase()} ({gl.team_id}) : {gl.player_name}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
