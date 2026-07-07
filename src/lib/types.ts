export interface Character {
  id: string;
  name: string;
  description: string;
  artStyle: string;
  colorPalette: string[];
  costumeDetails: string;
  accessories: string;
  bodyProportions: string;
  personalityNotes: string;
  referenceImages: string[]; // base64 or file paths
  approvedReferencePose?: string;
  group?: string; // optional group/collection name; empty means ungrouped
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface Pose {
  id: string;
  characterId: string;
  name: string;
  displayName: string;
  description: string;
  useCase: string;
  prompt?: string;
  imageData?: string; // base64 PNG
  imagePath?: string;
  status: 'pending' | 'generating' | 'generated' | 'approved' | 'rejected';
  anchor: 'bottom_center' | 'center' | 'top_center';
  issues?: string[];
  locked: boolean;
  generatedAt?: string;
}

export type PresetPerspective = 'side' | 'top_down';

export interface PoseSet {
  id: string;
  characterId: string;
  characterName: string;
  preset: string;
  perspective?: PresetPerspective; // camera viewpoint; defaults to 'side'
  poses: Pose[];
  canvasWidth: number;
  canvasHeight: number;
  status: 'in_progress' | 'done';
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
}

export interface GodotManifest {
  character_name: string;
  asset_type: 'static_pose_set';
  engine: 'Godot';
  canvas_size: string;
  anchor: Pose['anchor'];
  poses: {
    name: string;
    file: string;
    anchor: string;
    locked: boolean;
    use_case: string;
  }[];
}

export interface GamePreset {
  id: string;
  name: string;
  description: string;
  /** Camera viewpoint the poses are drawn from. Defaults to 'side' when omitted. */
  perspective?: PresetPerspective;
  poses: { name: string; displayName: string; description: string; useCase: string }[];
  canvasWidth: number;
  canvasHeight: number;
}

export const GAME_PRESETS: GamePreset[] = [
  {
    id: 'platformer',
    name: 'Platformer',
    description: 'Side-scrolling platformer character poses',
    canvasWidth: 512,
    canvasHeight: 512,
    poses: [
      { name: 'idle', displayName: 'Idle', description: 'Relaxed standing pose', useCase: 'default standing pose' },
      { name: 'walk', displayName: 'Walk Stance', description: 'Mid-stride walking pose', useCase: 'walking movement' },
      { name: 'run', displayName: 'Run Stance', description: 'Dynamic running pose', useCase: 'running movement' },
      { name: 'jump', displayName: 'Jump', description: 'Leaping upward pose', useCase: 'jump action' },
      { name: 'fall', displayName: 'Fall', description: 'Falling through air pose', useCase: 'falling state' },
      { name: 'land', displayName: 'Land', description: 'Landing impact pose', useCase: 'landing recovery' },
      { name: 'attack', displayName: 'Attack', description: 'Basic attack swing', useCase: 'combat action' },
      { name: 'hurt', displayName: 'Hurt', description: 'Taking damage reaction', useCase: 'damage feedback' },
      { name: 'death', displayName: 'Death', description: 'Defeated collapse pose', useCase: 'game over state' },
    ],
  },
  {
    id: 'rpg',
    name: 'RPG / Adventure',
    description: 'Role-playing game character poses',
    canvasWidth: 512,
    canvasHeight: 512,
    poses: [
      { name: 'idle', displayName: 'Idle', description: 'Relaxed standing pose', useCase: 'default standing pose' },
      { name: 'walk', displayName: 'Walk Stance', description: 'Mid-stride walking pose', useCase: 'walking movement' },
      { name: 'attack', displayName: 'Attack', description: 'Melee attack pose', useCase: 'combat action' },
      { name: 'heavy_attack', displayName: 'Heavy Attack', description: 'Powerful overhead strike', useCase: 'heavy combat action' },
      { name: 'block', displayName: 'Block', description: 'Defensive shield pose', useCase: 'blocking stance' },
      { name: 'dodge', displayName: 'Dodge', description: 'Evasive roll/sidestep', useCase: 'dodge action' },
      { name: 'cast_spell', displayName: 'Cast Spell', description: 'Magic casting pose', useCase: 'spell casting' },
      { name: 'hurt', displayName: 'Hurt', description: 'Taking damage reaction', useCase: 'damage feedback' },
      { name: 'death', displayName: 'Death', description: 'Defeated collapse', useCase: 'game over state' },
      { name: 'victory', displayName: 'Victory', description: 'Triumphant celebration', useCase: 'win state' },
      { name: 'talk', displayName: 'Talk', description: 'Conversation gesture', useCase: 'dialogue state' },
      { name: 'interact', displayName: 'Interact', description: 'Reaching/grabbing pose', useCase: 'object interaction' },
      { name: 'pick_up', displayName: 'Pick Up Item', description: 'Bending to collect item', useCase: 'item pickup' },
    ],
  },
  {
    id: 'fighting',
    name: 'Fighting Game',
    description: 'Fighting game character poses',
    canvasWidth: 512,
    canvasHeight: 512,
    poses: [
      { name: 'idle', displayName: 'Idle', description: 'Fighting stance', useCase: 'default fighting stance' },
      { name: 'walk_forward', displayName: 'Walk Forward', description: 'Advancing step', useCase: 'forward movement' },
      { name: 'walk_back', displayName: 'Walk Back', description: 'Retreating step', useCase: 'backward movement' },
      { name: 'light_punch', displayName: 'Light Punch', description: 'Quick jab', useCase: 'light attack' },
      { name: 'heavy_punch', displayName: 'Heavy Punch', description: 'Powerful haymaker', useCase: 'heavy attack' },
      { name: 'light_kick', displayName: 'Light Kick', description: 'Quick kick', useCase: 'light kick attack' },
      { name: 'heavy_kick', displayName: 'Heavy Kick', description: 'Roundhouse kick', useCase: 'heavy kick attack' },
      { name: 'block', displayName: 'Block', description: 'Guard stance', useCase: 'blocking' },
      { name: 'crouch', displayName: 'Crouch', description: 'Low stance', useCase: 'crouching state' },
      { name: 'jump', displayName: 'Jump', description: 'Airborne pose', useCase: 'jump state' },
      { name: 'hurt', displayName: 'Hurt', description: 'Hit reaction', useCase: 'damage state' },
      { name: 'knockdown', displayName: 'Knockdown', description: 'Knocked to ground', useCase: 'knockdown state' },
      { name: 'victory', displayName: 'Victory', description: 'Win pose', useCase: 'round win' },
    ],
  },
  {
    id: 'topdown',
    name: 'Top-Down',
    description: 'Top-down view game character poses',
    perspective: 'top_down',
    canvasWidth: 512,
    canvasHeight: 512,
    poses: [
      { name: 'idle', displayName: 'Idle', description: 'Standing at rest, seen from directly overhead, facing toward the bottom of the frame', useCase: 'default pose' },
      { name: 'walk', displayName: 'Walk', description: 'Mid-stride walk cycle seen from overhead, legs scissored along the ground', useCase: 'movement' },
      { name: 'attack', displayName: 'Attack', description: 'Weapon swing arcing across the ground, viewed from above', useCase: 'combat' },
      { name: 'cast', displayName: 'Cast', description: 'Spell casting with arms extended outward, viewed from above', useCase: 'magic' },
      { name: 'hurt', displayName: 'Hurt', description: 'Recoiling from a hit, viewed from above', useCase: 'hit feedback' },
      { name: 'death', displayName: 'Death', description: 'Collapsed flat on the ground, sprawled, viewed from above', useCase: 'death state' },
      { name: 'interact', displayName: 'Interact', description: 'Reaching out to use an object, viewed from above', useCase: 'interaction' },
    ],
  },
];

// ── Animations ───────────────────────────────────────────────────────────────
// A clip is a short looping animation (e.g. a walk cycle) made of N frames. Each
// frame is one drawing; frames are stored as individual PNGs on disk and served
// by URL, and the clip JSON stays slim (no inlined base64), matching the pose
// storage/serving convention.

export interface AnimationFrame {
  index: number; // 0-based position within the cycle
  imagePath?: string; // sliced frame written to data/animations/<slug>/<action>/frame_NN.png
  status: 'pending' | 'generated';
}

export interface AnimationClip {
  id: string;
  characterId: string;
  characterName: string;
  action: string; // canonical slug, e.g. 'walk'
  displayName: string; // e.g. 'Walk'
  perspective: PresetPerspective; // camera viewpoint; MVP ships 'side'
  frameCount: number;
  fps: number; // playback speed for preview + Godot SpriteFrames
  loop: boolean;
  canvasWidth: number;
  canvasHeight: number;
  frames: AnimationFrame[];
  status: 'pending' | 'generating' | 'generated' | 'failed';
  createdAt: string;
  updatedAt: string;
}

// Per-action motion metadata. Instead of hand-authoring keyframes (which made the
// model flip the character's facing), we give the model the character's actual
// pose image as the reference plus a short MOTION description for the action, and
// enforce a hard "same facing every frame" constraint in the prompt.
export interface AnimationSpec {
  action: string; // canonical slug, matches the pose name (e.g. 'walk', 'jump')
  displayName: string;
  perspective: PresetPerspective;
  frameCount: number;
  fps: number;
  loop: boolean;
  canvasWidth: number;
  canvasHeight: number;
  motion: string; // how the pose moves, injected into the filmstrip prompt
}

interface MotionDef {
  motion: string;
  displayName?: string;
  frameCount?: number;
  fps?: number;
  loop?: boolean;
}

const DEFAULT_MOTION: MotionDef = {
  motion: 'a short, natural animation that brings this pose to life with subtle looping motion of the limbs and body.',
  frameCount: 6,
  fps: 12,
  loop: true,
};

// Keyed by pose/action slug. Cyclic actions loop; one-shots (attack, jump, hurt…)
// don't. Motion text describes ONLY the limb/body movement — facing/scale/ground
// line are locked by the prompt.
export const ANIMATION_MOTIONS: Record<string, MotionDef> = {
  idle: { motion: 'a subtle idle breathing loop — a gentle up-and-down bob of the chest and shoulders with a slight weight shift; feet stay planted.', frameCount: 6, fps: 8 },
  walk: { motion: 'a smooth walk cycle — the legs alternate through contact, low point, passing, and high point while the arms swing in opposition; the character strides in place.', frameCount: 8 },
  walk_forward: { motion: 'a forward walk cycle — legs alternate through a full stride while the arms swing in opposition; the character strides in place.', frameCount: 8 },
  forward: { motion: 'a forward walk cycle — legs alternate through a full stride while the arms swing in opposition; the character strides in place.', frameCount: 8 },
  walk_back: { motion: 'a backward walk cycle — the legs step in reverse through a full stride while the character keeps the same facing.', frameCount: 8 },
  run: { motion: 'a fast run cycle — long strides with the body leaning into the run, legs cycling quickly and arms pumping.', frameCount: 8 },
  jump: { motion: 'a jump — an anticipation crouch, an explosive push-off, an airborne apex with legs tucked and arms up, then a landing crouch.', frameCount: 6, loop: false },
  fall: { motion: 'a falling loop — arms and legs bracing and flailing slightly as the character drops.', frameCount: 4 },
  land: { motion: 'a landing impact — from airborne down into a deep absorbing crouch and back up to stance.', frameCount: 4, loop: false },
  crouch: { motion: 'a crouch loop — lowering into a low crouch with a subtle idle bob while staying low.', frameCount: 4 },
  attack: { motion: 'a melee attack — a wind-up, the strike thrusting forward, then recovery to stance.', frameCount: 6, loop: false },
  heavy_attack: { motion: 'a heavy overhead attack — a big wind-up, a powerful downward strike, and a slow recovery.', frameCount: 6, loop: false },
  punch: { motion: 'a quick jab — the fist snaps forward with a small body twist and retracts to guard.', frameCount: 4, loop: false },
  light_punch: { motion: 'a quick jab — the fist snaps forward and retracts to guard.', frameCount: 4, loop: false },
  heavy_punch: { motion: 'a heavy punch — the fist winds back, drives forward with the whole body behind it, then recovers.', frameCount: 5, loop: false },
  kick: { motion: 'a quick kick — the leg snaps forward and returns to stance.', frameCount: 4, loop: false },
  light_kick: { motion: 'a quick kick — the leg snaps forward and returns to stance.', frameCount: 4, loop: false },
  heavy_kick: { motion: 'a roundhouse kick — the leg swings up and around with the hips, then returns to stance.', frameCount: 5, loop: false },
  block: { motion: 'a block — the arms/guard raise into a defensive brace and settle.', frameCount: 4 },
  dodge: { motion: 'a dodge — a quick sidestep and lean away, then back to stance.', frameCount: 4, loop: false },
  cast: { motion: 'a spell cast — gathering energy, the arms sweeping forward to release it, then settling.', frameCount: 6, loop: false },
  cast_spell: { motion: 'a spell cast — gathering energy, the arms sweeping forward to release it, then settling.', frameCount: 6, loop: false },
  hurt: { motion: 'a hit reaction — the body recoils backward from an impact and returns to stance.', frameCount: 4, loop: false },
  death: { motion: 'a defeat — the character staggers and collapses to the ground.', frameCount: 5, loop: false },
  knockdown: { motion: 'a knockdown — the character is knocked off balance and falls to the ground.', frameCount: 5, loop: false },
  victory: { motion: 'a victory celebration loop — an energetic triumphant gesture with a little bounce, arms raised.', frameCount: 6 },
  talk: { motion: 'a talking loop — subtle head and hand gestures as if speaking.', frameCount: 4, fps: 8 },
  interact: { motion: 'an interaction — reaching out to use or grab something and returning upright.', frameCount: 5, loop: false },
  pick_up: { motion: 'a pick-up — bending down to collect an item and straightening back up.', frameCount: 5, loop: false },
  point: { motion: 'a pointing gesture loop — the arm extends to point with subtle idle motion.', frameCount: 4 },
  up: { motion: 'a reaching-up gesture loop — the arm raises with a subtle bob.', frameCount: 4 },
};

function titleCase(slug: string): string {
  return slug.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Resolve an AnimationSpec for any action slug, using known motion metadata or a
// sensible default. displayName defaults to the pose's title-cased name.
export function getAnimationSpec(action: string, displayName?: string): AnimationSpec {
  const key = action.toLowerCase().trim();
  const def = ANIMATION_MOTIONS[key] || DEFAULT_MOTION;
  return {
    action: key,
    displayName: displayName || def.displayName || titleCase(key),
    perspective: 'side',
    frameCount: def.frameCount ?? 6,
    fps: def.fps ?? 12,
    loop: def.loop ?? true,
    canvasWidth: 512,
    canvasHeight: 512,
    motion: def.motion,
  };
}

// The default, human-readable animation description for an action, used to
// pre-fill the (editable) prompt box so users get a good animation by default
// without having to write a prompt themselves.
export function getAnimationPrompt(action: string): string {
  const key = action.toLowerCase().trim();
  return (ANIMATION_MOTIONS[key] || DEFAULT_MOTION).motion;
}
