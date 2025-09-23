import { useEffect, useState } from 'react'; import { supabase } from '../lib/supabase';
type EventRow={ id:string; game_id:string; player_id:string|null; team:string; period:number|null; time_mmss:string|null; goals:number; assists:number; shots:number; created_at:string; players?:{ name:string; jersey:number|null } };
type Game={ id:string; game_code:string; game_date:string; team_home:string; team_away:string; score_home:number; score_away:number; location:string|null };
export default function BoxScore({ gameId, onBack }:{ gameId:string; onBack:()=>void }){
  const [game,setGame]=useState<Game|null>(null); const [events,setEvents]=useState<EventRow[]>([]);
  useEffect(()=>{ (async()=>{
    const { data: g } = await supabase.from('games').select('*').eq('id',gameId).single(); setGame(g as any);
    const { data: e } = await supabase.from('events').select('*, players(name, jersey)').eq('game_id',gameId).order('period',{ascending:true}).order('time_mmss',{ascending:true}); setEvents((e||[]) as any);
  })(); },[gameId]);
  if(!game) return <p className="p-6">Loading…</p>;
  return (<section className="space-y-4">
    <button onClick={onBack} className="text-sm underline">← Back to games</button>
    <div className="text-center"><h3 className="text-2xl font-bold mb-1">{game.team_home} {game.score_home} – {game.score_away} {game.team_away}</h3>
      <div className="text-xs text-gray-500">{new Date(game.game_date).toLocaleString()} • {game.location||''}</div></div>
    <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left">
      <thead className="bg-gray-100"><tr><th className="p-2">Period</th><th className="p-2">Time</th><th className="p-2">Team</th><th className="p-2">Player</th><th className="p-2">Event</th></tr></thead>
      <tbody>{events.map(e=>(<tr key={e.id} className="border-t">
        <td className="p-2">P{e.period ?? '-'}</td><td className="p-2">{e.time_mmss ?? '-'}</td><td className="p-2 font-semibold">{e.team}</td>
        <td className="p-2">{e.players?.name || '–'} {e.players?.jersey?`#${e.players.jersey}`:''}</td>
        <td className="p-2">{e.goals?'Goal':e.assists?'Assist':e.shots?'Shot on Goal':'Event'}</td></tr>))}</tbody></table></div>
  </section>);
}