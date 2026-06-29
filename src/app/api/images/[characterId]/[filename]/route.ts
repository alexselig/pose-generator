import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCharacter } from '@/lib/storage';

const DATA_DIR = process.env.DATA_DIR || './data';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ characterId: string; filename: string }> }
) {
  const { characterId, filename } = await params;
  const safeName = path.basename(filename);

  // Try characterId as a UUID first (look up character name for folder)
  const character = getCharacter(characterId);
  const folderName = character ? slugify(character.name) : characterId;
  const filePath = path.join(DATA_DIR, 'images', folderName, safeName);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
