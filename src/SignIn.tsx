import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
export default function SignIn({ onSignedIn }:{ onSignedIn?:()=>void }){
  const [email,setEmail]=useState(''); const [sent,setSent]=useState(false); const [err,setErr]=useState('');
  const send=async()=>{ setErr(''); const { error } = await supabase.auth.signInWithOtp({ email }); if(error) setErr(error.message); else setSent(true); };
  useEffect(()=>{ const sub = supabase.auth.onAuthStateChange((_e, s)=>{ if(s && onSignedIn) onSignedIn(); }); return ()=>sub.data.subscription.unsubscribe(); },[]);
  if(sent) return <p className="text-sm">Check your email for the magic link.</p>;
  return (<div className="max-w-sm space-y-2">
    <input className="border rounded px-3 py-2 w-full" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
    <button onClick={send} className="btn btn-red">Send magic link</button>
    {err && <div className="text-red-600 text-sm">{err}</div>}
  </div>);
}