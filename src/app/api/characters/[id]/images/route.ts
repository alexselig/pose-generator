import { NextRequest, NextResponse } from 'next/server';
import { listCharacterImages, getCharacter, getCharacterFolderName } from '@/lib/storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const character = getCharacter(id);
  if (!character) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }

  const folderName = getCharacterFolderName(id);
  const images = listCharacterImages(id);

  return NextResponse.json({
    characterId: id,
    characterName: character.name,
    folder: `data/images/${folderName}/`,
    images: images.map(img => ({
      name: img.name,
      url: `/api/images/${id}/${img.name}`,
      isArchive: img.isArchive,
    })),
  });
}
