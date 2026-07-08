'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Scene } from '@/lib/types';
import { useToast } from '@/components/Toast';

const CHECKER = 'repeating-conic-gradient(#EFEAE0 0% 25%, #F9F6F1 0% 50%) 50% / 30px 30px';

export default function SceneEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useToast();
  const [scene, setScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(true);
  const [editText, setEditText] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`/api/scenes/${id}`)
      .then(r => (r.ok ? r.json() : null))
      .then((s: Scene | null) => {
        setScene(s);
        setLoading(false);
        if (!s) router.push('/scenes');
      })
      .catch(() => {
        setLoading(false);
        router.push('/scenes');
      });
  }, [id, router]);

  const imageUrl = (s: Scene) => `/api/scenes/${s.id}/image?v=${encodeURIComponent(s.updatedAt)}`;

  const runEdit = async (delta: string) => {
    if (!scene) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/scenes/${scene.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(delta ? { edit: delta } : { prompt: scene.prompt || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to apply edit');
      const updated: Scene = await res.json();
      setScene(updated);
      setEditText('');
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
    if (!scene?.prompt) return;
    try {
      await navigator.clipboard.writeText(scene.prompt);
      showToast('Prompt copied');
    } catch {
      showToast('Copy failed');
    }
  };

  if (loading) return <div style={{ padding: '30px 34px', color: 'var(--muted)' }}>Loading…</div>;
  if (!scene) return null;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
        <Link href="/scenes" style={{ ...secondaryButton, textDecoration: 'none' }}>← Scenes</Link>
        <h1 style={{ font: '700 22px var(--font-display)', margin: 0, color: 'var(--ink)' }}>{scene.name}</h1>
      </div>

      <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-card)', background: CHECKER }}>
        {scene.status === 'generated' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl(scene)} alt={scene.name} style={{ width: '100%', display: 'block', opacity: generating ? 0.4 : 1 }} />
        ) : (
          <div style={{ padding: '80px', textAlign: 'center', color: 'var(--muted)' }}>{scene.status === 'failed' ? 'Generation failed — try again.' : 'Generating…'}</div>
        )}
      </div>

      <div style={{ font: '400 12px var(--font-mono)', color: 'var(--muted)', margin: '10px 2px 0' }}>
        {scene.characterNames.join(' · ')} · {scene.aspectRatio}
      </div>

      {scene.prompt && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '18px 0 8px' }}>
            <span style={{ ...microLabel, marginBottom: 0 }}>PROMPT USED</span>
            <button onClick={copyPrompt} style={copyBtn}>⧉ Copy</button>
          </div>
          <div style={promptReadonly}>{scene.prompt}</div>
        </>
      )}

      <div style={{ ...microLabel, marginTop: '18px' }}>DESCRIBE AN EDIT · OPTIONAL</div>
      <textarea
        value={editText}
        onChange={e => setEditText(e.target.value)}
        rows={2}
        placeholder="Type just the change you want applied to this image — e.g. “make it night”, “move the dragon closer”, “add rain”. Leave blank to reroll the same prompt."
        style={field}
      />
      <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <a href={imageUrl(scene)} download={`${scene.name.replace(/[^a-z0-9]+/gi, '_')}.png`} style={{ ...secondaryButton, textDecoration: 'none' }}>⬇ Download</a>
        <button onClick={fixLimbs} disabled={generating} title="Redraw with an anatomy correction (removes extra/duplicated limbs)" style={{ ...secondaryButton, cursor: generating ? 'default' : 'pointer' }}>⚠ Fix limbs</button>
        <div style={{ flex: 1 }} />
        <button onClick={regenerate} disabled={generating} style={{ ...primaryButton, opacity: generating ? 0.55 : 1, cursor: generating ? 'default' : 'pointer' }}>
          {generating ? 'Generating…' : (editText.trim() ? '↻ Apply edit' : '↻ Regenerate')}
        </button>
      </div>
    </div>
  );
}

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
