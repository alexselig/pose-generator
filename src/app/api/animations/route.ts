import { NextRequest, NextResponse } from 'next/server';
import { getCharacter } from '@/lib/storage';
import { saveAnimationClip } from '@/lib/animations';
import { getAnimationSpec, AnimationClip } from '@/lib/types';
import { v4 as uuid } from 'uuid';

// Create an animation clip for a character + action (any pose name). Frames start
// pending; POST /api/animations/[id]/generate fills them in.
export async function POST(request: NextRequest) {
  try {
    const { characterId, action, displayName } = await request.json();

    const character = getCharacter(characterId);
    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }
    if (!action || typeof action !== 'string' || !action.trim()) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const spec = getAnimationSpec(action, displayName);
    const now = new Date().toISOString();
    const clip: AnimationClip = {
      id: uuid(),
      characterId,
      characterName: character.name,
      action: spec.action,
      displayName: spec.displayName,
      perspective: spec.perspective,
      frameCount: spec.frameCount,
      fps: spec.fps,
      loop: spec.loop,
      canvasWidth: spec.canvasWidth,
      canvasHeight: spec.canvasHeight,
      frames: Array.from({ length: spec.frameCount }, (_, i) => ({ index: i, status: 'pending' as const })),
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

