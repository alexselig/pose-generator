import { NextResponse } from 'next/server';
import { getLatestPoseSet } from '@/lib/storage';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const poseSet = getLatestPoseSet(id);
  // A character with no pose sets yet is a valid state (e.g. just created or
  // duplicated), not an error. Return null with 200 so callers stop logging a
  // spurious 404 in the console on every fresh character.
  if (!poseSet) return NextResponse.json(null);

  // ?slim=1 drops the inlined per-pose imageData base64 (which can total >15MB
  // for a full set). Callers that only need pose metadata — e.g. the detail
  // page, which renders poses from /api/images URLs and only reads pose id/name
  // to wire up regeneration — opt in and avoid downloading every image twice.
  const slim = new URL(request.url).searchParams.get('slim') === '1';
  if (slim) {
    return NextResponse.json({
      ...poseSet,
      poses: poseSet.poses.map(({ imageData, ...pose }) => pose),
    });
  }

  return NextResponse.json(poseSet);
}
