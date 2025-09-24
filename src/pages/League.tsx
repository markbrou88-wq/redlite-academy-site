// src/pages/League.tsx (only the relevant bits)
import { useState } from 'react';
import Games from './Games';
import BoxScore from './BoxScore';

export default function League() {
  const [sub, setSub] = useState<'leaders' | 'standings' | 'games' | 'box'>('leaders');
  const [gameSlug, setGameSlug] = useState<string | null>(null);

  return (
    <section className="space-y-6">
      {/* nav buttons ... */}
      {sub === 'games' && <Games onOpen={(slug) => { setGameSlug(slug); setSub('box'); }} />}
      {sub === 'box' && gameSlug && (
        <BoxScore
          gameSlug={gameSlug}
          onBack={() => { setGameSlug(null); setSub('games'); }}
        />
      )}
      {/* leaders/standings ... */}
    </section>
  );
}
