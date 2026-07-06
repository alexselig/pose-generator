import { NextResponse } from 'next/server';
import { getCharacter } from '@/lib/storage';
import { getAnimationClips } from '@/lib/animations';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!getCharacter(id)) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }
  return NextResponse.json(getAnimationClips(id));
}
