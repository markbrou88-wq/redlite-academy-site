// src/router.tsx
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

import App from "./App";

import Standings from "./pages/Standings";
import Leaders from "./pages/Leaders";
import Games from "./pages/Games";
import GameSummary from "./pages/GameSummary";
import Scorer from "./pages/Scorer";
import Signin from "./pages/Signin";
import Signup from "./pages/Signup";

/** Simple auth gate for protected routes */
function RequireAuth() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!alive) return;
      setAuthed(!!user && !error);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return null; // small guard while we check

  if (!authed) {
    // remember where we were going
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  return <Outlet />; // render the protected content
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      // default → standings
      { index: true, element: <Navigate to="/league/standings" replace /> },

      // league
      { path: "/league/standings", element: <Standings /> },
      { path: "/league/leaders", element: <Leaders /> },
      { path: "/league/games", element: <Games /> },
      { path: "/league/games/:slug", element: <GameSummary /> },

      // auth (lowercase canonical)
      { path: "/signin", element: <Signin /> },
      { path: "/signup", element: <Signup /> },

      // backwards-compat for old/uppercase links
      { path: "/Signin", element: <Navigate to="/signin" replace /> },
      { path: "/Signup", element: <Navigate to="/signup" replace /> },

      // protected admin section
      {
        element: <RequireAuth />,
        children: [
          { path: "/admin/scorer", element: <Scorer /> },
        ],
      },

      // catch-all
      { path: "*", element: <Navigate to="/league/standings" replace /> },
    ],
  },
]);
