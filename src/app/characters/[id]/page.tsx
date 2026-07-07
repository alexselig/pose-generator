'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Character, PoseSet, AnimationClip, getAnimationPrompt } from '@/lib/types';
import { listGroups } from '@/lib/groups';
import { useToast } from '@/components/Toast';
import { Lightbox, useLightbox, LightboxAnimation } from '@/components/Lightbox';

export default function CharacterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useToast();
  const [character, setCharacter] = useState<Character | null>(null);
  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  const [images, setImages] = useState<{ name: string; url: string; isArchive: boolean }[]>([]);
  const [poseSet, setPoseSet] = useState<PoseSet | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Character>>({});
  const [regenerating, setRegenerating] = useState(false);
  const [animGenerating, setAnimGenerating] = useState(false);
  const [animations, setAnimations] = useState<AnimationClip[]>([]);
  const lightbox = useLightbox();

  const reloadImages = () => {
    fetch(`/api/characters/${id}/images`)
      .then(res => res.ok ? res.json() : { images: [] })
      .then(data => setImages(data.images || []))
      .catch(() => setImages([]));
  };

  useEffect(() => {
    fetch(`/api/characters/${id}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => { setCharacter(data); setForm(data); })
      .catch(() => router.push('/characters'));

    reloadImages();

    fetch(`/api/characters/${id}/pose-sets/latest?slim=1`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setPoseSet(data))
      .catch(() => setPoseSet(null));

    fetch('/api/characters')
      .then(res => res.ok ? res.json() : [])
      .then((data: Character[]) => setAllCharacters(data))
      .catch(() => setAllCharacters([]));

    fetch(`/api/characters/${id}/animations`)
      .then(res => res.ok ? res.json() : [])
      .then((data: AnimationClip[]) => setAnimations(data))
      .catch(() => setAnimations([]));
  }, [id, router]);

  const groups = useMemo(() => listGroups(allCharacters), [allCharacters]);

  const currentPoses = useMemo(() => {
    return images.filter(img => !img.isArchive).map(img => {
      const displayName = img.name.replace(/\.png$/, '').replace(/^.*_/, '');
      return { ...img, displayName };
    });
  }, [images]);

  const handleLightboxRegenerate = async (imageIndex: number, prompt: string) => {
    if (!poseSet) return;
    // Match the image filename to a pose in the pose set
    const image = currentPoses[imageIndex];
    if (!image) return;
    const poseName = image.name.replace(/\.png$/, '').replace(/^.*_/, '');
    const pose = poseSet.poses.find(p => p.name === poseName);
    if (!pose) return;

    setRegenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poseSetId: poseSet.id, poseId: pose.id, prompt: prompt || undefined }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.imageData) {
          lightbox.updateImage(imageIndex, `data:image/png;base64,${result.imageData}`);
        }
        // Refresh images from disk
        reloadImages();
        showToast('Pose regenerated');
      }
    } catch {
      showToast('Failed to regenerate');
    } finally {
      setRegenerating(false);
    }
  };

  const poseActionSlug = (imageName: string): string => {
    if (!character) return '';
    const charSlug = character.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const base = imageName.replace(/\.png$/, '');
    return base.startsWith(`${charSlug}_`) ? base.slice(charSlug.length + 1) : base.replace(/^.*?_/, '');
  };

  const handleGenerateAnimation = async (imageIndex: number, animPrompt: string) => {
    const image = currentPoses[imageIndex];
    if (!image || !character) return;
    const action = poseActionSlug(image.name);
    const displayName = action.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    setAnimGenerating(true);
    try {
      let clip = animations.find(a => a.action === action);
      if (!clip) {
        const createRes = await fetch('/api/animations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterId: id, action, displayName }),
        });
        if (!createRes.ok) throw new Error('create failed');
        clip = await createRes.json();
      }
      const genRes = await fetch(`/api/animations/${clip!.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: animPrompt?.trim() || undefined }),
      });
      if (!genRes.ok) {
        const b = await genRes.json().catch(() => ({}));
        throw new Error(b.error || 'generation failed');
      }
      const updated: AnimationClip = await genRes.json();
      setAnimations(prev => [updated, ...prev.filter(c => c.id !== updated.id)]);
      showToast(`${updated.displayName} — ${updated.frameCount} frames`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to generate animation');
    } finally {
      setAnimGenerating(false);
    }
  };

  const animationPromptFor = (imageIndex: number): string => {
    const image = currentPoses[imageIndex];
    return image ? getAnimationPrompt(poseActionSlug(image.name)) : '';
  };

  const resolveAnimation = (imageIndex: number): LightboxAnimation | null => {
    const image = currentPoses[imageIndex];
    if (!image) return null;
    const action = poseActionSlug(image.name);
    const clip = animations.find(a => a.action === action && a.status === 'generated' && a.frameCount > 0);
    if (!clip) return null;
    return { clipId: clip.id, frameCount: clip.frameCount, fps: clip.fps, updatedAt: clip.updatedAt, displayName: clip.displayName };
  };

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

  const handleGroupChange = async (group: string) => {
    const res = await fetch(`/api/characters/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group }),
    });
    if (res.ok) {
      const updated: Character = await res.json();
      setCharacter(updated);
      setForm(prev => ({ ...prev, group: updated.group }));
      setAllCharacters(prev =>
        prev.some(c => c.id === updated.id)
          ? prev.map(c => (c.id === updated.id ? updated : c))
          : [...prev, updated]
      );
      showToast(group ? `Added to “${group}”` : 'Removed from group');
    } else {
      showToast('Failed to update group');
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

  if (!character) return <div style={{ padding: '34px 44px', color: 'var(--muted)' }}>Loading…</div>;

  return (
    <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '34px 44px 56px' }}>
      <div className="pf-row-wrap" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '18px', marginBottom: '30px' }}>
        <div style={{ alignSelf: 'center', maxWidth: '640px' }}>
          <p style={{ margin: 0, color: 'var(--ink-2)', font: '400 15px/1.6 var(--font-body)' }}>{character.description || 'No description yet.'}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          <button onClick={() => setEditing(value => !value)} className="pf-ghost" style={secondaryButton}>{editing ? 'Cancel' : 'Edit'}</button>
          <button onClick={handleDuplicate} className="pf-ghost" style={secondaryButton}>Duplicate</button>
          <Link href={`/export/${id}`} className="pf-filled" style={primaryLink}>
            Export →
          </Link>
        </div>
      </div>

      <div className="pf-stack" style={{ display: 'flex', gap: '36px', alignItems: 'flex-start', marginBottom: '38px' }}>
        <div style={{ flexShrink: 0, width: '300px' }}>
          <div style={{ aspectRatio: '1 / 1', border: '1px solid var(--border-card)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: character.referenceImages?.[0] ? '#F4EFE6' : 'repeating-linear-gradient(135deg, #F1ECE2, #F1ECE2 11px, #EBE4D6 11px, #EBE4D6 22px)' }}>
            {character.referenceImages?.[0] ? (
              <img src={`data:image/png;base64,${character.referenceImages[0]}`} alt={character.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
            ) : (
              <span style={{ font: '500 10px var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: '#B7AE9C' }}>Character Art</span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 13px var(--font-body)', color: 'var(--muted)', marginTop: '16px' }}>
            <span>anchor</span><span style={{ font: '400 13px var(--font-mono)', color: 'var(--ink-2)' }}>bottom_center</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 13px var(--font-body)', color: 'var(--muted)', marginTop: '8px' }}>
            <span>base</span><span style={{ color: 'var(--success)' }}>feet-aligned ✓</span>
          </div>
          <div style={{ height: '1px', background: 'var(--border-soft)', margin: '18px 0' }} />
          <GroupSelector value={character.group || ''} groups={groups} onSelect={handleGroupChange} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <EditField label="Description" value={form.description || ''} onChange={value => setForm(prev => ({ ...prev, description: value }))} multiline />
            <EditField label="Art style" value={form.artStyle || ''} onChange={value => setForm(prev => ({ ...prev, artStyle: value }))} />
            <div className="pf-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <EditField label="Costume / outfit" value={form.costumeDetails || ''} onChange={value => setForm(prev => ({ ...prev, costumeDetails: value }))} multiline />
              <EditField label="Accessories" value={form.accessories || ''} onChange={value => setForm(prev => ({ ...prev, accessories: value }))} multiline />
            </div>
            <div className="pf-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <EditField label="Body proportions" value={form.bodyProportions || ''} onChange={value => setForm(prev => ({ ...prev, bodyProportions: value }))} />
              <EditField label="Personality" value={form.personalityNotes || ''} onChange={value => setForm(prev => ({ ...prev, personalityNotes: value }))} />
            </div>
            <button onClick={handleSave} className="pf-filled" style={{ ...primaryLink, cursor: 'pointer', width: 'fit-content' }}>Save changes</button>
          </div>
        ) : (
          <>
            <div className="pf-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px 40px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
                <AttrRow label="Art style" value={character.artStyle} />
                <AttrRow label="Accessories" value={character.accessories} />
                <AttrRow label="Personality" value={character.personalityNotes} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
                <AttrRow label="Costume / outfit" value={character.costumeDetails} />
                <AttrRow label="Body proportions" value={character.bodyProportions} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-soft)' }}>
              <span style={{ font: '700 10px var(--font-body)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' }}>Palette</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(character.colorPalette || []).map((color, index) => (
                  <span key={`${color}-${index}`} style={{ width: '30px', height: '30px', borderRadius: '7px', background: color, border: '1px solid rgba(0,0,0,.08)' }} />
                ))}
              </div>
            </div>
          </>
        )}
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '14px', marginBottom: '18px' }}>
          <div>
            <h2 style={{ font: '600 26px var(--font-display)', margin: 0, color: 'var(--ink)' }}>All poses</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', font: '400 13px var(--font-body)' }}>Every pose {character.name} can strike — identity preserved across the full set.</p>
          </div>
          <Link href={`/generate/${id}`} className="pf-ghost-accent" style={{ ...ghostAccent, flexShrink: 0 }}>＋ Add poses</Link>
        </div>

        {currentPoses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--border-card)' }}>
            No poses generated yet. <Link href={`/generate/${id}`} style={{ color: 'var(--accent)' }}>Generate poses →</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(122px, 1fr))', gap: '16px' }}>
            {currentPoses.map((image, i) => (
              <div key={image.name} onClick={() => lightbox.open(currentPoses.map(p => ({ src: p.url, alt: p.displayName })), i)} style={{ cursor: 'pointer' }}>
                <div className="pf-posetile" style={{ aspectRatio: '1 / 1', border: '1px solid var(--border-card)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', background: 'var(--surface)', overflow: 'hidden' }}>
                  <img src={image.url} alt={image.displayName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
                <div style={{ padding: '8px 0 0', textAlign: 'center' }}>
                  <span style={{ font: '400 12px var(--font-mono)', color: '#6B6155' }}>{image.displayName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '20px', marginTop: '44px', paddingTop: '20px', borderTop: '1px solid var(--border-soft)' }}>
        <button onClick={handleArchive} className="pf-textaction" style={textAction}>{character.archived ? 'Unarchive' : 'Archive'}</button>
        <button onClick={handleDelete} style={{ ...textAction, color: 'var(--accent)', fontWeight: 600 }}>Delete</button>
      </div>
      {lightbox.state && <Lightbox images={lightbox.state.images} startIndex={lightbox.state.startIndex} onClose={lightbox.close} onRegenerate={poseSet ? handleLightboxRegenerate : undefined} resolveAnimation={resolveAnimation} onGenerateAnimation={handleGenerateAnimation} animationPromptFor={animationPromptFor} regenerating={regenerating} animGenerating={animGenerating} />}
    </div>
  );
}

function AttrRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div style={{ font: '700 10px var(--font-body)', letterSpacing: '.14em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: '7px' }}>{label.toUpperCase()}</div>
      <div style={{ font: '400 13.5px/1.6 var(--font-body)', color: 'var(--ink-2)' }}>{value || '—'}</div>
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
      <label style={{ font: '700 10px var(--font-body)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: '7px', display: 'block' }}>{label}</label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} style={fieldStyle} className="auto-grow" />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} style={fieldStyle} />
      )}
    </div>
  );
}

const NEW_GROUP_VALUE = '__new_group__';

function GroupSelector({ value, groups, onSelect }: { value: string; groups: string[]; onSelect: (group: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  // Always include the current group so it stays selectable even before the
  // full character list (which the group list is derived from) has loaded.
  const options = Array.from(new Set([value, ...groups].filter(Boolean))).sort((a, b) => a.localeCompare(b));

  const handleSelect = (next: string) => {
    if (next === NEW_GROUP_VALUE) {
      setNewName('');
      setCreating(true);
      return;
    }
    onSelect(next);
  };

  const commit = () => {
    const name = newName.trim();
    setCreating(false);
    setNewName('');
    if (name && name !== value) onSelect(name);
  };

  const cancel = () => {
    setCreating(false);
    setNewName('');
  };

  return (
    <div>
      <div style={{ font: '700 10px var(--font-body)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: '7px' }}>Group</div>
      {creating ? (
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') cancel(); }}
            placeholder="New group name"
            style={{ ...fieldStyle, padding: '8px 10px' }}
          />
          <button onClick={commit} style={{ ...secondaryButton, padding: '8px 11px', flexShrink: 0 }} title="Create group">Add</button>
          <button onClick={cancel} style={{ ...secondaryButton, padding: '8px 11px', flexShrink: 0 }} title="Cancel">✕</button>
        </div>
      ) : (
        <select value={value} onChange={e => handleSelect(e.target.value)} style={selectStyle}>
          <option value="">No group</option>
          {options.map(g => <option key={g} value={g}>{g}</option>)}
          <option value={NEW_GROUP_VALUE}>＋ New group…</option>
        </select>
      )}
    </div>
  );
}

const secondaryButton: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--ink-2)',
  border: '1px solid var(--border-field)',
  borderRadius: 'var(--radius-btn)',
  padding: '10px 18px',
  font: '600 13px var(--font-body)',
  cursor: 'pointer',
};

const primaryLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--accent)',
  color: 'var(--canvas)',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius-btn)',
  padding: '10px 20px',
  font: '600 13px var(--font-body)',
  textDecoration: 'none',
};

const textAction: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--muted)',
  font: '500 13px var(--font-body)',
  cursor: 'pointer',
  padding: 0,
};

// Ghost button in oxblood (border + text), used for the "+ Add poses" action.
const ghostAccent: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  color: 'var(--accent)',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius-btn)',
  padding: '10px 18px',
  font: '600 13px var(--font-body)',
  textDecoration: 'none',
  cursor: 'pointer',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-field)',
  borderRadius: 'var(--radius-input)',
  color: 'var(--ink)',
  padding: '10px 14px',
  font: '13.5px/1.5 var(--font-body)',
  outline: 'none',
  resize: 'none',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  background: "var(--surface) url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8AF9C' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>\") no-repeat right 12px center",
  border: '1px solid var(--border-field)',
  borderRadius: 'var(--radius-btn)',
  color: 'var(--ink)',
  padding: '10px 32px 10px 14px',
  font: '13.5px var(--font-body)',
  outline: 'none',
  cursor: 'pointer',
};
