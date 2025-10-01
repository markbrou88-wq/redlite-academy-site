// src/pages/SignIn.tsx
import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin, // back to your site after magic link
        },
      });
      if (error) throw error;
      setMsg("Magic link sent! Check your inbox.");
    } catch (err: any) {
      setMsg(err.message ?? "Sign-in failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <div className="font-semibold">Email</div>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="border p-2 w-full"
            placeholder="you@example.com"
            required
          />
        </label>
        <button
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={sending}
        >
          {sending ? "Sending…" : "Send magic link"}
        </button>
      </form>
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
