import { useState } from 'react'; import Leaders from './Leaders'; import Standings from './Standings'; import Games from './Games'; import BoxScore from './BoxScore';
export default function League(){
  const [sub,setSub]=useState<'leaders'|'standings'|'games'|'box'>('leaders'); const [game,setGame]=useState<string|null>(null);
  return (<section className="max-w-6xl mx-auto p-6 space-y-6">
    <div className="flex gap-4 border-b">{['leaders','standings','games'].map(s=>(
      <button key={s} className={`py-2 ${sub===s?'border-b-2 font-semibold':''}`} onClick={()=>{ setSub(s as any); setGame(null); }}>{s}</button>))}
    </div>
    {sub==='leaders' && <Leaders />}
    {sub==='standings' && <Standings />}
    {sub==='games' && (!game ? <Games onOpen={(id)=>{ setGame(id); setSub('box'); }} /> : <BoxScore gameId={game} onBack={()=>{ setGame(null); setSub('games'); }} />)}
  </section>);
}