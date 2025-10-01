// src/components/Nav.tsx
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Nav() {
  const { pathname } = useLocation();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (mounted) setUser(user ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const link = (to: string, label: string) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded ${pathname.startsWith(to) ? "bg-black text-white" : "hover:underline"}`}
    >
      {label}
    </Link>
  );

  return (
    <header className="border-b">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-4">
        <div className="font-bold text-xl">Redlite Academy</div>
        <nav className="flex gap-2">
          {link("/league/standings", "Standings")}
          {link("/league/leaders", "Leaders")}
          {link("/league/games", "Games")}
          {user ? link("/admin/scorer", "Scorer") : null}
        </nav>
        <div className="ml-auto">
          {user ? (
            <button
              className="text-sm underline"
              onClick={async () => { await supabase.auth.signOut(); }}
            >
              Sign out
            </button>
          ) : (
            <Link to="/signin" className="text-sm underline">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
