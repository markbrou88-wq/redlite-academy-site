import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./App";

import Standings from "./pages/Standings";
import Leaders from "./pages/Leaders";
import Games from "./pages/Games";
import GameSummary from "./pages/GameSummary";
import Scorer from "./pages/Scorer";
import Signin from "./pages/Signin";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/league/standings" replace /> },

      { path: "/league/standings", element: <Standings /> },
      { path: "/league/leaders", element: <Leaders /> },
      { path: "/league/games", element: <Games /> },
      { path: "/league/games/:slug", element: <GameSummary /> },

      // Auth pages
      { path: "/Signin", element: <Signin /> },

      // Scorer (the page itself already redirects to /signin if not logged in)
      { path: "/admin/scorer", element: <Scorer /> },

      { path: "*", element: <Navigate to="/league/standings" replace /> },
    ],
  },
]);
