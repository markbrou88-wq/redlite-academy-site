import { useEffect, useState } from 'react'; import { supabase } from '../lib/supabase';
type Row={ name:string; team:string; jersey:number|null; gp:number; goals:number; assists:number; points:number; shots:number; pts_per_gp:number };
export default function Leaders(){
  const [rows,setRows]=useState<Row[]>([]); const [loading,setLoading]=useState(true);
  const load=async()=>{ setLoading(true); const { data } = await supabase.from('player_stats').select('*'); setRows((data||[]) as any); setLoading(false); };
  useEffect(()=>{ load(); const ch=supabase.channel('leaders-live').on('postgres_changes',{event:'*',schema:'public',table:'events'},()=>load()).subscribe(); return ()=>supabase.removeChannel(ch); },[]);
  if(loading) return <p className="p-6">Loading…</p>;
  return (<section className="space-y-6"><h3 className="text-xl font-bold">Scoring Leaders</h3>
    <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left">
      <thead style={{background:"var(--brand-red)",color:"#fff"}}><tr>
        <th className="p-2">Player</th><th className="p-2">Team</th><th className="p-2">G</th><th className="p-2">A</th><th className="p-2">PTS</th><th className="p-2">SOG</th><th className="p-2">Pts/GP</th></tr></thead>
      <tbody>{rows.map((r:any,i:number)=>(<tr key={i} className="border-t">
        <td className="p-2 font-semibold">{r.name} {r.jersey?`#${r.jersey}`:''}</td>
        <td className="p-2">{r.team}</td><td className="p-2">{r.goals}</td><td className="p-2">{r.assists}</td>
        <td className="p-2">{r.points}</td><td className="p-2">{r.shots}</td><td className="p-2">{Number(r.pts_per_gp||0).toFixed(2)}</td></tr>))}</tbody>
    </table></div></section>);
}