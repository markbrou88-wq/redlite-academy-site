// src/App.tsx
import React from "react";
import { Link, Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold">Redlite Academy</Link>
          <nav className="flex gap-6">
            <Link to="/league/standings" className="hover:underline">Standings</Link>
            <Link to="/league/leaders" className="hover:underline">Leaders</Link>
            <Link to="/league/games" className="hover:underline">Games</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
