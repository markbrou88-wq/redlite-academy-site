import { useEffect, useMemo, useState } from 'react'; import { supabase } from '../lib/supabase';
type Player={ id:string; name:string; team:string; jersey:number|null }; type Game={ id:string; game_code:string; team_home:string; team_away:string; game_date:string };
export default function Logger(){
  const [games,setGames]=useState<Game[]>([]); const [players,setPlayers]=useState<Player[]>([]); const [gameId,setGameId]=useState(''); const [period,setPeriod]=useState(1); const [time,setTime]=useState('00:00'); const [running,setRunning]=useState(false);
  useEffect(()=>{ supabase.from('games').select('*').order('game_date',{ascending:false}).then(({data})=>setGames((data||[]) as any)); supabase.from('players').select('*').order('team').then(({data})=>setPlayers((data||[]) as any)); },[]);
  useEffect(()=>{ let id:any=null; if(running){ id=setInterval(()=>{ const [m,s]=time.split(':').map(n=>parseInt(n||'0',10)); const t=m*60+s+1; const mm=String(Math.floor(t/60)).padStart(2,'0'); const ss=String(t%60).padStart(2,'0'); setTime(`${mm}:${ss}`); },1000); } return ()=>id&&clearInterval(id); },[running,time]);
  const teams=useMemo(()=>['All',...Array.from(new Set(players.map(p=>p.team)))],[players]); const [teamFilter,setTeamFilter]=useState('All'); const filtered=useMemo(()=>players.filter(p=>teamFilter==='All'||p.team===teamFilter),[players,teamFilter]);
  const log=async(pid:string, team:string, kind:'goal'|'assist'|'shot')=>{ if(!gameId) return alert('Select a game first'); const payload:any={ game_id:gameId, player_id:pid, team, period, time_mmss:time, goals:0, assists:0, shots:0 };
    if(kind==='goal') payload.goals=1; else if(kind==='assist') payload.assists=1; else payload.shots=1; const { error } = await supabase.from('events').insert(payload); if(error) alert(error.message); };
  return (<section className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <select className="border rounded px-3 py-2" value={gameId} onChange={e=>setGameId(e.target.value)}>
        <option value="">Select game</option>{games.map(g=><option key={g.id} value={g.id}>{g.game_code} — {g.team_home} vs {g.team_away}</option>)}
      </select>
      <div className="flex gap-2">{[1,2,3].map(p=>(<button key={p} className={`border rounded px-3 py-2 ${p===period?'font-bold':''}`} onClick={()=>setPeriod(p)}>P{p}</button>))}</div>
      <div className="flex items-center gap-2"><input className="border rounded px-3 py-2 w-28" value={time} onChange={e=>setTime(e.target.value)} />
        <button className="btn btn-red" onClick={()=>setRunning(v=>!v)}>{running?'Pause':'Start'}</button>
        <button className="btn btn-outline" onClick={()=>setTime('00:00')}>Reset</button></div>
    </div>
    <div className="flex items-center gap-2"><span className="text-sm">Team:</span>
      <select className="border rounded px-2 py-1" value={teamFilter} onChange={e=>setTeamFilter(e.target.value)}>{teams.map(t=><option key={t} value={t}>{t}</option>)}</select>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{filtered.map(p=>(
      <div key={p.id} className="card"><div className="text-xs text-gray-500">{p.team}</div><div className="font-semibold">{p.name}</div><div className="text-xs">#{p.jersey ?? '-'}</div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <button className="btn btn-red" onClick={()=>log(p.id,p.team,'goal')}>Goal</button>
          <button className="btn btn-outline" onClick={()=>log(p.id,p.team,'assist')}>Assist</button>
          <button className="btn btn-outline" onClick={()=>log(p.id,p.team,'shot')}>SOG</button>
        </div></div>))}
    </div></section>);
}