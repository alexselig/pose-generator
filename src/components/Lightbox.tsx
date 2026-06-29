'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface LightboxImage {
  src: string;
  alt: string;
}

interface LightboxProps {
  images: LightboxImage[];
  startIndex: number;
  onClose: () => void;
  onRegenerate?: (index: number, prompt: string) => Promise<void>;
  regenerating?: boolean;
}

export function Lightbox({ images, startIndex, onClose, onRegenerate, regenerating }: LightboxProps) {
  const [index, setIndex] = useState(startIndex);
  const [prompt, setPrompt] = useState('');
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const prev = useCallback(() => { setIndex(i => (i - 1 + images.length) % images.length); setPrompt(''); }, [images.length]);
  const next = useCallback(() => { setIndex(i => (i + 1) % images.length); setPrompt(''); }, [images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture arrow keys when typing in the prompt
      if (e.target === promptRef.current) return;
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

      <div onClick={e => e.stopPropagation()} style={{ maxWidth: '80vw', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
        <img
          src={img.src}
          alt={img.alt}
          style={{ maxWidth: '80vw', maxHeight: onRegenerate ? '58vh' : '72vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ font: '600 14px var(--font-display)', color: '#e6e3f5' }}>{img.alt}</span>
          {images.length > 1 && (
            <span style={{ font: '400 12px var(--font-mono)', color: '#9a96c4' }}>{index + 1} / {images.length}</span>
          )}
        </div>

        {onRegenerate && (
          <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void onRegenerate(index, prompt);
                }
              }}
              rows={2}
              placeholder="Describe changes for regeneration…"
              style={{
                width: '100%',
                background: 'rgba(22,21,52,.9)',
                border: '1px solid #312d57',
                borderRadius: '10px',
                color: '#f0eefb',
                padding: '10px 12px',
                font: '13px/1.5 system-ui',
                outline: 'none',
                resize: 'none',
              }}
            />
            <button
              onClick={() => void onRegenerate(index, prompt)}
              disabled={regenerating}
              style={{
                alignSelf: 'flex-end',
                background: regenerating ? '#252247' : 'var(--gradient-brand)',
                color: regenerating ? '#9a96c4' : '#fff',
                border: 'none',
                borderRadius: 'var(--radius-btn)',
                padding: '9px 18px',
                font: '600 13px var(--font-display)',
                cursor: regenerating ? 'wait' : 'pointer',
                boxShadow: regenerating ? 'none' : '0 8px 20px -10px rgba(91,108,255,.9)',
              }}
            >
              {regenerating ? 'Generating…' : '↻ Regenerate'}
            </button>
          </div>
        )}
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

  const updateImage = useCallback((index: number, newSrc: string) => {
    setState(prev => {
      if (!prev) return prev;
      const updated = [...prev.images];
      updated[index] = { ...updated[index], src: newSrc };
      return { ...prev, images: updated };
    });
  }, []);

  return { state, open, close, updateImage };
}
