export type ViewDirection = 'right' | 'left' | 'front' | 'flat';

export type MotionPresetType =
  | 'hop'
  | 'bounce'
  | 'wiggle'
  | 'toss'
  | 'jolt'
  | 'clasp'
  | 'wobble'
  | 'drift'
  | 'twist'
  | 'press'
  | 'sway'
  | 'float'
  | 'bob'
  | 'twinkle'
  | 'glint'
  | 'sparkle';

export type RoleColorKey =
  | 'main'
  | 'gold'
  | 'tint'
  | 'ok'
  | 'hot'
  | 'deep'
  | 'white'
  | 'grey'
  | 'paper'
  | 'ink';

export interface Palette {
  id: string;
  name: string;
  colors: Record<RoleColorKey, string>;
}

export type ShapeType = 'slab-rect' | 'slab-circle' | 'polygon' | 'spark' | 'pencil-body' | 'pencil-tip' | 'paper-sheet';

export interface StickerLayer {
  id: string;
  name: string;
  shapeType: ShapeType;
  visible: boolean;
  locked: boolean;
  x: number; // Center offset in 500x500
  y: number;
  width: number;
  height: number;
  depth: number; // Slab thickness
  rotation: number;
  fillRole: RoleColorKey;
  sideColorRole?: RoleColorKey;
  outlineRole?: RoleColorKey;
  outlineWidth: number;
  parentId?: string;
  customHex?: string; // Custom fill color hex
  customSideHex?: string; // Custom shadow / side slab color hex
  customOutlineHex?: string; // Custom border / outline color hex
  points?: [number, number][]; // for polygon or custom points
}

export interface MotionConfig {
  preset: MotionPresetType;
  speed: number; // 0.5 to 2.0 (default 1.0)
  intensity: number; // 0.2 to 2.0 (default 1.0)
  loop: boolean;
}

export interface StickerProject {
  version: number;
  name: string;
  facing: ViewDirection;
  paletteId: string;
  customPalette?: Partial<Record<RoleColorKey, string>>;
  layers: StickerLayer[];
  motion: MotionConfig;
  canvasBg: string | null; // null = transparent
}

export interface AISettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
  timestamp: number;
}
