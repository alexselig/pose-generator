'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Character } from '@/lib/types';

export default function CharacterGalleryPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [poseCounts, setPoseCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetch('/api/characters')
      .then(res => res.json())
      .then(async (data: Character[]) => {
        setCharacters(data);
        setLoading(false);
        // Fetch pose counts for each character
        const counts: Record<string, number> = {};
        await Promise.all(data.map(async (char: Character) => {
          try {
            const res = await fetch(`/api/characters/${char.id}/images`);
            if (res.ok) {
              const body = await res.json();
              counts[char.id] = (body.images || []).filter((img: { isArchive: boolean }) => !img.isArchive).length;
            }
          } catch { /* ignore */ }
        }));
        setPoseCounts(counts);
      })
      .catch(() => setLoading(false));
  }, []);

  const defaultColors = ['#7b5cff', '#4f8cff', '#2fd6d6', '#3ddc97', '#f3c06a', '#ff7d8a'];
  const visibleChars = showArchived ? characters : characters.filter(c => !c.archived);
  const archivedCount = characters.filter(c => c.archived).length;

  if (loading) {
    return <div style={{ padding: '30px 34px', color: 'var(--text-dim)' }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '30px 34px 40px' }}>
      {/* Character Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(224px, 1fr))', gap: '16px' }}>
        {visibleChars.map((char, i) => {
          const color = char.colorPalette?.[0] || defaultColors[i % defaultColors.length];
          return (
            <Link
              key={char.id}
              href={`/characters/${char.id}`}
              className="no-underline"
              style={{
                position: 'relative',
                height: '286px',
                borderRadius: '20px',
                overflow: 'hidden',
                cursor: 'pointer',
                background: `linear-gradient(160deg, ${lighten(color, 40)}, ${color} 44%, ${darken(color, 50)})`,
                boxShadow: '0 22px 46px -26px rgba(0,0,0,.85)',
                display: 'block',
                opacity: char.archived ? 0.6 : 1,
              }}
            >
              {/* Character image — full bleed */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {char.referenceImages?.[0] ? (
                  <img
                    src={`data:image/png;base64,${char.referenceImages[0]}`}
                    alt={char.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                  />
                ) : (
                  <div style={{ fontSize: '80px', opacity: 0.4 }}>🎭</div>
                )}
              </div>

              {/* Bottom scrim */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 38%, rgba(8,7,22,.18) 60%, rgba(8,7,22,.82) 100%)' }} />

              {/* Archived badge */}
              {char.archived && (
                <div style={{ position: 'absolute', top: '12px', left: '12px', font: "600 10px var(--font-display)", letterSpacing: '.06em', background: 'rgba(255,255,255,.18)', color: '#fff', border: '1px solid rgba(255,255,255,.34)', padding: '3px 8px', borderRadius: '7px', backdropFilter: 'blur(4px)' }}>
                  ARCHIVED
                </div>
              )}

              {/* Bottom info */}
              <div style={{ position: 'absolute', left: '14px', right: '14px', bottom: '14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: "700 17px var(--font-display)", color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {char.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.8)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {char.artStyle || 'Illustrated'}
                  </div>
                </div>
                <span style={{ flexShrink: 0, font: "600 10.5px var(--font-display)", color: '#fff', background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)', padding: '4px 9px', borderRadius: '20px', backdropFilter: 'blur(4px)' }}>
                  {poseCounts[char.id] || 0} {(poseCounts[char.id] || 0) === 1 ? 'pose' : 'poses'}
                </span>
              </div>
            </Link>
          );
        })}

        {/* New character tile */}
        <Link
          href="/characters/new"
          className="no-underline"
          style={{
            border: '1.5px dashed #3c3770',
            borderRadius: '20px',
            height: '286px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: '#7d79ad',
            background: 'rgba(31,29,60,.4)',
            cursor: 'pointer',
          }}
        >
          <div style={{ width: '50px', height: '50px', borderRadius: '15px', background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '25px', color: '#fff', boxShadow: 'var(--shadow-btn-glow)' }}>
            ＋
          </div>
          <div style={{ font: "600 13px var(--font-display)", color: '#b9b3e6' }}>New character</div>
        </Link>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '28px', paddingTop: '18px', borderTop: '1px solid var(--border-divider)', color: 'var(--text-dim)', fontSize: '13px' }}>
        <span><b style={{ color: 'var(--text-bright)', fontWeight: 700 }}>{characters.length}</b> characters</span>
        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#3a3568', flexShrink: 0 }} />
        <span><b style={{ color: 'var(--text-bright)', fontWeight: 700 }}>{archivedCount}</b> archived</span>
        <div className="flex-1" />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', color: '#cdc9ee' }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={() => setShowArchived(!showArchived)}
            style={{ accentColor: '#7b5cff', width: '15px', height: '15px' }}
          />
          Show archived
        </label>
      </div>
    </div>
  );
}

function lighten(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * percent / 100));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent / 100));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * percent / 100));
  return `rgb(${r},${g},${b})`;
}

function darken(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - Math.round(255 * percent / 100));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * percent / 100));
  const b = Math.max(0, (num & 0xff) - Math.round(255 * percent / 100));
  return `rgb(${r},${g},${b})`;
}
