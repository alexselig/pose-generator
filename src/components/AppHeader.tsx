'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Character } from '@/lib/types';
import { useSidebar } from '@/components/SidebarNav';

export function AppHeader() {
  const pathname = usePathname();
  const [character, setCharacter] = useState<Character | null>(null);
  const { toggleSidebar } = useSidebar();

  const isCreate = pathname === '/characters/new';
  const charMatch = pathname.match(/^\/(characters|generate|export|animate)\/([^/]+)$/);
  const charId = charMatch?.[2];
  const isCharView = !!charMatch && !isCreate;
  // Only a real character route should fetch. Otherwise "/characters/new"
  // matches the regex with charId="new" and fires GET /api/characters/new -> 404.
  const fetchId = isCharView ? charId : null;

  useEffect(() => {
    if (!fetchId) {
      setCharacter(null);
      return;
    }

    fetch(`/api/characters/${fetchId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setCharacter(data))
      .catch(() => setCharacter(null));
  }, [fetchId]);

  let title = 'Character Gallery';
  if (isCreate) title = 'New Character';
  else if (isCharView) title = character?.name || 'Character';

  return (
    <header
      className="flex items-center gap-[16px] flex-none relative z-10"
      style={{
        height: '82px',
        padding: '0 36px',
        background: 'var(--canvas-raised)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-[14px] min-w-0">
        <button
          onClick={toggleSidebar}
          className="pf-hamburger"
          aria-label="Toggle navigation"
          style={{
            width: '34px',
            height: '34px',
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '4px',
            background: 'transparent',
            border: '1px solid var(--border-field)',
            borderRadius: '9px',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <span style={{ width: '15px', height: '2px', background: 'var(--ink)', borderRadius: '2px' }} />
          <span style={{ width: '15px', height: '2px', background: 'var(--ink)', borderRadius: '2px' }} />
          <span style={{ width: '15px', height: '2px', background: 'var(--ink)', borderRadius: '2px' }} />
        </button>

        {/* Wordmark — always present */}
        <Link href="/characters" className="no-underline" style={{ font: '700 28px var(--font-display)', color: 'var(--ink)', letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>
          PoseForge
        </Link>

        {/* Divider + page-title status */}
        <span style={{ width: '1px', height: '24px', background: 'var(--border-field)', flexShrink: 0 }} />
        <div className="flex items-center gap-[9px] min-w-0">
          {isCharView && (
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
          )}
          <span style={{ font: '600 13.5px var(--font-body)', color: 'var(--muted)', letterSpacing: '.16em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '520px' }}>
            {title}
          </span>
        </div>
      </div>

      <div className="flex-1" />

      <Link
        href="/characters/new"
        className="pf-newchar flex items-center gap-[7px] no-underline"
        style={{
          background: 'transparent',
          color: 'var(--accent)',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius-pill)',
          padding: '11px 22px',
          font: "600 12px var(--font-body)",
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '15px', lineHeight: 1 }}>＋</span> New Character
      </Link>
    </header>
  );
}
