'use client';

import { Suspense, use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Character, AnimationClip, getAnimationPrompt } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { BloomLoader } from '@/components/BloomLoader';
import { PageLoader } from '@/components/PageLoader';

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function titleCase(slug: string): string {
  return slug.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function AnimatePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <AnimateInner params={params} />
    </Suspense>
  );
}

function AnimateInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const { showToast } = useToast();

  const queryAction = (search.get('action') || '').toLowerCase();

  const [character, setCharacter] = useState<Character | null>(null);
  const [clips, setClips] = useState<AnimationClip[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [action, setAction] = useState(queryAction || 'walk');
  const [clip, setClip] = useState<AnimationClip | null>(null);
  const [generating, setGenerating] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(12);
  const [frameIndex, setFrameIndex] = useState(0);
  const [prompt, setPrompt] = useState(() => getAnimationPrompt(queryAction || 'walk'));
  const [poseUrls, setPoseUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/characters/${id}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data: Character) => setCharacter(data))
      .catch(() => router.push('/characters'));

    fetch(`/api/characters/${id}/animations`)
      .then(res => (res.ok ? res.json() : []))
      .then((data: AnimationClip[]) => setClips(data))
      .catch(() => setClips([]));

    // Derive the animatable actions from the character's existing poses.
    fetch(`/api/characters/${id}/images`)
      .then(res => (res.ok ? res.json() : { images: [], characterName: '' }))
      .then((body: { images?: { name: string; url: string; isArchive: boolean }[]; characterName?: string }) => {
        const charSlug = slugify(body.characterName || '');
        const poses = (body.images || []).filter(im => !im.isArchive);
        const actionOf = (name: string) => {
          const base = name.replace(/\.png$/, '');
          return charSlug && base.startsWith(`${charSlug}_`) ? base.slice(charSlug.length + 1) : base.replace(/^.*?_/, '');
        };
        const urlMap: Record<string, string> = {};
        for (const im of poses) {
          const a = actionOf(im.name);
          if (a && !(a in urlMap)) urlMap[a] = im.url;
        }
        setPoseUrls(urlMap);
        const uniq = Array.from(new Set(poses.map(im => actionOf(im.name))));
        setActions(uniq);
        if (!queryAction) {
          const resolved = uniq.includes('walk') ? 'walk' : (uniq[0] || 'walk');
          setAction(resolved);
          setPrompt(getAnimationPrompt(resolved));
        }
      })
      .catch(() => setActions([]));
  }, [id, router, queryAction]);

  // Show the latest clip for the chosen action.
  useEffect(() => {
    const latest = clips.find(c => c.action === action) || null;
    setClip(latest);
    if (latest) setFps(latest.fps);
  }, [clips, action]);

  const isGenerated = clip?.status === 'generated' && clip.frameCount > 0;

  const generate = async (targetAction: string, userPrompt?: string) => {
    setGenerating(true);
    try {
      let target = clips.find(c => c.action === targetAction);
      if (!target) {
        const createRes = await fetch('/api/animations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterId: id, action: targetAction, displayName: titleCase(targetAction) }),
        });
        if (!createRes.ok) throw new Error('create failed');
        target = await createRes.json();
      }
      const genRes = await fetch(`/api/animations/${target!.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt?.trim() || undefined }),
      });
      if (!genRes.ok) {
        const body = await genRes.json().catch(() => ({}));
        throw new Error(body.error || 'generation failed');
      }
      const updated: AnimationClip = await genRes.json();
      setClip(updated);
      setFps(updated.fps);
      setPlaying(true);
      setClips(prev => [updated, ...prev.filter(c => c.id !== updated.id)]);
      showToast(`${updated.displayName} generated — ${updated.frameCount} frames`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to generate animation');
    } finally {
      setGenerating(false);
    }
  };

  // Loop the frames while playing.
  useEffect(() => {
    if (!isGenerated || !playing || !clip) return;
    const timer = setInterval(() => setFrameIndex(i => (i + 1) % clip.frameCount), Math.max(40, 1000 / fps));
    return () => clearInterval(timer);
  }, [isGenerated, playing, fps, clip]);

  useEffect(() => { setFrameIndex(0); }, [clip?.id, clip?.updatedAt]);

  const frameUrls = useMemo(() => {
    if (!clip || !isGenerated) return [];
    return Array.from({ length: clip.frameCount }, (_, i) =>
      `/api/animations/${clip.id}/frames/${i}?v=${encodeURIComponent(clip.updatedAt)}`
    );
  }, [clip, isGenerated]);

  // Action buttons: the character's poses, plus the query action if not present.
  const actionList = useMemo(() => {
    const set = new Set(actions);
    if (queryAction) set.add(queryAction);
    return Array.from(set);
  }, [actions, queryAction]);

  if (!character) {
    return <PageLoader />;
  }

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '30px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
        <Link href={`/characters/${id}`} style={secondaryButton}>← Back</Link>
        <h1 style={{ font: '600 24px var(--font-display)', margin: 0, color: 'var(--ink)' }}>
          Animate {character.name}
        </h1>
      </div>

      <div className="pf-stack" style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
        {/* Preview */}
        <div style={{ flexShrink: 0, width: '360px' }}>
          <div style={{ position: 'relative', width: '360px', height: '360px', borderRadius: '16px', overflow: 'hidden', background: 'repeating-conic-gradient(#EFEAE0 0% 25%, #F9F6F1 0% 50%) 50% / 34px 34px', border: '1px solid var(--border-card)' }}>
            {isGenerated ? (
              frameUrls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={`${clip?.displayName} frame ${i + 1}`}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: i === frameIndex ? 1 : 0 }}
                />
              ))
            ) : (
              <>
                {poseUrls[action] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={poseUrls[action]}
                    alt={`${titleCase(action)} pose`}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: generating ? 0.32 : 0.72 }}
                  />
                )}
                {generating && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BloomLoader size={56} />
                  </div>
                )}
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', padding: '14px' }}>
                  <span style={{ background: 'rgba(26,23,20,.62)', color: 'var(--canvas)', padding: '7px 13px', borderRadius: '999px', font: '600 12px var(--font-body)', textAlign: 'center' }}>
                    {generating ? 'Generating…' : clip?.status === 'failed' ? 'Generation failed — try again.' : poseUrls[action] ? 'Starting pose — add a prompt & Generate' : 'No animation yet. Generate one →'}
                  </span>
                </div>
              </>
            )}
          </div>

          {isGenerated && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '14px' }}>
              <button onClick={() => setPlaying(p => !p)} style={secondaryButton}>
                {playing ? '❚❚ Pause' : '▶ Play'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <span style={{ font: '400 11px var(--font-mono)', color: 'var(--muted)' }}>fps</span>
                <input type="range" min={1} max={24} value={fps} onChange={e => setFps(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent)' }} />
                <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-2)', width: '20px' }}>{fps}</span>
              </div>
            </div>
          )}
        </div>

        {/* Controls + filmstrip */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '700 10px var(--font-body)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: '7px' }}>
            POSE / ACTION{actionList.length ? '' : ' — generate poses first'}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {actionList.map(a => {
              const has = clips.some(c => c.action === a && c.status === 'generated');
              return (
                <button
                  key={a}
                  onClick={() => { setAction(a); setPrompt(getAnimationPrompt(a)); }}
                  style={{ ...chip, ...(action === a ? { background: 'var(--accent)', color: 'var(--canvas)', border: '1px solid var(--accent)' } : {}) }}
                  title={has ? 'Has an animation' : 'Not animated yet'}
                >
                  {titleCase(a)}{has ? ' ●' : ''}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: '18px' }}>
            <div style={{ font: '700 10px var(--font-body)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: '7px' }}>
              PROMPT · OPTIONAL
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!generating && action) void generate(action, prompt);
                }
              }}
              rows={2}
              placeholder="Describe how it should move or look — e.g. “bouncy exaggerated stride, cape flowing”. Leave blank for the default motion."
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border-field)',
                borderRadius: 'var(--radius-input)',
                color: 'var(--ink)',
                padding: '10px 12px',
                font: '13px/1.5 var(--font-body)',
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '16px' }}>
            <div style={{ flex: 1 }} />
            {isGenerated && clip && (
              <a href={`/api/animations/${clip.id}/export`} style={{ ...secondaryButton, textDecoration: 'none' }}>⬇ Export to Godot</a>
            )}
            <button onClick={() => generate(action, prompt)} disabled={generating || !action} style={{ ...primaryButton, opacity: generating || !action ? 0.6 : 1, cursor: generating ? 'default' : 'pointer' }}>
              {generating ? 'Generating…' : clip ? '↻ Regenerate' : '✨ Generate'}
            </button>
          </div>

          <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: '12.5px', lineHeight: 1.5 }}>
            Animating <b style={{ color: 'var(--ink)' }}>{titleCase(action)}</b> — the model animates from this pose in one filmstrip, then it's sliced into transparent, Godot-ready frames.
          </p>

          {isGenerated && (
            <>
              <div style={{ font: '700 10px var(--font-body)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', margin: '26px 0 10px' }}>
                FRAMES · {clip?.frameCount}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: '8px' }}>
                {frameUrls.map((url, i) => (
                  <div key={url} style={{ borderRadius: '10px', padding: '4px', background: 'repeating-conic-gradient(#EFEAE0 0% 25%, #F9F6F1 0% 50%) 50% / 16px 16px', border: i === frameIndex ? '1px solid var(--accent)' : '1px solid var(--border-card)' }}>
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
  background: 'transparent',
  color: 'var(--ink-2)',
  border: '1px solid var(--border-field)',
  borderRadius: 'var(--radius-btn)',
  padding: '9px 16px',
  font: '600 13px var(--font-body)',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
};

const chip: React.CSSProperties = {
  background: 'var(--surface)',
  color: 'var(--ink-2)',
  border: '1px solid var(--border-field)',
  borderRadius: '999px',
  padding: '7px 14px',
  font: '600 12px var(--font-body)',
  cursor: 'pointer',
};

const primaryButton: React.CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--canvas)',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius-btn)',
  padding: '9px 18px',
  font: '600 13px var(--font-body)',
};
