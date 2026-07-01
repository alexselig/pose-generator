import { Character, PoseSet, GodotManifest } from './types';
import JSZip from 'jszip';
import { getPoseImage } from './storage';

export interface ExportOptions {
  prefix?: string;
  canvasSize?: number;
  anchor?: 'bottom_center' | 'center' | 'top_center';
  includePoseSheet?: boolean;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function generateManifest(character: Character, poseSet: PoseSet, options: ExportOptions = {}): GodotManifest {
  const charSlug = options.prefix || slugify(character.name);
  const canvasSize = options.canvasSize || poseSet.canvasWidth;
  const anchor = options.anchor || 'bottom_center';

  return {
    character_name: character.name,
    asset_type: 'static_pose_set',
    engine: 'Godot',
    canvas_size: `${canvasSize}x${canvasSize}`,
    anchor,
    poses: poseSet.poses
      .filter(p => p.status === 'approved' || p.status === 'generated')
      .map(p => ({
        name: p.name,
        file: `${charSlug}_${p.name}.png`,
        anchor,
        locked: p.locked,
        use_case: p.useCase,
      })),
  };
}

export async function exportGodotPackage(
  character: Character,
  poseSet: PoseSet,
  options: ExportOptions = {}
): Promise<Buffer> {
  const zip = new JSZip();
  const charSlug = options.prefix || slugify(character.name);
  const folder = zip.folder(`characters/${charSlug}`)!;
  const canvasSize = options.canvasSize || poseSet.canvasWidth || 512;
  const sharp = (await import('sharp')).default;

  const approvedPoses = poseSet.poses.filter(
    p => p.status === 'approved' || p.status === 'generated'
  );

  // Add individual pose PNGs, resized to the selected canvas so the exported
  // assets actually match the CANVAS SIZE control and the manifest (generated
  // images can be 1024px; shipping them verbatim broke consistent sizing).
  for (const pose of approvedPoses) {
    const imageData = pose.imageData || getPoseImage(character.id, pose.name);
    if (imageData) {
      const fileName = `${charSlug}_${pose.name}.png`;
      try {
        const resized = await sharp(Buffer.from(imageData, 'base64'))
          .resize(canvasSize, canvasSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        folder.file(fileName, resized);
      } catch {
        folder.file(fileName, imageData, { base64: true });
      }
    }
  }

  // Generate and add manifest
  const manifest = generateManifest(character, poseSet, options);
  folder.file(`${charSlug}_manifest.json`, JSON.stringify(manifest, null, 2));

  // Generate pose sheet if we have images
  const poseSheetData = options.includePoseSheet === false ? null : await generatePoseSheet(
    character,
    poseSet,
    options.canvasSize || poseSet.canvasWidth
  );
  if (poseSheetData) {
    folder.file(`${charSlug}_pose_sheet.png`, poseSheetData, { base64: true });
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return buffer;
}

async function generatePoseSheet(
  character: Character,
  poseSet: PoseSet,
  canvasSize: number
): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default;
    const approvedPoses = poseSet.poses.filter(
      p => (p.status === 'approved' || p.status === 'generated') && (p.imageData || getPoseImage(character.id, p.name))
    );

    if (approvedPoses.length === 0) return null;

    const cols = Math.ceil(Math.sqrt(approvedPoses.length));
    const rows = Math.ceil(approvedPoses.length / cols);
    const cellWidth = canvasSize;
    const cellHeight = canvasSize;
    const sheetWidth = cols * cellWidth;
    const sheetHeight = rows * cellHeight;

    const composites: { input: Buffer; left: number; top: number }[] = [];

    for (let i = 0; i < approvedPoses.length; i++) {
      const pose = approvedPoses[i];
      const imageData = pose.imageData || getPoseImage(character.id, pose.name);
      if (!imageData) continue;

      const col = i % cols;
      const row = Math.floor(i / cols);
      const buffer = Buffer.from(imageData, 'base64');
      const resized = await sharp(buffer)
        .resize(cellWidth, cellHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      composites.push({
        input: resized,
        left: col * cellWidth,
        top: row * cellHeight,
      });
    }

    const sheet = await sharp({
      create: {
        width: sheetWidth,
        height: sheetHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();

    return sheet.toString('base64');
  } catch (error) {
    console.error('Error generating pose sheet:', error);
    return null;
  }
}
