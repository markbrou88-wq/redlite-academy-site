import { useEffect, useState } from 'react'; import { supabase } from '../lib/supabase';
export default function Tournaments(){
  const [tours,setTours]=useState<any[]>([]); const [gamesBy,setGamesBy]=useState<Record<string, any[]>>({});
  useEffect(()=>{ (async()=>{
    const { data: t } = await supabase.from('tournaments').select('*').order('start_date',{ascending:true}); setTours(t||[]);
    const m:Record<string,any[]>={}; for(const tr of t||[]){ const { data:g } = await supabase.from('tournament_games').select('*').eq('tournament_id',tr.id).order('game_date',{ascending:true}); m[tr.id]=g||[]; } setGamesBy(m);
  })(); },[]);
  return (<section className="space-y-6"><h3 className="text-xl font-bold">Tournaments</h3>
    <div className="space-y-6">{tours.map(tr=>(<div key={tr.id} className="card">
      <div className="flex items-center justify-between"><h4 className="text-lg font-semibold">{tr.name}</h4>
        <span className="text-xs uppercase px-2 py-1 rounded text-white" style={{background: tr.status==='live'?'var(--brand-red)':'#000'}}>{tr.status}</span></div>
      <div className="text-xs text-gray-500">{tr.location||''} • {tr.start_date||''}{tr.end_date?` → ${tr.end_date}`:''}</div>
      {tr.description_md && <div className="prose mt-2 whitespace-pre-wrap">{tr.description_md}</div>}
      <div className="overflow-x-auto mt-3 border rounded"><table className="w-full text-left">
        <thead className="bg-gray-100"><tr><th className="p-2">When</th><th className="p-2">Home</th><th className="p-2">Away</th><th className="p-2">Score</th><th className="p-2">Round</th></tr></thead>
        <tbody>{(gamesBy[tr.id]||[]).map((g:any,i:number)=>(<tr key={i} className="border-t">
          <td className="p-2">{g.game_date?new Date(g.game_date).toLocaleString():"-"}</td><td className="p-2">{g.team_home}</td>
          <td className="p-2">{g.team_away}</td><td className="p-2">{g.score_home}—{g.score_away}</td><td className="p-2">{g.bracket_round||"-"}</td></tr>))}</tbody></table></div>
    </div>))}</div></section>);
}