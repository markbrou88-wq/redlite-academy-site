import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Signin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    navigate("/league/games", { replace: true });
  }

  return (
    <div className="max-w-sm mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Se connecter</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <div className="text-sm font-medium">Email</div>
          <input
            className="border p-2 w-full"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <div className="text-sm font-medium">Mot de passe</div>
          <input
            className="border p-2 w-full"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="bg-black text-white px-4 py-2 rounded w-full">
          Se connecter
        </button>
      </form>

      {msg && <div className="text-sm text-red-600">{msg}</div>}

      <div className="text-sm flex gap-4">
        <Link to="/league/games" className="text-blue-600">Retour au site</Link>
        <Link to="/signup" className="text-blue-600">Créer un compte</Link>
      </div>
    </div>
  );
}
