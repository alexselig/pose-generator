import fs from 'fs';
import path from 'path';
import { AnimationClip } from './types';

const DATA_DIR = process.env.DATA_DIR || './data';
const ANIM_CLIPS_DIR = path.join(DATA_DIR, 'animations');
const ANIM_FRAMES_DIR = path.join(DATA_DIR, 'animation-frames');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Frames live under data/animation-frames/<charSlug>/<action>/frame_NN.png so a
// character can hold several clips and the pose images (data/images/...) stay
// untouched.
function frameDir(characterName: string, action: string): string {
  return path.join(ANIM_FRAMES_DIR, slugify(characterName), slugify(action));
}

export function frameFileName(index: number): string {
  return `frame_${String(index).padStart(2, '0')}.png`;
}

// Clip CRUD — the clip JSON never contains image base64 (frames carry only an
// imagePath), so the list/detail responses stay slim by construction.
export function getAnimationClips(characterId?: string): AnimationClip[] {
  ensureDir(ANIM_CLIPS_DIR);
  const files = fs.readdirSync(ANIM_CLIPS_DIR).filter(f => f.endsWith('.json'));
  let clips = files.map(f => JSON.parse(fs.readFileSync(path.join(ANIM_CLIPS_DIR, f), 'utf-8')) as AnimationClip);
  if (characterId) clips = clips.filter(c => c.characterId === characterId);
  return clips.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getAnimationClip(id: string): AnimationClip | null {
  const filePath = path.join(ANIM_CLIPS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AnimationClip;
}

export function getLatestAnimationClip(characterId: string, action?: string): AnimationClip | null {
  const clips = getAnimationClips(characterId);
  const filtered = action ? clips.filter(c => c.action === action) : clips;
  return filtered[0] || null;
}

export function saveAnimationClip(clip: AnimationClip): AnimationClip {
  ensureDir(ANIM_CLIPS_DIR);
  fs.writeFileSync(path.join(ANIM_CLIPS_DIR, `${clip.id}.json`), JSON.stringify(clip, null, 2));
  return clip;
}

// Frame image storage — the slicer hands us decoded PNG buffers.
export function saveAnimationFrame(characterName: string, action: string, index: number, image: Buffer): string {
  const dir = frameDir(characterName, action);
  ensureDir(dir);
  const filePath = path.join(dir, frameFileName(index));
  fs.writeFileSync(filePath, image);
  return filePath;
}

export function readAnimationFrame(characterName: string, action: string, index: number): Buffer | null {
  const filePath = path.join(frameDir(characterName, action), frameFileName(index));
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

// Slice a generated horizontal filmstrip into N frame PNGs. The image model does
// not honor requested pixel dimensions, so we derive the cell width from the
// ACTUAL strip width / N rather than assuming a fixed size. Each cell is resized
// (fit: contain, transparent pad) to the clip's canvas so every frame is the same
// size and the character keeps its relative position when the frames are looped.
export async function sliceFilmstrip(
  stripBase64: string,
  frameCount: number,
  canvasWidth: number,
  canvasHeight: number
): Promise<Buffer[]> {
  const sharp = (await import('sharp')).default;
  const input = Buffer.from(stripBase64, 'base64');
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error('Filmstrip has no dimensions');

  const cellWidth = Math.floor(width / frameCount);
  if (cellWidth <= 0) throw new Error(`Filmstrip too narrow (${width}px) for ${frameCount} frames`);

  const frames: Buffer[] = [];
  for (let i = 0; i < frameCount; i++) {
    const left = i * cellWidth;
    // Last cell takes the remainder so rounding never drops edge pixels.
    const w = i === frameCount - 1 ? width - left : cellWidth;
    const frame = await sharp(input)
      .extract({ left, top: 0, width: w, height })
      .resize(canvasWidth, canvasHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    frames.push(frame);
  }
  return frames;
}
