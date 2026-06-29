'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GAME_PRESETS } from '@/lib/types';
import { Lightbox, useLightbox } from '@/components/Lightbox';

type WizStep = 1 | 2 | 3 | 4;
type RefMode = 'none' | 'uploaded' | 'generated';

interface Draft {
  name: string;
  description: string;
  artStyle: string;
  colorPalette: string[];
  costumeDetails: string;
  accessories: string;
  bodyProportions: string;
  personalityNotes: string;
}

export default function NewCharacterWizard() {
  const router = useRouter();
  const [step, setStep] = useState<WizStep>(1);
  const [refMode, setRefMode] = useState<RefMode>('none');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [genDone, setGenDone] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [designRefBase64, setDesignRefBase64] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [customizing, setCustomizing] = useState(false);
  const [customPoses, setCustomPoses] = useState<{id:string;name:string;displayName:string;useCase:string;status:'empty'|'generated'|'approved';prompt:string}[]>([]);
  const [newPoseName, setNewPoseName] = useState('');
  const [poses, setPoses] = useState<{id:string;name:string;displayName:string;useCase:string;status:'empty'|'generated'|'approved';prompt:string}[]>([]);
  const [generatingIdx, setGeneratingIdx] = useState(-1);
  const [poseImages, setPoseImages] = useState<Record<string, string>>({});
  const [addingColor, setAddingColor] = useState(false);
  const [newColorValue, setNewColorValue] = useState('#7b5cff');
  const [editingColorIdx, setEditingColorIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({
    name: '', description: '', artStyle: '', colorPalette: [],
    costumeDetails: '', accessories: '', bodyProportions: '', personalityNotes: '',
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const designRefInputRef = useRef<HTMLInputElement>(null);
  const lightbox = useLightbox();

  const canAnalyze = draft.name.trim() && (refMode === 'uploaded' || (refMode === 'generated' && genDone));

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageBase64((reader.result as string).split(',')[1]);
      setRefMode('uploaded');
    };
    reader.readAsDataURL(file);
  };

  const handleDesignRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setDesignRefBase64(prev => [...prev, (reader.result as string).split(',')[1]]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleGenerateCharacter = async () => {
    if (!genPrompt.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/characters/generate-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: genPrompt, name: draft.name || 'character' }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Failed to generate character');
        return;
      }
      const result = await res.json();
      if (result.imageBase64) {
        setImageBase64(result.imageBase64);
        setGenDone(true);
        setImageReady(false);
      } else {
        setError('No image was returned from generation');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleAnalyze = async () => {
    if (!canAnalyze) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/characters/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, name: draft.name }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Analysis failed');
        return;
      }
      const analysis = await res.json();
      setDraft(prev => ({
        ...prev,
        description: analysis.description || prev.description,
        artStyle: analysis.artStyle || prev.artStyle,
        colorPalette: analysis.colorPalette || prev.colorPalette,
        costumeDetails: analysis.costumeDetails || prev.costumeDetails,
        accessories: analysis.accessories || prev.accessories,
        bodyProportions: analysis.bodyProportions || prev.bodyProportions,
        personalityNotes: analysis.personalityNotes || prev.personalityNotes,
      }));
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = GAME_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setPoses(preset.poses.map((p, i) => ({
        id: `pose-${i}`,
        name: p.name,
        displayName: p.displayName,
        useCase: p.useCase,
        status: 'empty',
        prompt: '',
      })));
    }
  };

  const handleGeneratePoses = async () => {
    setStep(4);
    setError(null);
    // Create the character first
    const charRes = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, referenceImages: imageBase64 ? [imageBase64] : [] }),
    });
    if (!charRes.ok) {
      const err = await charRes.json().catch(() => ({ error: 'Failed to create character' }));
      setError(err.error || 'Failed to create character');
      return;
    }
    const character = await charRes.json();
    sessionStorage.setItem('pf_new_char_id', character.id);

    // Create pose set — use customPoses if customizing, otherwise use preset
    const generateBody = customizing
      ? {
          characterId: character.id,
          customPoses: customPoses.map(p => ({
            name: p.name,
            displayName: p.displayName,
            description: p.displayName,
            useCase: p.useCase,
          })),
        }
      : { characterId: character.id, presetId: selectedPreset };

    const setRes = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateBody),
    });
    if (!setRes.ok) {
      const err = await setRes.json().catch(() => ({ error: 'Failed to create pose set' }));
      setError(err.error || 'Failed to create pose set');
      return;
    }
    const poseSet = await setRes.json();
    sessionStorage.setItem('pf_new_poseset_id', poseSet.id);
    setPoses(prev => prev.map((p, i) => ({
      ...p,
      id: poseSet.poses[i]?.id || p.id,
    })));

    // Generate each pose sequentially
    for (let i = 0; i < poseSet.poses.length; i++) {
      setGeneratingIdx(i);
      try {
        const genRes = await fetch('/api/generate', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poseSetId: poseSet.id, poseId: poseSet.poses[i].id }),
        });
        if (genRes.ok) {
          const result = await genRes.json();
          const poseName = poseSet.poses[i].name;
          setPoses(prev => prev.map((p, j) => j === i ? { ...p, status: 'generated' } : p));
          if (result.imageData) {
            setPoseImages(prev => ({ ...prev, [poseName]: result.imageData }));
          }
        }
      } catch (err) {
        console.error(`Failed to generate pose ${i}:`, err);
      }
    }
    setGeneratingIdx(-1);
  };

  const handleRedoPose = async (poseIndex: number) => {
    const poseSetId = sessionStorage.getItem('pf_new_poseset_id');
    const pose = poses[poseIndex];
    if (!poseSetId || !pose?.id) return;

    setGeneratingIdx(poseIndex);
    setError(null);
    try {
      const genRes = await fetch('/api/generate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poseSetId,
          poseId: pose.id,
          prompt: pose.prompt,
        }),
      });
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({ error: 'Failed to regenerate pose' }));
        setError(err.error || 'Failed to regenerate pose');
        return;
      }

      const result = await genRes.json();
      setPoses(prev => prev.map((p, i) => i === poseIndex ? { ...p, status: 'generated' } : p));
      if (result.imageData) {
        setPoseImages(prev => ({ ...prev, [pose.name]: result.imageData }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate pose');
    } finally {
      setGeneratingIdx(-1);
    }
  };

  const [lbRegenerating, setLbRegenerating] = useState(false);
  const handleLightboxRegenerate = async (imageIndex: number, prompt: string) => {
    const poseSetId = sessionStorage.getItem('pf_new_poseset_id');
    // Map lightbox index (only poses with images) back to poses array
    const withImages = poses.map((p, i) => ({ p, i })).filter(x => poseImages[x.p.name]);
    const entry = withImages[imageIndex];
    if (!entry || !poseSetId) return;
    const pose = entry.p;
    setLbRegenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poseSetId, poseId: pose.id, prompt: prompt || undefined }),
      });
      if (res.ok) {
        const result = await res.json();
        setPoses(prev => prev.map((p, i) => i === entry.i ? { ...p, status: 'generated' } : p));
        if (result.imageData) {
          setPoseImages(prev => ({ ...prev, [pose.name]: result.imageData }));
          lightbox.updateImage(imageIndex, `data:image/png;base64,${result.imageData}`);
        }
      }
    } finally {
      setLbRegenerating(false);
    }
  };

  const handleDone = async () => {
    const charId = sessionStorage.getItem('pf_new_char_id');
    const poseSetId = sessionStorage.getItem('pf_new_poseset_id');
    if (poseSetId) {
      await fetch(`/api/pose-sets/${poseSetId}/finalize`, { method: 'POST' });
    }
    router.push(charId ? `/characters/${charId}` : '/characters');
  };

  const approvedCount = poses.filter(p => p.status === 'approved').length;

  const stepLabels = ['Reference', 'Attributes', 'Poses', 'Review'];

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '26px 34px 60px' }}>
      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '26px' }}>
        {stepLabels.map((label, i) => {
          const stepNum = (i + 1) as WizStep;
          const isCompleted = step > stepNum;
          const isActive = step === stepNum;
          return (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                onClick={() => { if (isCompleted) setStep(stepNum); }}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  font: "600 12px var(--font-display)",
                  whiteSpace: 'nowrap' as const,
                  cursor: isCompleted ? 'pointer' : 'default',
                  background: isActive ? '#5b4bff' : isCompleted ? '#16321f' : '#1d1b38',
                  color: isActive ? '#fff' : isCompleted ? '#45b27d' : '#6a6699',
                  border: `1px solid ${isActive ? 'transparent' : isCompleted ? '#2c5a3c' : '#2e2a54'}`,
                }}
              >
                {i + 1}. {label}
              </span>
              {i < 3 && <span style={{ color: '#4a4670', fontSize: '13px', margin: '0 -2px' }}>→</span>}
            </span>
          );
        })}
      </div>

      {/* Step 1: Reference */}
      {step === 1 && (
        <div style={{ maxWidth: '840px' }}>
          <h2 style={{ font: "700 23px var(--font-display)", letterSpacing: '-.01em', margin: '0 0 5px' }}>Provide a reference</h2>
          <p style={{ margin: '0 0 26px', color: 'var(--text-dim)', fontSize: '13px' }}>Upload an existing character or generate one from a description.</p>

          <label style={{ font: "600 11px var(--font-display)", letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px', display: 'block' }}>Character name</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '26px' }}>
            <input
              value={draft.name}
              onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Rowan Vale"
              style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--text-primary)', padding: '11px 13px', font: '14px var(--font-body)', outline: 'none' }}
            />
            <button
              onClick={() => {
                const firsts = ['Rowan','Kai','Lyra','Ash','Sage','Zephyr','Ember','Wren','Orion','Ivy','Finn','Luna','Jasper','Cleo','Atlas','Nova','Reed','Hazel','Milo','Aria','Soren','Piper','Callum','Dahlia','Quinn','Felix','Briar','Theo','Juniper','Sol'];
                const lasts = ['Vale','Starling','Ashford','Thornwood','Brightwater','Foxglove','Ironheart','Willowmere','Stormcrest','Dawnfield','Ravenscroft','Clearwater','Oakridge','Frosthollow','Silvervane','Windgate','Mossgrave','Hawkridge','Stonecrest','Duskwood'];
                const first = firsts[Math.floor(Math.random() * firsts.length)];
                const last = lasts[Math.floor(Math.random() * lasts.length)];
                setDraft(prev => ({ ...prev, name: `${first} ${last}` }));
              }}
              style={{ background: 'var(--bg-raised)', color: 'var(--text-dim)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-btn)', padding: '9px 14px', font: "600 11px var(--font-display)", cursor: 'pointer', whiteSpace: 'nowrap' }}
            >Suggest name</button>
          </div>

          <label style={{ font: "600 11px var(--font-display)", letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px', display: 'block' }}>Character reference</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
            {/* Upload option */}
            <button
              onClick={() => { setGenOpen(false); fileRef.current?.click(); }}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDragEnter={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (!file || !file.type.startsWith('image/')) return;
                const reader = new FileReader();
                reader.onload = () => {
                  setImageBase64((reader.result as string).split(',')[1]);
                  setRefMode('uploaded');
                };
                reader.readAsDataURL(file);
              }}
              style={{
                background: refMode === 'uploaded' ? 'rgba(61,220,151,.08)' : 'var(--bg-panel)',
                border: refMode === 'uploaded' ? '1.5px solid rgba(61,220,151,.4)' : '1.5px dashed #3c3770',
                borderRadius: '14px',
                padding: '28px 18px',
                cursor: 'pointer',
                textAlign: 'center',
                color: 'var(--text-primary)',
              }}
            >
              {refMode === 'uploaded' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  {imageBase64 && <img src={`data:image/png;base64,${imageBase64}`} style={{ maxHeight: '250px', minWidth: '50%', borderRadius: '8px', objectFit: 'contain' }} alt="" />}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ font: "600 13px var(--font-display)", color: 'var(--text-bright)' }}>Reference uploaded ✓</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '3px' }}>Click to replace</div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>↑</div>
                  <div style={{ font: "600 13px var(--font-display)", color: 'var(--text-bright)' }}>Upload character reference</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dimmer)', marginTop: '4px' }}>PNG / JPG · drag & drop</div>
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} hidden />

            {/* Generate option */}
            <button
              onClick={() => { setGenOpen(!genOpen); if (!genOpen) setRefMode('generated'); }}
              style={{
                background: refMode === 'generated' ? 'rgba(123,92,255,.08)' : 'var(--bg-panel)',
                border: refMode === 'generated' ? '1.5px solid rgba(123,92,255,.4)' : '1.5px dashed #3c3770',
                borderRadius: '14px',
                padding: '28px 18px',
                cursor: 'pointer',
                textAlign: 'center',
                color: 'var(--text-primary)',
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>✨</div>
              <div style={{ font: "600 13px var(--font-display)", color: 'var(--text-bright)' }}>Generate Character</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dimmer)', marginTop: '4px' }}>Describe & generate a base</div>
            </button>
          </div>

          {/* Generate panel */}
          {genOpen && (
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-hairline)', borderRadius: '16px', padding: '22px', marginBottom: '8px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px', minHeight: '340px' }}>
              {/* Left: Preview area */}
              <div style={{ borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'radial-gradient(ellipse at 50% 60%, rgba(123,92,255,.12), transparent 70%), var(--bg-app)', minHeight: '300px' }}>
                {generating ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '32px', height: '32px', border: '3px solid var(--accent-purple)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'pf-spin .8s linear infinite', margin: '0 auto 12px' }} />
                    <div style={{ color: 'var(--text-dimmer)', fontSize: '12px' }}>Generating…</div>
                  </div>
                ) : genDone && imageBase64 ? (
                  <>
                    {!imageReady && (
                      <div style={{ position: 'absolute', textAlign: 'center' }}>
                        <div style={{ width: '32px', height: '32px', border: '3px solid var(--accent-purple)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'pf-spin .8s linear infinite', margin: '0 auto 12px' }} />
                        <div style={{ color: 'var(--text-dimmer)', fontSize: '12px' }}>Loading image…</div>
                      </div>
                    )}
                    <img 
                      src={`data:image/png;base64,${imageBase64}`} 
                      onLoad={() => setImageReady(true)}
                      style={{ maxHeight: '260px', maxWidth: '100%', borderRadius: '8px', objectFit: 'contain', opacity: imageReady ? 1 : 0, transition: 'opacity 0.3s ease' }} 
                      alt="" 
                    />
                  </>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-dimmer)', fontSize: '12px', padding: '20px 10px', lineHeight: 1.6 }}>
                    <div style={{ fontSize: '28px', marginBottom: '10px' }}>✨</div>
                    Your character<br />will appear here
                  </div>
                )}
              </div>

              {/* Right: Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Design reference images (optional) */}
                <div>
                  <label style={{ font: "600 11px var(--font-display)", letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '8px', display: 'block' }}>
                    Design reference image(s) · Optional
                  </label>
                  <button
                    onClick={() => designRefInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                    onDragEnter={e => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      const files = e.dataTransfer.files;
                      if (!files || files.length === 0) return;
                      Array.from(files).forEach(file => {
                        if (!file.type.startsWith('image/')) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          setDesignRefBase64(prev => [...prev, (reader.result as string).split(',')[1]]);
                        };
                        reader.readAsDataURL(file);
                      });
                    }}
                    style={{
                      width: '100%',
                      background: designRefBase64.length > 0 ? 'rgba(61,220,151,.05)' : 'transparent',
                      border: designRefBase64.length > 0 ? '1.5px solid rgba(61,220,151,.3)' : '1.5px dashed #3c3770',
                      borderRadius: '12px',
                      padding: '18px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {designRefBase64.length > 0 ? (
                      <div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
                          {designRefBase64.map((img, i) => (
                            <img key={i} src={`data:image/png;base64,${img}`} style={{ height: '80px', borderRadius: '8px', objectFit: 'cover' }} alt="" />
                          ))}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--success)' }}>Reference added ✓</div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: '16px', marginBottom: '4px' }}>⬇</div>
                        <div style={{ font: "600 12px var(--font-display)", color: 'var(--text-bright)' }}>Drop design reference image(s)</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dimmer)', marginTop: '3px' }}>Guides the generated look</div>
                      </>
                    )}
                  </button>
                  <input ref={designRefInputRef} type="file" accept="image/*" multiple onChange={handleDesignRefUpload} hidden />
                </div>

                {/* Describe your character */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ font: "600 11px var(--font-display)", letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '8px', display: 'block' }}>
                    Describe your character
                  </label>
                  <textarea
                    value={genPrompt}
                    onChange={e => setGenPrompt(e.target.value)}
                    rows={4}
                    placeholder="e.g. A slender urban adventurer in a worn brown trench coat, expressive comic-book style…"
                    style={{ width: '100%', flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--text-primary)', padding: '12px 14px', font: '13px/1.5 var(--font-body)', outline: 'none', resize: 'none' }}
                  />
                </div>

                {/* Generate button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleGenerateCharacter}
                    disabled={generating || !genPrompt.trim()}
                    style={{ background: 'var(--gradient-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-btn)', padding: '12px 24px', font: "700 13px var(--font-display)", cursor: generating ? 'wait' : 'pointer', boxShadow: 'var(--shadow-btn-glow)', opacity: generating || !genPrompt.trim() ? 0.5 : 1 }}
                  >
                    {generating ? '⏳ Generating…' : genDone ? '✨ Regenerate' : '✨ Generate'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div style={{ background: 'rgba(255,125,138,.1)', border: '1px solid rgba(255,125,138,.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '8px', color: 'var(--danger)', fontSize: '13px' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '24px' }}>
            <button onClick={() => router.push('/characters')} style={{ background: 'var(--bg-raised)', color: '#e8e8ec', border: '1px solid #353160', borderRadius: 'var(--radius-btn)', padding: '12px 18px', font: "600 13px var(--font-display)", cursor: 'pointer' }}>
              Cancel
            </button>
            <div style={{ flex: 1 }} />
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze || analyzing}
              style={{
                background: canAnalyze && !analyzing ? 'var(--gradient-brand)' : 'var(--bg-raised)',
                color: canAnalyze && !analyzing ? '#fff' : 'var(--text-dimmer)',
                border: 'none',
                borderRadius: 'var(--radius-btn)',
                padding: '12px 22px',
                font: "700 13px var(--font-display)",
                cursor: canAnalyze && !analyzing ? 'pointer' : 'not-allowed',
                boxShadow: canAnalyze && !analyzing ? 'var(--shadow-btn-glow)' : 'none',
              }}
            >
              {analyzing ? 'Analyzing…' : 'Analyze & Continue →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Attributes */}
      {step === 2 && (
        <div>
          <h2 style={{ font: "700 23px var(--font-display)", letterSpacing: '-.01em', margin: '0 0 5px' }}>Review attributes</h2>
          <p style={{ margin: '0 0 26px', color: 'var(--text-dim)', fontSize: '13px' }}>AI-analyzed fields — edit any to refine.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '282px 1fr', gap: '26px', alignItems: 'start' }}>
            {/* Reference card */}
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-hairline)', borderRadius: '16px', padding: '16px', position: 'sticky', top: 0 }}>
              <div style={{ font: "600 11px var(--font-display)", letterSpacing: '.08em', color: 'var(--text-dim)', marginBottom: '12px' }}>REFERENCE</div>
              <div style={{ borderRadius: '12px', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
                {imageBase64 ? (
                  <img src={`data:image/png;base64,${imageBase64}`} style={{ width: '100%', objectFit: 'contain', borderRadius: '8px' }} alt="" />
                ) : (
                  <div style={{ fontSize: '60px', padding: '20px', background: 'rgba(123,92,255,.06)' }}>🎭</div>
                )}
              </div>
              <div style={{ font: "600 16px var(--font-display)", marginTop: '13px' }}>{draft.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dimmer)', marginTop: '3px' }}>Auto-analyzed · edit any field</div>
            </div>

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <WizField label="Description" value={draft.description} onChange={v => setDraft(p => ({ ...p, description: v }))} multiline />
              <WizField label="Art style" value={draft.artStyle} onChange={v => setDraft(p => ({ ...p, artStyle: v }))} />
               <div>
                <label style={{ font: "600 11px var(--font-display)", letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px', display: 'block' }}>Color palette</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {draft.colorPalette.map((c, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="color"
                        value={c}
                        onClick={() => setEditingColorIdx(i)}
                        onChange={e => {
                          const newPalette = [...draft.colorPalette];
                          newPalette[i] = e.target.value;
                          setDraft(p => ({ ...p, colorPalette: newPalette }));
                        }}
                        style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid rgba(255,255,255,.12)', cursor: 'pointer' }}
                      />
                      {editingColorIdx === i && (
                        <button
                          onClick={() => {
                            setDraft(p => ({ ...p, colorPalette: p.colorPalette.filter((_, j) => j !== i) }));
                            setEditingColorIdx(null);
                          }}
                          style={{ width: '30px', background: 'none', border: 'none', color: '#ff7d8a', cursor: 'pointer', font: '500 9px var(--font-display)', padding: '2px 0', lineHeight: 1 }}
                        >
                          delete
                        </button>
                      )}
                    </div>
                  ))}
                  {!addingColor ? (
                    <button
                      onClick={() => { setAddingColor(true); setEditingColorIdx(null); }}
                      style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1.5px dashed #3c3770', background: 'transparent', color: '#b9b3e6', cursor: 'pointer', fontSize: '15px' }}
                    >
                      +
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="color"
                        value={newColorValue}
                        onChange={e => {
                          const val = e.target.value;
                          setNewColorValue(val);
                          setDraft(p => ({ ...p, colorPalette: [...p.colorPalette, val] }));
                          setAddingColor(false);
                          setNewColorValue('#7b5cff');
                        }}
                        style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid rgba(255,255,255,.12)', cursor: 'pointer' }}
                      />
                      <button
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setAddingColor(false);
                          setNewColorValue('#7b5cff');
                        }}
                        style={{ width: '30px', background: 'none', border: 'none', color: '#9a96c4', cursor: 'pointer', font: '500 9px var(--font-display)', padding: '2px 0', lineHeight: 1 }}
                      >
                        cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'stretch' }}>
                <WizField label="Costume" value={draft.costumeDetails} onChange={v => setDraft(p => ({ ...p, costumeDetails: v }))} multiline />
                <WizField label="Accessories" value={draft.accessories} onChange={v => setDraft(p => ({ ...p, accessories: v }))} multiline />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'stretch' }}>
                <WizField label="Body proportions" value={draft.bodyProportions} onChange={v => setDraft(p => ({ ...p, bodyProportions: v }))} />
                <WizField label="Personality" value={draft.personalityNotes} onChange={v => setDraft(p => ({ ...p, personalityNotes: v }))} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '26px' }}>
            <button onClick={() => setStep(1)} style={{ background: 'var(--bg-raised)', color: '#e8e8ec', border: '1px solid #353160', borderRadius: 'var(--radius-btn)', padding: '12px 18px', font: "600 13px var(--font-display)", cursor: 'pointer' }}>← Back</button>
            <div style={{ flex: 1 }} />
            <button onClick={() => setStep(3)} style={{ background: 'var(--gradient-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-btn)', padding: '12px 22px', font: "700 13px var(--font-display)", cursor: 'pointer', boxShadow: 'var(--shadow-btn-glow)' }}>Continue →</button>
          </div>
        </div>
      )}

      {/* Step 3: Poses */}
      {step === 3 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
            <h2 style={{ font: "700 23px var(--font-display)", letterSpacing: '-.01em', margin: 0 }}>Choose a game preset</h2>
          </div>
          <p style={{ margin: '0 0 26px', color: 'var(--text-dim)', fontSize: '13px' }}>
            {customizing ? 'Add or remove poses to build your custom set.' : 'Select a preset to determine which poses to generate.'}
          </p>

          {!customizing ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '26px' }}>
              {GAME_PRESETS.map(preset => (
                <div
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset.id)}
                  style={{
                    textAlign: 'left',
                    padding: '20px 22px',
                    borderRadius: '16px',
                    border: `1px solid ${selectedPreset === preset.id ? '#7b5cff' : '#2e2a54'}`,
                    background: '#1f1d3c',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    boxShadow: selectedPreset === preset.id ? '0 0 0 1px #7b5cff' : 'none',
                    position: 'relative',
                  }}
                >
                  {selectedPreset === preset.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const p = GAME_PRESETS.find(x => x.id === preset.id);
                        if (p) {
                          setCustomPoses(p.poses.map((pose, i) => ({ id: `custom-${i}`, name: pose.name, displayName: pose.displayName, useCase: pose.useCase, status: 'empty' as const, prompt: '' })));
                        }
                        setCustomizing(true);
                      }}
                      style={{ position: 'absolute', top: '14px', right: '14px', background: '#252247', color: '#cdc9ee', border: '1px solid #353160', borderRadius: '8px', padding: '6px 12px', font: "600 11px var(--font-display)", cursor: 'pointer' }}
                    >Customize</button>
                  )}
                  <div style={{ font: "700 18px var(--font-display)", marginBottom: '4px' }}>{preset.name}</div>
                  <div style={{ fontSize: '13px', color: '#9a96c4', marginBottom: '10px' }}>{preset.description}</div>
                  <div style={{ font: "400 12px var(--font-mono)", color: '#7d79ad', marginBottom: '13px' }}>{preset.poses.length} poses · {preset.canvasWidth}×{preset.canvasHeight}px</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {preset.poses.map(p => (
                      <span key={p.name} style={{ font: "500 11px var(--font-display)", color: '#cdc9ee', background: '#252247', border: '1px solid #353160', padding: '4px 9px', borderRadius: '7px' }}>{p.displayName}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-hairline)', borderRadius: '14px', padding: '18px', marginBottom: '26px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ font: "600 13px var(--font-display)", color: 'var(--text-primary)' }}>Custom Pose List · {customPoses.length} poses</div>
                <button
                  onClick={() => setCustomizing(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dimmer)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                >Back to presets</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                {customPoses.map((p, i) => (
                  <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', font: "500 11px var(--font-display)", background: 'var(--bg-raised)', padding: '5px 10px', borderRadius: '8px', color: 'var(--text-dim)', border: '1px solid var(--border-hairline)' }}>
                    {p.displayName}
                    <button
                      onClick={() => setCustomPoses(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: 'var(--text-dimmer)', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: 0 }}
                    >×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={newPoseName}
                  onChange={e => setNewPoseName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newPoseName.trim()) {
                      const name = newPoseName.trim().toLowerCase().replace(/\s+/g, '_');
                      const displayName = newPoseName.trim().replace(/\b\w/g, l => l.toUpperCase());
                      setCustomPoses(prev => [...prev, { id: `custom-${Date.now()}`, name, displayName, useCase: '', status: 'empty', prompt: '' }]);
                      setNewPoseName('');
                    }
                  }}
                  placeholder="Add a pose name…"
                  style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 'var(--radius-input)', color: 'var(--text-primary)', padding: '9px 12px', font: '13px var(--font-body)', outline: 'none' }}
                />
                <button
                  onClick={() => {
                    if (newPoseName.trim()) {
                      const name = newPoseName.trim().toLowerCase().replace(/\s+/g, '_');
                      const displayName = newPoseName.trim().replace(/\b\w/g, l => l.toUpperCase());
                      setCustomPoses(prev => [...prev, { id: `custom-${Date.now()}`, name, displayName, useCase: '', status: 'empty', prompt: '' }]);
                      setNewPoseName('');
                    }
                  }}
                  style={{ background: 'var(--gradient-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-btn)', padding: '9px 14px', font: "600 12px var(--font-display)", cursor: 'pointer' }}
                >+ Add</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { setCustomizing(false); setStep(2); }} style={{ background: 'var(--bg-raised)', color: '#e8e8ec', border: '1px solid #353160', borderRadius: 'var(--radius-btn)', padding: '12px 18px', font: "600 13px var(--font-display)", cursor: 'pointer' }}>← Back</button>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => {
                if (customizing) {
                  setPoses(customPoses);
                }
                handleGeneratePoses();
              }}
              disabled={customizing ? customPoses.length === 0 : !selectedPreset}
              style={{
                background: (customizing ? customPoses.length > 0 : selectedPreset) ? 'var(--gradient-brand)' : 'var(--bg-raised)',
                color: (customizing ? customPoses.length > 0 : selectedPreset) ? '#fff' : 'var(--text-dimmer)',
                border: 'none', borderRadius: 'var(--radius-btn)', padding: '12px 22px',
                font: "700 13px var(--font-display)", cursor: (customizing ? customPoses.length > 0 : selectedPreset) ? 'pointer' : 'not-allowed',
                boxShadow: (customizing ? customPoses.length > 0 : selectedPreset) ? 'var(--shadow-btn-glow)' : 'none',
              }}
            >Generate poses →</button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div>
          <h2 style={{ font: "700 23px var(--font-display)", letterSpacing: '-.01em', margin: '0 0 5px' }}>Review & approve poses</h2>
          <p style={{ margin: '0 0 26px', color: 'var(--text-dim)', fontSize: '13px' }}>Approve poses or request regeneration.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(238px, 1fr))', gap: '16px', marginBottom: '26px' }}>
            {poses.map((pose, i) => (
              <div key={pose.id} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-hairline)', borderRadius: '14px', overflow: 'hidden' }}>
                {/* Image area with checkerboard */}
                <div className="checkerboard" style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {generatingIdx === i ? (
                    <div style={{ width: '28px', height: '28px', border: '3px solid var(--accent-purple)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'pf-spin .8s linear infinite' }} />
                  ) : poseImages[pose.name] ? (
                    <img
                      src={`data:image/png;base64,${poseImages[pose.name]}`}
                      alt={pose.displayName}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '8px', cursor: 'pointer' }}
                      onClick={() => {
                        const imgs = poses.filter(p => poseImages[p.name]).map(p => ({ src: `data:image/png;base64,${poseImages[p.name]}`, alt: p.displayName }));
                        const idx = poses.filter(p => poseImages[p.name]).findIndex(p => p.name === pose.name);
                        lightbox.open(imgs, idx);
                      }}
                    />
                  ) : pose.status === 'generated' ? (
                    <div style={{ color: 'var(--text-dimmer)', fontSize: '11px' }}>Generated ✓</div>
                  ) : (
                    <div style={{ color: 'var(--text-dimmer)', fontSize: '11px' }}>Waiting…</div>
                  )}
                </div>
                <div style={{ padding: '12px' }}>
                  <div style={{ marginBottom: '9px' }}>
                    <div style={{ font: "600 14px var(--font-display)" }}>{pose.displayName}</div>
                    <div style={{ fontSize: '11.5px', color: '#9a96c4', marginTop: '4px' }}>{pose.useCase}</div>
                  </div>

                  {pose.status === 'approved' ? (
                    <button
                      onClick={() => setPoses(prev => prev.map((p, j) => j === i ? { ...p, status: 'generated' } : p))}
                      style={{ width: '100%', minHeight: '79px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', font: "700 14px var(--font-display)", cursor: 'pointer', background: '#3ddc97', color: '#0c2a1c', border: 'none' }}
                    >
                      ✓ Approved
                    </button>
                  ) : pose.status === 'generated' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <textarea
                        value={pose.prompt}
                        onChange={e => setPoses(prev => prev.map((p, j) => j === i ? { ...p, prompt: e.target.value } : p))}
                        onInput={e => {
                          const target = e.currentTarget;
                          target.style.height = 'auto';
                          target.style.height = `${target.scrollHeight}px`;
                        }}
                        rows={1}
                        className="auto-grow"
                        placeholder="Edit prompt for redo…"
                        style={{ width: '100%', background: '#161534', border: '1px solid #312d57', borderRadius: '8px', color: '#f0eefb', padding: '7px 9px', font: '12px/1.4 system-ui', outline: 'none', resize: 'none', overflow: 'hidden', marginBottom: '0', display: 'block' }}
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleRedoPose(i)}
                          disabled={generatingIdx === i}
                          style={{ flex: 1, background: '#252247', color: '#cdc9ee', border: '1px solid #353160', borderRadius: '9px', padding: '9px', font: "600 12px var(--font-display)", cursor: generatingIdx === i ? 'wait' : 'pointer', opacity: generatingIdx === i ? 0.7 : 1 }}
                        >
                          ↻ Redo
                        </button>
                        <button
                          onClick={() => setPoses(prev => prev.map((p, j) => j === i ? { ...p, status: 'approved' } : p))}
                          style={{ flex: 1, background: 'rgba(61,220,151,.12)', color: '#3ddc97', border: '1px solid rgba(61,220,151,.3)', borderRadius: '9px', padding: '9px', font: "600 12px var(--font-display)", cursor: 'pointer' }}
                        >
                          ✓ Approve
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '22px', paddingTop: '18px', borderTop: '1px solid #262248' }}>
            <span style={{ fontSize: '13px', color: '#9a96c4' }}><b style={{ color: '#e6e3f5', fontWeight: 700 }}>{approvedCount}</b> of {poses.length} approved</span>
            <button onClick={() => setStep(3)} style={{ background: '#252247', color: '#e8e8ec', border: '1px solid #353160', borderRadius: '11px', padding: '12px 18px', font: "600 13px var(--font-display)", cursor: 'pointer', marginLeft: 'auto' }}>← Back</button>
            <button
              onClick={handleDone}
              style={{ background: 'var(--gradient-brand)', color: '#fff', border: 'none', borderRadius: '11px', padding: '12px 24px', font: "700 14px var(--font-display)", cursor: 'pointer', boxShadow: '0 12px 28px -10px rgba(91,108,255,.9)' }}
            >
              Done
            </button>
          </div>
        </div>
      )}
      {lightbox.state && <Lightbox images={lightbox.state.images} startIndex={lightbox.state.startIndex} onClose={lightbox.close} onRegenerate={handleLightboxRegenerate} regenerating={lbRegenerating} />}
    </div>
  );
}

function WizField({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [overflows, setOverflows] = useState(false);
  const collapsedHeight = 80;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.height = 'auto';
      const full = el.scrollHeight;
      if (collapsed) {
        setOverflows(full > collapsedHeight);
        el.style.height = `${Math.min(full, collapsedHeight)}px`;
      } else {
        el.style.height = `${Math.max(full, collapsedHeight)}px`;
      }
    });
  }, [value, collapsed]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <label style={{ font: "600 11px var(--font-display)", letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '6px', display: 'block' }}>{label}</label>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={1}
        style={{
          width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-input)',
          borderRadius: 'var(--radius-input)', color: 'var(--text-primary)', padding: '11px 13px',
          font: '13px/1.5 var(--font-body)', outline: 'none', resize: 'none', overflow: 'hidden',
          flex: 1, minHeight: `${collapsedHeight}px`,
        }}
      />
      {overflows && collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          style={{ position: 'absolute', left: '6px', bottom: '6px', background: 'rgba(22,21,52,.85)', border: '1px solid #312d57', borderRadius: '6px', color: '#7b5cff', fontSize: '12px', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}
          title="Expand"
        >⤡</button>
      )}
    </div>
  );
}
