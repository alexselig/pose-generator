'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Character, GodotManifest, Pose, PoseSet } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { Lightbox, useLightbox } from '@/components/Lightbox';

export default function ExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { showToast } = useToast();
  const [character, setCharacter] = useState<Character | null>(null);
  const [poseSet, setPoseSet] = useState<PoseSet | null>(null);
  const [allPoseSets, setAllPoseSets] = useState<PoseSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefix, setPrefix] = useState('');
  const [canvasSize, setCanvasSize] = useState(384);
  const [anchor, setAnchor] = useState<'bottom_center' | 'center' | 'top_center'>('bottom_center');
  const [includeSheet, setIncludeSheet] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const lightbox = useLightbox();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [characterRes, poseSetRes] = await Promise.all([
          fetch(`/api/characters/${id}`),
          fetch(`/api/characters/${id}/pose-sets/latest`),
        ]);

        if (!characterRes.ok) return;

        const characterData: Character = await characterRes.json();
        if (cancelled) return;
        setCharacter(characterData);
        setPrefix(slugify(characterData.name));

        if (poseSetRes.ok) {
          const poseSetData: PoseSet | null = await poseSetRes.json();
          if (cancelled) return;
          if (poseSetData) {
            setPoseSet(poseSetData);
            setCanvasSize(poseSetData.canvasWidth || 384);
          }
        }

        // Fetch all pose sets to merge poses from multiple generations
        const allRes = await fetch(`/api/characters/${id}/pose-sets`);
        if (allRes.ok && !cancelled) {
          const all: PoseSet[] = await allRes.json();
          setAllPoseSets(all);
        }
      } catch {
        // Network error — fall through; loading is cleared in finally.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const generatedPoses = useMemo(() => {
    const isGenerated = (p: Pose) => p.status === 'generated' || p.status === 'approved' || p.status === 'rejected';
    // Merge poses from all pose sets, latest pose set wins on name conflicts
    const byName = new Map<string, Pose>();
    for (const ps of allPoseSets) {
      for (const pose of ps.poses) {
        if (isGenerated(pose) && !byName.has(pose.name)) {
          byName.set(pose.name, pose);
        }
      }
    }
    // Fallback to single pose set if allPoseSets is empty
    if (byName.size === 0 && poseSet) {
      return poseSet.poses.filter(isGenerated);
    }
    return Array.from(byName.values());
  }, [poseSet, allPoseSets]);

  const handleLightboxRegenerate = async (imageIndex: number, prompt: string) => {
    const pose = generatedPoses[imageIndex];
    if (!pose) return;
    // The merged list spans every pose set, so regenerate against the set that
    // actually contains this pose (not just the latest) or the API 404s.
    const sourceSet = allPoseSets.find(ps => ps.poses.some(p => p.id === pose.id)) || poseSet;
    if (!sourceSet) return;
    setRegenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poseSetId: sourceSet.id, poseId: pose.id, prompt: prompt || undefined }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.imageData) {
          lightbox.updateImage(imageIndex, `data:image/png;base64,${result.imageData}`);
        }
        // Reload pose sets (latest + all) to reflect the regenerated pose.
        const [psRes, allRes] = await Promise.all([
          fetch(`/api/characters/${id}/pose-sets/latest`),
          fetch(`/api/characters/${id}/pose-sets`),
        ]);
        if (psRes.ok) setPoseSet(await psRes.json());
        if (allRes.ok) setAllPoseSets(await allRes.json());
        showToast('Pose regenerated');
      }
    } catch {
      showToast('Failed to regenerate');
    } finally {
      setRegenerating(false);
    }
  };

  const manifest: GodotManifest | null = useMemo(() => {
    if (!character) return null;
    return {
      character_name: character.name,
      asset_type: 'static_pose_set',
      engine: 'Godot',
      canvas_size: `${canvasSize}x${canvasSize}`,
      anchor,
      poses: generatedPoses.map(pose => ({
        name: pose.name,
        file: `${prefix}_${slugify(pose.name)}.png`,
        anchor,
        locked: pose.locked,
        use_case: pose.useCase,
      })),
    };
  }, [anchor, canvasSize, character, generatedPoses, prefix]);

  const files = useMemo(() => {
    const items = generatedPoses.map(pose => `${prefix}_${slugify(pose.name)}.png`);
    if (includeSheet && generatedPoses.length > 0) items.push(`${prefix}_pose_sheet.png`);
    items.push(`${prefix}_manifest.json`);
    return items;
  }, [generatedPoses, includeSheet, prefix]);

  const handleDownload = async () => {
    if (!poseSet || !character) return;
    setDownloading(true);
    try {
      const query = new URLSearchParams({
        characterId: character.id,
        prefix,
        canvasSize: String(canvasSize),
        anchor,
        includeSheet: String(includeSheet),
      });
      const res = await fetch(`/api/export?${query.toString()}`);
      if (!res.ok) {
        throw new Error('Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prefix}_godot_assets.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Godot asset pack exported');
    } catch {
      showToast('Export failed');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '30px 34px', color: 'var(--text-dim)' }}>Loading…</div>;
  }

  if (!character || !poseSet) {
    return (
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '30px 34px' }}>
        <h1 style={{ font: '600 34px var(--font-display)', margin: '0 0 8px' }}>Export to Godot</h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: '18px' }}>You need a generated pose set before exporting.</p>
        <Link href={`/generate/${id}`} style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
          Go generate poses →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1060px', margin: '0 auto', padding: '24px 30px 60px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '5px' }}>
          <Link href={`/characters/${id}`} className="pf-ghost" style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border-field)', borderRadius: '10px', padding: '9px 15px', font: '600 12px var(--font-body)', cursor: 'pointer', flexShrink: 0, textDecoration: 'none' }}>
            ← Back
          </Link>
          <h1 style={{ font: '600 34px var(--font-display)', letterSpacing: '-.01em', margin: 0 }}>Export to Godot</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>Transparent PNGs, consistent canvas & anchor, Godot-friendly names, optional pose sheet + manifest.</p>
      </div>

      <div className="pf-grid-1" style={{ display: 'grid', gridTemplateColumns: '300px 1fr 1fr', gap: '20px', alignItems: 'start' }}>
        <section style={panelStyle}>
          <div style={{ font: '600 11px var(--font-body)', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: '14px' }}>EXPORT SETTINGS</div>
          <FieldLabel>FILE PREFIX</FieldLabel>
          <input value={prefix} onChange={e => setPrefix(slugify(e.target.value) || 'character')} style={{ ...fieldStyle, font: '13px var(--font-mono)' }} />

          <FieldLabel>CANVAS SIZE</FieldLabel>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            {[256, 384, 512].map(size => (
              <button
                key={size}
                onClick={() => setCanvasSize(size)}
                style={{
                  flex: 1, borderRadius: '8px', padding: '8px 4px', font: '600 12px var(--font-body)', cursor: 'pointer',
                  ...(canvasSize === size
                    ? { background: 'var(--gradient-brand)', color: 'var(--canvas)', border: '1px solid transparent' }
                    : { background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border-field)' })
                }}
              >
                {size}px
              </button>
            ))}
          </div>

          <FieldLabel>ANCHOR POINT</FieldLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            {(['bottom_center', 'center', 'top_center'] as const).map(a => (
              <button
                key={a}
                onClick={() => setAnchor(a)}
                style={{
                  textAlign: 'left', borderRadius: '8px', padding: '8px 11px', font: '500 12px var(--font-mono)', cursor: 'pointer',
                  ...(anchor === a
                    ? { background: 'var(--accent-tint)', color: 'var(--accent)', border: '1px solid var(--accent)' }
                    : { background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border-field)' })
                }}
              >
                {a}
              </button>
            ))}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ink-2)', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={includeSheet}
              onChange={() => setIncludeSheet(v => !v)}
              style={{ accentColor: 'var(--accent)', width: '15px', height: '15px' }}
            />
            Include pose sheet
          </label>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
          <section style={panelStyle}>
            <div style={{ font: '600 11px var(--font-body)', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: '12px' }}>ASSET PACK · {files.length} FILES</div>
            <div style={{ font: '400 12.5px/1.9 var(--font-mono)', color: 'var(--ink-2)' }}>
              <div style={{ color: 'var(--muted)' }}>/characters/<span style={{ color: 'var(--accent)' }}>{prefix}</span>/</div>
              {files.map(file => {
                const isManifest = file.endsWith('.json');
                const isSheet = file.includes('_pose_sheet');
                const glyph = isManifest ? '{}' : isSheet ? '▦' : '🖼';
                const color = isManifest ? 'var(--success)' : isSheet ? 'var(--muted)' : 'var(--ink-2)';
                return (
                  <div key={file} style={{ paddingLeft: '16px', color }}>{glyph} {file}</div>
                );
              })}
            </div>
          </section>

          {includeSheet && generatedPoses.length > 0 && (
            <section style={panelStyle}>
              <div style={{ font: '600 11px var(--font-body)', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: '12px' }}>POSE SHEET PREVIEW</div>
              <div style={{ border: '1px solid var(--border-card)', borderRadius: '10px', padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px', background: character ? `radial-gradient(150px 95px at 50% 22%, ${hexAlpha(character.colorPalette?.[0] || '#7A2E2A', 0.18)}, var(--canvas-raised) 72%)` : 'var(--canvas-raised)' }}>
                {generatedPoses.map((pose, i) => (
                  <div key={pose.id} onClick={() => lightbox.open(generatedPoses.map(p => ({ src: getPoseImageSrc(character, p), alt: p.displayName })), i)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                    <img src={getPoseImageSrc(character, pose)} alt={pose.displayName} style={{ maxWidth: '100%', maxHeight: '74px', objectFit: 'contain' }} />
                    <span style={{ font: '400 8px var(--font-mono)', color: 'var(--muted)', marginTop: '-4px' }}>{pose.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <section style={{ ...panelStyle, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ font: '600 11px var(--font-body)', letterSpacing: '.08em', color: 'var(--muted)' }}>{prefix}_manifest.json</span>
            <span style={{ font: '400 10px var(--font-mono)', color: 'var(--success)' }}>Godot ✓</span>
          </div>
          <pre style={{ margin: 0, background: 'var(--code-panel-bg)', border: '1px solid var(--border-card)', borderRadius: '10px', padding: '14px', font: '400 11.5px/1.6 var(--font-mono)', color: 'var(--code-text)', overflow: 'auto', maxHeight: '360px', whiteSpace: 'pre' }}>
            {manifest && JSON.stringify(manifest, null, 2)}
          </pre>
          <button onClick={handleDownload} disabled={downloading || generatedPoses.length === 0} style={{ marginTop: '14px', width: '100%', ...primaryButton(downloading || generatedPoses.length === 0), borderRadius: '12px', padding: '13px' }}>
            ⬇ Export Godot asset pack
          </button>
          <div style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center', marginTop: '8px' }}>
            {files.length} files · {canvasSize}×{canvasSize} · transparent PNG
          </div>
        </section>
      </div>
      {lightbox.state && <Lightbox images={lightbox.state.images} startIndex={lightbox.state.startIndex} onClose={lightbox.close} onRegenerate={handleLightboxRegenerate} regenerating={regenerating} />}
    </div>
  );
}


function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function hexAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function getPoseImageSrc(character: Character, pose: Pose) {
  if (pose.imageData) return `data:image/png;base64,${pose.imageData}`;
  return `/api/images/${character.id}/${slugify(character.name)}_${slugify(pose.name)}.png`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ font: '600 10px var(--font-body)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>{children}</div>;
}

const panelStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border-hairline)',
  borderRadius: 'var(--radius-card)',
  padding: '16px',
  boxShadow: 'var(--shadow-panel)',
};


const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
  borderRadius: 'var(--radius-input)',
  color: 'var(--text-primary)',
  padding: '10px 12px',
  font: '13px var(--font-body)',
  outline: 'none',
  marginBottom: '12px',
};

function primaryButton(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? 'var(--bg-raised)' : 'var(--gradient-brand-full)',
    color: disabled ? 'var(--text-dimmer)' : 'var(--canvas)',
    border: 'none',
    borderRadius: 'var(--radius-btn)',
    padding: '12px 18px',
    font: '700 13px var(--font-body)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : 'var(--shadow-btn-glow)',
  };
}
