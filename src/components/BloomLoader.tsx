'use client';

import React from 'react';

/**
 * BloomLoader — a self-contained "working / generating" animation.
 *
 * A rotating ring of eight petals that morph through a radial star, a circle, a
 * square and a triangle. Drop-in and framework-light: it only needs React and
 * injects its own keyframes once, so you can copy this single file into any
 * React app.
 *
 * Props:
 *   size   number  — pixel diameter (default 48).
 *   color  string  — any CSS color the petal gradient is built from. Defaults to
 *                    the host app's `--accent` variable, falling back to a blue.
 *                    Pass e.g. "var(--brand)", "#e0522f", or "currentColor".
 *   label  string  — accessible status label (default "Loading").
 *
 * Usage:  <BloomLoader size={44} color="var(--accent)" />
 */

const STYLE_ID = 'bloomforge-loader-style';

const BLOOM_CSS = `
.bloomforge{position:relative;display:inline-block;vertical-align:middle;animation:bloomforge-spin 5s linear infinite}
.bloomforge>i{position:absolute;left:50%;top:50%;
  width:calc(var(--bf-s) * .23);height:calc(var(--bf-s) * .23);
  margin:calc(var(--bf-s) * -.115) 0 0 calc(var(--bf-s) * -.115);
  background:linear-gradient(150deg,
    color-mix(in srgb, var(--bf-c) 72%, #fff),
    var(--bf-c) 58%,
    color-mix(in srgb, var(--bf-c) 68%, #000));
  animation:bloomforge-morph 6.4s linear infinite}
.bloomforge>i:nth-child(1){--a:0deg}
.bloomforge>i:nth-child(2){--a:45deg}
.bloomforge>i:nth-child(3){--a:90deg}
.bloomforge>i:nth-child(4){--a:135deg}
.bloomforge>i:nth-child(5){--a:180deg}
.bloomforge>i:nth-child(6){--a:225deg}
.bloomforge>i:nth-child(7){--a:270deg}
.bloomforge>i:nth-child(8){--a:315deg}
@keyframes bloomforge-spin{to{transform:rotate(360deg)}}
@keyframes bloomforge-morph{
  0%     {transform:rotate(var(--a)) translateY(calc(var(--bf-s)*-.36)) rotate(45deg)   scale(1.25);border-radius:0 50% 50% 50%;clip-path:polygon(0% 0%,100% 0%,100% 100%,0% 100%)}
  16.66% {transform:rotate(var(--a)) translateY(calc(var(--bf-s)*-.24)) rotate(225deg)  scale(.56); border-radius:50%;         clip-path:polygon(0% 0%,100% 0%,100% 100%,0% 100%)}
  33.33% {transform:rotate(var(--a)) translateY(calc(var(--bf-s)*-.36)) rotate(405deg)  scale(1.25);border-radius:0 50% 50% 50%;clip-path:polygon(0% 0%,100% 0%,100% 100%,0% 100%)}
  50%    {transform:rotate(var(--a)) translateY(calc(var(--bf-s)*-.24)) rotate(585deg)  scale(.56); border-radius:14%;        clip-path:polygon(0% 0%,100% 0%,100% 100%,0% 100%)}
  66.66% {transform:rotate(var(--a)) translateY(calc(var(--bf-s)*-.36)) rotate(765deg)  scale(1.25);border-radius:0 50% 50% 50%;clip-path:polygon(0% 0%,100% 0%,100% 100%,0% 100%)}
  75%    {transform:rotate(var(--a)) translateY(calc(var(--bf-s)*-.30)) rotate(915deg)  scale(.9);  border-radius:9%;         clip-path:polygon(50% 0%,50% 0%,100% 100%,0% 100%)}
  83.33% {transform:rotate(var(--a)) translateY(calc(var(--bf-s)*-.24)) rotate(945deg)  scale(.68); border-radius:9%;         clip-path:polygon(50% 0%,50% 0%,100% 100%,0% 100%)}
  91.66% {transform:rotate(var(--a)) translateY(calc(var(--bf-s)*-.30)) rotate(975deg)  scale(.9);  border-radius:9%;         clip-path:polygon(50% 0%,50% 0%,100% 100%,0% 100%)}
  100%   {transform:rotate(var(--a)) translateY(calc(var(--bf-s)*-.36)) rotate(1125deg) scale(1.25);border-radius:0 50% 50% 50%;clip-path:polygon(0% 0%,100% 0%,100% 100%,0% 100%)}
}
`;

/** Inject the keyframes once (client-side, deduped by id). SSR-safe. */
function ensureBloomStyle(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = BLOOM_CSS;
  document.head.appendChild(el);
}

// Inject as soon as this module loads on the client, so the first render animates.
ensureBloomStyle();

export interface BloomLoaderProps {
  size?: number;
  color?: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function BloomLoader({
  size = 48,
  color = 'var(--accent, #0067c0)',
  label = 'Loading',
  className,
  style,
}: BloomLoaderProps) {
  // Belt-and-suspenders: also ensure on mount (covers reused chunks / HMR).
  React.useEffect(ensureBloomStyle, []);
  return (
    <span
      className={className ? `bloomforge ${className}` : 'bloomforge'}
      role="status"
      aria-label={label}
      style={{
        width: size,
        height: size,
        ['--bf-s' as string]: `${size}px`,
        ['--bf-c' as string]: color,
        ...style,
      }}
    >
      <i /><i /><i /><i /><i /><i /><i /><i />
    </span>
  );
}

export default BloomLoader;
