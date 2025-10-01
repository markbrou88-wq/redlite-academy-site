import React, { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { supabase } from "./lib/supabase";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    // initial load
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
      setLoadingUser(false);
    })();

    // keep in sync with future logins/logouts
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold">Redlite Academy</Link>

          <nav className="flex gap-6 items-center">
            <Link to="/league/standings" className="hover:underline">Standings</Link>
            <Link to="/league/leaders" className="hover:underline">Leaders</Link>
            <Link to="/league/games" className="hover:underline">Games</Link>

            {/* Auth-aware items */}
            {!loadingUser && (
              user ? (
                <>
                  <Link to="/admin/scorer" className="font-semibold hover:underline">
                    Scorer
                  </Link>
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                    }}
                    className="text-sm underline"
                    title="Sign out"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link to="/signin" className="underline">Sign in</Link>
              )
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
