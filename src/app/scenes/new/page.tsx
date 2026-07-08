'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Character, SCENE_ASPECT_RATIOS } from '@/lib/types';
import { groupCharacters } from '@/lib/groups';
import { useToast } from '@/components/Toast';

export default function NewScenePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [context, setContext] = useState('');
  const [styleNote, setStyleNote] = useState('');
  const [aspect, setAspect] = useState<string>('16:9');
  const [enhance, setEnhance] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/characters')
      .then(r => (r.ok ? r.json() : []))
      .then((cs: Character[]) => setCharacters(cs.filter(c => !c.archived)))
      .catch(() => {});
  }, []);

  const toggle = (id: string) =>
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const canGenerate = selected.length >= 2 && context.trim().length > 0 && !generating;

  const generate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const createRes = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterIds: selected, context, aspectRatio: aspect, styleNote: styleNote || undefined }),
      });
      if (!createRes.ok) throw new Error((await createRes.json().catch(() => ({}))).error || 'Failed to create scene');
      const scene = await createRes.json();
      // Jump to the focused editor, which runs the generation with a live loader.
      router.push(`/scenes/${scene.id}?enhance=${enhance ? '1' : '0'}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to create scene');
      setGenerating(false);
    }
  };

  const sections = useMemo(() => groupCharacters(characters), [characters]);
  const activeSection = sections.find(s => s.name === activeGroup) ?? sections[0] ?? null;

  const renderCard = (c: Character) => {
    const on = selected.includes(c.id);
    return (
      <button
        key={c.id}
        onClick={() => toggle(c.id)}
        title={c.name}
        style={{
          position: 'relative', padding: '8px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
          background: on ? 'var(--accent)' : 'var(--surface)',
          border: `1px solid ${on ? 'var(--accent)' : 'var(--border-card)'}`,
        }}
      >
        <div style={{ width: '100%', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: 'repeating-conic-gradient(#EFEAE0 0% 25%, #F9F6F1 0% 50%) 50% / 18px 18px', marginBottom: '6px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/characters/${c.id}/reference`} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
        </div>
        <div style={{ font: '600 12px var(--font-body)', color: on ? 'var(--canvas)' : 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
        {on && <div style={{ position: 'absolute', top: '6px', right: '6px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--canvas)', color: 'var(--accent)', font: '700 12px var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>}
      </button>
    );
  };

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '30px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
        <Link href="/scenes" style={backLink}>← Scenes</Link>
        <h1 style={{ font: '700 26px var(--font-display)', margin: 0, color: 'var(--ink)' }}>New scene</h1>
      </div>
      <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: '13.5px', lineHeight: 1.55, maxWidth: '640px' }}>
        Pick two or more characters, describe the moment, and generate a single illustrated scene with them posed together.
      </p>

      <div style={card}>
        <div style={microLabel}>1 · CAST — pick 2 or more</div>
        {characters.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '4px 0 0' }}>
            No characters yet. <Link href="/characters/new" style={{ color: 'var(--accent)' }}>Create one →</Link>
          </p>
        ) : (
          <div style={{ marginTop: '4px' }}>
            {sections.length > 1 && (
              <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', marginBottom: '14px', borderBottom: '1px solid var(--border-card)' }}>
                {sections.map(section => {
                  const isActive = activeSection?.name === section.name;
                  const selCount = section.characters.filter(c => selected.includes(c.id)).length;
                  return (
                    <button key={section.name} onClick={() => setActiveGroup(section.name)} style={{ ...tab, ...(isActive ? tabActive : {}) }}>
                      {section.isUngrouped ? 'Ungrouped' : section.name}
                      {selCount > 0 && <span style={tabBadge(isActive)}>{selCount}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {activeSection && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: '10px' }}>
                {activeSection.characters.map(c => renderCard(c))}
              </div>
            )}
          </div>
        )}

        {characters.length > 0 && (
          <div style={{ font: '400 12px var(--font-mono)', color: 'var(--muted)', marginTop: '10px' }}>
            {selected.length < 2 ? 'Select at least 2 characters' : `${selected.length} characters selected`}
          </div>
        )}

        <div style={{ ...microLabel, marginTop: '20px' }}>2 · CONTEXT</div>
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          rows={3}
          placeholder="Describe the scene — setting, mood, action, and how the characters relate. e.g. “the two heroes stand back-to-back in a burning throne room at dusk, weapons drawn”."
          style={field}
        />

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '18px' }}>
          <div>
            <div style={microLabel}>ASPECT</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {SCENE_ASPECT_RATIOS.map(r => (
                <button key={r} onClick={() => setAspect(r)} style={{ ...chip, ...(aspect === r ? chipActive : {}) }}>{r}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={microLabel}>STYLE NOTE · OPTIONAL</div>
            <input
              value={styleNote}
              onChange={e => setStyleNote(e.target.value)}
              placeholder="e.g. painterly, cel-shaded, storybook…"
              style={{ ...field, height: '40px', padding: '9px 12px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', font: '500 12.5px var(--font-body)', color: 'var(--ink-2)' }} title="Expand your context into a richer prompt with the text model before generating">
            <input type="checkbox" checked={enhance} onChange={e => setEnhance(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            ✨ Enhance my prompt
          </label>
          <button onClick={generate} disabled={!canGenerate} style={{ ...primaryButton, opacity: canGenerate ? 1 : 0.55, cursor: canGenerate ? 'pointer' : 'default' }}>
            {generating ? 'Generating…' : '✨ Generate scene'}
          </button>
        </div>
      </div>
    </div>
  );
}

const backLink: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--ink-2)',
  border: '1px solid var(--border-field)',
  borderRadius: 'var(--radius-btn)',
  padding: '7px 14px',
  font: '600 13px var(--font-body)',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
};

const card: React.CSSProperties = {
  background: 'var(--surface-card, var(--surface))',
  border: '1px solid var(--border-card)',
  borderRadius: '16px',
  padding: '20px 22px',
};

const microLabel: React.CSSProperties = {
  font: '700 10px var(--font-body)',
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: 'var(--faint)',
  marginBottom: '8px',
};

const field: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border-field)',
  borderRadius: 'var(--radius-input)',
  color: 'var(--ink)',
  padding: '10px 12px',
  font: '13px/1.5 var(--font-body)',
  outline: 'none',
  resize: 'none',
};

const chip: React.CSSProperties = {
  background: 'var(--surface)',
  color: 'var(--ink-2)',
  border: '1px solid var(--border-field)',
  borderRadius: '999px',
  padding: '7px 14px',
  font: '600 12px var(--font-mono)',
  cursor: 'pointer',
};

const chipActive: React.CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--canvas)',
  border: '1px solid var(--accent)',
};

const tab: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  color: 'var(--muted)',
  padding: '8px 12px',
  font: '600 12.5px var(--font-body)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '-1px',
};

const tabActive: React.CSSProperties = {
  color: 'var(--ink)',
  borderBottom: '2px solid var(--accent)',
};

const tabBadge = (active: boolean): React.CSSProperties => ({
  minWidth: '16px',
  height: '16px',
  padding: '0 4px',
  borderRadius: '999px',
  background: active ? 'var(--accent)' : 'var(--border-card)',
  color: active ? 'var(--canvas)' : 'var(--ink-2)',
  font: '700 10px var(--font-mono)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const primaryButton: React.CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--canvas)',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius-btn)',
  padding: '10px 18px',
  font: '600 13px var(--font-body)',
};
