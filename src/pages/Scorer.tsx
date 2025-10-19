// src/pages/Scorer.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Team = { id: string; name: string; short_name: string | null };
type Player = { id: string; name: string; team_id: string; number?: number | null };
type Game = {
  id: string;
  slug: string;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  home_team?: Team | null;
  away_team?: Team | null;
  status?: string | null;
};

export default function Scorer() {
  const navigate = useNavigate();

  // auth gate
  const [userReady, setUserReady] = useState(false);

  // reference data
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  // active selection
  const [selectedGameId, setSelectedGameId] = useState<string>("");

  // side/team selection for the goal being entered
  const [teamSide, setTeamSide] = useState<"away" | "home">("away");
  const [period, setPeriod] = useState<number>(1);
  const [time, setTime] = useState<string>("00:00");

  // event fields
  const [scorerId, setScorerId] = useState<string>("");
  const [assist1Id, setAssist1Id] = useState<string>("");
  const [assist2Id, setAssist2Id] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // -- Create game form
  const [createBusy, setCreateBusy] = useState(false);
  const [newDate, setNewDate] = useState<string>(() => {
    const d = new Date();
    // yyyy-mm-dd (HTML date input)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [newTime, setNewTime] = useState<string>("20:00"); // local typical
  const [newHomeId, setNewHomeId] = useState<string>("");
  const [newAwayId, setNewAwayId] = useState<string>("");

  // ------------------ auth ------------------
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/signin", { replace: true });
        return;
      }
      setUserReady(true);
    })();
  }, [navigate]);

  // ------------------ load teams/players/games ------------------
  useEffect(() => {
    if (!userReady) return;
    (async () => {
      const [{ data: tData }, { data: pData }, { data: gData }] = await Promise.all([
        supabase.from("teams").select("id,name,short_name").order("name"),
        supabase.from("players").select("id,name,team_id,number").order("name"),
        supabase
          .from("games")
          .select(
            `
            id, slug, game_date, status,
            home_team_id, away_team_id,
            home_team:home_team_id(id,name,short_name),
            away_team:away_team_id(id,name,short_name)
          `
          )
          .order("game_date", { ascending: false })
          .limit(120),
      ]);

      setTeams((tData ?? []) as Team[]);
      setPlayers((pData ?? []) as Player[]);
      setGames((gData ?? []) as Game[]);
    })();
  }, [userReady]);

  const selectedGame = useMemo(() => games.find((g) => g.id === selectedGameId) ?? null, [games, selectedGameId]);

  const awayTeam = useMemo(() => {
    if (!selectedGame) return null;
    return teams.find((t) => t.id === selectedGame.away_team_id) ?? selectedGame.away_team ?? null;
  }, [selectedGame, teams]);

  const homeTeam = useMemo(() => {
    if (!selectedGame) return null;
    return teams.find((t) => t.id === selectedGame.home_team_id) ?? selectedGame.home_team ?? null;
  }, [selectedGame, teams]);

  const selectedTeamId = useMemo(() => {
    if (!selectedGame) return "";
    return teamSide === "away" ? selectedGame.away_team_id : selectedGame.home_team_id;
  }, [selectedGame, teamSide]);

  const teamPlayers = useMemo(() => {
    return players.filter((p) => p.team_id === selectedTeamId);
  }, [players, selectedTeamId]);

  // ------------------ helpers ------------------
  function formatSlugDate(d: Date) {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${mm}.${dd}.${yyyy}`;
  }

  function short(tid: string | null | undefined) {
    const t = teams.find((x) => x.id === tid);
    return t?.short_name || "UNK";
  }

  async function nextGameSlug(awayId: string, homeId: string, gameDate: Date) {
    // Count games on that day to pick next _game_N
    const start = new Date(gameDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const { count } = await supabase
      .from("games")
      .select("id", { count: "exact", head: true })
      .gte("game_date", start.toISOString())
      .lt("game_date", end.toISOString());

    const n = (count ?? 0) + 1;
    const dateStr = formatSlugDate(gameDate);
    return `${short(awayId)}_vs_${short(homeId)}_${dateStr}_game_${n}`;
  }

  // ------------------ create game ------------------
  async function handleCreateGame(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!newAwayId || !newHomeId) {
      setMsg("Choose both Away and Home teams.");
      return;
    }
    if (newAwayId === newHomeId) {
      setMsg("Away and Home cannot be the same team.");
      return;
    }
    if (!newDate || !newTime) {
      setMsg("Choose date and time.");
      return;
    }

    setCreateBusy(true);
    try {
      // Build ISO date/time
      const isoLocal = new Date(`${newDate}T${newTime}:00`);
      // Generate slug
      const slug = await nextGameSlug(newAwayId, newHomeId, isoLocal);

      const { data, error } = await supabase
        .from("games")
        .insert({
          slug,
          game_date: isoLocal.toISOString(),
          status: "scheduled",
          home_team_id: newHomeId,
          away_team_id: newAwayId,
        })
        .select(
          `
          id, slug, game_date, status,
          home_team_id, away_team_id,
          home_team:home_team_id(id,name,short_name),
          away_team:away_team_id(id,name,short_name)
        `
        )
        .single();

      if (error) throw error;
      if (data) {
        setGames((prev) => [data as Game, ...prev]);
        setSelectedGameId(data.id);
        setTeamSide("away"); // default
        setPeriod(1);
        setTime("00:00");
        setScorerId("");
        setAssist1Id("");
        setAssist2Id("");
        setMsg(`Game created: ${data.slug}`);
      }
    } catch (err: any) {
      setMsg(err.message ?? "Error creating game");
    } finally {
      setCreateBusy(false);
    }
  }

  // ------------------ save goal ------------------
  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!selectedGame) {
      setMsg("Pick a game.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setMsg("Time must be MM:SS");
      return;
    }
    if (!scorerId) {
      setMsg("Pick a scorer.");
      return;
    }

    setSaving(true);
    try {
      const teamId = selectedTeamId;

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
      // keep scorer, reset assists
      setAssist1Id("");
      setAssist2Id("");
    } catch (err: any) {
      setMsg(err.message ?? "Error saving goal");
    } finally {
      setSaving(false);
    }
  }

  if (!userReady) return null;

  // UI helpers
  const awayShort = awayTeam?.short_name || "AWAY";
  const homeShort = homeTeam?.short_name || "HOME";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Scorer</h1>

      {/* ---------- Create Game Card ---------- */}
      <form onSubmit={handleCreateGame} className="space-y-3 border rounded p-4">
        <h2 className="font-semibold text-lg">New game</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="block">
            <div className="text-sm font-medium">Date</div>
            <input
              type="date"
              className="border p-2 w-full"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium">Time</div>
            <input
              type="time"
              className="border p-2 w-full"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium">Away team</div>
            <select
              className="border p-2 w-full"
              value={newAwayId}
              onChange={(e) => setNewAwayId(e.target.value)}
            >
              <option value="">-- choose away --</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.short_name ?? ""} — {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="text-sm font-medium">Home team</div>
            <select
              className="border p-2 w-full"
              value={newHomeId}
              onChange={(e) => setNewHomeId(e.target.value)}
            >
              <option value="">-- choose home --</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.short_name ?? ""} — {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={createBusy || !newAwayId || !newHomeId || !newDate || !newTime}
        >
          {createBusy ? "Creating…" : "Create game"}
        </button>
      </form>

      {/* ---------- Existing Game + Event entry ---------- */}
      <form onSubmit={handleSaveGoal} className="space-y-6">
        {/* Game picker by slug */}
        <label className="block">
          <div className="font-semibold">Game (slug)</div>
          <select
            className="border p-2 w-full"
            value={selectedGameId}
            onChange={(e) => setSelectedGameId(e.target.value)}
          >
            <option value="">-- choose --</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.slug}
              </option>
            ))}
          </select>
        </label>

        {/* Away/Home toggle with team short names */}
        <div className="flex gap-6">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={teamSide === "away"}
              onChange={() => setTeamSide("away")}
              disabled={!selectedGame}
            />
            <span>{awayShort}</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={teamSide === "home"}
              onChange={() => setTeamSide("home")}
              disabled={!selectedGame}
            />
            <span>{homeShort}</span>
          </label>
        </div>

        {/* period + time */}
        <div className="flex gap-4">
          <label className="block">
            <div className="font-semibold">Period</div>
            <input
              type="number"
              className="border p-2 w-24"
              min={1}
              max={5}
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

        {/* Scorer / Assists — filtered to the chosen team */}
        <label className="block">
          <div className="font-semibold">Scorer</div>
          <select
            className="border p-2 w-full"
            value={scorerId}
            onChange={(e) => setScorerId(e.target.value)}
            disabled={!selectedTeamId}
          >
            <option value="">-- choose --</option>
            {teamPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.number ? ` (#${p.number})` : ""}
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
              disabled={!selectedTeamId}
            >
              <option value="">-- none --</option>
              {teamPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.number ? ` (#${p.number})` : ""}
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
              disabled={!selectedTeamId}
            >
              <option value="">-- none --</option>
              {teamPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.number ? ` (#${p.number})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={saving || !selectedGame || !scorerId}
        >
          {saving ? "Saving…" : "Save goal"}
        </button>
      </form>

      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
