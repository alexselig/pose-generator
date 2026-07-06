'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Character } from '@/lib/types';
import { groupCharacters } from '@/lib/groups';
import { useSidebar } from '@/components/SidebarNav';

export function Sidebar() {
  const pathname = usePathname();
  const [characters, setCharacters] = useState<Character[]>([]);
  const { open, closeSidebar } = useSidebar();

  useEffect(() => {
    fetch('/api/characters')
      .then(res => res.json())
      .then(setCharacters)
      .catch(() => {});
  }, [pathname]); // Refetch on navigation

  // Close the mobile drawer whenever the route changes (e.g. tapping a link).
  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  const isGallery = pathname === '/' || pathname === '/characters';
  const activeCharId = pathname.match(/\/(characters|generate|export|animate)\/([^/]+)/)?.[2];
  const libraryCharacters = characters.filter(char => !char.archived);
  const sections = groupCharacters(libraryCharacters);

  const renderCharLink = (char: Character) => {
    const isActive = activeCharId === char.id;
    return (
      <Link
        key={char.id}
        href={`/characters/${char.id}`}
        className="flex items-center gap-[9px] no-underline"
        style={{
          padding: '6px 10px',
          margin: '0 -10px',
          borderRadius: '8px',
          background: isActive ? 'var(--accent)' : 'transparent',
          color: isActive ? 'var(--canvas)' : 'var(--ink-2)',
          font: `${isActive ? 600 : 500} 13.5px var(--font-body)`,
          cursor: 'pointer',
        }}
      >
        <span
          className="flex-none"
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: isActive ? 'var(--canvas)' : 'var(--accent)',
          }}
        />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {char.name}
        </span>
      </Link>
    );
  };

  return (
    <>
      <div
        className={`pf-backdrop${open ? ' pf-backdrop--open' : ''}`}
        onClick={closeSidebar}
        aria-hidden
      />
      <aside
        className={`pf-sidebar${open ? ' pf-sidebar--open' : ''} w-[246px] flex-none flex flex-col overflow-visible`}
        style={{
          background: 'var(--sidebar)',
          borderRight: '1px solid var(--border)',
          padding: '28px 24px',
          gap: '22px',
        }}
      >
      {/* Brand wordmark */}
      <Link
        href="/characters"
        className="no-underline flex-none"
        style={{
          font: '700 26px var(--font-display)',
          color: 'var(--ink)',
          letterSpacing: '-.01em',
          lineHeight: 1,
        }}
      >
        PoseForge
      </Link>

      {/* Gallery row */}
      <Link
        href="/characters"
        className="flex items-center gap-[9px] no-underline flex-none"
        style={{
          padding: '0 0 15px',
          borderBottom: '1px solid var(--border)',
          color: isGallery ? 'var(--accent)' : 'var(--text-bright)',
          font: "700 12px var(--font-body)",
          letterSpacing: '.05em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        <span aria-hidden style={{ fontSize: '13px', lineHeight: 1 }}>▦</span>
        Gallery
      </Link>

      {/* Grouped character list */}
      {sections.map(section => {
        const label = section.isUngrouped
          ? (sections.length === 1 ? 'Library' : 'Ungrouped')
          : section.name;
        return (
          <div key={section.name} className="flex flex-col" style={{ gap: '2px' }}>
            <div
              className="flex items-center"
              style={{ margin: '0 0 8px', gap: '8px' }}
            >
              <span style={{ flex: 1, font: "700 10px var(--font-body)", letterSpacing: '.16em', color: 'var(--faint)', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label}
              </span>
              <span style={{ color: '#B8AF9C', font: 'italic 600 14px var(--font-display)' }}>{section.characters.length}</span>
            </div>
            {section.characters.map(char => renderCharLink(char))}
          </div>
        );
      })}

      <div className="flex-1" />

      {/* Footer */}
      <div style={{ font: 'italic 400 14px/1.5 var(--font-display)', color: '#B0A796' }}>
        Static illustrated poses · Transparent PNG · Godot-ready
      </div>
    </aside>
    </>
  );
}
