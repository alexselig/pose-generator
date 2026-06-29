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
  const [loading, setLoading] = useState(true);
  const [prefix, setPrefix] = useState('');
  const [canvasSize, setCanvasSize] = useState(384);
  const [anchor, setAnchor] = useState<'bottom_center' | 'center' | 'top_center'>('bottom_center');
  const [includeSheet, setIncludeSheet] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const lightbox = useLightbox();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [characterRes, poseSetRes] = await Promise.all([
        fetch(`/api/characters/${id}`),
        fetch(`/api/characters/${id}/pose-sets/latest`),
      ]);

      if (!characterRes.ok) {
        if (!cancelled) setLoading(false);
        return;
      }

      const characterData: Character = await characterRes.json();
      if (cancelled) return;
      setCharacter(characterData);
      setPrefix(slugify(characterData.name));

      if (poseSetRes.ok) {
        const poseSetData: PoseSet = await poseSetRes.json();
        if (cancelled) return;
        setPoseSet(poseSetData);
        setCanvasSize(poseSetData.canvasWidth || 384);
      }

      if (!cancelled) setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const generatedPoses = useMemo(
    () => poseSet?.poses.filter(pose => pose.status === 'generated' || pose.status === 'approved' || pose.status === 'rejected') || [],
    [poseSet]
  );

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
        <h1 style={{ font: '700 28px var(--font-display)', margin: '0 0 8px' }}>Export to Godot</h1>
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
          <Link href={`/characters/${id}`} style={{ background: '#252247', color: '#e8e8ec', border: '1px solid #353160', borderRadius: '10px', padding: '9px 15px', font: '600 12px var(--font-display)', cursor: 'pointer', flexShrink: 0, textDecoration: 'none' }}>
            ← Back
          </Link>
          <h1 style={{ font: '700 26px var(--font-display)', letterSpacing: '-.02em', margin: 0 }}>Export to Godot</h1>
        </div>
        <p style={{ margin: 0, color: '#9a96c4', fontSize: '13px' }}>Transparent PNGs, consistent canvas & anchor, Godot-friendly names, optional pose sheet + manifest.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 1fr', gap: '20px', alignItems: 'start' }}>
        <section style={panelStyle}>
          <div style={{ font: '600 11px var(--font-display)', letterSpacing: '.08em', color: '#9a96c4', marginBottom: '14px' }}>EXPORT SETTINGS</div>
          <FieldLabel>FILE PREFIX</FieldLabel>
          <input value={prefix} onChange={e => setPrefix(slugify(e.target.value) || 'character')} style={{ ...fieldStyle, font: '13px var(--font-mono)' }} />

          <FieldLabel>CANVAS SIZE</FieldLabel>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            {[256, 384, 512].map(size => (
              <button
                key={size}
                onClick={() => setCanvasSize(size)}
                style={{
                  flex: 1, borderRadius: '8px', padding: '8px 4px', font: '600 12px var(--font-display)', cursor: 'pointer',
                  ...(canvasSize === size
                    ? { background: 'var(--gradient-brand)', color: '#fff', border: '1px solid transparent' }
                    : { background: '#252247', color: '#cdc9ee', border: '1px solid #353160' })
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
                    ? { background: 'rgba(111,141,255,.18)', color: '#8fa6ff', border: '1px solid rgba(111,141,255,.4)' }
                    : { background: '#252247', color: '#9a96c4', border: '1px solid #353160' })
                }}
              >
                {a}
              </button>
            ))}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cdc9ee', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={includeSheet}
              onChange={() => setIncludeSheet(v => !v)}
              style={{ accentColor: '#7b5cff', width: '15px', height: '15px' }}
            />
            Include pose sheet
          </label>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <section style={panelStyle}>
            <div style={{ font: '600 11px var(--font-display)', letterSpacing: '.08em', color: '#9a96c4', marginBottom: '12px' }}>ASSET PACK · {files.length} FILES</div>
            <div style={{ font: '400 12.5px/1.9 var(--font-mono)', color: '#cdc9ee' }}>
              <div style={{ color: '#9a96c4' }}>/characters/<span style={{ color: '#6f8dff' }}>{prefix}</span>/</div>
              {files.map(file => {
                const isManifest = file.endsWith('.json');
                const isSheet = file.includes('_pose_sheet');
                const glyph = isManifest ? '{}' : isSheet ? '▦' : '🖼';
                const color = isManifest ? '#3ddc97' : isSheet ? '#b9b3e6' : '#cdc9ee';
                return (
                  <div key={file} style={{ paddingLeft: '16px', color }}>{glyph} {file}</div>
                );
              })}
            </div>
          </section>

          {includeSheet && generatedPoses.length > 0 && (
            <section style={panelStyle}>
              <div style={{ font: '600 11px var(--font-display)', letterSpacing: '.08em', color: '#9a96c4', marginBottom: '12px' }}>POSE SHEET PREVIEW</div>
              <div style={{ border: '1px solid #2e2a54', borderRadius: '10px', padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px', background: character ? `radial-gradient(150px 95px at 50% 22%, ${hexAlpha(character.colorPalette?.[0] || '#7b5cff', 0.3)}, #14132e 72%)` : '#14132e' }}>
                {generatedPoses.map((pose, i) => (
                  <div key={pose.id} onClick={() => lightbox.open(generatedPoses.map(p => ({ src: getPoseImageSrc(character, p), alt: p.displayName })), i)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                    <img src={getPoseImageSrc(character, pose)} alt={pose.displayName} style={{ maxWidth: '100%', maxHeight: '74px', objectFit: 'contain' }} />
                    <span style={{ font: '400 8px var(--font-mono)', color: '#7d79ad', marginTop: '-4px' }}>{pose.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <section style={{ ...panelStyle, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ font: '600 11px var(--font-display)', letterSpacing: '.08em', color: '#9a96c4' }}>{prefix}_manifest.json</span>
            <span style={{ font: '400 10px var(--font-mono)', color: '#3ddc97' }}>Godot ✓</span>
          </div>
          <pre style={{ margin: 0, background: '#13122c', border: '1px solid #2e2a54', borderRadius: '10px', padding: '14px', font: '400 11.5px/1.6 var(--font-mono)', color: '#c4c0e6', overflow: 'auto', maxHeight: '360px', whiteSpace: 'pre' }}>
            {manifest && JSON.stringify(manifest, null, 2)}
          </pre>
          <button onClick={handleDownload} disabled={downloading || generatedPoses.length === 0} style={{ marginTop: '14px', width: '100%', ...primaryButton(downloading || generatedPoses.length === 0), borderRadius: '12px', padding: '13px' }}>
            ⬇ Export Godot asset pack
          </button>
          <div style={{ fontSize: '11px', color: '#7d79ad', textAlign: 'center', marginTop: '8px' }}>
            {files.length} files · {canvasSize}×{canvasSize} · transparent PNG
          </div>
        </section>
      </div>
      {lightbox.state && <Lightbox images={lightbox.state.images} startIndex={lightbox.state.startIndex} onClose={lightbox.close} />}
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
  return <div style={{ font: '600 10px var(--font-display)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px' }}>{children}</div>;
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
    color: disabled ? 'var(--text-dimmer)' : '#fff',
    border: 'none',
    borderRadius: 'var(--radius-btn)',
    padding: '12px 18px',
    font: '700 13px var(--font-display)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : 'var(--shadow-btn-glow)',
  };
}
