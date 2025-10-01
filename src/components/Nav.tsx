// src/components/Nav.tsx
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Nav() {
  const { pathname } = useLocation();
  const [isAuthed, setIsAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setIsAuthed(!!data.session);
        setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session);
    });

    return () => {
      mounted = false;
      sub.subscription?.unsubscribe();
    };
  }, []);

  const link = (to: string, label: string) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded ${
        pathname.startsWith(to) ? "bg-black text-white" : "hover:bg-gray-100"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="border-b">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
        <div className="font-bold">Redlite Academy</div>
        <nav className="flex gap-2">
          {link("/league/standings", "Standings")}
          {link("/league/leaders", "Leaders")}
          {link("/league/games", "Games")}
          {!loading && isAuthed && link("/admin/scorer", "Scorer")}
        </nav>

        <div className="ml-auto">
          {!loading && !isAuthed && link("/auth/signin", "Login")}
          {!loading && isAuthed && (
            <button
              className="px-3 py-2 rounded hover:bg-gray-100"
              onClick={async () => {
                await supabase.auth.signOut();
              }}
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
