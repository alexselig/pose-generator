import { GoogleGenerativeAI } from '@google/generative-ai';
import { Character, Pose, PresetPerspective } from './types';

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  return new GoogleGenerativeAI(apiKey);
}

// Detect image MIME type from the leading bytes of a base64 string so that
// non-PNG references (JPEG/WebP/GIF) are sent to Gemini with the correct type.
// Upload handlers strip the data-URL prefix, so the type must be inferred here.
export function detectImageMimeType(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
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

// The camera + sizing rules differ sharply by viewpoint. Side/front views frame
// the character head-to-feet with a ground baseline; top-down views look straight
// down, so the character is seen from above (crown of head + shoulders) and is
// centered both axes with no baseline. Keeping these separate is what makes the
// top-down preset actually render overhead poses instead of standing side views.
function buildLayoutSection(
  perspective: PresetPerspective,
  canvasSize: { width: number; height: number }
): string {
  if (perspective === 'top_down') {
    return `CAMERA / VIEWPOINT (CRITICAL — THIS IS THE SINGLE MOST IMPORTANT INSTRUCTION, OVERRIDES ANY DEFAULT):
- Render the character as a TOP-DOWN game sprite seen from a steep HIGH ANGLE looking DOWN on them from above, exactly how characters look in top-down games like The Legend of Zelda: A Link to the Past, RPG Maker, Enter the Gungeon, or Hotline Miami.
- The camera floats ABOVE the character, tilted down roughly 70 degrees. The TOP/CROWN of the head and the tops of the shoulders are the largest, nearest shapes. The head sits high and the body is strongly FORESHORTENED/compressed beneath it.
- You should barely see the face: it is tucked under the head and pointed down/away. Do NOT draw a clear, eye-level, front-facing face looking at the viewer.
- Layout of the body from this angle: rounded top-of-head at the top, shoulders splayed out just below it, arms coming off the sides, torso short and compressed, and the feet appear as small shapes poking out near the bottom.
- This is NOT an eye-level portrait and NOT a side view. If the character looks like it is simply standing and facing the camera at eye level, the result is WRONG and must be redone as an overhead view.
- Facing direction is along the ground plane: the neutral Idle points toward the BOTTOM of the canvas ("south"); other poses orient across the ground, not up/down against gravity.

CONSISTENT SIZING (TOP-DOWN):
- Center the character BOTH horizontally and vertically on the canvas — there is NO ground baseline and NO reserved headroom.
- The character spans about 65% of the canvas height (${Math.round(canvasSize.height * 0.65)} pixels) along its longest visible axis, and this scale stays CONSTANT across ALL poses — never scale up or down.
- Extended limbs, weapons, or spell effects may reach into the surrounding margin, but the body's scale and center never change.`;
  }
  return `CRITICAL REQUIREMENTS FOR CONSISTENT SIZING:
- The character's BODY HEIGHT (head to feet in neutral standing) must always be exactly 70% of the canvas height (${Math.round(canvasSize.height * 0.7)} pixels tall)
- This body height stays CONSTANT across ALL poses — never scale the character up or down
- Extended limbs (raised arms, spread legs, weapons) may extend OUTSIDE the body height zone into the remaining 30% canvas space
- The character's feet/base must always align to the same baseline (bottom 15% of canvas)
- The top 15% of canvas is reserved as headroom for raised arms, jumps, or weapons
- Center the character horizontally on the canvas`;
}

export async function generatePoseImage(
  character: Character,
  pose: Pose,
  canvasSize: { width: number; height: number },
  referenceImageBase64?: string,
  perspective: PresetPerspective = 'side'
): Promise<string> {
  const client = getClient();

  const topDown = perspective === 'top_down';

  // nano-banana copies the composition of an attached image very strongly, so a
  // front-facing reference portrait drags top-down renders back to an eye-level
  // view (verified: with-ref top-down kept coming out front-facing). For top-down
  // we therefore drive identity from the rich text description instead of the
  // reference image — the face is barely visible overhead anyway, and outfit,
  // colors, accessories, and silhouette (all in the text) carry the identity.
  const useReferenceImage = referenceImageBase64 && !topDown;

  const referenceSection = useReferenceImage
    ? `\nIDENTITY LOCK (CRITICAL — a reference image of this exact character is attached above):
- Reproduce the SAME character shown in the reference image: identical face, hairstyle, skin tone, outfit, color palette, accessories, and body proportions.
- Do NOT redesign, restyle, age, or reinterpret the character — only the POSE may change.
- The reference image is authoritative: if any detail below conflicts with it, follow the image.
`
    : topDown
      ? `\nIDENTITY LOCK (CRITICAL — match the character described below):
- Reproduce this EXACT character: same outfit, color palette, accessories, hairstyle/head, and body proportions from the description.
- Do NOT invent a different character or restyle them — only the pose and the (top-down) camera define the framing.
`
      : '';

  const prompt = topDown
    ? `Generate a single illustrated 2D character sprite for a TOP-DOWN (overhead) video game.

${buildLayoutSection(perspective, canvasSize)}
${referenceSection}
CHARACTER (identity — keep outfit, colors, accessories, hair, and proportions; but IGNORE any front-only facial-expression details below, since from a top-down angle the face is mostly hidden):
${buildCharacterPrompt(character)}

Pose: ${pose.displayName}
Pose Description: ${pose.description}
Use Case: ${pose.useCase}
${pose.prompt ? `Additional Regeneration Notes: ${pose.prompt}` : ''}

RENDERING REQUIREMENTS:
- Transparent background (no background elements whatsoever)
- Same outfit, colors, accessories, and proportions as the character description
- Clean illustrated style suitable for a 2D game
- Whole character visible from the overhead high angle, no cropping of the core body (extended weapons/effects may touch edges)
- Canvas size: ${canvasSize.width}x${canvasSize.height} pixels
- Static pose, not animated
- High quality, game-ready illustration; readable at small sizes
- Anchor point: center of character (overhead sprites are center-anchored)

Reminder: this MUST be the steep top-down high-angle view described above (crown of head prominent, face hidden/foreshortened, body compressed) — NOT an eye-level front view.
Generate ONLY the character in this top-down overhead pose with a transparent/empty background. No text, no UI, no labels.`
    : `Generate a single illustrated 2D character pose for a video game.
${referenceSection}
${buildCharacterPrompt(character)}

Pose: ${pose.displayName}
Pose Description: ${pose.description}
Use Case: ${pose.useCase}
${pose.prompt ? `Additional Regeneration Notes: ${pose.prompt}` : ''}

${buildLayoutSection(perspective, canvasSize)}

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

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // Present the reference image FIRST so it strongly anchors the character's
  // identity, then follow with the detailed pose prompt. Part ordering matters
  // for image models — a buried reference gets under-weighted. Skipped for
  // top-down (see useReferenceImage above): the front-facing portrait would drag
  // the render back to eye-level.
  if (useReferenceImage) {
    parts.push({
      text: 'Reference image of the character (canonical appearance). Keep the character identical to this image and change only the pose:',
    });
    parts.push({
      inlineData: {
        mimeType: detectImageMimeType(referenceImageBase64 as string),
        data: referenceImageBase64 as string,
      },
    });
  }

  parts.push({ text: prompt });

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
  onProgress?: (poseId: string, status: 'generating' | 'generated' | 'error', imageData?: string) => void,
  perspective: PresetPerspective = 'side'
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
      const imageData = await generatePoseImage(character, pose, canvasSize, referenceImageBase64, perspective);
      results.set(pose.id, imageData);
      onProgress?.(pose.id, 'generated', imageData);
    } catch (error) {
      console.error(`Error generating pose ${pose.name}:`, error);
      onProgress?.(pose.id, 'error');
    }
  }

  return results;
}
