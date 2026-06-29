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

export interface PoseSet {
  id: string;
  characterId: string;
  characterName: string;
  preset: string;
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
    canvasWidth: 512,
    canvasHeight: 512,
    poses: [
      { name: 'idle', displayName: 'Idle', description: 'Standing facing down', useCase: 'default pose' },
      { name: 'walk', displayName: 'Walk', description: 'Walking stride', useCase: 'movement' },
      { name: 'attack', displayName: 'Attack', description: 'Swing attack', useCase: 'combat' },
      { name: 'cast', displayName: 'Cast', description: 'Spell casting', useCase: 'magic' },
      { name: 'hurt', displayName: 'Hurt', description: 'Damage reaction', useCase: 'hit feedback' },
      { name: 'death', displayName: 'Death', description: 'Collapsed', useCase: 'death state' },
      { name: 'interact', displayName: 'Interact', description: 'Using object', useCase: 'interaction' },
    ],
  },
];
