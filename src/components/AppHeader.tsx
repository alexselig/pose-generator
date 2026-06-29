'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Character } from '@/lib/types';

export function AppHeader() {
  const pathname = usePathname();
  const [character, setCharacter] = useState<Character | null>(null);

  const isGallery = pathname === '/' || pathname === '/characters';
  const isCreate = pathname === '/characters/new';
  const charMatch = pathname.match(/^\/(characters|generate|export)\/([^/]+)$/);
  const charId = charMatch?.[2];
  const isCharView = !!charMatch && !isCreate;

  useEffect(() => {
    if (!charId) {
      setCharacter(null);
      return;
    }

    fetch(`/api/characters/${charId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setCharacter(data))
      .catch(() => setCharacter(null));
  }, [charId]);

  let title = 'Character Gallery';
  if (isCreate) title = 'New Character';
  else if (isCharView) title = character?.name || 'Character';

  return (
    <header
      className="flex items-center gap-[14px] flex-none relative z-10"
      style={{
        height: '64px',
        padding: '0 26px',
        background: 'var(--gradient-header)',
        boxShadow: 'var(--shadow-header)',
      }}
    >
      <div className="flex items-center gap-[11px] min-w-0">
        {isGallery ? (
          <span className="grid flex-none" style={{ gridTemplateColumns: 'repeat(3,3.5px)', gridTemplateRows: 'repeat(3,3.5px)', gap: '2px', color: '#fff', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.35))' }}>
            {Array(9).fill(0).map((_, i) => (
              <i key={i} style={{ background: 'currentColor', borderRadius: '1px', width: '3.5px', height: '3.5px' }} />
            ))}
          </span>
        ) : isCharView ? (
          <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: character?.colorPalette?.[0] || '#fff', border: '2px solid rgba(255,255,255,.6)', boxShadow: '0 1px 3px rgba(0,0,0,.35)', flexShrink: 0 }} />
        ) : null}
      <span style={{ font: '700 28px var(--font-display)', color: '#fff', letterSpacing: '-.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '560px' }}>
        {title}
      </span>
      </div>

      <div className="flex-1" />

      <Link
        href="/characters/new"
        className="flex items-center gap-[7px] no-underline"
        style={{
          background: '#fff',
          color: '#4733c4',
          border: 'none',
          borderRadius: '12px',
          padding: '10px 18px',
          font: "700 13px var(--font-display)",
          cursor: 'pointer',
          boxShadow: '0 12px 28px -10px rgba(0,0,0,.4)',
        }}
      >
        <span style={{ fontSize: '16px', lineHeight: 1 }}>＋</span> New Character
      </Link>
    </header>
  );
}
