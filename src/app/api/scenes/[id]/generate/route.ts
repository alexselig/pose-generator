import { NextResponse } from 'next/server';
import { getCharacter, getPoseImage } from '@/lib/storage';
import { getScene, saveScene, saveSceneImage, readSceneImage } from '@/lib/scenes';
import { generateSceneImage, enhanceScenePrompt, editSceneImage } from '@/lib/gemini';
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
    // Auto-enhance the user's short context into a rich prompt unless disabled or
    // an explicit (already-edited) prompt was supplied.
    const enhance = body?.enhance !== false;
    const editInstruction =
      typeof body?.edit === 'string' && body.edit.trim() ? body.edit.trim() : undefined;

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
    scene.updatedAt = new Date().toISOString();
    saveScene(scene);

    let base64: string;
    if (editInstruction) {
      // Delta edit: transform the current render in place, keeping composition,
      // characters, and style — only what the instruction asks changes.
      const current = readSceneImage(scene.id);
      if (!current) {
        scene.status = 'failed';
        scene.updatedAt = new Date().toISOString();
        saveScene(scene);
        return NextResponse.json({ error: 'No image to edit yet — generate the scene first.' }, { status: 400 });
      }
      base64 = await editSceneImage(current.toString('base64'), editInstruction, {
        aspectRatio: scene.aspectRatio,
      });
    } else {
      // Resolve the effective scene prompt: an explicit edit wins; otherwise expand
      // the context with the text model (best-effort — fall back to the raw context).
      let effectivePrompt = userPrompt;
      if (!effectivePrompt && enhance) {
        try {
          effectivePrompt = await enhanceScenePrompt(characters, scene.context, {
            aspectRatio: scene.aspectRatio,
            styleNote: scene.styleNote,
          });
        } catch (e) {
          console.error('Scene prompt enhancement failed:', e);
        }
      }
      scene.prompt = effectivePrompt || undefined;
      saveScene(scene);

      // Canonical reference per character: the generated reference pose, else the
      // first uploaded reference image, else undefined (rely on the description).
      const references = characters.map(
        c => getPoseImage(c.id, 'reference_0') || (c.referenceImages.length > 0 ? c.referenceImages[0] : undefined)
      );

      base64 = await generateSceneImage(characters, references, scene.context, {
        aspectRatio: scene.aspectRatio,
        styleNote: scene.styleNote,
        prompt: effectivePrompt,
      });
    }

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
