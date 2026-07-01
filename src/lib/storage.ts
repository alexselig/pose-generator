import fs from 'fs';
import path from 'path';
import { Character, Pose, PoseSet } from './types';

const DATA_DIR = process.env.DATA_DIR || './data';
const CHARACTERS_DIR = path.join(DATA_DIR, 'characters');
const POSES_DIR = path.join(DATA_DIR, 'poses');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Slugify a name for file/folder naming
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Get character folder path (named by character)
function characterImageDir(characterName: string): string {
  return path.join(IMAGES_DIR, slugify(characterName));
}

// Build filename: charactername_posename.png
function poseFileName(characterName: string, poseName: string): string {
  return `${slugify(characterName)}_${slugify(poseName)}.png`;
}

// Build archive filename: charactername_posename_archive_N.png
function poseArchiveFileName(characterName: string, poseName: string, num: number): string {
  return `${slugify(characterName)}_${slugify(poseName)}_archive_${num}.png`;
}

// Character operations
export function getCharacters(): Character[] {
  ensureDir(CHARACTERS_DIR);
  const files = fs.readdirSync(CHARACTERS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const data = fs.readFileSync(path.join(CHARACTERS_DIR, f), 'utf-8');
    return JSON.parse(data) as Character;
  }).sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getCharacter(id: string): Character | null {
  const filePath = path.join(CHARACTERS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function saveCharacter(character: Character): Character {
  ensureDir(CHARACTERS_DIR);
  const filePath = path.join(CHARACTERS_DIR, `${character.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(character, null, 2));
  return character;
}

export function deleteCharacter(id: string): boolean {
  return archiveCharacter(id);
}

export function archiveCharacter(id: string): boolean {
  const filePath = path.join(CHARACTERS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return false;
  const character = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Character;
  character.archived = true;
  character.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(character, null, 2));
  return true;
}

export function hardDeleteCharacter(id: string): boolean {
  const filePath = path.join(CHARACTERS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return false;

  // Clean up associated pose sets
  const poseSets = getPoseSets(id);
  for (const ps of poseSets) {
    const psPath = path.join(POSES_DIR, `${ps.id}.json`);
    if (fs.existsSync(psPath)) fs.unlinkSync(psPath);
  }

  // Clean up images directory
  const character = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Character;
  const imageDir = characterImageDir(character.name);
  if (fs.existsSync(imageDir)) {
    fs.rmSync(imageDir, { recursive: true, force: true });
  }

  fs.unlinkSync(filePath);
  return true;
}

export function duplicateCharacter(id: string, newId: string): Character | null {
  const original = getCharacter(id);
  if (!original) return null;
  const duplicate: Character = {
    ...original,
    id: newId,
    name: `${original.name} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return saveCharacter(duplicate);
}

// Pose Set operations
export function getPoseSets(characterId?: string): PoseSet[] {
  ensureDir(POSES_DIR);
  const files = fs.readdirSync(POSES_DIR).filter(f => f.endsWith('.json'));
  let sets = files.map(f => {
    const data = fs.readFileSync(path.join(POSES_DIR, f), 'utf-8');
    return JSON.parse(data) as PoseSet;
  });
  if (characterId) {
    sets = sets.filter(s => s.characterId === characterId);
  }
  return sets.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getPoseSet(id: string): PoseSet | null {
  const filePath = path.join(POSES_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function getLatestPoseSet(characterId: string): PoseSet | null {
  const sets = getPoseSets(characterId);
  return sets[0] || null;
}

// Build a synthetic pose set that merges the generated poses from ALL of a
// character's pose sets. Newest set wins on pose-name conflicts, matching the
// gallery and export UI (which merge across sets). Without this, exports and
// manifests only reflected the most recent pose set and silently dropped every
// pose generated in earlier sets.
export function getMergedPoseSet(characterId: string): PoseSet | null {
  const sets = getPoseSets(characterId); // newest first (updatedAt desc)
  if (sets.length === 0) return null;

  const byName = new Map<string, Pose>();
  for (const set of sets) {
    for (const pose of set.poses) {
      if ((pose.status === 'generated' || pose.status === 'approved') && !byName.has(pose.name)) {
        byName.set(pose.name, pose);
      }
    }
  }

  const latest = sets[0];
  // Fall back to the latest set's poses if none are marked generated/approved
  // (e.g. a set still mid-generation) so export never returns an empty pack.
  const poses = byName.size > 0 ? Array.from(byName.values()) : latest.poses;
  return { ...latest, poses };
}

export function savePoseSet(poseSet: PoseSet): PoseSet {
  ensureDir(POSES_DIR);
  const filePath = path.join(POSES_DIR, `${poseSet.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(poseSet, null, 2));
  return poseSet;
}

// Image storage — files named as charactername_posename.png inside data/images/charactername/
export function savePoseImage(characterId: string, poseName: string, imageData: string): string {
  const character = getCharacter(characterId);
  const charName = character?.name || characterId;
  const imageDir = characterImageDir(charName);
  ensureDir(imageDir);
  const fileName = poseFileName(charName, poseName);
  const filePath = path.join(imageDir, fileName);

  // Archive existing image if it exists
  if (fs.existsSync(filePath)) {
    archivePoseImage(characterId, poseName);
  }

  const buffer = Buffer.from(imageData, 'base64');
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// Archive a pose image before overwriting with a new version
export function archivePoseImage(characterId: string, poseName: string): void {
  const character = getCharacter(characterId);
  const charName = character?.name || characterId;
  const imageDir = characterImageDir(charName);
  const fileName = poseFileName(charName, poseName);
  const currentPath = path.join(imageDir, fileName);
  if (!fs.existsSync(currentPath)) return;

  // Find next archive number
  let archiveNum = 1;
  while (fs.existsSync(path.join(imageDir, poseArchiveFileName(charName, poseName, archiveNum)))) {
    archiveNum++;
  }

  const archivePath = path.join(imageDir, poseArchiveFileName(charName, poseName, archiveNum));
  fs.copyFileSync(currentPath, archivePath);
}

export function getPoseImage(characterId: string, poseName: string): string | null {
  const character = getCharacter(characterId);
  const charName = character?.name || characterId;
  const imageDir = characterImageDir(charName);
  const fileName = poseFileName(charName, poseName);
  const filePath = path.join(imageDir, fileName);
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return buffer.toString('base64');
}

// Get all archived versions of a pose
export function getPoseArchives(characterId: string, poseName: string): string[] {
  const character = getCharacter(characterId);
  const charName = character?.name || characterId;
  const imageDir = characterImageDir(charName);
  if (!fs.existsSync(imageDir)) return [];

  const prefix = `${slugify(charName)}_${slugify(poseName)}_archive_`;
  const files = fs.readdirSync(imageDir);
  return files
    .filter(f => f.startsWith(prefix) && f.endsWith('.png'))
    .sort()
    .map(f => {
      const buffer = fs.readFileSync(path.join(imageDir, f));
      return buffer.toString('base64');
    });
}

// Finalize a pose set - persist all images to disk and mark as done
export function finalizePoseSet(poseSetId: string): PoseSet | null {
  const poseSet = getPoseSet(poseSetId);
  if (!poseSet) return null;

  const character = getCharacter(poseSet.characterId);
  const charName = character?.name || poseSet.characterName;
  const imageDir = characterImageDir(charName);
  ensureDir(imageDir);

  // Save all pose images to disk
  for (const pose of poseSet.poses) {
    if (pose.imageData) {
      const fileName = poseFileName(charName, pose.name);
      const filePath = path.join(imageDir, fileName);
      if (!fs.existsSync(filePath)) {
        const buffer = Buffer.from(pose.imageData, 'base64');
        fs.writeFileSync(filePath, buffer);
      }
      pose.imagePath = filePath;
    }
  }

  poseSet.status = 'done';
  poseSet.finalizedAt = new Date().toISOString();
  poseSet.updatedAt = new Date().toISOString();

  // Save the pose set JSON without inline image data
  const slimSet = {
    ...poseSet,
    poses: poseSet.poses.map(p => ({ ...p, imageData: undefined })),
  };
  ensureDir(POSES_DIR);
  const filePath = path.join(POSES_DIR, `${poseSet.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(slimSet, null, 2));

  return poseSet;
}

// Get the image directory for a character
export function getCharacterOutputDir(characterId: string): string {
  const character = getCharacter(characterId);
  const charName = character?.name || characterId;
  return characterImageDir(charName);
}

// List all images on disk for a character
export function listCharacterImages(characterId: string): { name: string; path: string; isArchive: boolean }[] {
  const character = getCharacter(characterId);
  const charName = character?.name || characterId;
  const imageDir = characterImageDir(charName);
  if (!fs.existsSync(imageDir)) return [];

  return fs.readdirSync(imageDir)
    .filter(f => f.endsWith('.png'))
    .map(f => ({
      name: f,
      path: path.join(imageDir, f),
      isArchive: f.includes('_archive_'),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Get the filename for a character's pose (for URL building)
export function getPoseFileName(characterId: string, poseName: string): string {
  const character = getCharacter(characterId);
  const charName = character?.name || characterId;
  return poseFileName(charName, poseName);
}

// Get the folder name for a character
export function getCharacterFolderName(characterId: string): string {
  const character = getCharacter(characterId);
  const charName = character?.name || characterId;
  return slugify(charName);
}

export function saveReferenceImage(characterId: string, index: number, imageData: string): string {
  const imageDir = path.join(DATA_DIR, 'references', characterId);
  ensureDir(imageDir);
  const fileName = `reference_${index}.png`;
  const filePath = path.join(imageDir, fileName);
  const buffer = Buffer.from(imageData, 'base64');
  fs.writeFileSync(filePath, buffer);
  return filePath;
}
