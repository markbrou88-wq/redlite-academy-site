// src/pages/Signup.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) setMsg(error.message);
    else {
      setMsg("Check your email to confirm.");
      navigate("/signin", { replace: true });
    }
  }

  return (
    <div className="max-w-sm mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Créer un compte</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="border p-2 w-full" type="email" placeholder="email"
               value={email} onChange={e => setEmail(e.target.value)} />
        <input className="border p-2 w-full" type="password" placeholder="mot de passe"
               value={password} onChange={e => setPassword(e.target.value)} />
        <button className="bg-black text-white px-4 py-2 rounded w-full">Créer</button>
      </form>
      {msg && <div className="text-sm">{msg}</div>}
      <Link to="/signin" className="text-blue-600 text-sm">Déjà un compte ? Se connecter</Link>
    </div>
  );
}
