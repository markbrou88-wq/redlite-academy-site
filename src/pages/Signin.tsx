// src/pages/Signin.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Mode = "signin" | "signup";

export default function Signin({ initialMode = "signin" }: { initialMode?: Mode }) {
  const navigate = useNavigate();
  const location = useLocation();

  // If the user was bounced from a protected page, you can redirect them back
  const redirectTo = (location.state as any)?.from || "/admin/scorer";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // Already signed in? go to app
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate(redirectTo, { replace: true });
    });
  }, [navigate, redirectTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!email || !password) {
      setMsg("Entre ton email et ton mot de passe.");
      return;
    }

    try {
      setLoading(true);
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate(redirectTo, { replace: true });
      } else {
        // SIGN UP
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Compte créé. Tu es connecté.");
        navigate(redirectTo, { replace: true });
      }
    } catch (err: any) {
      setMsg(err.message ?? "Erreur.");
    } finally {
      setLoading(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="p-6 max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">
        {isSignup ? "Créer un compte" : "Se connecter"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <div className="font-semibold">Email</div>
          <input
            type="email"
            className="border p-2 w-full"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="block">
          <div className="font-semibold">Mot de passe</div>
          <input
            type="password"
            className="border p-2 w-full"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
        </label>

        <button
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50 w-full"
          disabled={loading}
        >
          {loading ? "..." : (isSignup ? "Créer un compte" : "Se connecter")}
        </button>
      </form>

      {msg && <div className="text-sm text-blue-700">{msg}</div>}

      <div className="text-sm flex items-center gap-3">
        <Link className="text-blue-600 hover:underline" to="/">
          Retour au site
        </Link>

        <button
          className="text-blue-600 hover:underline"
          onClick={() => setMode(isSignup ? "signin" : "signup")}
        >
          {isSignup ? "Déjà un compte ? Se connecter" : "Créer un compte"}
        </button>
      </div>
    </div>
  );
}
