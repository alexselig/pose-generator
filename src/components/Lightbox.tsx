'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface LightboxImage {
  src: string;
  alt: string;
}

export interface LightboxAnimation {
  clipId: string;
  frameCount: number;
  fps: number;
  updatedAt: string;
  displayName: string;
}

interface LightboxProps {
  images: LightboxImage[];
  startIndex: number;
  onClose: () => void;
  onRegenerate?: (index: number, prompt: string) => Promise<void>;
  onAnimate?: (index: number) => void;
  resolveAnimation?: (index: number) => LightboxAnimation | null;
  regenerating?: boolean;
}

export function Lightbox({ images, startIndex, onClose, onRegenerate, onAnimate, resolveAnimation, regenerating }: LightboxProps) {
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
  const anim = resolveAnimation?.(index) ?? null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--overlay)',
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
        {images.length > 1 && (
          <span style={{ font: '400 12px var(--font-mono)', color: 'rgba(247,244,238,.6)' }}>{index + 1} / {images.length}</span>
        )}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '86vw' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {(anim || onAnimate) && (
              <span style={{ font: '600 10px var(--font-body)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(247,244,238,.55)' }}>Static pose</span>
            )}
            <img
              src={img.src}
              alt={img.alt}
              style={{ maxWidth: (anim || onAnimate) ? 'min(40vw, 56vh)' : '80vw', maxHeight: onRegenerate ? '56vh' : '72vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)' }}
            />
            <span style={{ font: '500 13px var(--font-mono)', color: 'rgba(247,244,238,.85)' }}>{img.alt}</span>
          </div>

          {anim ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ font: '600 10px var(--font-body)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(247,244,238,.55)' }}>Animation · {anim.displayName}</span>
              <AnimationPlayer key={`${anim.clipId}:${anim.updatedAt}`} anim={anim} side={onRegenerate ? '56vh' : '72vh'} />
            </div>
          ) : onAnimate ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ font: '600 10px var(--font-body)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(247,244,238,.55)' }}>Animation</span>
              <button
                onClick={() => onAnimate(index)}
                className="pf-addanim"
                title="Generate an animation from this pose"
                style={{
                  width: `min(40vw, ${onRegenerate ? '56vh' : '72vh'})`,
                  height: `min(40vw, ${onRegenerate ? '56vh' : '72vh'})`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  background: 'rgba(247,244,238,.04)',
                  border: '1.5px dashed rgba(247,244,238,.28)',
                  borderRadius: '12px',
                  color: 'rgba(247,244,238,.85)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '46px', lineHeight: 1, fontWeight: 200 }}>＋</span>
                <span style={{ font: '600 12px var(--font-body)', letterSpacing: '.14em', textTransform: 'uppercase' }}>Animation</span>
              </button>
            </div>
          ) : null}
        </div>

        {onRegenerate && (
          <div style={{ width: '100%', maxWidth: '520px', display: 'flex', gap: '10px', alignItems: 'stretch' }}>
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
                flex: 1,
                minWidth: 0,
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
            <button
              onClick={() => void onRegenerate(index, prompt)}
              disabled={regenerating}
              style={{
                flexShrink: 0,
                background: regenerating ? 'rgba(247,244,238,.15)' : 'var(--accent)',
                color: regenerating ? 'rgba(247,244,238,.6)' : 'var(--canvas)',
                border: '1px solid transparent',
                borderRadius: 'var(--radius-btn)',
                padding: '10px 18px',
                font: '600 13px var(--font-body)',
                cursor: regenerating ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
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
        style={{ position: 'absolute', top: '20px', right: '24px', background: 'none', border: 'none', color: 'rgba(247,244,238,.65)', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}
        aria-label="Close"
      >✕</button>
    </div>
  );
}

function AnimationPlayer({ anim, side }: { anim: LightboxAnimation; side: string }) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || anim.frameCount <= 1) return;
    const t = setInterval(() => setFrame(f => (f + 1) % anim.frameCount), Math.max(40, 1000 / anim.fps));
    return () => clearInterval(t);
  }, [playing, anim.frameCount, anim.fps]);

  const box = `min(40vw, ${side})`;
  return (
    <>
      <div
        style={{
          position: 'relative',
          width: box,
          height: box,
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'repeating-conic-gradient(rgba(247,244,238,.06) 0% 25%, rgba(247,244,238,.02) 0% 50%) 50% / 28px 28px',
          boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)',
        }}
      >
        {Array.from({ length: anim.frameCount }, (_, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={`/api/animations/${anim.clipId}/frames/${i}?v=${encodeURIComponent(anim.updatedAt)}`}
            alt={`frame ${i + 1}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: i === frame ? 1 : 0 }}
          />
        ))}
      </div>
      <button
        onClick={() => setPlaying(p => !p)}
        style={{
          background: 'rgba(247,244,238,.1)',
          border: '1px solid rgba(247,244,238,.18)',
          color: 'var(--canvas)',
          borderRadius: 'var(--radius-btn)',
          padding: '7px 16px',
          font: '600 12px var(--font-body)',
          cursor: 'pointer',
        }}
      >
        {playing ? '❚❚ Pause' : '▶ Play'}
      </button>
    </>
  );
}

function navBtn(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    [side]: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(247,244,238,.1)',
    border: '1px solid rgba(247,244,238,.18)',
    borderRadius: '50%',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--canvas)',
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
