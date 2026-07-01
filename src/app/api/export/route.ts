import { NextRequest, NextResponse } from 'next/server';
import { getCharacter, getMergedPoseSet, getPoseSet } from '@/lib/storage';
import { exportGodotPackage, generateManifest } from '@/lib/export';

function getExportOptions(searchParams: URLSearchParams) {
  const canvasSize = Number(searchParams.get('canvasSize') || '') || undefined;
  const anchor = searchParams.get('anchor');
  return {
    prefix: searchParams.get('prefix') || undefined,
    canvasSize,
    anchor: anchor === 'center' || anchor === 'top_center' || anchor === 'bottom_center' ? anchor : undefined,
    includePoseSheet: searchParams.get('includeSheet') !== 'false',
  } as const;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const characterId = searchParams.get('characterId');
    const format = searchParams.get('format') || 'zip';
    if (!characterId) {
      return NextResponse.json({ error: 'characterId is required' }, { status: 400 });
    }

    const character = getCharacter(characterId);
    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    const poseSet = getMergedPoseSet(characterId);
    if (!poseSet) {
      return NextResponse.json({ error: 'Pose set not found' }, { status: 404 });
    }

    const options = getExportOptions(searchParams);

    if (format === 'manifest') {
      return NextResponse.json(generateManifest(character, poseSet, options));
    }

    const zipBuffer = await exportGodotPackage(character, poseSet, options);
    const uint8 = new Uint8Array(zipBuffer);
    const prefix = options.prefix || character.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return new NextResponse(uint8, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${prefix}_godot_assets.zip"`,
      },
    });
  } catch (error) {
    console.error('Error exporting:', error);
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poseSetId, format, prefix, canvasSize, anchor, includePoseSheet } = body;

    const poseSet = getPoseSet(poseSetId);
    if (!poseSet) {
      return NextResponse.json({ error: 'Pose set not found' }, { status: 404 });
    }

    const character = getCharacter(poseSet.characterId);
    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    if (format === 'manifest') {
      const manifest = generateManifest(character, poseSet, { prefix, canvasSize, anchor, includePoseSheet });
      return NextResponse.json(manifest);
    }

    if (format === 'zip') {
      const zipBuffer = await exportGodotPackage(character, poseSet, { prefix, canvasSize, anchor, includePoseSheet });
      const uint8 = new Uint8Array(zipBuffer);
      return new NextResponse(uint8, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${(prefix || character.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'))}_godot_assets.zip"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid format. Use "manifest" or "zip"' }, { status: 400 });
  } catch (error) {
    console.error('Error exporting:', error);
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
  }
}
