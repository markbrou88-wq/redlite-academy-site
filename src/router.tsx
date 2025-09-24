// src/router.tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./App";

// Your pages
import Standings from "./pages/Standings";
import Leaders from "./pages/Leaders";
import Games from "./pages/Games";
import GameSummary from "./pages/GameSummary";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      // Landing -> redirect to standings
      { index: true, element: <Navigate to="/league/standings" replace /> },

      { path: "league/standings", element: <Standings /> },
      { path: "league/leaders", element: <Leaders /> },
      { path: "league/games", element: <Games /> },
      { path: "league/games/:slug", element: <GameSummary /> },

      // 404
      { path: "*", element: <Navigate to="/league/standings" replace /> },
    ],
  },
]);
