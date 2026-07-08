import { NextResponse } from 'next/server';
import { getScene, readSceneImage } from '@/lib/scenes';

// Serve the rendered scene PNG. The URL is immutable; callers bust the cache
// after regeneration with ?v=<updatedAt> (mirrors /api/animations frames).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scene = getScene(id);
  if (!scene) {
    return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
  }
  const buffer = readSceneImage(id);
  if (!buffer) {
    return NextResponse.json({ error: 'Scene image not found' }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
