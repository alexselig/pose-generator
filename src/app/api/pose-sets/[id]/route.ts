import { NextRequest, NextResponse } from 'next/server';
import { getPoseSet, savePoseSet } from '@/lib/storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const poseSet = getPoseSet(id);
  if (!poseSet) {
    return NextResponse.json({ error: 'Pose set not found' }, { status: 404 });
  }
  return NextResponse.json(poseSet);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const poseSet = getPoseSet(id);
  if (!poseSet) {
    return NextResponse.json({ error: 'Pose set not found' }, { status: 404 });
  }

  const body = await request.json();

  if (Array.isArray(body.poses)) {
    poseSet.poses = body.poses;
    if (body.preset) poseSet.preset = body.preset;
    if (body.canvasWidth) poseSet.canvasWidth = body.canvasWidth;
    if (body.canvasHeight) poseSet.canvasHeight = body.canvasHeight;
    poseSet.updatedAt = new Date().toISOString();
    savePoseSet(poseSet);
    return NextResponse.json(poseSet);
  }

  // Handle pose status updates (approve, reject, lock)
  if (body.poseId && body.action) {
    const poseIndex = poseSet.poses.findIndex(p => p.id === body.poseId);
    if (poseIndex === -1) {
      return NextResponse.json({ error: 'Pose not found' }, { status: 404 });
    }

    switch (body.action) {
      case 'approve':
        poseSet.poses[poseIndex].status = 'approved';
        poseSet.poses[poseIndex].locked = true;
        break;
      case 'reject':
        poseSet.poses[poseIndex].status = 'rejected';
        poseSet.poses[poseIndex].issues = body.issues || [];
        break;
      case 'lock':
        poseSet.poses[poseIndex].locked = true;
        break;
      case 'unlock':
        poseSet.poses[poseIndex].locked = false;
        break;
      case 'update':
        if (body.displayName) poseSet.poses[poseIndex].displayName = body.displayName;
        if (body.description) poseSet.poses[poseIndex].description = body.description;
        if (body.name) poseSet.poses[poseIndex].name = body.name;
        if (body.useCase) poseSet.poses[poseIndex].useCase = body.useCase;
        if (body.anchor) poseSet.poses[poseIndex].anchor = body.anchor;
        if (body.issues) poseSet.poses[poseIndex].issues = body.issues;
        if (body.status) poseSet.poses[poseIndex].status = body.status;
        if (typeof body.locked === 'boolean') poseSet.poses[poseIndex].locked = body.locked;
        if (typeof body.prompt === 'string') poseSet.poses[poseIndex].prompt = body.prompt;
        break;
      case 'remove':
        poseSet.poses.splice(poseIndex, 1);
        break;
    }

    poseSet.updatedAt = new Date().toISOString();
    savePoseSet(poseSet);
    return NextResponse.json(poseSet);
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
