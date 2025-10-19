// src/pages/Games.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

// ---- Types ---------------------------------------------------------------
type Team = { id: string; name: string; short_name?: string | null };

type GameRow = {
  id: string;
  slug: string;
  game_date: string; // timestamptz
  status: "scheduled" | "final";
  home_team_id: string;
  away_team_id: string;

  // These may exist in games_scores_live; if not, we'll derive from teams
  home_team_name?: string | null;
  away_team_name?: string | null;

  // These exist in games_scores_live (derived from events)
  home_goals?: number | null;
  away_goals?: number | null;
};

// ---- Utilities -----------------------------------------------------------
function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function ScoreCell(g: GameRow) {
  const h = g.home_goals ?? 0;
  const a = g.away_goals ?? 0;
  return <span>{h}–{a}</span>;
}

// ---- Component -----------------------------------------------------------
export default function Games() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<GameRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const teamById = useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  async function fetchTeams() {
    const { data, error } = await supabase.from("teams").select("id,name,short_name").order("name");
    if (!error && data) setTeams(data as Team[]);
  }

  async function fetchGames() {
    setErr(null);
    setLoading(true);

    // Try the view first
    const tryView = await supabase
      .from("games_scores_live")
      .select("*")
      .order("game_date", { ascending: false });

    if (!tryView.error && tryView.data) {
      setRows(tryView.data as unknown as GameRow[]);
      setLoading(false);
      return;
    }

    // Fallback to raw tables if the view isn't present on this environment
    const g = await supabase
      .from("games")
      .select("id, slug, game_date, status, home_team_id, away_team_id")
      .order("game_date", { ascending: false });

    if (g.error || !g.data) {
      setErr(g.error?.message ?? "Failed to load games");
      setLoading(false);
      return;
    }

    // derive names; and let score be 0–0 since we don't have the view
    const fallback = (g.data as any[]).map((r) => ({
      ...r,
      home_team_name: teamById.get(r.home_team_id)?.name ?? r.home_team_id,
      away_team_name: teamById.get(r.away_team_id)?.name ?? r.away_team_id,
      home_goals: 0,
      away_goals: 0,
    })) as GameRow[];

    setRows(fallback);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      await fetchTeams();
      await fetchGames();
    })();
    // Realtime refresh on games and events
    const sub = supabase
      .channel("games-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, fetchGames)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, fetchGames)
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []); // eslint-disable-line

  async function markStatus(id: string, status: "final" | "scheduled") {
    setErr(null);
    const { error } = await supabase.from("games").update({ status }).eq("id", id);
    if (error) setErr(error.message);
  }

  async function handleDelete(id: string) {
    setErr(null);
    const ok = confirm("Delete this game? All its events will also be deleted.");
    if (!ok) return;
    // Optimistic UI
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== id));
    const { error } = await supabase.from("games").delete().eq("id", id);
    if (error) {
      setErr(error.message);
      setRows(prev); // rollback
    }
  }

  function homeName(r: GameRow) {
    return r.home_team_name ?? teamById.get(r.home_team_id)?.name ?? r.home_team_id;
  }
  function awayName(r: GameRow) {
    return r.away_team_name ?? teamById.get(r.away_team_id)?.name ?? r.away_team_id;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Games</h1>

      {err && (
        <div className="mb-4 text-sm text-red-600">
          {err}
        </div>
      )}

      {loading ? (
        <div>Loading…</div>
      ) : rows.length === 0 ? (
        <div>No games yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left">Date</th>
                <th className="py-2 text-left">Home</th>
                <th className="py-2 text-left">Away</th>
                <th className="py-2 text-left">Score</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-black/5">
                  <td className="py-2">
                    <Link to={`/league/games/${encodeURIComponent(r.slug)}`} className="text-blue-700 hover:underline">
                      {fmtDate(r.game_date)}
                    </Link>
                  </td>
                  <td className="py-2">{homeName(r)}</td>
                  <td className="py-2">{awayName(r)}</td>
                  <td className="py-2"><ScoreCell {...r} /></td>
                  <td className="py-2">
                    <span className={r.status === "final" ? "font-semibold" : ""}>
                      {r.status}
                    </span>
                    {" "}
                    {r.status === "final" ? (
                      <button
                        className="ml-2 text-xs text-blue-700 hover:underline"
                        onClick={() => markStatus(r.id, "scheduled")}
                        title="Re-open game"
                      >
                        Mark scheduled
                      </button>
                    ) : (
                      <button
                        className="ml-2 text-xs text-blue-700 hover:underline"
                        onClick={() => markStatus(r.id, "final")}
                        title="Mark final"
                      >
                        Mark FINAL
                      </button>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      className="text-gray-500 hover:text-red-600"
                      title="Delete game"
                      onClick={() => handleDelete(r.id)}
                      aria-label="Delete"
                    >
                      {/* Trash can */}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M9 3h6a1 1 0 0 1 1 1v1h4v2H4V5h4V4a1 1 0 0 1 1-1Zm1 4h4v12a2 2 0 0 1-2 2h-0a2 2 0 0 1-2-2V7Z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
