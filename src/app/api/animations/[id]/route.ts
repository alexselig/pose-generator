import { NextResponse } from 'next/server';
import { getAnimationClip, saveAnimationClip } from '@/lib/animations';

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

// Update reviewer state on a clip (currently just the approved flag).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clip = getAnimationClip(id);
  if (!clip) {
    return NextResponse.json({ error: 'Animation clip not found' }, { status: 404 });
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  if (typeof body.approved === 'boolean') {
    clip.approved = body.approved;
    clip.updatedAt = new Date().toISOString();
    saveAnimationClip(clip);
  }
  return NextResponse.json(clip);
}

