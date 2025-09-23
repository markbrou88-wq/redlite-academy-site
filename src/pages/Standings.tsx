import { useEffect, useState } from 'react'; import { supabase } from '../lib/supabase';
type Row={ team:string; gp:number; w:number; l:number; t:number; gf:number; ga:number; gd:number; pts:number; pts_pct:number };
export default function Standings(){
  const [rows,setRows]=useState<Row[]>([]);
  useEffect(()=>{ const load=async()=>{ const { data } = await supabase.from('team_standings').select('*'); setRows((data||[]) as any); };
    load(); const ch=supabase.channel('standings-live').on('postgres_changes',{event:'*',schema:'public',table:'games'},()=>load()).subscribe(); return ()=>supabase.removeChannel(ch); },[]);
  return (<section className="space-y-6"><h3 className="text-xl font-bold">Standings</h3>
    <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left">
      <thead className="bg-gray-100"><tr><th className="p-2">Team</th><th className="p-2">GP</th><th className="p-2">W</th><th className="p-2">L</th><th className="p-2">T</th><th className="p-2">GF</th><th className="p-2">GA</th><th className="p-2">GD</th><th className="p-2">PTS</th><th className="p-2">PTS%</th></tr></thead>
      <tbody>{rows.map(r=>(<tr key={r.team} className="border-t"><td className="p-2 font-semibold">{r.team}</td>
        <td className="p-2">{r.gp}</td><td className="p-2">{r.w}</td><td className="p-2">{r.l}</td><td className="p-2">{r.t}</td>
        <td className="p-2">{r.gf}</td><td className="p-2">{r.ga}</td><td className="p-2">{r.gd}</td><td className="p-2">{r.pts}</td>
        <td className="p-2">{Number(r.pts_pct).toFixed(3)}</td></tr>))}</tbody></table></div></section>);
}