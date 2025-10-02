import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type GameRow = {
  slug: string;
  game_date: string;
  status: string | null;
  home_team_name: string;
  away_team_name: string;
  home_goals: number;
  away_goals: number;
};

export default function Games() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data, error } = await supabase
        .from("games_ext_v2")
        .select(
          `
          slug,
          game_date,
          status,
          home_team_name
