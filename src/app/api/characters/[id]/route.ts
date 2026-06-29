import { NextRequest, NextResponse } from 'next/server';
import { getCharacter, saveCharacter, duplicateCharacter, archiveCharacter, hardDeleteCharacter } from '@/lib/storage';
import { v4 as uuid } from 'uuid';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const character = getCharacter(id);
  if (!character) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }
  return NextResponse.json(character);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = getCharacter(id);
  if (!existing) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }

  const body = await request.json();
  const updated = {
    ...existing,
    ...body,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };
  const saved = saveCharacter(updated);
  return NextResponse.json(saved);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const success = hardDeleteCharacter(id);
  if (!success) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (body.action === 'duplicate') {
    const newChar = duplicateCharacter(id, uuid());
    if (!newChar) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }
    return NextResponse.json(newChar, { status: 201 });
  }

  if (body.action === 'archive') {
    const success = archiveCharacter(id);
    if (!success) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
