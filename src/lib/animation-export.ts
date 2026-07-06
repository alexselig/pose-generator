import { AnimationClip } from './types';
import JSZip from 'jszip';
import { readAnimationFrame } from './animations';

export interface AnimationExportOptions {
  prefix?: string;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function frameFileName(prefix: string, action: string, index: number): string {
  return `${prefix}_${action}_${String(index).padStart(2, '0')}.png`;
}

// Godot 4 SpriteFrames resource (.tres). Extract the pack into the Godot project
// root so the res:// paths resolve, then drop the .tres onto an AnimatedSprite2D.
function buildSpriteFramesTres(clip: AnimationClip, prefix: string, resDir: string): string {
  const n = clip.frameCount;
  const extResources: string[] = [];
  const frameEntries: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = String(i + 1);
    const file = frameFileName(prefix, clip.action, i);
    extResources.push(`[ext_resource type="Texture2D" path="${resDir}/${file}" id="${id}"]`);
    frameEntries.push(`{\n"duration": 1.0,\n"texture": ExtResource("${id}")\n}`);
  }
  return `[gd_resource type="SpriteFrames" load_steps=${n + 1} format=3]

${extResources.join('\n')}

[resource]
animations = [{
"frames": [${frameEntries.join(', ')}],
"loop": ${clip.loop ? 'true' : 'false'},
"name": &"${clip.action}",
"speed": ${clip.fps.toFixed(1)}
}]
`;
}

// Horizontal sprite sheet: N frames side by side, each canvasWidth x canvasHeight.
async function buildSpriteSheet(frames: Buffer[], canvasWidth: number, canvasHeight: number): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const composites = frames.map((input, i) => ({ input, left: i * canvasWidth, top: 0 }));
  return sharp({
    create: {
      width: canvasWidth * frames.length,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

// Build the downloadable Godot asset pack for one animation clip: individual
// transparent frame PNGs, a horizontal sprite sheet, a ready-to-use SpriteFrames
// .tres, and a manifest.
export async function exportAnimationPackage(
  clip: AnimationClip,
  options: AnimationExportOptions = {}
): Promise<Buffer> {
  const prefix = options.prefix || slugify(clip.characterName);
  const zip = new JSZip();
  const folderPath = `characters/${prefix}/${clip.action}`;
  const folder = zip.folder(folderPath)!;

  const frames: Buffer[] = [];
  for (let i = 0; i < clip.frameCount; i++) {
    const buf = readAnimationFrame(clip.characterName, clip.action, i);
    if (!buf) continue;
    frames.push(buf);
    folder.file(frameFileName(prefix, clip.action, i), buf);
  }

  if (frames.length === 0) {
    throw new Error('No frames to export');
  }

  const sheet = await buildSpriteSheet(frames, clip.canvasWidth, clip.canvasHeight);
  folder.file(`${prefix}_${clip.action}_sheet.png`, sheet);

  const resDir = `res://${folderPath}`;
  folder.file(`${prefix}_${clip.action}.tres`, buildSpriteFramesTres(clip, prefix, resDir));

  const manifest = {
    character_name: clip.characterName,
    asset_type: 'animation_set',
    engine: 'Godot',
    action: clip.action,
    fps: clip.fps,
    loop: clip.loop,
    frame_count: frames.length,
    canvas_size: `${clip.canvasWidth}x${clip.canvasHeight}`,
    sprite_frames: `${prefix}_${clip.action}.tres`,
    sprite_sheet: `${prefix}_${clip.action}_sheet.png`,
    frames: frames.map((_, i) => frameFileName(prefix, clip.action, i)),
  };
  folder.file(`${prefix}_${clip.action}_manifest.json`, JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: 'nodebuffer' });
}
