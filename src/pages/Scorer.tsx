import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Team = { id: string; name: string; short_name: string | null };
type Player = { id: string; name: string; team_id: string };
type Game = {
  id: string;
  slug: string;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  home_team: Team | null;
  away_team: Team | null;
};

export default function Scorer() {
  const navigate = useNavigate();

  const [userReady, setUserReady] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [teamSide, setTeamSide] = useState<"home" | "away">("home");
  const [period, setPeriod] = useState<number>(1);
  const [time, setTime] = useState<string>("00:00");
  const [scorerId, setScorerId] = useState<string>("");
  const [assist1Id, setAssist1Id] = useState<string>("");
  const [assist2Id, setAssist2Id] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");

  // 1) Require auth
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/signin", { replace: true });
        return;
      }
      setUserReady(true);
    })();
  }, [navigate]);

  // 2) Load recent games + teams
  useEffect(() => {
    if (!userReady) return;
    (async () => {
      const { data, error } = await supabase
        .from("games")
        .select(`
          id, slug, game_date, home_team_id, away_team_id,
          home_team:home_team_id ( id, name, short_name ),
          away_team:away_team_id ( id, name, short_name )
        `)
        .order("game_date", { ascending: false })
        .limit(50);
      if (!error && data) setGames(data as Game[]);
    })();
  }, [userReady]);

  // 3) Load all players (so we can filter by team locally)
  useEffect(() => {
    if (!userReady) return;
    (async () => {
      const { data, error } = await supabase
        .from("players")
        .select(`id, name, team_id`)
        .order("name");
      if (!error && data) setPlayers(data as Player[]);
    })();
  }, [userReady]);

  const selectedGame = useMemo(
    () => games.find(g => g.id === selectedGameId),
    [games, selectedGameId]
  );

  const selectedTeamId = useMemo(() => {
    if (!selectedGame) return "";
    return teamSide === "home" ? selectedGame.home_team_id : selectedGame.away_team_id;
  }, [selectedGame, teamSide]);

  const teamPlayers = useMemo(
    () => players.filter(p => p.team_id === selectedTeamId),
    [players, selectedTeamId]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!selectedGame || !scorerId) {
      setMessage("Pick a game and a scorer.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setMessage("Time must be MM:SS");
      return;
    }

    setSaving(true);

    try {
      // 1. Insert goal
      const goal = {
        game_id: selectedGame.id,
        team_id: selectedTeamId,
        player_id: scorerId,
        period,
        time_mmss: time,
        event: "goal" as const,
      };

      let { error: gErr } = await supabase.from("events").insert(goal);
      if (gErr) throw gErr;

      // 2. Optional assists (must match period/time/team of goal)
      const assistRows = [];
      if (assist1Id) assistRows.push({
        game_id: selectedGame.id,
        team_id: selectedTeamId,
        player_id: assist1Id,
        period,
        time_mmss: time,
        event: "assist" as const,
      });
      if (assist2Id) assistRows.push({
        game_id: selectedGame.id,
        team_id: selectedTeamId,
        player_id: assist2Id,
        period,
        time_mmss: time,
        event: "assist" as const,
      });
      if (assistRows.length) {
        const { error: aErr } = await supabase.from("events").insert(assistRows);
        if (aErr) throw aErr;
      }

      setMessage("Saved!");
      // reset assists only
      setAssist1Id("");
      setAssist2Id("");
    } catch (err: any) {
      setMessage(err.message ?? "Error saving");
    } finally {
      setSaving(false);
    }
  }

  if (!userReady) return null;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Scorer</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <div className="font-semibold">Game</div>
          <select
            className="border p-2 w-full"
            value={selectedGameId}
            onChange={e => setSelectedGameId(e.target.value)}
          >
            <option value="">-- choose --</option>
            {games.map(g => (
              <option key={g.id} value={g.id}>
                {new Date(g.game_date).toLocaleString()} — {g.home_team?.name} vs {g.away_team?.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={teamSide === "home"}
              onChange={() => setTeamSide("home")}
            />
            <span>Home</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={teamSide === "away"}
              onChange={() => setTeamSide("away")}
            />
            <span>Away</span>
          </label>
        </div>

        <div className="flex gap-4">
          <label className="block">
            <div className="font-semibold">Period</div>
            <input
              type="number"
              className="border p-2 w-24"
              min={1}
              max={5}
              value={period}
              onChange={e => setPeriod(Number(e.target.value))}
            />
          </label>
          <label className="block">
            <div className="font-semibold">Time (MM:SS)</div>
            <input
              type="text"
              className="border p-2 w-24"
              value={time}
              onChange={e => setTime(e.target.value)}
              placeholder="13:37"
            />
          </label>
        </div>

        <label className="block">
          <div className="font-semibold">Scorer</div>
          <select
            className="border p-2 w-full"
            value={scorerId}
            onChange={e => setScorerId(e.target.value)}
            disabled={!selectedTeamId}
          >
            <option value="">-- choose --</option>
            {teamPlayers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className="font-semibold">Assist 1 (optional)</div>
            <select
              className="border p-2 w-full"
              value={assist1Id}
              onChange={e => setAssist1Id(e.target.value)}
              disabled={!selectedTeamId}
            >
              <option value="">-- none --</option>
              {teamPlayers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="font-semibold">Assist 2 (optional)</div>
            <select
              className="border p-2 w-full"
              value={assist2Id}
              onChange={e => setAssist2Id(e.target.value)}
              disabled={!selectedTeamId}
            >
              <option value="">-- none --</option>
              {teamPlayers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={saving || !selectedGameId || !scorerId}
        >
          {saving ? "Saving…" : "Save goal"}
        </button>
      </form>

      {message && <div className="text-sm">{message}</div>}
    </div>
  );
}
