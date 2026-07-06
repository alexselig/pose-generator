import { NextResponse } from 'next/server';
import { getAnimationClip } from '@/lib/animations';
import { exportAnimationPackage } from '@/lib/animation-export';

export const runtime = 'nodejs';

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Stream a Godot asset pack (frames + sprite sheet + SpriteFrames .tres + manifest)
// for one animation clip.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const clip = getAnimationClip(id);
  if (!clip) {
    return NextResponse.json({ error: 'Animation clip not found' }, { status: 404 });
  }
  if (clip.status !== 'generated' || clip.frameCount === 0) {
    return NextResponse.json({ error: 'Animation has no generated frames yet' }, { status: 400 });
  }

  const prefix = new URL(request.url).searchParams.get('prefix') || undefined;

  try {
    const zip = await exportAnimationPackage(clip, { prefix });
    const filename = `${slugify(prefix || clip.characterName)}_${clip.action}_godot.zip`;
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to export animation: ${message}` }, { status: 500 });
  }
}
