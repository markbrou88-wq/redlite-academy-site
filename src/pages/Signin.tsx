import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

/**
 * Simple Auth screen (email / password) for Supabase.
 * - "Se connecter" = signInWithPassword
 * - "Créer un compte" = signUp
 * After success we redirect to the desired page (default: /admin/scorer).
 */
export default function Signin() {
  const navigate = useNavigate();
  const location = useLocation();

  // If you navigated here from a protected page, we keep where to go back to:
  // e.g. navigate("/signin", { state: { from: "/admin/scorer" } })
  const redirectTo =
    (location.state as any)?.from || "/admin/scorer";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!email || !password) {
      setMsg("Entre ton email et un mot de passe.");
      return;
    }

    try {
      setLoading(true);

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // OK -> go back to target (default /admin/scorer)
        navigate(redirectTo, { replace: true });
      } else {
        // Sign up: create account and (optionally) auto-login.
        // You can keep the redirect option; Supabase will use your allowed URLs.
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/admin/scorer`,
          },
        });
        if (error) throw error;
        setMsg("Compte créé. Vérifie tes emails si la confirmation est activée.");
      }
    } catch (err: any) {
      setMsg(err.message ?? "Erreur d’authentification.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md border rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-4">
          {mode === "signin" ? "Se connecter" : "Créer un compte"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              className="mt-1 block w-full border rounded p-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@exemple.com"
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Mot de passe</span>
            <input
              type="password"
              className="mt-1 block w-full border rounded p-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white rounded py-2 disabled:opacity-50"
          >
            {loading
              ? "En cours…"
              : mode === "signin"
              ? "Se connecter"
              : "Créer le compte"}
          </button>
        </form>

        {msg && <p className="mt-3 text-sm">{msg}</p>}

        <div className="mt-6 text-sm flex items-center justify-between">
          <button
            className="underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin"
              ? "Créer un compte"
              : "J’ai déjà un compte"}
          </button>

          {/* Optional: back to site */}
          <Link className="underline" to="/league/standings">
            Retour au site
          </Link>
        </div>
      </div>
    </div>
  );
}
