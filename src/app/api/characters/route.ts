import { NextRequest, NextResponse } from 'next/server';
import { getCharacters, saveCharacter } from '@/lib/storage';
import { Character } from '@/lib/types';
import { v4 as uuid } from 'uuid';

export async function GET() {
  try {
    const characters = getCharacters();
    return NextResponse.json(characters);
  } catch (error) {
    console.error('Error fetching characters:', error);
    return NextResponse.json({ error: 'Failed to fetch characters' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const character: Character = {
      id: uuid(),
      name: body.name || 'Unnamed Character',
      description: body.description || '',
      artStyle: body.artStyle || '',
      colorPalette: body.colorPalette || [],
      costumeDetails: body.costumeDetails || '',
      accessories: body.accessories || '',
      bodyProportions: body.bodyProportions || '',
      personalityNotes: body.personalityNotes || '',
      referenceImages: body.referenceImages || [],
      approvedReferencePose: body.approvedReferencePose,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
    };
    const saved = saveCharacter(character);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error('Error creating character:', error);
    return NextResponse.json({ error: 'Failed to create character' }, { status: 500 });
  }
}
