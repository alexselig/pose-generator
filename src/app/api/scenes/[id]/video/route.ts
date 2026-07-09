import { NextResponse } from 'next/server';
import { getScene, readSceneVideo } from '@/lib/scenes';

// Serve the rendered scene mp4. Callers bust the cache with ?v=<videoUpdatedAt>
// after a re-animate (mirrors /api/scenes/[id]/image).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scene = getScene(id);
  if (!scene) {
    return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
  }
  const buffer = readSceneVideo(id);
  if (!buffer) {
    return NextResponse.json({ error: 'Scene video not found' }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'video/mp4',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
