'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Character, PoseSet, GAME_PRESETS } from '@/lib/types';
import { Lightbox, useLightbox } from '@/components/Lightbox';

// All unique poses across all presets
const ALL_SUGGESTIONS = GAME_PRESETS.flatMap(preset => preset.poses).filter(
  (pose, i, list) => list.findIndex(p => p.name === pose.name) === i
);

type ReviewPose = {
  id: string;
  name: string;
  displayName: string;
  useCase: string;
  status: 'empty' | 'generated' | 'approved';
  prompt: string;
};

export default function GeneratePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pick phase
  const [pickedPoses, setPickedPoses] = useState<{ id: string; name: string; displayName: string; useCase: string }[]>([]);
  const [newPoseName, setNewPoseName] = useState('');

  // Review phase
  const [phase, setPhase] = useState<'pick' | 'review'>('pick');
  const [poseSetId, setPoseSetId] = useState<string | null>(null);
  const [reviewPoses, setReviewPoses] = useState<ReviewPose[]>([]);
  const [poseImages, setPoseImages] = useState<Record<string, string>>({});
  const [generatingIdx, setGeneratingIdx] = useState(-1);
  const lightbox = useLightbox();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/characters/${id}`);
        if (!res.ok) throw new Error('Character not found');
        const data: Character = await res.json();
        if (!cancelled) setCharacter(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          router.push('/characters');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id, router]);

  // Pick phase helpers
  const suggestions = useMemo(() => {
    const added = new Set(pickedPoses.map(p => p.name));
    return ALL_SUGGESTIONS.filter(p => !added.has(p.name));
  }, [pickedPoses]);

  const handleAddSuggestion = (pose: typeof ALL_SUGGESTIONS[number]) => {
    setPickedPoses(prev => [...prev, { id: `pose-${Date.now()}-${pose.name}`, name: pose.name, displayName: pose.displayName, useCase: pose.useCase }]);
  };

  const handleRemovePose = (index: number) => {
    setPickedPoses(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddCustom = () => {
    if (!newPoseName.trim()) return;
    const name = newPoseName.trim().toLowerCase().replace(/\s+/g, '_');
    const displayName = newPoseName.trim().replace(/\b\w/g, l => l.toUpperCase());
    setPickedPoses(prev => [...prev, { id: `pose-${Date.now()}`, name, displayName, useCase: '' }]);
    setNewPoseName('');
  };

  // Generate: create pose set then generate each pose
  const handleGenerate = async () => {
    if (!character || pickedPoses.length === 0) return;
    setError(null);

    // Switch to review phase immediately
    setReviewPoses(pickedPoses.map(p => ({ ...p, status: 'empty', prompt: '' })));
    setPhase('review');

    try {
      // Create pose set
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: character.id,
          customPoses: pickedPoses.map(p => ({
            name: p.name,
            displayName: p.displayName,
            description: p.displayName,
            useCase: p.useCase,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to create pose set' }));
        throw new Error(body.error || 'Failed to create pose set');
      }
      const poseSet: PoseSet = await res.json();
      setPoseSetId(poseSet.id);

      // Update review poses with server IDs
      setReviewPoses(prev => prev.map((p, i) => ({
        ...p,
        id: poseSet.poses[i]?.id || p.id,
      })));

      // Generate each pose sequentially
      for (let i = 0; i < poseSet.poses.length; i++) {
        setGeneratingIdx(i);
        try {
          const genRes = await fetch('/api/generate', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ poseSetId: poseSet.id, poseId: poseSet.poses[i].id }),
          });
          if (genRes.ok) {
            const result = await genRes.json();
            setReviewPoses(prev => prev.map((p, j) => j === i ? { ...p, status: 'generated' } : p));
            if (result.imageData) {
              setPoseImages(prev => ({ ...prev, [poseSet.poses[i].name]: result.imageData }));
            }
          }
        } catch (err) {
          console.error(`Failed to generate pose ${i}:`, err);
        }
      }
      setGeneratingIdx(-1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pose set');
      setPhase('pick');
    }
  };

  // Redo a single pose
  const handleRedoPose = async (poseIndex: number) => {
    const pose = reviewPoses[poseIndex];
    if (!poseSetId || !pose?.id) return;
    setGeneratingIdx(poseIndex);
    setError(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poseSetId, poseId: pose.id, prompt: pose.prompt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to regenerate' }));
        setError(err.error || 'Failed to regenerate');
        return;
      }
      const result = await res.json();
      setReviewPoses(prev => prev.map((p, i) => i === poseIndex ? { ...p, status: 'generated' } : p));
      if (result.imageData) {
        setPoseImages(prev => ({ ...prev, [pose.name]: result.imageData }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setGeneratingIdx(-1);
    }
  };

  const [lbRegenerating, setLbRegenerating] = useState(false);
  const handleLightboxRegenerate = async (imageIndex: number, prompt: string) => {
    // Map lightbox index (only images with poseImages) back to reviewPoses index
    const withImages = reviewPoses.map((p, i) => ({ p, i })).filter(x => poseImages[x.p.name]);
    const entry = withImages[imageIndex];
    if (!entry || !poseSetId) return;
    const pose = entry.p;
    setLbRegenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poseSetId, poseId: pose.id, prompt: prompt || undefined }),
      });
      if (res.ok) {
        const result = await res.json();
        setReviewPoses(prev => prev.map((p, i) => i === entry.i ? { ...p, status: 'generated' } : p));
        if (result.imageData) {
          setPoseImages(prev => ({ ...prev, [pose.name]: result.imageData }));
          lightbox.updateImage(imageIndex, `data:image/png;base64,${result.imageData}`);
        }
      }
    } finally {
      setLbRegenerating(false);
    }
  };

  const handleDone = async () => {
    if (poseSetId) {
      await fetch(`/api/pose-sets/${poseSetId}/finalize`, { method: 'POST' }).catch(() => {});
    }
    router.push(`/characters/${id}`);
  };

  const approvedCount = reviewPoses.filter(p => p.status === 'approved').length;

  if (loading || !character) {
    return <div style={{ padding: '30px 34px', color: 'var(--text-dim)' }}>Loading…</div>;
  }

  // ── Review phase ──
  if (phase === 'review') {
    return (
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '24px 30px 60px' }}>
        <h1 style={{ font: '600 34px var(--font-display)', letterSpacing: '-.01em', margin: '0 0 5px' }}>Review &amp; approve poses</h1>
        <p style={{ margin: '0 0 26px', color: 'var(--text-dim)', fontSize: '13px' }}>Approve poses or request regeneration.</p>

        {error && (
          <div style={{ marginBottom: '16px', borderRadius: '12px', border: '1px solid rgba(142,58,53,.35)', background: 'rgba(142,58,53,.1)', color: 'var(--danger)', padding: '12px 14px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(238px, 1fr))', gap: '16px', marginBottom: '26px' }}>
          {reviewPoses.map((pose, i) => (
            <div key={pose.id} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-hairline)', borderRadius: '14px', overflow: 'hidden' }}>
              <div className="checkerboard" style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {generatingIdx === i ? (
                  <div style={{ width: '28px', height: '28px', border: '3px solid var(--accent-purple)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'pf-spin .8s linear infinite' }} />
                ) : poseImages[pose.name] ? (
                  <img
                    src={`data:image/png;base64,${poseImages[pose.name]}`}
                    alt={pose.displayName}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '8px', cursor: 'pointer' }}
                    onClick={() => {
                      const imgs = reviewPoses.filter(p => poseImages[p.name]).map(p => ({ src: `data:image/png;base64,${poseImages[p.name]}`, alt: p.displayName }));
                      const idx = reviewPoses.filter(p => poseImages[p.name]).findIndex(p => p.name === pose.name);
                      lightbox.open(imgs, idx);
                    }}
                  />
                ) : pose.status === 'generated' ? (
                  <div style={{ color: 'var(--text-dimmer)', fontSize: '11px' }}>Generated ✓</div>
                ) : (
                  <div style={{ color: 'var(--text-dimmer)', fontSize: '11px' }}>Waiting…</div>
                )}
              </div>
              <div style={{ padding: '12px' }}>
                <div style={{ marginBottom: '9px' }}>
                  <div style={{ font: '600 14px var(--font-body)' }}>{pose.displayName}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '4px' }}>{pose.useCase}</div>
                </div>

                {pose.status === 'approved' ? (
                  <button
                    onClick={() => setReviewPoses(prev => prev.map((p, j) => j === i ? { ...p, status: 'generated' } : p))}
                    style={{ width: '100%', minHeight: '79px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', font: '700 14px var(--font-body)', cursor: 'pointer', background: 'var(--success)', color: 'var(--canvas)', border: 'none' }}
                  >
                    ✓ Approved
                  </button>
                ) : pose.status === 'generated' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea
                      value={pose.prompt}
                      onChange={e => setReviewPoses(prev => prev.map((p, j) => j === i ? { ...p, prompt: e.target.value } : p))}
                      onInput={e => {
                        const target = e.currentTarget;
                        target.style.height = 'auto';
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                      rows={1}
                      className="auto-grow"
                      placeholder="Edit prompt for redo…"
                      style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-field)', borderRadius: '8px', color: 'var(--ink)', padding: '7px 9px', font: '12px/1.4 var(--font-body)', outline: 'none', resize: 'none', overflow: 'hidden', marginBottom: '0', display: 'block' }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => void handleRedoPose(i)}
                        disabled={generatingIdx === i}
                        style={{ flex: 1, background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border-field)', borderRadius: '9px', padding: '9px', font: '600 12px var(--font-body)', cursor: generatingIdx === i ? 'wait' : 'pointer', opacity: generatingIdx === i ? 0.7 : 1 }}
                      >
                        ↻ Redo
                      </button>
                      <button
                        onClick={() => setReviewPoses(prev => prev.map((p, j) => j === i ? { ...p, status: 'approved' } : p))}
                        style={{ flex: 1, background: 'rgba(94,107,59,.12)', color: 'var(--success)', border: '1px solid rgba(94,107,59,.4)', borderRadius: '9px', padding: '9px', font: '600 12px var(--font-body)', cursor: 'pointer' }}
                      >
                        ✓ Approve
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingTop: '18px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}><b style={{ color: 'var(--ink)', fontWeight: 700 }}>{approvedCount}</b> of {reviewPoses.length} approved</span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => void handleDone()}
            style={{ background: 'var(--accent)', color: 'var(--canvas)', border: 'none', borderRadius: '11px', padding: '12px 24px', font: '700 14px var(--font-body)', cursor: 'pointer', boxShadow: 'none' }}
          >
            Done
          </button>
        </div>
        {lightbox.state && <Lightbox images={lightbox.state.images} startIndex={lightbox.state.startIndex} onClose={lightbox.close} onRegenerate={handleLightboxRegenerate} regenerating={lbRegenerating} />}
      </div>
    );
  }

  // ── Pick phase ──
  return (
    <div style={{ padding: '24px 30px 60px', maxWidth: '820px' }}>
      <Link href={`/characters/${id}`} style={{ color: 'var(--muted)', fontSize: '12px', textDecoration: 'none', display: 'inline-block', marginBottom: '18px' }}>← Back to character</Link>
      <h1 style={{ font: '600 34px var(--font-display)', letterSpacing: '-.01em', margin: '0 0 5px' }}>Add poses</h1>
      <p style={{ margin: '0 0 26px', color: 'var(--text-dim)', fontSize: '13px' }}>
        Pick from suggested poses or add your own custom names.
      </p>

      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-hairline)', borderRadius: '14px', padding: '18px', marginBottom: '26px' }}>
        <div style={{ font: '600 13px var(--font-body)', color: 'var(--text-primary)', marginBottom: '14px' }}>
          Pose List · {pickedPoses.length} {pickedPoses.length === 1 ? 'pose' : 'poses'}
        </div>

        {pickedPoses.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
            {pickedPoses.map((p, i) => (
              <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', font: '500 11px var(--font-body)', background: 'var(--bg-raised)', padding: '5px 10px', borderRadius: '8px', color: 'var(--text-dim)', border: '1px solid var(--border-hairline)' }}>
                {p.displayName}
                <button
                  onClick={() => handleRemovePose(i)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dimmer)', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: 0 }}
                >×</button>
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={newPoseName}
            onChange={e => setNewPoseName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCustom(); }}
            placeholder="Add a pose name…"
            style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--text-primary)', padding: '9px 12px', font: '13px var(--font-body)', outline: 'none' }}
          />
          <button
            onClick={handleAddCustom}
            style={{ background: 'var(--gradient-brand)', color: 'var(--canvas)', border: 'none', borderRadius: 'var(--radius-btn)', padding: '9px 14px', font: '600 12px var(--font-body)', cursor: 'pointer' }}
          >+ Add</button>
        </div>

        {suggestions.length > 0 && (
          <>
            <div style={{ font: '600 10px var(--font-body)', letterSpacing: '.06em', color: 'var(--muted)', marginTop: '14px', marginBottom: '8px' }}>SUGGESTIONS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {suggestions.map(p => (
                <button
                  key={p.name}
                  onClick={() => handleAddSuggestion(p)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', font: '500 11px var(--font-body)', background: 'transparent', padding: '5px 10px', borderRadius: '8px', color: 'var(--muted)', border: '1px dashed var(--border-field)', cursor: 'pointer' }}
                >
                  + {p.displayName}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: '16px', borderRadius: '12px', border: '1px solid rgba(142,58,53,.35)', background: 'rgba(142,58,53,.1)', color: 'var(--danger)', padding: '12px 14px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        <Link href={`/characters/${id}`} style={{ background: 'var(--bg-raised)', color: 'var(--ink-2)', border: '1px solid var(--border-field)', borderRadius: 'var(--radius-btn)', padding: '12px 18px', font: '600 13px var(--font-body)', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>← Back</Link>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => void handleGenerate()}
          disabled={pickedPoses.length === 0}
          style={{
            background: pickedPoses.length > 0 ? 'var(--gradient-brand)' : 'var(--bg-raised)',
            color: pickedPoses.length > 0 ? 'var(--canvas)' : 'var(--text-dimmer)',
            border: 'none', borderRadius: 'var(--radius-btn)', padding: '12px 22px',
            font: '700 13px var(--font-body)', cursor: pickedPoses.length === 0 ? 'not-allowed' : 'pointer',
            boxShadow: pickedPoses.length > 0 ? 'var(--shadow-btn-glow)' : 'none',
          }}
        >Generate poses →</button>
      </div>
    </div>
  );
}
