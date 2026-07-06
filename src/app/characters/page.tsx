'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Character } from '@/lib/types';
import { groupCharacters } from '@/lib/groups';

// The list endpoint returns characters without inlined referenceImages base64;
// hasReference tells us whether to render the portrait URL or the placeholder.
type GalleryCharacter = Character & { hasReference?: boolean };

export default function CharacterGalleryPage() {
  const [characters, setCharacters] = useState<GalleryCharacter[]>([]);
  const [poseCounts, setPoseCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetch('/api/characters')
      .then(res => res.json())
      .then(async (data: GalleryCharacter[]) => {
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

  const visibleChars = showArchived ? characters : characters.filter(c => !c.archived);
  const archivedCount = characters.filter(c => c.archived).length;

  const sections = groupCharacters(visibleChars);
  const hasGroups = sections.some(s => !s.isUngrouped);

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '24px',
  };

  const stripe = 'repeating-linear-gradient(135deg, #F1ECE2, #F1ECE2 11px, #EBE4D6 11px, #EBE4D6 22px)';

  const renderCard = (char: GalleryCharacter) => {
    const count = poseCounts[char.id] || 0;
    return (
      <Link
        key={char.id}
        href={`/characters/${char.id}`}
        className="pf-card no-underline"
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          border: '1px solid var(--border-card)',
          borderRadius: '12px',
          overflow: 'hidden',
          cursor: 'pointer',
          opacity: char.archived ? 0.62 : 1,
        }}
      >
        {/* Art area */}
        <div style={{ position: 'relative', height: '238px', background: char.hasReference ? '#F4EFE6' : stripe }}>
          {char.hasReference ? (
            <img
              src={`/api/characters/${char.id}/reference`}
              alt={char.name}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
            />
          ) : (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: '12px', textAlign: 'center', font: '500 10px var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: '#B7AE9C' }}>
              Character Art
            </div>
          )}
          {char.archived && (
            <div style={{ position: 'absolute', top: '10px', left: '10px', font: "700 9px var(--font-body)", letterSpacing: '.08em', textTransform: 'uppercase', background: '#EDE6D8', color: 'var(--muted)', border: '1px solid var(--border-field)', padding: '3px 8px', borderRadius: '6px' }}>
              Archived
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ font: "600 20px var(--font-display)", color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {char.name}
          </div>
          <div style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--muted)', height: '34px', overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
            {char.artStyle || 'Illustrated character'}
          </div>
          <span style={{ alignSelf: 'flex-start', font: "500 10.5px var(--font-body)", color: '#7A6F5E', border: '1px solid #E0D7C7', padding: '4px 11px', borderRadius: 'var(--radius-pill)' }}>
            {count} {count === 1 ? 'pose' : 'poses'}
          </span>
        </div>
      </Link>
    );
  };

  const newCharacterTile = (
    <Link
      href="/characters/new"
      className="pf-newtile no-underline"
      style={{
        border: '1.5px dashed var(--border-dashed)',
        borderRadius: '12px',
        minHeight: '322px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        color: 'var(--muted)',
        background: 'transparent',
        cursor: 'pointer',
      }}
    >
      <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', color: 'var(--canvas)' }}>
        ＋
      </div>
      <div style={{ font: "600 13px var(--font-body)" }}>New character</div>
    </Link>
  );

  if (loading) {
    return <div style={{ padding: '36px 42px', color: 'var(--muted)' }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '36px 42px 48px' }}>
      {hasGroups ? (
        <>
          {sections.map(section => (
            <section key={section.name} style={{ marginBottom: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', margin: '0 0 24px' }}>
                <h2 style={{ font: '600 28px var(--font-display)', margin: 0, color: 'var(--ink)' }}>
                  {section.isUngrouped ? 'Ungrouped' : section.name}
                </h2>
                <span style={{ font: 'italic 500 19px var(--font-display)', color: '#B8AF9C' }}>
                  {section.characters.length}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-soft)' }} />
              </div>
              <div style={gridStyle}>
                {section.characters.map(char => renderCard(char))}
                {section.isUngrouped && newCharacterTile}
              </div>
            </section>
          ))}
          {!sections.some(s => s.isUngrouped) && (
            <div style={gridStyle}>{newCharacterTile}</div>
          )}
        </>
      ) : (
        <div style={gridStyle}>
          {visibleChars.map(char => renderCard(char))}
          {newCharacterTile}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', paddingTop: '22px', borderTop: '1px solid var(--border-soft)', color: 'var(--muted)', font: '400 13px var(--font-body)' }}>
        <span><b style={{ color: 'var(--text-bright)', fontWeight: 700 }}>{characters.length}</b> characters</span>
        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--border-field)', flexShrink: 0 }} />
        <span><b style={{ color: 'var(--text-bright)', fontWeight: 700 }}>{archivedCount}</b> archived</span>
        <div className="flex-1" />
        <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', userSelect: 'none', color: 'var(--ink-2)', font: '500 13px var(--font-body)' }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={() => setShowArchived(!showArchived)}
            className="pf-check"
          />
          Show archived
        </label>
      </div>
    </div>
  );
}
