import { useEffect, useState } from 'react'; import { supabase } from '../lib/supabase';
type Game={ id:string; game_code:string; game_date:string; team_home:string; team_away:string; score_home:number; score_away:number; location:string|null };
export default function Games({ onOpen }:{ onOpen:(id:string)=>void }){
  const [games,setGames]=useState<Game[]>([]);
  useEffect(()=>{ supabase.from('games').select('*').order('game_date',{ascending:false}).then(({data})=>setGames((data||[]) as any)); },[]);
  return (<section className="space-y-6"><h3 className="text-xl font-bold">Games</h3>
    <div className="space-y-2">{games.map(g=>(<div key={g.id} className="card cursor-pointer hover:bg-gray-50" onClick={()=>onOpen(g.id)}>
      <div className="font-semibold">{g.game_code} – {g.team_home} {g.score_home} – {g.score_away} {g.team_away}</div>
      <div className="text-xs text-gray-500">{new Date(g.game_date).toLocaleString()} • {g.location||''}</div></div>))}</div></section>);
}