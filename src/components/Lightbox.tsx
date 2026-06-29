'use client';

import { useCallback, useEffect, useState } from 'react';

export interface LightboxImage {
  src: string;
  alt: string;
}

interface LightboxProps {
  images: LightboxImage[];
  startIndex: number;
  onClose: () => void;
}

export function Lightbox({ images, startIndex, onClose }: LightboxProps) {
  const [index, setIndex] = useState(startIndex);

  const prev = useCallback(() => setIndex(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setIndex(i => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, prev, next]);

  if (images.length === 0) return null;
  const img = images[index];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(10,9,26,.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
      }}
    >
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); prev(); }}
          style={navBtn('left')}
          aria-label="Previous"
        >‹</button>
      )}

      <div onClick={e => e.stopPropagation()} style={{ maxWidth: '80vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
        <img
          src={img.src}
          alt={img.alt}
          style={{ maxWidth: '80vw', maxHeight: '72vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ font: '600 14px var(--font-display)', color: '#e6e3f5' }}>{img.alt}</span>
          {images.length > 1 && (
            <span style={{ font: '400 12px var(--font-mono)', color: '#9a96c4' }}>{index + 1} / {images.length}</span>
          )}
        </div>
      </div>

      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); next(); }}
          style={navBtn('right')}
          aria-label="Next"
        >›</button>
      )}

      <button
        onClick={onClose}
        style={{ position: 'absolute', top: '20px', right: '24px', background: 'none', border: 'none', color: '#9a96c4', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}
        aria-label="Close"
      >✕</button>
    </div>
  );
}

function navBtn(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    [side]: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,.08)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: '50%',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#e6e3f5',
    fontSize: '28px',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
  };
}

export function useLightbox() {
  const [state, setState] = useState<{ images: LightboxImage[]; startIndex: number } | null>(null);

  const open = useCallback((images: LightboxImage[], startIndex: number) => {
    setState({ images, startIndex });
  }, []);

  const close = useCallback(() => {
    setState(null);
  }, []);

  return { state, open, close };
}
