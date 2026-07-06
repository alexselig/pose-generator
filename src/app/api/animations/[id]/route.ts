import { NextResponse } from 'next/server';
import { getAnimationClip } from '@/lib/animations';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clip = getAnimationClip(id);
  if (!clip) {
    return NextResponse.json({ error: 'Animation clip not found' }, { status: 404 });
  }
  // Clip JSON is already slim (frames carry only index/imagePath/status, no base64).
  return NextResponse.json(clip);
}
