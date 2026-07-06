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

// Remove any existing frame_NN.png before a (re)generation. The model draws a
// variable frame count, so a shorter re-gen would otherwise leave orphaned tail
// frames on disk that the frame route could still serve (they're cached
// immutably). Clearing first keeps the on-disk set == the clip's real frames.
export function clearAnimationFrames(characterName: string, action: string): void {
  const dir = frameDir(characterName, action);
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (/^frame_\d+\.png$/.test(f)) fs.rmSync(path.join(dir, f));
  }
}

export function readAnimationFrame(characterName: string, action: string, index: number): Buffer | null {
  const filePath = path.join(frameDir(characterName, action), frameFileName(index));
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

// Slice a generated horizontal filmstrip into normalized frame PNGs.
//
// The model returns an OPAQUE ~1024x1024 image with a variable number of figures
// (asked 8, often draws 6-8) packed close together in a horizontal band. We (1)
// flood-fill the near-white background to real alpha, (2) segment figures by
// connected components of character "ink" (robust to close spacing and to light
// character parts), then (3) rescale every figure by one shared factor and
// bottom-align it on a fixed ground line so the frames loop cleanly.
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
    return mn >= 232 && mx - mn <= 18; // only near-white, low saturation (spare cream)
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

  // SEGMENTATION by connected components of character "ink" (saturated or dark
  // pixels). This is robust both to light character parts (a near-white cream
  // shirt the background key would fragment) AND to figures the model packs close
  // together, which column-gap slicing merges into blobs. Each character is a
  // connected blob; components that heavily x-overlap (a figure's detached parts,
  // e.g. a held tool) merge into one figure.
  const inkMask = new Uint8Array(npx);
  for (let i = 0; i < npx; i++) {
    const o = i * channels;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn > 28 || mx < 205) inkMask[i] = 1; // colorful OR dark = character
  }

  // Label 4-connected components, tracking area + bbox.
  const label = new Int32Array(npx);
  const ccStack: number[] = [];
  const comps: Array<{ area: number; minx: number; maxx: number; miny: number; maxy: number }> = [];
  let cur = 0;
  for (let s = 0; s < npx; s++) {
    if (!inkMask[s] || label[s]) continue;
    cur++;
    let area = 0, minx = width, maxx = 0, miny = height, maxy = 0;
    ccStack.push(s);
    label[s] = cur;
    while (ccStack.length) {
      const i = ccStack.pop() as number;
      const x = i % width, y = (i / width) | 0;
      area++;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
      if (x + 1 < width && inkMask[i + 1] && !label[i + 1]) { label[i + 1] = cur; ccStack.push(i + 1); }
      if (x - 1 >= 0 && inkMask[i - 1] && !label[i - 1]) { label[i - 1] = cur; ccStack.push(i - 1); }
      if (y + 1 < height && inkMask[i + width] && !label[i + width]) { label[i + width] = cur; ccStack.push(i + width); }
      if (y - 1 >= 0 && inkMask[i - width] && !label[i - width]) { label[i - width] = cur; ccStack.push(i - width); }
    }
    comps.push({ area, minx, maxx, miny, maxy });
  }

  // Keep significant components (drop specks).
  const minArea = Math.round(npx * 0.0004);
  const bigComps = comps.filter(c => c.area >= minArea);

  // Group components into ROWS. gemini-2.5-flash-image frequently lays the frames
  // out as a GRID (e.g. 4x2) inside a ~square image instead of the requested single
  // row, so we must NOT merge vertically-stacked figures — doing so produced frames
  // that each contained two characters. Two components share a row when their
  // vertical spans overlap by more than half of the shorter span.
  const rows: Array<{ miny: number; maxy: number; comps: typeof comps }> = [];
  for (const c of [...bigComps].sort((a, b) => (a.miny + a.maxy) - (b.miny + b.maxy))) {
    const ch = c.maxy - c.miny + 1;
    let placed = false;
    for (const row of rows) {
      const ov = Math.min(c.maxy, row.maxy) - Math.max(c.miny, row.miny) + 1;
      if (ov > 0.5 * Math.min(ch, row.maxy - row.miny + 1)) {
        row.comps.push(c);
        row.miny = Math.min(row.miny, c.miny);
        row.maxy = Math.max(row.maxy, c.maxy);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push({ miny: c.miny, maxy: c.maxy, comps: [c] });
  }
  rows.sort((a, b) => a.miny - b.miny);

  // Within each row: left→right, merging components that x-overlap > 40% of the
  // smaller (a single figure's detached parts, e.g. a raised arm or a held item).
  // Frames then read in grid order — each row left→right, rows top→bottom.
  const boxes: Array<{ left: number; top: number; width: number; height: number }> = [];
  for (const row of rows) {
    const rowBoxes: Array<{ left: number; top: number; width: number; height: number }> = [];
    for (const c of row.comps.sort((a, b) => a.minx - b.minx)) {
      const cw = c.maxx - c.minx + 1;
      let merged = false;
      for (const f of rowBoxes) {
        const overlap = Math.min(c.maxx, f.left + f.width - 1) - Math.max(c.minx, f.left) + 1;
        if (overlap > 0.4 * Math.min(cw, f.width)) {
          const nx0 = Math.min(f.left, c.minx);
          const nx1 = Math.max(f.left + f.width - 1, c.maxx);
          const ny0 = Math.min(f.top, c.miny);
          const ny1 = Math.max(f.top + f.height - 1, c.maxy);
          f.left = nx0; f.width = nx1 - nx0 + 1; f.top = ny0; f.height = ny1 - ny0 + 1;
          merged = true;
          break;
        }
      }
      if (!merged) rowBoxes.push({ left: c.minx, top: c.miny, width: cw, height: c.maxy - c.miny + 1 });
    }
    rowBoxes.sort((a, b) => a.left - b.left);
    boxes.push(...rowBoxes);
  }

  // Fallback: if nothing usable was found, even-split by the expected count.
  if (boxes.length === 0) {
    const cellW = Math.floor(width / expectedFrames);
    for (let i = 0; i < expectedFrames; i++) {
      const left = i * cellW;
      boxes.push({ left, top: 0, width: i === expectedFrames - 1 ? width - left : cellW, height });
    }
  }

  // One shared scale keeps every figure the same size (preserves the walk bob),
  // clamped so the widest figure still fits the canvas; feet bottom-align to a
  // fixed ground line.
  const targetHeight = Math.round(canvasHeight * 0.82);
  const maxFigureHeight = Math.max(...boxes.map(b => b.height));
  const maxFigureWidth = Math.max(...boxes.map(b => b.width));
  const scale = Math.min(targetHeight / maxFigureHeight, (canvasWidth * 0.96) / maxFigureWidth);
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
