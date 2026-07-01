'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Character } from '@/lib/types';
import { groupCharacters } from '@/lib/groups';

export function Sidebar() {
  const pathname = usePathname();
  const [characters, setCharacters] = useState<Character[]>([]);

  useEffect(() => {
    fetch('/api/characters')
      .then(res => res.json())
      .then(setCharacters)
      .catch(() => {});
  }, [pathname]); // Refetch on navigation

  const isGallery = pathname === '/' || pathname === '/characters';
  const activeCharId = pathname.match(/\/(characters|generate|export)\/([^/]+)/)?.[2];
  const libraryCharacters = characters.filter(char => !char.archived);

  // Default accent colors for characters without palettes
  const defaultColors = ['#7b5cff', '#4f8cff', '#2fd6d6', '#3ddc97', '#f3c06a', '#ff7d8a'];

  // Stable color per character (by position in the full library), independent of grouping.
  const colorMap = new Map<string, string>();
  libraryCharacters.forEach((char, i) => {
    colorMap.set(char.id, char.colorPalette?.[0] || defaultColors[i % defaultColors.length]);
  });
  const sections = groupCharacters(libraryCharacters);

  const renderCharLink = (char: Character) => {
    const color = colorMap.get(char.id) || defaultColors[0];
    const isActive = activeCharId === char.id;
    return (
      <Link
        key={char.id}
        href={`/characters/${char.id}`}
        className="flex items-center gap-[10px] no-underline"
        style={{
          padding: isActive ? '9px 13px' : '9px 11px',
          borderRadius: isActive ? '11px 0 0 11px' : '10px',
          background: isActive ? darkenHex(color, 86) : 'transparent',
          color: isActive ? '#fff' : '#9a96c4',
          font: isActive ? "600 12.5px var(--font-display)" : "500 12.5px var(--font-display)",
          cursor: 'pointer',
          marginRight: isActive ? '-12px' : '0',
          width: isActive ? 'calc(100% + 12px)' : '100%',
          boxShadow: isActive ? '0 8px 20px -10px rgba(0,0,0,.5)' : 'none',
          position: isActive ? 'relative' as const : undefined,
          zIndex: isActive ? 1 : undefined,
        }}
      >
        <span
          className="flex-none"
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 10px ${color}`,
          }}
        />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {char.name}
        </span>
      </Link>
    );
  };

  return (
    <aside
      className="w-[228px] flex-none flex flex-col overflow-visible"
      style={{
        background: 'var(--bg-sidebar)',
        borderRight: `2px solid ${darkenHex(activeCharId ? (characters.find(c => c.id === activeCharId)?.colorPalette?.[0] || '#7b5cff') : '#8e8ea6', 86)}`,
        padding: '16px 12px',
        gap: '4px',
      }}
    >
      {/* Brand bar */}
      <Link
        href="/"
        className="flex items-center gap-[10px] no-underline flex-none"
        style={{
          height: '64px',
          margin: '-16px -12px 30px',
          padding: '0 18px',
          background: 'var(--gradient-sidebar-brand)',
        }}
      >
        <div
          className="flex items-center justify-center flex-none"
          style={{
            width: '31px',
            height: '31px',
            borderRadius: '9px',
            background: 'rgba(255,255,255,.95)',
            overflow: 'hidden',
          }}
        >
          <img src="/logo.png" alt="PoseForge" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
        </div>
        <span style={{ font: "700 18px var(--font-display)", letterSpacing: '-.01em', color: '#fff' }}>
          PoseForge
        </span>
      </Link>

      {/* Gallery nav */}
      <Link
        href="/characters"
        className="flex items-center gap-[10px] no-underline border-none"
        style={{
          padding: isGallery ? '10px 14px' : '10px 12px',
          borderRadius: isGallery ? '12px 0 0 12px' : '11px',
          background: isGallery ? darkenHex('#8e8ea6', 86) : 'transparent',
          color: isGallery ? '#fff' : '#b9b3e6',
          font: isGallery ? "700 13px var(--font-display)" : "600 13px var(--font-display)",
          cursor: 'pointer',
          marginRight: isGallery ? '-12px' : '0',
          width: isGallery ? 'calc(100% + 12px)' : '100%',
          boxShadow: isGallery ? '0 8px 20px -10px rgba(0,0,0,.5)' : 'none',
          position: isGallery ? 'relative' as const : undefined,
          zIndex: isGallery ? 1 : undefined,
        }}
      >
        <span className="grid flex-none" style={{ gridTemplateColumns: 'repeat(3,3px)', gridTemplateRows: 'repeat(3,3px)', gap: '1.8px' }}>
          {Array(9).fill(0).map((_, i) => (
            <i key={i} style={{ background: 'currentColor', borderRadius: '1px', width: '3px', height: '3px' }} />
          ))}
        </span>
        Gallery
      </Link>

      {/* Grouped character list */}
      {sections.map(section => {
        const label = section.isUngrouped
          ? (sections.length === 1 ? 'LIBRARY' : 'UNGROUPED')
          : section.name;
        return (
          <div key={section.name} className="flex flex-col" style={{ gap: '4px' }}>
            <div
              className="flex items-center"
              style={{ font: "600 10px var(--font-display)", letterSpacing: '.1em', color: '#6a6699', margin: '18px 8px 8px', gap: '7px' }}
            >
              {!section.isUngrouped && (
                <span aria-hidden style={{ fontSize: '11px', lineHeight: 1, color: '#8e88c4' }}>▸</span>
              )}
              <span style={{ flex: 1, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label}
              </span>
              {!section.isUngrouped && (
                <span style={{ color: '#56527f', font: '600 10px var(--font-display)' }}>{section.characters.length}</span>
              )}
            </div>
            {section.characters.map(char => renderCharLink(char))}
          </div>
        );
      })}

      <div className="flex-1" />

      {/* Footer */}
      <div style={{ font: '400 11px/1.5 system-ui', color: '#6a6699', padding: '10px', borderTop: '1px solid var(--border-divider)' }}>
        Static illustrated poses · transparent PNG · Godot-ready exports
      </div>
    </aside>
  );
}

function darkenHex(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) - amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) - amt));
  const b = Math.max(0, Math.min(255, (n & 255) - amt));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
