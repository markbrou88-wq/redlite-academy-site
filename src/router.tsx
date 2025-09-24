// src/router.tsx
import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./App";
import League from "./pages/League";
import Standings from "./pages/Standings";
import Leaders from "./pages/Leaders";
import Games from "./pages/Games";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,              // global layout (header/nav)
    children: [
      { index: true, element: <Navigate to="/league/standings" replace /> },
      {
        path: "league",
        element: <League />,        // league tabs wrapper
        children: [
          { index: true, element: <Navigate to="standings" replace /> },
          { path: "standings", element: <Standings /> },
          { path: "leaders", element: <Leaders /> },
          { path: "games", element: <Games /> },
        ],
      },
    ],
  },
]);
