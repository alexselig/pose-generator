import { NextRequest, NextResponse } from 'next/server';
import { getCharacter } from '@/lib/storage';
import { getScenes, saveScene } from '@/lib/scenes';
import { Scene } from '@/lib/types';
import { v4 as uuid } from 'uuid';

export function GET() {
  return NextResponse.json(getScenes());
}

// Create a scene from a set of characters + a context. The image is filled in by
// POST /api/scenes/[id]/generate.
export async function POST(request: NextRequest) {
  try {
    const { characterIds, context, name, aspectRatio, styleNote } = await request.json();

    if (!Array.isArray(characterIds) || characterIds.length === 0) {
      return NextResponse.json({ error: 'At least one character is required' }, { status: 400 });
    }
    if (!context || typeof context !== 'string' || !context.trim()) {
      return NextResponse.json({ error: 'context is required' }, { status: 400 });
    }

    const characters = characterIds.map((cid: string) => getCharacter(cid));
    if (characters.some(c => !c)) {
      return NextResponse.json({ error: 'One or more characters not found' }, { status: 404 });
    }
    const names = characters.map(c => c!.name);

    const now = new Date().toISOString();
    const scene: Scene = {
      id: uuid(),
      name: (name && String(name).trim()) || names.join(' & '),
      characterIds,
      characterNames: names,
      context: context.trim(),
      aspectRatio: typeof aspectRatio === 'string' ? aspectRatio : '16:9',
      styleNote: typeof styleNote === 'string' && styleNote.trim() ? styleNote.trim() : undefined,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    saveScene(scene);
    return NextResponse.json(scene, { status: 201 });
  } catch (error) {
    console.error('Error creating scene:', error);
    return NextResponse.json({ error: 'Failed to create scene' }, { status: 500 });
  }
}
