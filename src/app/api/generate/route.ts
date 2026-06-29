import { NextRequest, NextResponse } from 'next/server';
import { getCharacter, savePoseSet, savePoseImage, getPoseImage } from '@/lib/storage';
import { generatePoseImage } from '@/lib/gemini';
import { Pose, PoseSet, GAME_PRESETS } from '@/lib/types';
import { v4 as uuid } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { characterId, presetId, customPoses, canvasWidth, canvasHeight } = body;

    const character = getCharacter(characterId);
    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    // Get poses from preset or custom list
    let poseDefs: { name: string; displayName: string; description: string; useCase: string }[];
    let cw = canvasWidth || 512;
    let ch = canvasHeight || 512;

    if (presetId) {
      const preset = GAME_PRESETS.find(p => p.id === presetId);
      if (!preset) {
        return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
      }
      poseDefs = preset.poses;
      cw = preset.canvasWidth;
      ch = preset.canvasHeight;
    } else if (customPoses) {
      poseDefs = customPoses;
    } else {
      return NextResponse.json({ error: 'Either presetId or customPoses required' }, { status: 400 });
    }

    // Create pose set
    const poses: Pose[] = poseDefs.map(p => ({
      id: uuid(),
      characterId,
      name: p.name,
      displayName: p.displayName,
      description: p.description,
      useCase: p.useCase,
      status: 'pending' as const,
      anchor: 'bottom_center' as const,
      locked: false,
    }));

    const poseSet: PoseSet = {
      id: uuid(),
      characterId,
      characterName: character.name,
      preset: presetId || 'custom',
      poses,
      canvasWidth: cw,
      canvasHeight: ch,
      status: 'in_progress',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    savePoseSet(poseSet);
    return NextResponse.json(poseSet, { status: 201 });
  } catch (error) {
    console.error('Error creating pose set:', error);
    return NextResponse.json({ error: 'Failed to create pose set' }, { status: 500 });
  }
}

// Generate a single pose
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { poseSetId, poseId, prompt } = body;

    // Load from storage  
    const { getPoseSet } = await import('@/lib/storage');
    const poseSet = getPoseSet(poseSetId);
    if (!poseSet) {
      return NextResponse.json({ error: 'Pose set not found' }, { status: 404 });
    }

    const character = getCharacter(poseSet.characterId);
    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    const poseIndex = poseSet.poses.findIndex(p => p.id === poseId);
    if (poseIndex === -1) {
      return NextResponse.json({ error: 'Pose not found' }, { status: 404 });
    }

    const pose = poseSet.poses[poseIndex];
    if (pose.locked) {
      return NextResponse.json({ error: 'Pose is locked' }, { status: 400 });
    }

    // Get reference image if available
    const referenceImage = character.referenceImages.length > 0
      ? getPoseImage(character.id, 'reference_0') || character.referenceImages[0]
      : undefined;

    // Generate the pose
    poseSet.poses[poseIndex].status = 'generating';
    savePoseSet(poseSet);

    if (prompt) {
      poseSet.poses[poseIndex].prompt = prompt;
    }

    const imageData = await generatePoseImage(
      character,
      {
        ...pose,
        prompt: prompt || pose.prompt,
      },
      { width: poseSet.canvasWidth, height: poseSet.canvasHeight },
      referenceImage
    );

    // Save image
    savePoseImage(character.id, pose.name, imageData);

    // Update pose set
    poseSet.poses[poseIndex].status = 'generated';
    poseSet.poses[poseIndex].imageData = imageData;
    poseSet.poses[poseIndex].generatedAt = new Date().toISOString();
    poseSet.updatedAt = new Date().toISOString();
    savePoseSet(poseSet);

    return NextResponse.json(poseSet.poses[poseIndex]);
  } catch (error) {
    console.error('Error generating pose:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to generate pose: ${message}` }, { status: 500 });
  }
}
