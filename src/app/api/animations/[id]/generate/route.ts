import { NextResponse } from 'next/server';
import { getCharacter, getPoseImage } from '@/lib/storage';
import {
  getAnimationClip,
  saveAnimationClip,
  saveAnimationFrame,
  sliceFilmstrip,
} from '@/lib/animations';
import { generateAnimationFilmstrip } from '@/lib/gemini';
import { ANIMATION_PRESETS } from '@/lib/types';

// sharp + a full model round-trip; keep off the edge runtime and give it room.
export const runtime = 'nodejs';
export const maxDuration = 120;

// Generate the whole clip in one shot: one filmstrip model call, then slice it
// into frame PNGs on disk. On failure the clip is marked 'failed' so the UI can
// offer a retry instead of spinning forever.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const clip = getAnimationClip(id);
    if (!clip) {
      return NextResponse.json({ error: 'Animation clip not found' }, { status: 404 });
    }

    const character = getCharacter(clip.characterId);
    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    const preset = ANIMATION_PRESETS.find(p => p.action === clip.action);
    if (!preset) {
      return NextResponse.json({ error: 'Animation preset not found' }, { status: 404 });
    }

    clip.status = 'generating';
    clip.updatedAt = new Date().toISOString();
    saveAnimationClip(clip);

    // Same reference resolution as pose generation: prefer the persisted
    // reference image, fall back to the first inline reference.
    const reference = character.referenceImages.length > 0
      ? getPoseImage(character.id, 'reference_0') || character.referenceImages[0]
      : undefined;

    const strip = await generateAnimationFilmstrip(character, preset, reference);
    const frameBuffers = await sliceFilmstrip(strip, clip.canvasWidth, clip.canvasHeight, clip.frameCount);

    clip.frames = frameBuffers.map((buf, i) => {
      const imagePath = saveAnimationFrame(character.name, clip.action, i, buf);
      return { index: i, imagePath, status: 'generated' as const };
    });
    // The model draws a variable number of figures; trust the detected count.
    clip.frameCount = frameBuffers.length;
    clip.status = 'generated';
    clip.updatedAt = new Date().toISOString();
    saveAnimationClip(clip);

    return NextResponse.json(clip);
  } catch (error) {
    console.error('Error generating animation:', error);
    const clip = getAnimationClip(id);
    if (clip) {
      clip.status = 'failed';
      clip.updatedAt = new Date().toISOString();
      saveAnimationClip(clip);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to generate animation: ${message}` }, { status: 500 });
  }
}
