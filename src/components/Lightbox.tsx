'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface LightboxImage {
  src: string;
  alt: string;
}

// The on-screen media size. The static pose image, the animation player, and the
// "no animation yet" placeholder all render at this exact box so toggling between
// Static and Animation never changes the layout size. Poses and animation frames
// are both square, so a single square box matches all three.
const MEDIA_BOX = 'min(74vw, 52vh)';

// The pose name caption. Rendered directly under the media in BOTH the static and
// animation views so the label reads the same and sits in the same spot when you
// toggle between them (the animation inherits its pose's name).
const NAME_LABEL_STYLE: React.CSSProperties = { font: '500 13px var(--font-mono)', color: 'rgba(247,244,238,.85)' };

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
  resolveAnimation?: (index: number) => LightboxAnimation | null;
  onGenerateAnimation?: (index: number, prompt: string) => Promise<void>;
  animationPromptFor?: (index: number) => string;
  regenerating?: boolean;
  animGenerating?: boolean;
}

export function Lightbox({ images, startIndex, onClose, onRegenerate, resolveAnimation, onGenerateAnimation, animationPromptFor, regenerating, animGenerating }: LightboxProps) {
  const [index, setIndex] = useState(startIndex);
  const [view, setView] = useState<'static' | 'animation'>('static');

  // Track the rendered width of whichever media element is on screen (static
  // pose image, animation player, or the "no animation yet" placeholder) so the
  // prompt row below can be sized to exactly match the image above it.
  const [mediaWidth, setMediaWidth] = useState<number | null>(null);
  const mediaObserver = useRef<ResizeObserver | null>(null);
  const measureRef = useCallback((el: HTMLElement | null) => {
    mediaObserver.current?.disconnect();
    mediaObserver.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setMediaWidth(w);
    });
    ro.observe(el);
    mediaObserver.current = ro;
    setMediaWidth(el.clientWidth);
  }, []);
  useEffect(() => () => mediaObserver.current?.disconnect(), []);

  const prev = useCallback(() => setIndex(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setIndex(i => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      // Don't hijack keys while typing in the prompt.
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
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
  const canAnimate = !!onGenerateAnimation;
  const showingAnimation = canAnimate && view === 'animation';
  const promptEnabled = showingAnimation ? !!onGenerateAnimation : !!onRegenerate;
  const busy = showingAnimation ? !!animGenerating : !!regenerating;

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
        <button onClick={e => { e.stopPropagation(); prev(); }} style={navBtn('left')} aria-label="Previous">‹</button>
      )}

      <div onClick={e => e.stopPropagation()} style={{ width: 'min(92vw, 720px)', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '4px 2px' }}>
        {images.length > 1 && (
          <span style={{ font: '400 12px var(--font-mono)', color: 'rgba(247,244,238,.6)' }}>{index + 1} / {images.length}</span>
        )}

        {canAnimate && (
          <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'rgba(247,244,238,.08)', border: '1px solid rgba(247,244,238,.14)', borderRadius: '999px' }}>
            <button onClick={() => setView('static')} style={segBtn(!showingAnimation)}>Static pose</button>
            <button onClick={() => setView('animation')} style={segBtn(showingAnimation)}>
              Animation{anim ? ' ●' : ''}
            </button>
          </div>
        )}

        {showingAnimation ? (
          anim ? (
            <AnimationView key={`${anim.clipId}:${anim.updatedAt}`} anim={anim} measureRef={measureRef} label={img.alt} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ font: '600 10px var(--font-body)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(247,244,238,.55)' }}>Animation</span>
              <div ref={measureRef} style={{ position: 'relative', width: MEDIA_BOX, height: MEDIA_BOX, borderRadius: '12px', overflow: 'hidden', border: '1.5px dashed rgba(247,244,238,.28)', background: 'repeating-conic-gradient(rgba(247,244,238,.06) 0% 25%, rgba(247,244,238,.02) 0% 50%) 50% / 28px 28px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={img.alt} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: animGenerating ? 0.3 : 0.5 }} />
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', padding: '12px' }}>
                  <span style={{ background: 'rgba(26,23,20,.66)', color: 'var(--canvas)', padding: '7px 13px', borderRadius: '999px', font: '600 12px var(--font-body)', textAlign: 'center' }}>
                    {animGenerating ? 'Generating…' : 'No animation yet — tweak the prompt & Generate'}
                  </span>
                </div>
              </div>
              <span style={NAME_LABEL_STYLE}>{img.alt}</span>
            </div>
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {canAnimate && (
              <span style={{ font: '600 10px var(--font-body)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(247,244,238,.55)' }}>Static pose</span>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={measureRef}
              src={img.src}
              alt={img.alt}
              style={{ maxWidth: canAnimate ? MEDIA_BOX : '80vw', maxHeight: canAnimate ? '52vh' : (onRegenerate ? '58vh' : '72vh'), objectFit: 'contain', borderRadius: '12px', boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)' }}
            />
            <span style={NAME_LABEL_STYLE}>{img.alt}</span>
          </div>
        )}

        {promptEnabled && (
          <PromptBox
            key={`${showingAnimation ? 'anim' : 'pose'}:${index}`}
            width={mediaWidth}
            defaultValue={showingAnimation ? (animationPromptFor?.(index) ?? '') : ''}
            placeholder={showingAnimation ? 'Describe the animation — pre-filled, edit to taste…' : 'Describe changes for regeneration…'}
            busy={busy}
            buttonLabel={busy ? 'Generating…' : showingAnimation ? (anim ? '↻ Regenerate' : '✨ Generate') : '↻ Regenerate'}
            onSubmit={value => {
              if (showingAnimation) { if (onGenerateAnimation) void onGenerateAnimation(index, value); }
              else if (onRegenerate) { void onRegenerate(index, value); }
            }}
          />
        )}
      </div>

      {images.length > 1 && (
        <button onClick={e => { e.stopPropagation(); next(); }} style={navBtn('right')} aria-label="Next">›</button>
      )}

      <button
        onClick={onClose}
        style={{ position: 'absolute', top: '20px', right: '24px', background: 'none', border: 'none', color: 'rgba(247,244,238,.65)', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}
        aria-label="Close"
      >✕</button>
    </div>
  );
}

function AnimationView({ anim, measureRef, label }: { anim: LightboxAnimation; measureRef?: (el: HTMLElement | null) => void; label: string }) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || anim.frameCount <= 1) return;
    const t = setInterval(() => setFrame(f => (f + 1) % anim.frameCount), Math.max(40, 1000 / anim.fps));
    return () => clearInterval(t);
  }, [playing, anim.frameCount, anim.fps]);

  const url = (i: number) => `/api/animations/${anim.clipId}/frames/${i}?v=${encodeURIComponent(anim.updatedAt)}`;
  const box = MEDIA_BOX;
  const checker = 'repeating-conic-gradient(rgba(247,244,238,.06) 0% 25%, rgba(247,244,238,.02) 0% 50%) 50% / 28px 28px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
      <span style={{ font: '600 10px var(--font-body)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(247,244,238,.55)' }}>Animation</span>
      <div ref={measureRef} style={{ position: 'relative', width: box, height: box, borderRadius: '12px', overflow: 'hidden', background: checker, boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)' }}>
        {Array.from({ length: anim.frameCount }, (_, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={url(i)} alt={`frame ${i + 1}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: i === frame ? 1 : 0 }} />
        ))}
      </div>
      <span style={NAME_LABEL_STYLE}>{label}</span>
      <button
        onClick={() => setPlaying(p => !p)}
        style={{ background: 'rgba(247,244,238,.1)', border: '1px solid rgba(247,244,238,.18)', color: 'var(--canvas)', borderRadius: 'var(--radius-btn)', padding: '7px 16px', font: '600 12px var(--font-body)', cursor: 'pointer' }}
      >
        {playing ? '❚❚ Pause' : '▶ Play'}
      </button>
      {/* Frames — below the animation, above the prompt. Click to scrub. */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 'min(88vw, 640px)' }}>
        {Array.from({ length: anim.frameCount }, (_, i) => (
          <button
            key={i}
            onClick={() => { setPlaying(false); setFrame(i); }}
            title={`Frame ${i + 1}`}
            style={{ width: '58px', height: '58px', padding: '3px', borderRadius: '8px', cursor: 'pointer', background: checker, border: i === frame ? '2px solid var(--accent)' : '1px solid rgba(247,244,238,.18)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url(i)} alt={`frame ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function PromptBox({ defaultValue, placeholder, busy, buttonLabel, onSubmit, width }: {
  defaultValue: string;
  placeholder: string;
  busy: boolean;
  buttonLabel: string;
  onSubmit: (value: string) => void;
  width?: number | null;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div style={{ width: width ? `${width}px` : '100%', maxWidth: width ? 'none' : '640px', display: 'flex', gap: '10px', alignItems: 'stretch' }}>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit(value);
          }
        }}
        rows={2}
        placeholder={placeholder}
        style={{ flex: 1, minWidth: 0, background: 'var(--surface)', border: '1px solid var(--border-field)', borderRadius: 'var(--radius-input)', color: 'var(--ink)', padding: '10px 12px', font: '13px/1.5 var(--font-body)', outline: 'none', resize: 'none' }}
      />
      <button
        onClick={() => onSubmit(value)}
        disabled={busy}
        style={{ flexShrink: 0, background: busy ? 'rgba(247,244,238,.15)' : 'var(--accent)', color: busy ? 'rgba(247,244,238,.6)' : 'var(--canvas)', border: '1px solid transparent', borderRadius: 'var(--radius-btn)', padding: '10px 18px', font: '600 13px var(--font-body)', cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function segBtn(active: boolean): React.CSSProperties {
  return {
    padding: '7px 16px',
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
    font: '600 12px var(--font-body)',
    letterSpacing: '.03em',
    background: active ? 'var(--canvas)' : 'transparent',
    color: active ? 'var(--ink)' : 'rgba(247,244,238,.72)',
  };
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
