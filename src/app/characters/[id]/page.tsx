'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Character } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { Lightbox, useLightbox } from '@/components/Lightbox';

export default function CharacterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useToast();
  const [character, setCharacter] = useState<Character | null>(null);
  const [images, setImages] = useState<{ name: string; url: string; isArchive: boolean }[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Character>>({});
  const lightbox = useLightbox();

  useEffect(() => {
    fetch(`/api/characters/${id}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => { setCharacter(data); setForm(data); })
      .catch(() => router.push('/characters'));

    fetch(`/api/characters/${id}/images`)
      .then(res => res.ok ? res.json() : { images: [] })
      .then(data => setImages(data.images || []))
      .catch(() => setImages([]));
  }, [id, router]);

  const currentPoses = useMemo(() => {
    return images.filter(img => !img.isArchive).map(img => {
      const displayName = img.name.replace(/\.png$/, '').replace(/^.*_/, '');
      return { ...img, displayName };
    });
  }, [images]);

  const handleSave = async () => {
    const res = await fetch(`/api/characters/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const updated = await res.json();
      setCharacter(updated);
      setEditing(false);
      showToast('Character saved');
    }
  };

  const handleDuplicate = async () => {
    const res = await fetch(`/api/characters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'duplicate' }),
    });
    if (res.ok) {
      const duplicate = await res.json();
      showToast('Character duplicated');
      router.push(`/characters/${duplicate.id}`);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Archive this character?')) return;
    const res = await fetch(`/api/characters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive' }),
    });
    if (res.ok) {
      showToast('Character archived');
      router.push('/characters');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this character permanently?')) return;
    const res = await fetch(`/api/characters/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Character deleted');
      router.push('/characters');
    }
  };

  if (!character) return <div style={{ padding: '30px 34px', color: 'var(--text-dim)' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '30px 34px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', marginBottom: '24px' }}>
        <div style={{ alignSelf: 'center' }}>
          <p style={{ margin: 0, color: '#9a96c4', fontSize: '13.5px' }}>{character.description || 'No description yet.'}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button onClick={() => setEditing(value => !value)} style={secondaryButton}>{editing ? 'Cancel' : 'Edit'}</button>
          <button onClick={handleDuplicate} style={secondaryButton}>Duplicate</button>
          <Link href={`/export/${id}`} style={primaryLink}>
            Export →
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '34px', alignItems: 'flex-start', marginBottom: '38px' }}>
        <div style={{ flexShrink: 0, width: '212px' }}>
          <div style={{ borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px', background: `radial-gradient(150px 95px at 50% 22%, ${hexAlpha(character.colorPalette?.[0] || '#7b5cff', 0.30)}, #14132e 72%)` }}>
            {character.referenceImages?.[0] ? (
              <img src={`data:image/png;base64,${character.referenceImages[0]}`} alt={character.name} style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }} />
            ) : (
              <div style={{ fontSize: '60px' }}>🎭</div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 11px var(--font-mono)', color: '#9a96c4', marginTop: '14px' }}>
            <span>anchor</span><span style={{ color: '#6f8dff' }}>bottom_center</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 11px var(--font-mono)', color: '#9a96c4', marginTop: '6px' }}>
            <span>base</span><span style={{ color: '#3ddc97' }}>feet-aligned ✓</span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <EditField label="Description" value={form.description || ''} onChange={value => setForm(prev => ({ ...prev, description: value }))} multiline />
            <EditField label="Art style" value={form.artStyle || ''} onChange={value => setForm(prev => ({ ...prev, artStyle: value }))} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <EditField label="Costume / outfit" value={form.costumeDetails || ''} onChange={value => setForm(prev => ({ ...prev, costumeDetails: value }))} multiline />
              <EditField label="Accessories" value={form.accessories || ''} onChange={value => setForm(prev => ({ ...prev, accessories: value }))} multiline />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <EditField label="Body proportions" value={form.bodyProportions || ''} onChange={value => setForm(prev => ({ ...prev, bodyProportions: value }))} />
              <EditField label="Personality" value={form.personalityNotes || ''} onChange={value => setForm(prev => ({ ...prev, personalityNotes: value }))} />
            </div>
            <button onClick={handleSave} style={{ ...primaryLink, border: 'none', cursor: 'pointer', width: 'fit-content' }}>Save changes</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 40px' }}>
              <AttrRow label="Description" value={character.description} />
              <AttrRow label="Art style" value={character.artStyle} />
              <AttrRow label="Costume / outfit" value={character.costumeDetails} />
              <AttrRow label="Accessories" value={character.accessories} />
              <AttrRow label="Body proportions" value={character.bodyProportions} />
              <AttrRow label="Personality" value={character.personalityNotes} />
            </div>

            <div style={{ height: '1px', background: '#28244a', margin: '24px 0 18px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ font: '600 10px var(--font-display)', letterSpacing: '.07em', color: '#7d79ad' }}>PALETTE</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(character.colorPalette || []).map((color, index) => (
                  <span key={`${color}-${index}`} style={{ width: '30px', height: '30px', borderRadius: '8px', background: color, border: '1px solid rgba(255,255,255,.12)' }} />
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={handleArchive} style={textAction}>{character.archived ? 'Unarchive' : 'Archive'}</button>
              <button onClick={handleDelete} style={{ ...textAction, color: '#ff7d8a' }}>Delete</button>
            </div>
          </>
        )}
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '14px', marginBottom: '14px' }}>
          <div>
            <h2 style={{ font: '700 18px var(--font-display)', letterSpacing: '-.01em', margin: 0 }}>All poses</h2>
            <p style={{ margin: '3px 0 0', color: '#9a96c4', fontSize: '12.5px' }}>Every pose {character.name} can strike — identity preserved across the full set.</p>
          </div>
          <Link href={`/generate/${id}`} style={{ ...secondaryButton, textDecoration: 'none', flexShrink: 0 }}>＋ Add Poses</Link>
        </div>

        {currentPoses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dimmer)', background: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid var(--border-hairline)' }}>
            No poses generated yet. <Link href={`/generate/${id}`} style={{ color: 'var(--accent-cyan)' }}>Generate poses →</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(122px, 1fr))', gap: '14px' }}>
            {currentPoses.map((image, i) => (
              <div key={image.name} onClick={() => lightbox.open(currentPoses.map(p => ({ src: p.url, alt: p.displayName })), i)} style={{ cursor: 'pointer' }}>
                <div style={{ borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0', background: '#fff' }}>
                  <img src={image.url} alt={image.displayName} style={{ maxWidth: '100%', maxHeight: '92px', objectFit: 'contain' }} />
                </div>
                <div style={{ padding: '8px 0 0', textAlign: 'center' }}>
                  <span style={{ font: '600 12px var(--font-display)', color: '#e6e3f5' }}>{image.displayName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {lightbox.state && <Lightbox images={lightbox.state.images} startIndex={lightbox.state.startIndex} onClose={lightbox.close} />}
    </div>
  );
}

function AttrRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div style={{ font: '600 10px var(--font-display)', letterSpacing: '.07em', color: '#7d79ad', marginBottom: '4px' }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: '13.5px', color: '#e6e3f5', lineHeight: 1.45 }}>{value || '—'}</div>
    </div>
  );
}

function hexAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function lightenHex(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amt);
  const g = Math.min(255, ((n >> 8) & 255) + amt);
  const b = Math.min(255, (n & 255) + amt);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function darkenHex(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((n >> 16) & 255) - amt);
  const g = Math.max(0, ((n >> 8) & 255) - amt);
  const b = Math.max(0, (n & 255) - amt);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function EditField({ label, value, onChange, multiline }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return (
    <div>
      <label style={{ font: '600 10px var(--font-display)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-dimmer)', marginBottom: '6px', display: 'block' }}>{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} style={fieldStyle} className="auto-grow" />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} style={fieldStyle} />
      )}
    </div>
  );
}

const secondaryButton: React.CSSProperties = {
  background: 'var(--bg-raised)',
  color: 'var(--text-bright)',
  border: '1px solid #353160',
  borderRadius: 'var(--radius-btn)',
  padding: '9px 16px',
  font: '600 12px var(--font-display)',
  cursor: 'pointer',
};

const primaryLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--gradient-brand)',
  color: '#fff',
  borderRadius: 'var(--radius-btn)',
  padding: '9px 16px',
  font: '700 12px var(--font-display)',
  textDecoration: 'none',
  boxShadow: 'var(--shadow-btn-glow)',
};

const textAction: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-dim)',
  font: '500 12px var(--font-display)',
  cursor: 'pointer',
  padding: 0,
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
  borderRadius: 'var(--radius-input)',
  color: 'var(--text-primary)',
  padding: '10px 12px',
  font: '13px/1.5 var(--font-body)',
  outline: 'none',
  resize: 'none',
};
