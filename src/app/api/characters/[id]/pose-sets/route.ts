import { NextResponse } from 'next/server';
import { getPoseSets } from '@/lib/storage';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const poseSets = getPoseSets(id);
  return NextResponse.json(poseSets);
}
