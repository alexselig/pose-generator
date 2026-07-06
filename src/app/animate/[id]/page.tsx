'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Character, AnimationClip, ANIMATION_PRESETS } from '@/lib/types';
import { useToast } from '@/components/Toast';

export default function AnimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useToast();

  const [character, setCharacter] = useState<Character | null>(null);
  const [clips, setClips] = useState<AnimationClip[]>([]);
  const [action, setAction] = useState('walk');
  const [clip, setClip] = useState<AnimationClip | null>(null);
  const [generating, setGenerating] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(12);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    fetch(`/api/characters/${id}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data: Character) => setCharacter(data))
      .catch(() => router.push('/characters'));

    fetch(`/api/characters/${id}/animations`)
      .then(res => (res.ok ? res.json() : []))
      .then((data: AnimationClip[]) => setClips(data))
      .catch(() => setClips([]));
  }, [id, router]);

  // When clips or the chosen action change, preview the latest clip for it.
  useEffect(() => {
    const latest = clips.find(c => c.action === action) || null;
    setClip(latest);
    if (latest) setFps(latest.fps);
  }, [clips, action]);

  const preset = ANIMATION_PRESETS.find(p => p.id === action);
  const isGenerated = clip?.status === 'generated' && clip.frameCount > 0;

  // Loop the frames while playing.
  useEffect(() => {
    if (!isGenerated || !playing || !clip) return;
    const timer = setInterval(() => {
      setFrameIndex(i => (i + 1) % clip.frameCount);
    }, Math.max(40, 1000 / fps));
    return () => clearInterval(timer);
  }, [isGenerated, playing, fps, clip]);

  useEffect(() => { setFrameIndex(0); }, [clip?.id, clip?.updatedAt]);

  const frameUrls = useMemo(() => {
    if (!clip || !isGenerated) return [];
    return Array.from({ length: clip.frameCount }, (_, i) =>
      `/api/animations/${clip.id}/frames/${i}?v=${encodeURIComponent(clip.updatedAt)}`
    );
  }, [clip, isGenerated]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Reuse the existing clip for this action, or create one.
      let target = clips.find(c => c.action === action);
      if (!target) {
        const createRes = await fetch('/api/animations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterId: id, action }),
        });
        if (!createRes.ok) throw new Error('create failed');
        target = await createRes.json();
      }
      const genRes = await fetch(`/api/animations/${target!.id}/generate`, { method: 'POST' });
      if (!genRes.ok) {
        const body = await genRes.json().catch(() => ({}));
        throw new Error(body.error || 'generation failed');
      }
      const updated: AnimationClip = await genRes.json();
      setClip(updated);
      setFps(updated.fps);
      setPlaying(true);
      setClips(prev => {
        const rest = prev.filter(c => c.id !== updated.id);
        return [updated, ...rest];
      });
      showToast(`${updated.displayName} generated — ${updated.frameCount} frames`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to generate animation');
    } finally {
      setGenerating(false);
    }
  };

  if (!character) {
    return <div style={{ padding: '30px 34px', color: 'var(--text-dim)' }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '30px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
        <Link href={`/characters/${id}`} style={secondaryButton}>← Back</Link>
        <h1 style={{ font: '700 20px var(--font-display)', letterSpacing: '-.01em', margin: 0 }}>
          Animate {character.name}
        </h1>
      </div>

      <div className="pf-stack" style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
        {/* Preview */}
        <div style={{ flexShrink: 0, width: '360px' }}>
          <div style={{ position: 'relative', width: '360px', height: '360px', borderRadius: '18px', overflow: 'hidden', background: 'repeating-conic-gradient(#2a2748 0% 25%, #23203f 0% 50%) 50% / 34px 34px', border: '1px solid var(--border-hairline)' }}>
            {isGenerated ? (
              frameUrls.map((url, i) => (
                // Preload every frame; show only the current one to avoid flicker.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={`${clip?.displayName} frame ${i + 1}`}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: i === frameIndex ? 1 : 0 }}
                />
              ))
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dimmer)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                {generating ? 'Generating…' : clip?.status === 'failed' ? 'Generation failed — try again.' : 'No animation yet. Generate one →'}
              </div>
            )}
          </div>

          {/* Playback controls */}
          {isGenerated && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '14px' }}>
              <button onClick={() => setPlaying(p => !p)} style={secondaryButton}>
                {playing ? '❚❚ Pause' : '▶ Play'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <span style={{ font: '400 11px var(--font-mono)', color: '#9a96c4' }}>fps</span>
                <input type="range" min={1} max={24} value={fps} onChange={e => setFps(Number(e.target.value))} style={{ flex: 1, accentColor: '#7b5cff' }} />
                <span style={{ font: '400 11px var(--font-mono)', color: '#e6e3f5', width: '20px' }}>{fps}</span>
              </div>
            </div>
          )}
        </div>

        {/* Controls + filmstrip */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '600 10px var(--font-display)', letterSpacing: '.07em', color: '#7d79ad', marginBottom: '7px' }}>ANIMATION</div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {ANIMATION_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setAction(p.id)}
                style={{ ...secondaryButton, ...(action === p.id ? { background: 'var(--gradient-brand)', color: '#fff', border: 'none' } : {}) }}
              >
                {p.displayName}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {isGenerated && clip && (
              <a href={`/api/animations/${clip.id}/export`} style={{ ...secondaryButton, textDecoration: 'none' }}>⬇ Export to Godot</a>
            )}
            <button onClick={handleGenerate} disabled={generating} style={{ ...primaryButton, opacity: generating ? 0.6 : 1, cursor: generating ? 'default' : 'pointer' }}>
              {generating ? 'Generating…' : clip ? '↻ Regenerate' : '✨ Generate'}
            </button>
          </div>

          <p style={{ margin: '12px 0 0', color: '#9a96c4', fontSize: '12.5px', lineHeight: 1.5 }}>
            {preset?.description || ''} Generated as one filmstrip, then sliced into transparent, Godot-ready frames.
          </p>

          {isGenerated && (
            <>
              <div style={{ font: '600 10px var(--font-display)', letterSpacing: '.07em', color: '#7d79ad', margin: '26px 0 10px' }}>
                FRAMES · {clip?.frameCount}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: '8px' }}>
                {frameUrls.map((url, i) => (
                  <div key={url} style={{ borderRadius: '10px', padding: '4px', background: 'repeating-conic-gradient(#2a2748 0% 25%, #23203f 0% 50%) 50% / 16px 16px', border: i === frameIndex ? '1px solid #7b5cff' : '1px solid var(--border-hairline)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`frame ${i + 1}`} style={{ width: '100%', height: '72px', objectFit: 'contain', display: 'block' }} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const secondaryButton: React.CSSProperties = {
  background: 'var(--bg-raised)',
  color: 'var(--text-bright)',
  border: '1px solid #353160',
  borderRadius: 'var(--radius-btn)',
  padding: '9px 16px',
  font: '600 12px var(--font-display)',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
};

const primaryButton: React.CSSProperties = {
  background: 'var(--gradient-brand)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-btn)',
  padding: '9px 18px',
  font: '700 12px var(--font-display)',
  boxShadow: 'var(--shadow-btn-glow)',
};
