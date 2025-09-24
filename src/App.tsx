// src/App.tsx
import React from "react";
import { NavLink, Link, Outlet } from "react-router-dom";

export default function App() {
  const navLinkClass =
    "px-3 py-2 rounded font-medium hover:opacity-80 transition";
  const activeClass = "bg-white text-black";

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Top bar */}
      <header className="bg-black text-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold">
            Redlite Academy
          </Link>

          <nav className="flex gap-1">
            <NavLink
              to="/league/standings"
              className={({ isActive }) =>
                `${navLinkClass} ${isActive ? activeClass : ""}`
              }
            >
              Standings
            </NavLink>
            <NavLink
              to="/league/leaders"
              className={({ isActive }) =>
                `${navLinkClass} ${isActive ? activeClass : ""}`
              }
            >
              Leaders
            </NavLink>
            <NavLink
              to="/league/games"
              className={({ isActive }) =>
                `${navLinkClass} ${isActive ? activeClass : ""}`
              }
            >
              Games
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Page container */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
