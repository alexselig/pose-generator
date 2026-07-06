import { NextRequest, NextResponse } from 'next/server';
import { getCharacter } from '@/lib/storage';
import { saveAnimationClip } from '@/lib/animations';
import { ANIMATION_PRESETS, AnimationClip } from '@/lib/types';
import { v4 as uuid } from 'uuid';

// Create an animation clip for a character from an animation preset (e.g. walk).
// Frames start as pending; POST /api/animations/[id]/generate fills them in.
export async function POST(request: NextRequest) {
  try {
    const { characterId, action } = await request.json();

    const character = getCharacter(characterId);
    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    const preset = ANIMATION_PRESETS.find(p => p.id === action || p.action === action);
    if (!preset) {
      return NextResponse.json({ error: 'Animation preset not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const clip: AnimationClip = {
      id: uuid(),
      characterId,
      characterName: character.name,
      action: preset.action,
      displayName: preset.displayName,
      perspective: preset.perspective ?? 'side',
      frameCount: preset.frameCount,
      fps: preset.fps,
      loop: preset.loop,
      canvasWidth: preset.canvasWidth,
      canvasHeight: preset.canvasHeight,
      frames: preset.frames.map(f => ({ index: f.index, status: 'pending' as const })),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    saveAnimationClip(clip);
    return NextResponse.json(clip, { status: 201 });
  } catch (error) {
    console.error('Error creating animation clip:', error);
    return NextResponse.json({ error: 'Failed to create animation clip' }, { status: 500 });
  }
}
