import { NextResponse } from 'next/server';
import { getCharacter, getPoseImage } from '@/lib/storage';
import { getScene, saveScene, saveSceneImage } from '@/lib/scenes';
import { generateSceneImage } from '@/lib/gemini';
import { Character } from '@/lib/types';

// sharp-free, but a full multi-image model round-trip; keep off the edge runtime.
export const runtime = 'nodejs';
export const maxDuration = 120;

// Generate (or regenerate) the scene image in one model call: each character's
// reference image is fed in and bound to that character by name in the prompt.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const userPrompt =
      typeof body?.prompt === 'string' && body.prompt.trim() ? body.prompt.trim() : undefined;

    const scene = getScene(id);
    if (!scene) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    const characters = scene.characterIds
      .map(cid => getCharacter(cid))
      .filter((c): c is Character => !!c);
    if (characters.length === 0) {
      return NextResponse.json({ error: 'No valid characters for this scene' }, { status: 400 });
    }

    scene.status = 'generating';
    if (userPrompt) scene.prompt = userPrompt;
    scene.updatedAt = new Date().toISOString();
    saveScene(scene);

    // Canonical reference per character: the generated reference pose, else the
    // first uploaded reference image, else undefined (rely on the description).
    const references = characters.map(
      c => getPoseImage(c.id, 'reference_0') || (c.referenceImages.length > 0 ? c.referenceImages[0] : undefined)
    );

    const base64 = await generateSceneImage(characters, references, scene.context, {
      aspectRatio: scene.aspectRatio,
      styleNote: scene.styleNote,
      prompt: userPrompt || scene.prompt,
    });

    const imagePath = saveSceneImage(scene.id, Buffer.from(base64, 'base64'));
    scene.status = 'generated';
    scene.imagePath = imagePath;
    scene.updatedAt = new Date().toISOString();
    saveScene(scene);

    return NextResponse.json(scene);
  } catch (error) {
    console.error('Error generating scene:', error);
    const scene = getScene(id);
    if (scene) {
      scene.status = 'failed';
      scene.updatedAt = new Date().toISOString();
      saveScene(scene);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to generate scene: ${message}` }, { status: 500 });
  }
}
