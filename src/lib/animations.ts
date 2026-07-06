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

// Slice a generated horizontal filmstrip into normalized frame PNGs.
//
// The image model ignores requested aspect ratios (it returns ~1024x1024) and
// draws a variable number of figures (asked 8, often draws 6-8) sitting in a
// horizontal band, NOT in full-height even columns. So we segment by CONTENT:
// find the figures via transparent gaps between them, then rescale every figure
// by one common factor and bottom-align it on a fixed ground line. This keeps
// character scale consistent and feet on a baseline so the frames loop cleanly,
// regardless of how many the model drew or where it placed them.
export async function sliceFilmstrip(
  stripBase64: string,
  canvasWidth: number,
  canvasHeight: number,
  expectedFrames = 8
): Promise<Buffer[]> {
  const sharp = (await import('sharp')).default;
  const input = Buffer.from(stripBase64, 'base64');
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (!width || !height) throw new Error('Filmstrip has no dimensions');

  // The model returns an OPAQUE ~1024x1024 image with a near-white background
  // (it ignores transparency + chroma-key requests). Remove the background by
  // flood-filling the connected near-white region inward from the borders: this
  // yields real alpha AND clean gaps between figures, while light colors enclosed
  // inside the character (e.g. a cream shirt) survive because they are not
  // border-connected.
  const npx = width * height;
  const alpha = new Uint8Array(npx).fill(255);
  const isBg = (i: number): boolean => {
    const o = i * channels;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    return mn >= 214 && mx - mn <= 22; // light + low saturation
  };
  const seen = new Uint8Array(npx);
  const stack: number[] = [];
  const visit = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (seen[i]) return;
    seen[i] = 1;
    if (isBg(i)) { alpha[i] = 0; stack.push(i); }
  };
  for (let x = 0; x < width; x++) { visit(x, 0); visit(x, height - 1); }
  for (let y = 0; y < height; y++) { visit(0, y); visit(width - 1, y); }
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % width, y = (i / width) | 0;
    visit(x + 1, y); visit(x - 1, y); visit(x, y + 1); visit(x, y - 1);
  }

  // Keyed RGBA buffer: original colors + computed alpha.
  const keyed = Buffer.alloc(npx * 4);
  for (let i = 0; i < npx; i++) {
    const o = i * channels;
    keyed[i * 4] = data[o];
    keyed[i * 4 + 1] = data[o + 1];
    keyed[i * 4 + 2] = data[o + 2];
    keyed[i * 4 + 3] = alpha[i];
  }
  const keyedPng = await sharp(keyed, { raw: { width, height, channels: 4 } }).png().toBuffer();

  // Column profile over the now-transparent image -> figure spans.
  const colHasContent: boolean[] = new Array(width).fill(false);
  const colTop: number[] = new Array(width).fill(Infinity);
  const colBot: number[] = new Array(width).fill(-1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] > 40) {
        colHasContent[x] = true;
        if (y < colTop[x]) colTop[x] = y;
        if (y > colBot[x]) colBot[x] = y;
      }
    }
  }

  // Group consecutive content columns into figures. Bridge tiny transparent gaps
  // (e.g. between an outstretched arm and the torso) and drop sliver noise.
  const minGap = Math.max(6, Math.round(width * 0.012));
  const minFigureWidth = Math.max(8, Math.round(width * 0.02));
  const spans: Array<{ x0: number; x1: number }> = [];
  let runStart = -1;
  let gap = 0;
  for (let x = 0; x < width; x++) {
    if (colHasContent[x]) {
      if (runStart === -1) runStart = x;
      gap = 0;
    } else if (runStart !== -1) {
      gap++;
      if (gap >= minGap) {
        spans.push({ x0: runStart, x1: x - gap });
        runStart = -1;
        gap = 0;
      }
    }
  }
  if (runStart !== -1) spans.push({ x0: runStart, x1: width - 1 });
  const figures = spans.filter(s => s.x1 - s.x0 + 1 >= minFigureWidth);

  // Turn spans into per-frame cells. Over-wide spans (two strides that overlapped
  // into one blob) are split into equal sub-frames using the median single-figure
  // width. If segmentation fails, fall back to an even N-column split.
  const cells: Array<{ x0: number; x1: number }> = [];
  if (figures.length >= 2 && figures.length <= 24) {
    const widths = figures.map(f => f.x1 - f.x0 + 1).sort((a, b) => a - b);
    const unit = widths[Math.floor(widths.length / 2)] || 1;
    for (const f of figures) {
      const w = f.x1 - f.x0 + 1;
      const n = Math.max(1, Math.min(4, Math.round(w / unit)));
      const sw = w / n;
      for (let k = 0; k < n; k++) {
        cells.push({ x0: Math.round(f.x0 + k * sw), x1: Math.round(f.x0 + (k + 1) * sw) - 1 });
      }
    }
  } else {
    const cellW = Math.floor(width / expectedFrames);
    for (let i = 0; i < expectedFrames; i++) {
      cells.push({ x0: i * cellW, x1: i === expectedFrames - 1 ? width - 1 : (i + 1) * cellW - 1 });
    }
  }

  const boxes: Array<{ left: number; top: number; width: number; height: number }> = [];
  for (const c of cells) {
    let top = Infinity;
    let bot = -1;
    for (let x = c.x0; x <= c.x1; x++) {
      if (colTop[x] < top) top = colTop[x];
      if (colBot[x] > bot) bot = colBot[x];
    }
    if (bot >= top) boxes.push({ left: c.x0, top, width: c.x1 - c.x0 + 1, height: bot - top + 1 });
  }
  if (boxes.length === 0) throw new Error('No frames detected in filmstrip');

  // One shared scale factor (from the tallest figure) preserves relative sizes so
  // the walk's up/down bob survives; feet bottom-align to a fixed ground line.
  const targetHeight = Math.round(canvasHeight * 0.82);
  const maxFigureHeight = Math.max(...boxes.map(b => b.height));
  const scale = targetHeight / maxFigureHeight;
  const baselinePad = Math.round(canvasHeight * 0.08);

  const frames: Buffer[] = [];
  for (const b of boxes) {
    const newW = Math.max(1, Math.round(b.width * scale));
    const newH = Math.max(1, Math.round(b.height * scale));
    const figure = await sharp(keyedPng)
      .extract({ left: b.left, top: b.top, width: b.width, height: b.height })
      .resize(newW, newH, { fit: 'fill' })
      .png()
      .toBuffer();

    const left = Math.round((canvasWidth - newW) / 2);
    const top = Math.max(0, canvasHeight - baselinePad - newH);
    const frame = await sharp({
      create: { width: canvasWidth, height: canvasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: figure, left: Math.max(0, left), top }])
      .png()
      .toBuffer();
    frames.push(frame);
  }
  return frames;
}
