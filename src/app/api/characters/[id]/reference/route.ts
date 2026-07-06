import { NextRequest, NextResponse } from 'next/server';
import { getCharacter } from '@/lib/storage';

// Serve a character's reference image (the base illustration) as a cacheable
// PNG. The character list endpoint no longer inlines referenceImages base64, so
// the gallery loads portraits from this URL instead — turning a multi-MB inline
// payload into a browser-cached image request.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const character = getCharacter(id);
  if (!character) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }

  const raw = character.referenceImages?.[0];
  if (!raw) {
    return NextResponse.json({ error: 'No reference image' }, { status: 404 });
  }

  // referenceImages entries are stored as raw base64; tolerate an accidental
  // data-URL prefix just in case.
  const base64 = raw.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
