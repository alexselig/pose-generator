import { GoogleGenerativeAI } from '@google/generative-ai';
import { Character, Pose } from './types';

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  return new GoogleGenerativeAI(apiKey);
}

function buildCharacterPrompt(character: Character): string {
  const parts = [
    `Character: ${character.name}`,
    character.description && `Description: ${character.description}`,
    character.artStyle && `Art Style: ${character.artStyle}`,
    character.colorPalette.length > 0 && `Color Palette: ${character.colorPalette.join(', ')}`,
    character.costumeDetails && `Costume/Outfit: ${character.costumeDetails}`,
    character.accessories && `Accessories: ${character.accessories}`,
    character.bodyProportions && `Body Proportions: ${character.bodyProportions}`,
    character.personalityNotes && `Personality: ${character.personalityNotes}`,
  ].filter(Boolean);
  return parts.join('\n');
}

export async function generatePoseImage(
  character: Character,
  pose: Pose,
  canvasSize: { width: number; height: number },
  referenceImageBase64?: string
): Promise<string> {
  const client = getClient();

  const prompt = `Generate a single illustrated 2D character pose for a video game.

${buildCharacterPrompt(character)}

Pose: ${pose.displayName}
Pose Description: ${pose.description}
Use Case: ${pose.useCase}
${pose.prompt ? `Additional Regeneration Notes: ${pose.prompt}` : ''}

CRITICAL REQUIREMENTS FOR CONSISTENT SIZING:
- The character's BODY HEIGHT (head to feet in neutral standing) must always be exactly 70% of the canvas height (${Math.round(canvasSize.height * 0.7)} pixels tall)
- This body height stays CONSTANT across ALL poses — never scale the character up or down
- Extended limbs (raised arms, spread legs, weapons) may extend OUTSIDE the body height zone into the remaining 30% canvas space
- The character's feet/base must always align to the same baseline (bottom 15% of canvas)
- The top 15% of canvas is reserved as headroom for raised arms, jumps, or weapons
- Center the character horizontally on the canvas

RENDERING REQUIREMENTS:
- Transparent background (no background elements whatsoever)
- Consistent with the character description (same outfit, colors, proportions, face)
- Clean illustrated style suitable for a 2D game
- Full body visible, no cropping of the core body (extended weapons/effects may touch edges)
- Canvas size: ${canvasSize.width}x${canvasSize.height} pixels
- Static pose, not animated
- High quality, game-ready illustration
- Character should be readable at small sizes (clear silhouette)
- Anchor point: ${pose.anchor === 'bottom_center' ? 'feet centered at bottom baseline' : 'center of character'}

Generate ONLY the character in this pose with a transparent/empty background. No text, no UI, no labels.`;

  const model = client.getGenerativeModel({ 
    model: 'gemini-2.5-flash-image',
    generationConfig: {
      // @ts-expect-error - responseModalities not in types yet
      responseModalities: ['image', 'text'],
    },
  });

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
  ];

  if (referenceImageBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: referenceImageBase64,
      },
    });
    parts.push({
      text: 'Use the above reference image to maintain character consistency. Generate the new pose matching this character exactly.',
    });
  }

  const result = await model.generateContent(parts);
  const response = result.response;

  // Extract image from response
  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('No response from Gemini');
  }

  for (const part of candidates[0].content.parts) {
    if ('inlineData' in part && part.inlineData) {
      return part.inlineData.data;
    }
  }

  throw new Error('No image generated in response');
}

export async function generateMultiplePoses(
  character: Character,
  poses: Pose[],
  canvasSize: { width: number; height: number },
  referenceImageBase64?: string,
  onProgress?: (poseId: string, status: 'generating' | 'generated' | 'error', imageData?: string) => void
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // Generate sequentially to maintain consistency
  for (const pose of poses) {
    if (pose.locked && pose.imageData) {
      results.set(pose.id, pose.imageData);
      continue;
    }

    try {
      onProgress?.(pose.id, 'generating');
      const imageData = await generatePoseImage(character, pose, canvasSize, referenceImageBase64);
      results.set(pose.id, imageData);
      onProgress?.(pose.id, 'generated', imageData);
    } catch (error) {
      console.error(`Error generating pose ${pose.name}:`, error);
      onProgress?.(pose.id, 'error');
    }
  }

  return results;
}
