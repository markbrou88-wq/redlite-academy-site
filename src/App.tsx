import { useState } from 'react';
import Nav from './components/Nav';
import News from './pages/News';
import League from './pages/League';
import Tournaments from './pages/Tournaments';
import Sponsors from './pages/Sponsors';
import Logger from './pages/Logger';
import Admin from './pages/Admin';

export default function App(){
  const [tab,setTab]=useState<string>('news');
  return (
    <div className="min-h-screen flex flex-col">
      <Nav tab={tab} setTab={setTab} />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto p-6">
          {tab==='news' && <News />}
          {tab==='league' && <League />}
          {tab==='tournaments' && <Tournaments />}
          {tab==='sponsors' && <Sponsors />}
          {tab==='logger' && <Logger />}
          {tab==='admin' && <Admin />}
        </div>
      </main>
      <footer className="text-center text-sm py-6 text-gray-500">© {new Date().getFullYear()} Redlite Academy</footer>
    </div>
  );
}