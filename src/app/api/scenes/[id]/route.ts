import { NextResponse } from 'next/server';
import { getScene, saveScene, deleteScene } from '@/lib/scenes';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scene = getScene(id);
  if (!scene) {
    return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
  }
  return NextResponse.json(scene);
}

// Update reviewer state on a scene (currently just the approved flag).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scene = getScene(id);
  if (!scene) {
    return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  if (typeof body.approved === 'boolean') {
    scene.approved = body.approved;
    scene.updatedAt = new Date().toISOString();
    saveScene(scene);
  }
  return NextResponse.json(scene);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = deleteScene(id);
  if (!ok) {
    return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
