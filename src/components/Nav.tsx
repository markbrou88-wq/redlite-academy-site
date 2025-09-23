import { brand } from '../theme';
export default function Nav({ tab, setTab }:{ tab:string; setTab:(t:string)=>void }){
  const tabs = ["news","league","tournaments","sponsors","logger","admin"] as const;
  return (
    <header className="px-6 py-5 shadow" style={{ background: brand.black, color: brand.white }}>
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full" style={{background: brand.red}} />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-wide">{brand.name}</h1>
        </div>
        <nav className="flex gap-4 text-sm sm:text-base">
          {tabs.map(t => (
            <button key={t}
              className={`uppercase tracking-wide ${tab===t ? "border-b-2" : ""}`}
              style={{ borderColor: brand.red }}
              onClick={()=>setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}