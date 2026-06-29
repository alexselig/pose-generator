import { NextRequest, NextResponse } from 'next/server';
import { finalizePoseSet } from '@/lib/storage';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const poseSet = finalizePoseSet(id);
  if (!poseSet) {
    return NextResponse.json({ error: 'Pose set not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    poseSet: {
      ...poseSet,
      poses: poseSet.poses.map(p => ({ ...p, imageData: undefined })),
    },
  });
}
