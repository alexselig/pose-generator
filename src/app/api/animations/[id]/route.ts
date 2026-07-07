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

// Update reviewer state on a clip: the approved flag, or a single frame's hidden
// flag (frameIndex + hidden). Hiding a frame does NOT bump updatedAt so the
// preview (keyed on updatedAt) doesn't remount mid-edit.
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
  let changed = false;
  if (typeof body.approved === 'boolean') {
    clip.approved = body.approved;
    clip.updatedAt = new Date().toISOString();
    changed = true;
  }
  if (typeof body.frameIndex === 'number' && typeof body.hidden === 'boolean') {
    const frame = clip.frames.find(f => f.index === body.frameIndex);
    if (frame) {
      frame.hidden = body.hidden;
      changed = true;
    }
  }
  if (changed) {
    saveAnimationClip(clip);
  }
  return NextResponse.json(clip);
}

