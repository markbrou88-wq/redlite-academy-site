import SignIn from '../SignIn'; import NewsAdmin from './NewsAdmin'; import { useEffect, useState } from 'react'; import { supabase } from '../lib/supabase';
export default function Admin(){
  const [session,setSession]=useState<any>(null);
  useEffect(()=>{ supabase.auth.getSession().then(({data})=>setSession(data.session)); const { data: sub } = supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return ()=>sub.subscription.unsubscribe(); },[]);
  if(!session) return <SignIn onSignedIn={()=>{}} />;
  return (<section className="space-y-6"><h3 className="text-xl font-bold">Admin</h3><NewsAdmin />
    <div className="card"><h3 className="font-semibold mb-2">Tournaments Admin (add later)</h3><p className="text-sm text-gray-600">DB tables exist; UI can be extended.</p></div></section>);
}