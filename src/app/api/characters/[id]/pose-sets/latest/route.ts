import { NextResponse } from 'next/server';
import { getLatestPoseSet } from '@/lib/storage';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const poseSet = getLatestPoseSet(id);
  // A character with no pose sets yet is a valid state (e.g. just created or
  // duplicated), not an error. Return null with 200 so callers stop logging a
  // spurious 404 in the console on every fresh character.
  return NextResponse.json(poseSet ?? null);
}
