import { NextResponse } from 'next/server';
import { getAnimationClip, readAnimationFrame } from '@/lib/animations';

// Serve one sliced frame as a cacheable PNG (mirrors /api/images). The URL is
// immutable, so callers bust the cache after regeneration with ?v=<updatedAt>.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index } = await params;

  const clip = getAnimationClip(id);
  if (!clip) {
    return NextResponse.json({ error: 'Animation clip not found' }, { status: 404 });
  }

  const i = Number.parseInt(index, 10);
  if (Number.isNaN(i) || i < 0) {
    return NextResponse.json({ error: 'Invalid frame index' }, { status: 400 });
  }

  // Only serve frames the clip actually declares. Guards against orphaned frame
  // files from an earlier, longer generation being served for an out-of-range
  // index (they'd otherwise be cached immutably).
  if (i >= clip.frames.length) {
    return NextResponse.json({ error: 'Frame not found' }, { status: 404 });
  }

  const buffer = readAnimationFrame(clip.characterName, clip.action, i);
  if (!buffer) {
    return NextResponse.json({ error: 'Frame not found' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
