'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Scene } from '@/lib/types';
import { useToast } from '@/components/Toast';

export default function ScenesPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/scenes')
      .then(r => (r.ok ? r.json() : []))
      .then(setScenes)
      .catch(() => {});
  }, []);

  // Keyboard nav while the scene lightbox is open.
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      else if (e.key === 'ArrowLeft') setLightboxIndex(i => (i === null ? i : (i - 1 + scenes.length) % scenes.length));
      else if (e.key === 'ArrowRight') setLightboxIndex(i => (i === null ? i : (i + 1) % scenes.length));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIndex, scenes.length]);

  const removeScene = async (id: string) => {
    if (!confirm('Delete this scene?')) return;
    const res = await fetch(`/api/scenes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setScenes(prev => prev.filter(s => s.id !== id));
      setLightboxIndex(null);
      showToast('Scene deleted');
    }
  };

  const imageUrl = (scene: Scene) => `/api/scenes/${scene.id}/image?v=${encodeURIComponent(scene.updatedAt)}`;

  const lbScene = lightboxIndex !== null ? scenes[lightboxIndex] ?? null : null;
  const openLightbox = (id: string) => {
    const i = scenes.findIndex(s => s.id === id);
    if (i >= 0) setLightboxIndex(i);
  };
  const closeLightbox = () => setLightboxIndex(null);
  const stepLightbox = (dir: number) =>
    setLightboxIndex(i => (i === null || scenes.length === 0 ? i : (i + dir + scenes.length) % scenes.length));

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '30px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '20px' }}>
        <h1 style={{ font: '700 26px var(--font-display)', margin: 0, color: 'var(--ink)' }}>Scenes</h1>
        <span style={{ font: '400 13px var(--font-mono)', color: 'var(--muted)' }}>{scenes.length} saved</span>
      </div>

      {scenes.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '60px 22px' }}>
          <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: '14px' }}>No scenes yet — build one with two or more of your characters.</p>
          <Link href="/scenes/new" style={{ ...primaryButton, textDecoration: 'none', display: 'inline-block' }}>✨ New scene</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {scenes.map(s => (
            <div key={s.id} style={{ ...card, padding: '10px' }}>
              <button onClick={() => openLightbox(s.id)} style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '10px', overflow: 'hidden' }}>
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
      )}

      {/* Scene lightbox */}
      {lbScene && (
        <div onClick={closeLightbox} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(20,16,12,.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {scenes.length > 1 && (
            <button onClick={e => { e.stopPropagation(); stepLightbox(-1); }} style={lbNav('left')} aria-label="Previous scene">‹</button>
          )}
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '92vw', padding: '0 64px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span style={{ font: '600 16px var(--font-display)', color: '#fff' }}>{lbScene.name}</span>
              {scenes.length > 1 && (
                <span style={{ font: '400 12px var(--font-mono)', color: 'rgba(255,255,255,.55)' }}>{(lightboxIndex ?? 0) + 1} / {scenes.length}</span>
              )}
            </div>
            {lbScene.status === 'generated' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl(lbScene)} alt={lbScene.name} style={{ maxWidth: '84vw', maxHeight: '70vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 30px 80px -20px rgba(0,0,0,.8)' }} />
            ) : (
              <div style={{ padding: '80px', color: 'rgba(255,255,255,.7)' }}>{lbScene.status}</div>
            )}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <a href={imageUrl(lbScene)} download={`${lbScene.name.replace(/[^a-z0-9]+/gi, '_')}.png`} style={lbSecondary}>⬇ Download</a>
              <button onClick={() => router.push(`/scenes/${lbScene.id}`)} style={{ ...primaryButton, cursor: 'pointer' }}>✎ Edit scene</button>
            </div>
          </div>
          {scenes.length > 1 && (
            <button onClick={e => { e.stopPropagation(); stepLightbox(1); }} style={lbNav('right')} aria-label="Next scene">›</button>
          )}
          <button onClick={closeLightbox} style={{ position: 'absolute', top: '20px', right: '24px', background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }} aria-label="Close">✕</button>
        </div>
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

const primaryButton: React.CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--canvas)',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius-btn)',
  padding: '10px 18px',
  font: '600 13px var(--font-body)',
};

const lbSecondary: React.CSSProperties = {
  background: 'rgba(255,255,255,.12)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,.28)',
  borderRadius: 'var(--radius-btn)',
  padding: '9px 16px',
  font: '600 13px var(--font-body)',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
};

function lbNav(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    [side]: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,.12)',
    border: '1px solid rgba(255,255,255,.28)',
    borderRadius: '50%',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '28px',
    cursor: 'pointer',
  };
}
