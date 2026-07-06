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

// One keyframe phase of a preset animation. The description is written for the
// image model: it names the leg/arm positions for that phase so the generated
// filmstrip reads as a real cycle instead of N near-identical drawings.
export interface AnimationFramePhase {
  index: number;
  label: string; // short human label, e.g. 'Contact (left lead)'
  description: string; // phase description injected into the filmstrip prompt
}

export interface AnimationPreset {
  id: string; // preset id, e.g. 'walk'
  action: string; // canonical action slug used for filenames + Godot anim name
  displayName: string;
  description: string;
  perspective?: PresetPerspective; // defaults to 'side'
  frameCount: number;
  fps: number;
  loop: boolean;
  canvasWidth: number;
  canvasHeight: number;
  frames: AnimationFramePhase[];
}

// Classic 8-drawing side-view walk cycle (two steps = one full loop). Phase order
// per step: Contact -> Down/recoil -> Passing -> Up/high-point, then the mirror
// for the opposite leg. Arms swing opposite the legs throughout. The character
// walks in place, faces screen-right, and keeps a constant scale + ground line so
// the sliced frames line up when looped.
export const WALK_CYCLE_PRESET: AnimationPreset = {
  id: 'walk',
  action: 'walk',
  displayName: 'Walk',
  description: 'Side-view 8-frame walk cycle, facing right, looping.',
  perspective: 'side',
  frameCount: 8,
  fps: 12,
  loop: true,
  canvasWidth: 512,
  canvasHeight: 512,
  frames: [
    { index: 0, label: 'Contact (left lead)', description: 'Contact pose: legs spread in a wide stride, LEFT foot forward with heel striking the ground, RIGHT foot back on its toe pushing off. Right arm swings forward, left arm swings back. Body at mid height.' },
    { index: 1, label: 'Down / recoil', description: 'Down pose (lowest point): weight drops onto the forward left leg which bends to absorb it, rear right foot lifting off. Body compressed to its lowest height. Arms near the body mid-swing.' },
    { index: 2, label: 'Passing', description: 'Passing pose: the rear right leg swings forward and passes directly under the body next to the straight standing left leg. Legs are close together, body rising. Arms roughly vertical at the sides.' },
    { index: 3, label: 'Up / high point', description: 'Up pose (highest point): the standing left leg straightens and pushes the body to its tallest, while the right leg reaches forward for the next step. Left arm swings forward, right arm back.' },
    { index: 4, label: 'Contact (right lead)', description: 'Contact pose, mirrored: legs spread in a wide stride, RIGHT foot forward with heel strike, LEFT foot back on its toe. Left arm swings forward, right arm back. Body at mid height.' },
    { index: 5, label: 'Down / recoil', description: 'Down pose (lowest point), mirrored: weight drops onto the forward right leg which bends, rear left foot lifting off. Body at its lowest. Arms near the body mid-swing.' },
    { index: 6, label: 'Passing', description: 'Passing pose, mirrored: the rear left leg swings forward and passes under the body next to the straight standing right leg. Legs close together, body rising. Arms roughly vertical.' },
    { index: 7, label: 'Up / high point', description: 'Up pose (highest point), mirrored: the standing right leg straightens and pushes the body tallest, left leg reaching forward. Right arm swings forward, left arm back.' },
  ],
};

export const ANIMATION_PRESETS: AnimationPreset[] = [WALK_CYCLE_PRESET];
