import { NextResponse } from 'next/server';
import { getLatestPoseSet } from '@/lib/storage';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const poseSet = getLatestPoseSet(id);
  if (!poseSet) {
    return NextResponse.json({ error: 'Pose set not found' }, { status: 404 });
  }
  return NextResponse.json(poseSet);
}
