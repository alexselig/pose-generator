'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Character, Scene, SCENE_ASPECT_RATIOS } from '@/lib/types';
import { groupCharacters } from '@/lib/groups';
import { useToast } from '@/components/Toast';

export default function ScenesPage() {
  const { showToast } = useToast();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [context, setContext] = useState('');
  const [styleNote, setStyleNote] = useState('');
  const [aspect, setAspect] = useState<string>('16:9');
  const [enhance, setEnhance] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [active, setActive] = useState<Scene | null>(null);
  const [editText, setEditText] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/characters')
      .then(r => (r.ok ? r.json() : []))
      .then((cs: Character[]) => setCharacters(cs.filter(c => !c.archived)))
      .catch(() => {});
    fetch('/api/scenes')
      .then(r => (r.ok ? r.json() : []))
      .then(setScenes)
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
      const scene: Scene = await createRes.json();
      const genRes = await fetch(`/api/scenes/${scene.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enhance }),
      });
      if (!genRes.ok) throw new Error((await genRes.json().catch(() => ({}))).error || 'Failed to generate scene');
      const updated: Scene = await genRes.json();
      setActive(updated);
      setEditText('');
      setScenes(prev => [updated, ...prev.filter(s => s.id !== updated.id)]);
      showToast('Scene generated');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to generate scene');
    } finally {
      setGenerating(false);
    }
  };

  const runEdit = async (delta: string) => {
    if (!active) return;
    setGenerating(true);
    try {
      const genRes = await fetch(`/api/scenes/${active.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(delta ? { edit: delta } : { prompt: active.prompt || undefined }),
      });
      if (!genRes.ok) throw new Error((await genRes.json().catch(() => ({}))).error || 'Failed to regenerate');
      const updated: Scene = await genRes.json();
      setActive(updated);
      setEditText('');
      setScenes(prev => prev.map(s => (s.id === updated.id ? updated : s)));
      showToast(delta ? 'Edit applied' : 'Scene regenerated');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to apply edit');
    } finally {
      setGenerating(false);
    }
  };

  const regenerate = () => runEdit(editText.trim());

  const fixLimbs = () => runEdit(
    'Fix the character anatomy: each character must have exactly two arms, two hands, and two legs — remove any extra, duplicated, merged, or floating limbs. Keep every character\u2019s identity, the composition, and the art style the same.'
  );

  const copyPrompt = async () => {
    if (!active?.prompt) return;
    try {
      await navigator.clipboard.writeText(active.prompt);
      showToast('Prompt copied');
    } catch {
      showToast('Copy failed');
    }
  };

  const removeScene = async (id: string) => {
    if (!confirm('Delete this scene?')) return;
    const res = await fetch(`/api/scenes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setScenes(prev => prev.filter(s => s.id !== id));
      if (active?.id === id) setActive(null);
      showToast('Scene deleted');
    }
  };

  const openScene = (scene: Scene) => {
    setActive(scene);
    setEditText('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const imageUrl = (scene: Scene) => `/api/scenes/${scene.id}/image?v=${encodeURIComponent(scene.updatedAt)}`;

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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '6px' }}>
        <h1 style={{ font: '700 26px var(--font-display)', margin: 0, color: 'var(--ink)' }}>Scenes</h1>
        <span style={{ font: '400 13px var(--font-mono)', color: 'var(--muted)' }}>{scenes.length} saved</span>
      </div>
      <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: '13.5px', lineHeight: 1.55, maxWidth: '640px' }}>
        Pick two or more characters, describe the moment, and generate a single illustrated scene with them posed together.
      </p>

      {/* Builder */}
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
          <span style={{ font: '400 12px var(--font-mono)', color: 'var(--muted)' }}>
            {selected.length < 2 ? 'Select at least 2 characters' : `${selected.length} characters`}
          </span>
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

      {/* Active scene review */}
      {active && (
        <div style={{ ...card, marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
            <h2 style={{ font: '600 18px var(--font-display)', margin: 0, color: 'var(--ink)' }}>{active.name}</h2>
            <span style={{ font: '400 12px var(--font-mono)', color: 'var(--muted)' }}>{active.aspectRatio}</span>
          </div>
          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-card)', background: 'repeating-conic-gradient(#EFEAE0 0% 25%, #F9F6F1 0% 50%) 50% / 30px 30px' }}>
            {active.status === 'generated' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl(active)} alt={active.name} style={{ width: '100%', display: 'block', opacity: generating ? 0.4 : 1 }} />
            ) : (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>{active.status === 'failed' ? 'Generation failed — try again.' : 'Generating…'}</div>
            )}
          </div>

          {active.prompt && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0 8px' }}>
                <span style={{ ...microLabel, marginBottom: 0 }}>PROMPT USED</span>
                <button onClick={copyPrompt} style={copyBtn}>⧉ Copy</button>
              </div>
              <div style={promptReadonly}>{active.prompt}</div>
            </>
          )}

          <div style={{ ...microLabel, marginTop: '16px' }}>DESCRIBE AN EDIT · OPTIONAL</div>
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            rows={2}
            placeholder="Type just the change you want applied to this image — e.g. “make it night”, “move the dragon closer”, “add rain”. Leave blank to reroll the same prompt."
            style={field}
          />
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <a href={imageUrl(active)} download={`${active.name.replace(/[^a-z0-9]+/gi, '_')}.png`} style={{ ...secondaryButton, textDecoration: 'none' }}>⬇ Download</a>
            <button onClick={fixLimbs} disabled={generating} title="Redraw with an anatomy correction (removes extra/duplicated limbs)" style={{ ...secondaryButton, cursor: generating ? 'default' : 'pointer' }}>⚠ Fix limbs</button>
            <div style={{ flex: 1 }} />
            <button onClick={regenerate} disabled={generating} style={{ ...primaryButton, opacity: generating ? 0.55 : 1, cursor: generating ? 'default' : 'pointer' }}>
              {generating ? 'Generating…' : (editText.trim() ? '↻ Apply edit' : '↻ Regenerate')}
            </button>
          </div>
        </div>
      )}

      {/* Gallery */}
      {scenes.length > 0 && (
        <>
          <div style={{ ...microLabel, margin: '34px 0 12px' }}>SAVED SCENES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
            {scenes.map(s => (
              <div key={s.id} style={{ ...card, padding: '10px' }}>
                <button onClick={() => openScene(s)} style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', aspectRatio: '16/9', background: 'repeating-conic-gradient(#EFEAE0 0% 25%, #F9F6F1 0% 50%) 50% / 22px 22px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-card)' }}>
                    {s.status === 'generated' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl(s)} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: '12px' }}>{s.status}</div>
                    )}
                  </div>
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '600 13px var(--font-body)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div style={{ font: '400 11px var(--font-mono)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.characterNames.join(' · ')}</div>
                  </div>
                  <button onClick={() => removeScene(s.id)} title="Delete scene" style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '15px', lineHeight: 1, padding: '4px' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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

const secondaryButton: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--ink-2)',
  border: '1px solid var(--border-field)',
  borderRadius: 'var(--radius-btn)',
  padding: '9px 16px',
  font: '600 13px var(--font-body)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
};

const promptReadonly: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-field)',
  borderRadius: 'var(--radius-input)',
  color: 'var(--ink-2)',
  padding: '10px 12px',
  font: '12.5px/1.55 var(--font-body)',
  whiteSpace: 'pre-wrap',
  maxHeight: '150px',
  overflowY: 'auto',
};

const copyBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border-field)',
  borderRadius: '999px',
  color: 'var(--ink-2)',
  padding: '3px 10px',
  font: '600 11px var(--font-body)',
  cursor: 'pointer',
};
