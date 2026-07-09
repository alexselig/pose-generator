'use client';

import { BloomLoader } from './BloomLoader';

// Standard full-page "loading" state — a centered BloomLoader so every route
// shares the same loading animation.
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '90px 34px', color: 'var(--muted)' }}>
      <BloomLoader size={40} />
      <span style={{ font: '500 13px var(--font-body)' }}>{label}</span>
    </div>
  );
}

export default PageLoader;
