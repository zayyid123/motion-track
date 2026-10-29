import { z } from 'zod';
import { PALETTES, VIEWS } from '@/lib/funIsometric/fun';
import type { Icon, Layer, Palette, View } from '@/lib/funIsometric/fun';

export const PROJECT_VERSION = 2;
export const PROJECT_DRAFT_KEY = 'motion_track_project_v2';

export interface StudioDoc {
  icon: Icon;
  paletteId: string;
  palette: Palette;
  facing: View;
  outlineWidth: number;
}

const viewSchema = z.enum(['right', 'left', 'front', 'flat']);

const shapeSchema = z.looseObject({
  d: z.unknown(),
  fill: z.string().optional(),
  line: z.union([z.boolean(), z.number()]).optional(),
  depth: z.number().optional(),
  side: z.string().optional(),
  edges: z.array(z.tuple([z.number(), z.number()])).optional(),
  crease: z.boolean().optional(),
  round: z.boolean().optional(),
  trim: z.unknown().optional(),
});

const layerSchema = z.looseObject({
  id: z.string().optional(),
  name: z.string().optional(),
  isGroup: z.boolean().optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  groupId: z.string().optional(),
  isGroupLeader: z.boolean().optional(),
  motionPreset: z.string().optional(),
  clip: z.string().optional(),
  a: z.tuple([z.number(), z.number()]).optional(),
  p: z.unknown().optional(),
  r: z.unknown().optional(),
  s: z.unknown().optional(),
  o: z.unknown().optional(),
  line: z.number().optional(),
  tilt: z.tuple([z.number(), z.number()]).optional(),
  tiltFromView: z.boolean().optional(),
  ip: z.number().optional(),
  op: z.number().optional(),
  m: z.unknown().optional(),
  shapes: z.array(shapeSchema),
});

const iconSchema = z.looseObject({
  name: z.string(),
  frames: z.number().int().positive(),
  size: z.number().positive().optional(),
  line: z.number().optional(),
  ink: z.string().optional(),
  extrude: z.unknown().optional(),
  still: z.number().optional(),
  layers: z.array(layerSchema),
});

const paletteSchema = z.looseObject({
  main: z.string(),
  gold: z.string(),
  tint: z.string(),
  ok: z.string(),
  hot: z.string(),
  deep: z.string(),
  white: z.string(),
  grey: z.string(),
  paper: z.string(),
  ink: z.string(),
});

const projectFileSchema = z.looseObject({
  version: z.literal(PROJECT_VERSION),
  icon: iconSchema,
  paletteId: z.string(),
  palette: paletteSchema,
  facing: viewSchema,
  outlineWidth: z.number().min(0).max(40),
  savedAt: z.string().optional(),
});

export interface ParseSuccess {
  ok: true;
  doc: StudioDoc;
}
export interface ParseFailure {
  ok: false;
  error: string;
}
export type ParseResult = ParseSuccess | ParseFailure;

const loosePalette = (input?: Partial<Palette>): Palette => ({ ...PALETTES.slush, ...(input ?? {}) });

/**
 * Serializes the editor document with a stable schema envelope. The envelope is
 * what makes future migrations possible; the raw icon is never dumped at the root.
 */
export function serializeProject(doc: StudioDoc): string {
  return JSON.stringify(
    {
      version: PROJECT_VERSION,
      icon: doc.icon,
      paletteId: doc.paletteId,
      palette: doc.palette,
      facing: doc.facing,
      outlineWidth: doc.outlineWidth,
      savedAt: new Date().toISOString(),
    },
    null,
    2
  );
}

/**
 * Accepts v2 project files and migrates legacy files (a bare `Icon` JSON, which
 * is what previous versions of the studio downloaded) into the v2 shape.
 */
export function parseProject(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Project file is empty or malformed.' };
  }

  const record = parsed as Record<string, unknown>;

  if (record.version === PROJECT_VERSION) {
    const result = projectFileSchema.safeParse(record);
    if (!result.success) {
      return { ok: false, error: `Invalid project file: ${result.error.issues[0]?.message ?? 'unknown error'}` };
    }
    return {
      ok: true,
      doc: {
        icon: result.data.icon as unknown as Icon,
        paletteId: result.data.paletteId,
        palette: loosePalette(result.data.palette),
        facing: result.data.facing,
        outlineWidth: result.data.outlineWidth,
      },
    };
  }

  // v2 draft written by an intermediate build, or a wrapped legacy icon.
  const wrapped = record.icon;
  const rawIcon = wrapped && typeof wrapped === 'object' ? wrapped : record;

  const iconResult = iconSchema.safeParse(rawIcon);
  if (!iconResult.success) {
    return { ok: false, error: 'Unrecognized project format. Expected a Motion-Track project or icon JSON.' };
  }

  const icon = iconResult.data as unknown as Icon;
  const facing = viewSchema.safeParse(record.facing).success ? (record.facing as View) : 'right';
  const outlineWidth =
    typeof record.outlineWidth === 'number' ? record.outlineWidth : typeof icon.line === 'number' ? icon.line : 5;

  return {
    ok: true,
    doc: {
      icon,
      paletteId: typeof record.paletteId === 'string' ? record.paletteId : 'slush',
      palette: loosePalette(record.palette as Partial<Palette> | undefined),
      facing,
      outlineWidth,
    },
  };
}

export function readProjectDraft(): StudioDoc | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PROJECT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = parseProject(raw);
    return parsed.ok ? parsed.doc : null;
  } catch {
    return null;
  }
}

export function writeProjectDraft(doc: StudioDoc): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROJECT_DRAFT_KEY, serializeProject(doc));
  } catch {
    // Draft autosave is best-effort; the project can still be downloaded as JSON.
  }
}

export function clearProjectDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PROJECT_DRAFT_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

export const DEFAULT_FACING: View = 'right';
export const DEFAULT_OUTLINE = 5;
export const DEFAULT_PALETTE_ID = 'slush';

export function defaultTiltFor(view: View): readonly [number, number] {
  return VIEWS[view].tilt;
}

export type { Layer };
