import fs from 'fs';
import path from 'path';
import { Scene } from './types';

const DATA_DIR = process.env.DATA_DIR || './data';
const SCENES_DIR = path.join(DATA_DIR, 'scenes');
const SCENE_IMAGES_DIR = path.join(SCENES_DIR, 'images');
const SCENE_VIDEOS_DIR = path.join(SCENES_DIR, 'videos');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Scene JSON never contains image base64 (the render lives on disk), so list/detail
// responses stay slim — matching the pose/animation storage convention.
export function getScenes(): Scene[] {
  ensureDir(SCENES_DIR);
  const files = fs.readdirSync(SCENES_DIR).filter(f => f.endsWith('.json'));
  return files
    .map(f => JSON.parse(fs.readFileSync(path.join(SCENES_DIR, f), 'utf-8')) as Scene)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getScene(id: string): Scene | null {
  const filePath = path.join(SCENES_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Scene;
}

export function saveScene(scene: Scene): Scene {
  ensureDir(SCENES_DIR);
  fs.writeFileSync(path.join(SCENES_DIR, `${scene.id}.json`), JSON.stringify(scene, null, 2));
  return scene;
}

export function deleteScene(id: string): boolean {
  const filePath = path.join(SCENES_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.rmSync(filePath);
  const img = path.join(SCENE_IMAGES_DIR, `${id}.png`);
  if (fs.existsSync(img)) fs.rmSync(img);
  const vid = path.join(SCENE_VIDEOS_DIR, `${id}.mp4`);
  if (fs.existsSync(vid)) fs.rmSync(vid);
  return true;
}

export function saveSceneImage(id: string, image: Buffer): string {
  ensureDir(SCENE_IMAGES_DIR);
  const filePath = path.join(SCENE_IMAGES_DIR, `${id}.png`);
  fs.writeFileSync(filePath, image);
  return filePath;
}

export function readSceneImage(id: string): Buffer | null {
  const filePath = path.join(SCENE_IMAGES_DIR, `${id}.png`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

export function saveSceneVideo(id: string, video: Buffer): string {
  ensureDir(SCENE_VIDEOS_DIR);
  const filePath = path.join(SCENE_VIDEOS_DIR, `${id}.mp4`);
  fs.writeFileSync(filePath, video);
  return filePath;
}

export function readSceneVideo(id: string): Buffer | null {
  const filePath = path.join(SCENE_VIDEOS_DIR, `${id}.mp4`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}
