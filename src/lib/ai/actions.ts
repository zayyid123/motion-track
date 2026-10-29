import { z } from 'zod';
import { at, ellipse, ensureLayerIds, PALETTES, pill, rect, ring, scene, spark, star, VIEWS } from '@/lib/funIsometric/fun';
import type { Icon, Layer, Palette, View } from '@/lib/funIsometric/fun';
import type { Bounds } from '@/lib/geometry/bounds';
import { createMotion, isMotionPresetId } from '@/lib/funIsometric/presets';
import { getTemplate, TEMPLATE_IDS } from '@/lib/funIsometric/library';
import type { StudioDoc } from '@/lib/projectFile';
const ROLE = z.enum(['main', 'gold', 'tint', 'ok', 'hot', 'deep', 'white', 'grey', 'paper', 'ink']);
const FACE = z.enum(['right', 'left', 'front', 'flat']);
const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a #rrggbb hex value.');

/**
 * Lenient numeric field. LLMs occasionally emit numbers as strings ("120") or a
 * stray value in an optional cosmetic field. Coercing and falling back to
 * `undefined` means one bad field can no longer invalidate an entire composed
 * layer (which previously dropped the whole action with a "Skipped" report).
 */
const looseNumber = z.coerce.number().optional().catch(undefined);
const rangedNumber = (min: number, max: number) =>
  z.coerce.number().min(min).max(max).optional().catch(undefined);

/**
 * `line` mirrors the engine's `Shape.line`: `false` hides the outline, `true`
 * uses the icon's default width, and a number sets an explicit outline width.
 */
const lineField = z
  .preprocess((value) => {
    if (typeof value === 'string') {
      const lower = value.trim().toLowerCase();
      if (lower === 'true') return true;
      if (lower === 'false') return false;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    }
    return value;
  }, z.union([z.boolean(), z.number().min(0).max(40)]))
  .optional()
  .catch(undefined);

/** Boolean flag that also accepts "true"/"false" strings and 0/1 numbers. */
const boolField = z
  .preprocess((value) => {
    if (typeof value === 'string') {
      const lower = value.trim().toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }
    if (typeof value === 'number') return value !== 0;
    return value;
  }, z.boolean())
  .optional()
  .catch(undefined);

/**
 * One drawable piece inside a layer. Primitives are built from width/height;
 * `path` + `viewBox` injects arbitrary SVG geometry so the AI can draw detailed,
 * illustrative artwork (bulb glass, filament, ribs) instead of plain boxes.
 */
export const shapeSpecSchema = z.object({
  shape: z.enum(['rect', 'circle', 'spark', 'star', 'pill', 'ring', 'arch', 'path']).optional().catch(undefined),
  path: z.string().min(1).optional().catch(undefined),
  viewBox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional().catch(undefined),
  width: rangedNumber(1, 2000),
  height: rangedNumber(1, 2000),
  /** Band thickness in px for the `arch` shape; ignored by other shapes. */
  thickness: rangedNumber(1, 400),
  dx: looseNumber,
  dy: looseNumber,
  dx2: looseNumber,
  dy2: looseNumber,
  fill: ROLE.optional().catch(undefined),
  depth: rangedNumber(-5, 10),
  line: lineField,
  round: rangedNumber(0, 400),
});

export type ShapeSpec = z.infer<typeof shapeSpecSchema>;

const shapesField = z.array(shapeSpecSchema).min(1).max(60).optional();

const pair = z.tuple([z.coerce.number(), z.coerce.number()]).optional().catch(undefined);

const updateLayer = z.object({
  type: z.literal('update_layer'),
  layerId: z.string().min(1),
  name: z.string().min(1).max(60).optional(),
  position: pair,
  rotation: looseNumber,
  scale: pair,
  opacity: rangedNumber(0, 100),
  tilt: pair,
  hidden: boolField,
  locked: boolField,
  motionPreset: z.string().min(1).optional(),
  fill: ROLE.optional().catch(undefined),
  depth: rangedNumber(-5, 10),
  /** Per-layer ink outline width in px (overrides the project default). */
  outline: rangedNumber(0, 40),
});

const addLayer = z.object({
  type: z.literal('add_layer'),
  shape: z.enum(['rect', 'circle', 'spark', 'star', 'pill', 'ring', 'arch']).optional().catch(undefined),
  name: z.string().min(1).max(60).optional(),
  width: rangedNumber(4, 1000),
  height: rangedNumber(4, 1000),
  position: pair,
  rotation: looseNumber,
  scale: pair,
  opacity: rangedNumber(0, 100),
  fill: ROLE.optional().catch(undefined),
  depth: rangedNumber(-5, 10),
  /** Per-layer ink outline width in px (overrides the project default). */
  outline: rangedNumber(0, 40),
  motionPreset: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
  /** Composite artwork: overrides `shape` and draws several pieces in one layer. */
  shapes: shapesField,
});

export const aiActionSchema = z.discriminatedUnion('type', [
  updateLayer,
  addLayer,
  z.object({
    type: z.literal('create_group'),
    id: z.string().min(1).max(60).optional(),
    name: z.string().min(1).max(60).optional(),
    motionPreset: z.string().min(1).optional(),
    position: pair,
    outline: rangedNumber(0, 40),
  }),
  z.object({
    type: z.literal('insert_template'),
    /** Designed sticker id or name, e.g. "headphones", "padlock", "coins". */
    name: z.string().min(1).max(60),
    paletteId: z.string().min(1).optional(),
    facing: FACE.optional(),
  }),
  z.object({ type: z.literal('clear_layers') }),
  z.object({ type: z.literal('add_shapes'), layerId: z.string().min(1), shapes: shapesField }),
  z.object({ type: z.literal('delete_layer'), layerId: z.string().min(1) }),
  z.object({ type: z.literal('select_layer'), layerId: z.string().min(1) }),
  z.object({ type: z.literal('set_palette'), paletteId: z.string().min(1) }),
  z.object({ type: z.literal('set_palette_color'), role: ROLE, color: HEX }),
  z.object({ type: z.literal('set_outline'), width: z.number().min(0).max(40) }),
  z.object({ type: z.literal('set_facing'), facing: FACE }),
  z.object({ type: z.literal('rename_project'), name: z.string().min(1).max(80) }),
]);

export type AIAction = z.infer<typeof aiActionSchema>;

export interface ParsedAIResponse {
  reply: string;
  actions: AIAction[];
  warnings: string[];
}

export interface AIApplyResult {
  doc: StudioDoc;
  applied: string[];
  skipped: string[];
  changed: boolean;
  /** Set when an action explicitly selected a layer. */
  selectedLayerId?: string | null;
  /** Layers removed by this batch, so the caller can clear a stale selection. */
  removed: string[];
}

export type AIApplyOutcome = Pick<AIApplyResult, 'applied' | 'skipped' | 'changed'>;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const round = (value: number): number => Math.round(value * 100) / 100;
const labelOf = (layer: Layer): string => layer.name ?? layer.id ?? 'layer';

/** Lowercases a label into a stable, referenceable layer id slug. */
const slugify = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'group';

/** "headphones" -> "Headphones"; used to name inserted library stickers. */
const prettyTemplateName = (slug: string): string =>
  slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

/** Structured deep clone with a JSON fallback; library icons are shared constants. */
const deepClone = <T>(value: T): T =>
  typeof structuredClone === 'function' ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T);

/** Samples an SVG endpoint-arc into points so bounds capture its bulge. */
function arcPoints(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  rotation: number,
  largeArc: number,
  sweep: number,
  x2: number,
  y2: number,
  push: (x: number, y: number) => void
): void {
  push(x1, y1);
  push(x2, y2);
  if (rx === 0 || ry === 0) return;
  const phi = (rotation * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;
  let rx2 = rx;
  let ry2 = ry;
  const lambda = (x1p * x1p) / (rx2 * rx2) + (y1p * y1p) / (ry2 * ry2);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx2 *= s;
    ry2 *= s;
  }
  const num = rx2 * rx2 * ry2 * ry2 - rx2 * rx2 * y1p * y1p - ry2 * ry2 * x1p * x1p;
  const den = rx2 * rx2 * y1p * y1p + ry2 * ry2 * x1p * x1p;
  const sign = largeArc !== sweep ? 1 : -1;
  const coef = den === 0 ? 0 : sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * (rx2 * y1p)) / ry2;
  const cyp = (-coef * (ry2 * x1p)) / rx2;
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    const a = Math.acos(Math.min(1, Math.max(-1, len === 0 ? 1 : dot / len)));
    return ux * vy - uy * vx < 0 ? -a : a;
  };
  const theta1 = angle(1, 0, (x1p - cxp) / rx2, (y1p - cyp) / ry2);
  let dTheta = angle((x1p - cxp) / rx2, (y1p - cyp) / ry2, (-x1p - cxp) / rx2, (-y1p - cyp) / ry2);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  else if (sweep && dTheta < 0) dTheta += 2 * Math.PI;
  const steps = 24;
  for (let s = 0; s <= steps; s += 1) {
    const t = theta1 + (dTheta * s) / steps;
    push(cx + cosPhi * rx2 * Math.cos(t) - sinPhi * ry2 * Math.sin(t), cy + sinPhi * rx2 * Math.cos(t) + cosPhi * ry2 * Math.sin(t));
  }
}

/** DOM-free bounds for an SVG path string (handles lines, curves and arcs). */
function pathBoundsNumeric(d: string): Bounds | null {
  const tokens = d.match(PATH_TOKEN);
  if (!tokens || !tokens.length) return null;
  let i = 0;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const push = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  const num = (): number => {
    const value = Number(tokens[i++]);
    return Number.isFinite(value) ? value : 0;
  };

  while (i < tokens.length) {
    if (isPathCommand(tokens[i])) cmd = tokens[i++];
    if (!cmd) break;
    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;

    if (upper === 'Z') {
      cx = sx;
      cy = sy;
      cmd = '';
      continue;
    }
    if (upper === 'M') {
      const x = rel ? cx + num() : num();
      const y = rel ? cy + num() : num();
      cx = x;
      cy = y;
      sx = x;
      sy = y;
      push(cx, cy);
      cmd = rel ? 'l' : 'L';
      continue;
    }
    if (upper === 'L') {
      cx = rel ? cx + num() : num();
      cy = rel ? cy + num() : num();
      push(cx, cy);
      continue;
    }
    if (upper === 'H') {
      cx = rel ? cx + num() : num();
      push(cx, cy);
      continue;
    }
    if (upper === 'V') {
      cy = rel ? cy + num() : num();
      push(cx, cy);
      continue;
    }
    if (upper === 'C') {
      const x1 = rel ? cx + num() : num();
      const y1 = rel ? cy + num() : num();
      const x2 = rel ? cx + num() : num();
      const y2 = rel ? cy + num() : num();
      cx = rel ? cx + num() : num();
      cy = rel ? cy + num() : num();
      push(x1, y1);
      push(x2, y2);
      push(cx, cy);
      continue;
    }
    if (upper === 'S') {
      const x2 = rel ? cx + num() : num();
      const y2 = rel ? cy + num() : num();
      cx = rel ? cx + num() : num();
      cy = rel ? cy + num() : num();
      push(x2, y2);
      push(cx, cy);
      continue;
    }
    if (upper === 'Q') {
      const x1 = rel ? cx + num() : num();
      const y1 = rel ? cy + num() : num();
      cx = rel ? cx + num() : num();
      cy = rel ? cy + num() : num();
      push(x1, y1);
      push(cx, cy);
      continue;
    }
    if (upper === 'T') {
      cx = rel ? cx + num() : num();
      cy = rel ? cy + num() : num();
      push(cx, cy);
      continue;
    }
    if (upper === 'A') {
      const rx = Math.abs(num());
      const ry = Math.abs(num());
      const rot = num();
      const large = num() ? 1 : 0;
      const sweep = num() ? 1 : 0;
      const ex = rel ? cx + num() : num();
      const ey = rel ? cy + num() : num();
      arcPoints(cx, cy, rx, ry, rot, large, sweep, ex, ey, push);
      cx = ex;
      cy = ey;
      continue;
    }
    while (i < tokens.length && !isPathCommand(tokens[i])) i += 1;
    cmd = '';
  }

  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

const unionBounds = (a: Bounds, b: Bounds): Bounds => ({
  minX: Math.min(a.minX, b.minX),
  minY: Math.min(a.minY, b.minY),
  maxX: Math.max(a.maxX, b.maxX),
  maxY: Math.max(a.maxY, b.maxY),
});

/** World-space bounds of every rendered shape in the icon at frame 0. */
export function compositionBounds(icon: Icon): Bounds | null {
  const sc = scene(icon, 0);
  const extrude = at(icon.extrude ?? [0, 0], sc.f);
  let union: Bounds | null = null;

  for (const part of sc.parts) {
    let local: Bounds | null = null;
    for (const shape of part.L.shapes) {
      const d = at(shape.d, sc.f);
      if (typeof d !== 'string') continue;
      const sb = pathBoundsNumeric(d);
      if (!sb) continue;
      const stroke = shape.line === false ? 0 : typeof shape.line === 'number' ? shape.line : icon.line ?? 4;
      let next: Bounds =
        stroke > 0
          ? { minX: sb.minX - stroke / 2, minY: sb.minY - stroke / 2, maxX: sb.maxX + stroke / 2, maxY: sb.maxY + stroke / 2 }
          : sb;
      const depth = shape.depth ?? 0;
      if (depth > 0) {
        const dx = extrude[0] * depth;
        const dy = extrude[1] * depth;
        next = {
          minX: Math.min(next.minX, next.minX + dx),
          minY: Math.min(next.minY, next.minY + dy),
          maxX: Math.max(next.maxX, next.maxX + dx),
          maxY: Math.max(next.maxY, next.maxY + dy),
        };
      }
      local = local ? unionBounds(local, next) : next;
    }
    if (!local) continue;

    const m = part.pose.m;
    const corners: ReadonlyArray<readonly [number, number]> = [
      [local.minX, local.minY],
      [local.maxX, local.minY],
      [local.maxX, local.maxY],
      [local.minX, local.maxY],
    ];
    for (const [x, y] of corners) {
      const wx = m[0] * x + m[2] * y + m[4];
      const wy = m[1] * x + m[3] * y + m[5];
      const point: Bounds = { minX: wx, minY: wy, maxX: wx, maxY: wy };
      union = union ? unionBounds(union, point) : point;
    }
  }

  return union;
}

/**
 * Recenters a freshly generated composition on the 500x500 stage. Only root
 * layers (groups and standalone layers) are moved; children follow their group,
 * so one shift repositions the whole sticker.
 */
export function centerComposition(icon: Icon): Icon {
  const bounds = compositionBounds(icon);
  if (!bounds) return icon;
  const dx = round(250 - (bounds.minX + bounds.maxX) / 2);
  const dy = round(250 - (bounds.minY + bounds.maxY) / 2);
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return icon;

  return {
    ...icon,
    layers: icon.layers.map((layer) => {
      if (layer.parent || layer.groupId) return layer;
      const p = layer.p;
      if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number') return layer;
      return { ...layer, p: [round(p[0] + dx), round(p[1] + dy)] };
    }),
  };
}

/** Reads a static numeric scale from a layer, defaulting to 100%. */
const staticScale = (layer: Layer): [number, number] => {
  const s = layer.s;
  if (Array.isArray(s) && typeof s[0] === 'number' && typeof s[1] === 'number') return [s[0], s[1]];
  return [100, 100];
};

/**
 * Shrinks an oversized composition about its own centre so it fits inside a
 * `maxSize` box, then lets `centerComposition` place it. Root layers take the
 * scale (their `s`) and move toward the centre (their `p`); grouped children
 * ride their group, so the whole sticker scales as one unit.
 */
export function fitComposition(icon: Icon, maxSize = 380): Icon {
  const bounds = compositionBounds(icon);
  if (!bounds) return icon;
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  if (!Number.isFinite(span) || span <= 0 || span <= maxSize) return icon;

  const k = maxSize / span;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  return {
    ...icon,
    layers: icon.layers.map((layer) => {
      if (layer.parent || layer.groupId) return layer;
      const p = layer.p;
      if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number') return layer;
      const s = staticScale(layer);
      return {
        ...layer,
        p: [round(cx + (p[0] - cx) * k), round(cy + (p[1] - cy) * k)] as [number, number],
        s: [round(clamp(s[0] * k, 1, 1000)), round(clamp(s[1] * k, 1, 1000))] as [number, number],
      };
    }),
  };
}

/**
 * Tokenizes SVG path data into command letters and numbers.
 * Letters exclude e/E so exponent notation stays intact.
 */
const PATH_TOKEN = /[a-df-zA-DF-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
const isPathCommand = (token: string): boolean => /^[a-df-zA-DF-Z]$/.test(token);
const frac = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * Applies a uniform scale plus translation to raw SVG path data and re-emits
 * absolute commands. This keeps the stored `d` valid for `Path2D(pathString)`
 * (which does not accept `transform(...)` prefixes), so `viewBox`-space artwork
 * can be placed and sized in layer-local coordinates.
 */
export function transformPathData(d: string, scale: number, tx: number, ty: number): string {
  const tokens = d.match(PATH_TOKEN) ?? [];
  const out: string[] = [];
  let i = 0;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;

  const num = (): number => {
    const value = Number(tokens[i++]);
    return Number.isFinite(value) ? value : 0;
  };
  const px = (x: number): number => frac(x * scale + tx);
  const py = (y: number): number => frac(y * scale + ty);

  while (i < tokens.length) {
    if (isPathCommand(tokens[i])) {
      cmd = tokens[i];
      i++;
    }
    if (!cmd) break;

    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;

    if (upper === 'Z') {
      out.push('Z');
      cx = sx;
      cy = sy;
      cmd = '';
      continue;
    }

    if (upper === 'M') {
      const ax = rel ? cx + num() : num();
      const ay = rel ? cy + num() : num();
      cx = ax;
      cy = ay;
      sx = ax;
      sy = ay;
      out.push(`M${px(cx)} ${py(cy)}`);
      // Subsequent coordinate pairs after M are implicit lineto segments.
      cmd = rel ? 'l' : 'L';
      continue;
    }

    if (upper === 'L') {
      cx = rel ? cx + num() : num();
      cy = rel ? cy + num() : num();
      out.push(`L${px(cx)} ${py(cy)}`);
      continue;
    }

    if (upper === 'H') {
      cx = rel ? cx + num() : num();
      out.push(`L${px(cx)} ${py(cy)}`);
      continue;
    }

    if (upper === 'V') {
      cy = rel ? cy + num() : num();
      out.push(`L${px(cx)} ${py(cy)}`);
      continue;
    }

    if (upper === 'C') {
      const x1 = rel ? cx + num() : num();
      const y1 = rel ? cy + num() : num();
      const x2 = rel ? cx + num() : num();
      const y2 = rel ? cy + num() : num();
      cx = rel ? cx + num() : num();
      cy = rel ? cy + num() : num();
      out.push(`C${px(x1)} ${py(y1)} ${px(x2)} ${py(y2)} ${px(cx)} ${py(cy)}`);
      continue;
    }

    if (upper === 'S') {
      const x2 = rel ? cx + num() : num();
      const y2 = rel ? cy + num() : num();
      cx = rel ? cx + num() : num();
      cy = rel ? cy + num() : num();
      out.push(`S${px(x2)} ${py(y2)} ${px(cx)} ${py(cy)}`);
      continue;
    }

    if (upper === 'Q') {
      const x1 = rel ? cx + num() : num();
      const y1 = rel ? cy + num() : num();
      cx = rel ? cx + num() : num();
      cy = rel ? cy + num() : num();
      out.push(`Q${px(x1)} ${py(y1)} ${px(cx)} ${py(cy)}`);
      continue;
    }

    if (upper === 'T') {
      cx = rel ? cx + num() : num();
      cy = rel ? cy + num() : num();
      out.push(`T${px(cx)} ${py(cy)}`);
      continue;
    }

    if (upper === 'A') {
      const rx = num() * Math.abs(scale);
      const ry = num() * Math.abs(scale);
      const rot = num();
      const largeArc = num() ? 1 : 0;
      const sweep = num() ? 1 : 0;
      cx = rel ? cx + num() : num();
      cy = rel ? cy + num() : num();
      out.push(`A${frac(rx)} ${frac(ry)} ${frac(rot)} ${largeArc} ${sweep} ${px(cx)} ${py(cy)}`);
      continue;
    }

    // Unknown command: skip its remaining numeric tokens to avoid an infinite loop.
    while (i < tokens.length && !isPathCommand(tokens[i])) i++;
    cmd = '';
  }

  return out.join(' ') || d;
}

/**
 * A half-ellipse band: the curved silhouette of a headband, handle, smile or
 * arch. `dx`/`dy` is the centre of its bounding box, so it behaves like the
 * other primitives. `thickness` is the band width in px.
 */
function archPath(dx: number, dy: number, width: number, height: number, thickness: number): string {
  const rx = width / 2;
  const ry = height;
  const t = Math.max(1, Math.min(thickness, Math.min(rx, ry) * 0.9));
  const irx = Math.max(0, rx - t);
  const iry = Math.max(0, ry - t);
  const baseline = dy + height / 2;
  return `M${frac(dx - rx)} ${frac(baseline)} A${frac(rx)} ${frac(ry)} 0 0 1 ${frac(dx + rx)} ${frac(baseline)} L${frac(dx + irx)} ${frac(baseline)} A${frac(irx)} ${frac(iry)} 0 0 0 ${frac(dx - irx)} ${frac(baseline)} Z`;
}

/**
 * Builds a drawable shape from a spec. Primitives use width/height and are
 * centred (corner-aligned rectangles can offset via dx2/dy2). `path` injects
 * arbitrary SVG geometry from `viewBox` space.
 */
export function buildShape(spec: ShapeSpec): Layer['shapes'][number] {
  const width = spec.width ?? 120;
  const height = spec.height ?? 120;
  const depth = spec.depth ?? 0.8;
  const dx = spec.dx ?? 0;
  const dy = spec.dy ?? 0;

  if (spec.path) {
    // Normalise the path by its OWN geometry: scale it to fit width x height and
    // centre its real bounds on (dx, dy). This makes path pieces behave exactly
    // like primitives and means a wrong or missing `viewBox` can never blow the
    // piece up or fling it off-canvas.
    const bounds = pathBoundsNumeric(spec.path);
    if (bounds) {
      const bw = Math.max(1e-6, bounds.maxX - bounds.minX);
      const bh = Math.max(1e-6, bounds.maxY - bounds.minY);
      const scale = Math.min(width / bw, height / bh);
      const cx = spec.dx2 !== undefined ? spec.dx2 + width / 2 : dx;
      const cy = spec.dy2 !== undefined ? spec.dy2 + height / 2 : dy;
      const tx = cx - ((bounds.minX + bounds.maxX) / 2) * scale;
      const ty = cy - ((bounds.minY + bounds.maxY) / 2) * scale;
      return {
        d: transformPathData(spec.path, scale, tx, ty),
        fill: spec.fill ?? 'main',
        depth: spec.depth ?? 0,
        ...(spec.line !== undefined ? { line: spec.line } : {}),
      };
    }

    // Fallback for paths the numeric parser cannot read: use the declared viewBox.
    const [vx, vy, vw, vh] = spec.viewBox ?? [0, 0, width, height];
    const scale = Math.min(width / Math.max(1, vw), height / Math.max(1, vh));
    const d = transformPathData(spec.path, scale, dx - vx * scale, dy - vy * scale);
    return {
      d,
      fill: spec.fill ?? 'main',
      depth: spec.depth ?? 0,
      ...(spec.line !== undefined ? { line: spec.line } : {}),
    };
  }

  const shape = spec.shape ?? 'rect';
  const radius = Math.min(width, height) / 2;
  let d: string;
  switch (shape) {
    case 'circle':
      d = ellipse(dx, dy, width / 2, height / 2);
      break;
    case 'spark':
      d = spark(dx, dy, radius);
      break;
    case 'star':
      d = star(dx, dy, radius);
      break;
    case 'pill':
      d = pill((spec.dx2 ?? -width / 2) + dx, (spec.dy2 ?? -height / 2) + dy, width, height);
      break;
    case 'ring':
      d = ring(dx, dy, radius, radius * 0.5);
      break;
    case 'arch':
      d = archPath(dx, dy, width, height, spec.thickness ?? Math.max(6, Math.min(width, height) * 0.16));
      break;
    default:
      d = rect((spec.dx2 ?? -width / 2) + dx, (spec.dy2 ?? -height / 2) + dy, width, height, spec.round ?? 12);
      break;
  }

  return {
    d,
    fill: spec.fill ?? 'main',
    depth: shape === 'spark' || shape === 'star' ? (spec.depth ?? 0) : depth,
    ...(spec.line !== undefined ? { line: spec.line } : {}),
  };
}

function shapesFromSpecs(specs: ShapeSpec[]): Layer['shapes'] {
  return specs.map((spec) => buildShape(spec));
}

/** Resolves the shape list for a new layer from either `shapes[]` or a single `shape`. */
function resolveShapes(action: {
  shapes?: ShapeSpec[];
  shape?: string;
  width?: number;
  height?: number;
  fill?: string;
  depth?: number;
}): Layer['shapes'] {
  if (action.shapes && action.shapes.length) {
    return shapesFromSpecs(action.shapes);
  }
  const single: ShapeSpec = {
    shape: (action.shape as ShapeSpec['shape']) ?? 'rect',
    width: clamp(action.width ?? 120, 4, 1000),
    height: clamp(action.height ?? 120, 4, 1000),
    fill: action.fill as ShapeSpec['fill'],
    depth: action.depth,
  };
  return shapesFromSpecs([single]);
}

let actionCounter = 0;
function defaultId(prefix: string): string {
  actionCounter += 1;
  const stamp = Date.now().toString(36).slice(-4);
  return `${prefix}-${stamp}${actionCounter.toString(36)}`;
}

const COLOR_TO_ROLE: Record<string, z.infer<typeof ROLE>> = {
  blue: 'main',
  primary: 'main',
  cyan: 'tint',
  purple: 'tint',
  violet: 'tint',
  green: 'ok',
  success: 'ok',
  yellow: 'gold',
  orange: 'gold',
  gold: 'gold',
  red: 'hot',
  pink: 'hot',
  rose: 'hot',
  magenta: 'hot',
  accent: 'hot',
  black: 'ink',
  dark: 'deep',
  shadow: 'deep',
  gray: 'grey',
  grey: 'grey',
  white: 'white',
  paper: 'paper',
  light: 'paper',
};

function normalizeColorName(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const raw = value.toLowerCase().trim();
  if (COLOR_TO_ROLE[raw]) return COLOR_TO_ROLE[raw];
  if (ROLE.safeParse(raw).success) return raw;
  return value;
}

function normalizeActionRaw(item: unknown): unknown {
  if (!item || typeof item !== 'object') return item;
  const action = { ...(item as Record<string, unknown>) };

  if (typeof action.fill === 'string') {
    action.fill = normalizeColorName(action.fill);
  }

  // Nested composite artwork: normalize color names inside each shape spec.
  if (Array.isArray(action.shapes)) {
    action.shapes = (action.shapes as unknown[]).map((shape) => {
      if (!shape || typeof shape !== 'object') return shape;
      const next = { ...(shape as Record<string, unknown>) };
      if (typeof next.fill === 'string') next.fill = normalizeColorName(next.fill);
      if (typeof next.stroke === 'string') next.stroke = normalizeColorName(next.stroke);
      return next;
    });
  }

  if (action.type === 'set_palette' && typeof action.paletteId === 'string') {
    action.paletteId = action.paletteId.toLowerCase().trim();
  }

  if (action.type === 'set_facing' && typeof action.facing === 'string') {
    action.facing = action.facing.toLowerCase().trim();
  }

  if (action.position && typeof action.position === 'object' && !Array.isArray(action.position)) {
    const p = action.position as { x?: unknown; y?: unknown };
    if (typeof p.x === 'number' && typeof p.y === 'number') {
      action.position = [p.x, p.y];
    }
  }

  if (action.scale && typeof action.scale === 'object' && !Array.isArray(action.scale)) {
    const s = action.scale as { x?: unknown; y?: unknown; scaleX?: unknown; scaleY?: unknown };
    const sx = typeof s.x === 'number' ? s.x : typeof s.scaleX === 'number' ? s.scaleX : undefined;
    const sy = typeof s.y === 'number' ? s.y : typeof s.scaleY === 'number' ? s.scaleY : undefined;
    if (sx !== undefined && sy !== undefined) {
      action.scale = [sx, sy];
    }
  }

  return action;
}

function cleanJsonCandidate(candidate: string): string {
  return candidate
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

function extractJsonCandidates(text: string): string[] {
  const candidates: string[] = [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]?.trim()) {
    candidates.push(cleanJsonCandidate(fenced[1]));
  }

  const source = (fenced ? fenced[1] : text).trim();
  const cleanedSource = cleanJsonCandidate(source);
  if (!candidates.includes(cleanedSource)) {
    candidates.push(cleanedSource);
  }

  const objectStart = source.indexOf('{');
  const objectEnd = source.lastIndexOf('}');
  if (objectStart !== -1 && objectEnd > objectStart) {
    const candidate = cleanJsonCandidate(source.slice(objectStart, objectEnd + 1));
    if (!candidates.includes(candidate)) candidates.push(candidate);
  }

  const arrayStart = source.indexOf('[');
  const arrayEnd = source.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    const candidate = cleanJsonCandidate(source.slice(arrayStart, arrayEnd + 1));
    if (!candidates.includes(candidate)) candidates.push(candidate);
  }

  return candidates;
}

const envelopeSchema = z.object({
  reply: z.string().optional(),
  actions: z.array(z.unknown()).optional(),
});

/**
 * Parses the assistant text into a reply plus validated actions. Models that
 * ignore the JSON contract simply produce a plain reply with no actions.
 */
export function parseAIResponse(text: string): ParsedAIResponse {
  const trimmed = text.trim();
  if (!trimmed) return { reply: '', actions: [], warnings: [] };

  for (const candidate of extractJsonCandidates(trimmed)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }

    // A bare array of actions is accepted as a shortcut.
    if (Array.isArray(parsed)) {
      const result = collectActions(parsed);
      if (!result.actions.length && !result.warnings.length) continue;
      const reply = result.actions.length ? 'Applying the requested changes.' : trimmed;
      return { reply, ...result };
    }

    // A single action object without the reply envelope.
    if (parsed && typeof parsed === 'object' && 'type' in parsed) {
      const normalized = normalizeActionRaw(parsed);
      const single = aiActionSchema.safeParse(normalized);
      if (single.success) {
        return { reply: 'Applying the requested changes.', actions: [single.data], warnings: [] };
      }
    }

    const envelope = envelopeSchema.safeParse(parsed);
    if (!envelope.success) continue;

    const { reply, actions: rawActions } = envelope.data;
    if (typeof reply !== 'string' && !Array.isArray(rawActions)) continue;

    const result = collectActions(rawActions ?? []);
    const normalizedReply =
      typeof reply === 'string' && reply.trim()
        ? reply.trim()
        : result.actions.length
          ? 'Applying the requested changes.'
          : trimmed;

    return { ...result, reply: normalizedReply };
  }

  return { reply: trimmed, actions: [], warnings: [] };
}

function collectActions(raw: unknown[]): Pick<ParsedAIResponse, 'actions' | 'warnings'> {
  const actions: AIAction[] = [];
  const warnings: string[] = [];

  for (const item of raw) {
    const normalized = normalizeActionRaw(item);
    const result = aiActionSchema.safeParse(normalized);
    if (result.success) {
      actions.push(result.data);
      continue;
    }
    const type =
      typeof item === 'object' && item && 'type' in item
        ? String((item as { type: unknown }).type)
        : 'action';
    warnings.push(`Skipped invalid ${type}: ${result.error.issues[0]?.message ?? 'unknown error'}.`);
  }

  return { actions, warnings };
}

function applyOne(
  doc: StudioDoc,
  action: AIAction,
  makeId: (prefix: string) => string
): AIApplyResult {
  let icon: Icon = {
    ...doc.icon,
    layers: doc.icon.layers.map((layer) => ({ ...layer })),
  };
  let palette = doc.palette;
  let paletteId = doc.paletteId;
  let facing = doc.facing;
  let outlineWidth = doc.outlineWidth;
  let changed = false;
  let selectedLayerId: string | null | undefined;
  const applied: string[] = [];
  const skipped: string[] = [];
  const removed: string[] = [];

  const findLayer = (id: string): Layer | undefined => {
    if (!id || typeof id !== 'string') return undefined;
    const target = id.trim().toLowerCase();

    // 1. Exact ID match
    let found = icon.layers.find((l) => l.id === id);
    if (found) return found;

    // 2. Case-insensitive ID match
    found = icon.layers.find((l) => l.id?.toLowerCase() === target);
    if (found) return found;

    // 3. Exact or case-insensitive Name
    found = icon.layers.find((l) => l.name?.trim().toLowerCase() === target);
    if (found) return found;

    // 4. 1-based index (e.g. "1", "layer 1", "#1")
    const indexMatch = target.match(/^(?:layer\s*|#)?(\d+)$/i);
    if (indexMatch) {
      const idx = parseInt(indexMatch[1], 10) - 1;
      if (idx >= 0 && idx < icon.layers.length) {
        return icon.layers[idx];
      }
    }

    // 5. Partial name match if unambiguous
    const nameMatches = icon.layers.filter(
      (l) => l.name && (l.name.toLowerCase().includes(target) || target.includes(l.name.toLowerCase()))
    );
    if (nameMatches.length === 1) return nameMatches[0];

    return undefined;
  };

  const replaceLayer = (id: string, next: Layer) => {
    icon = { ...icon, layers: icon.layers.map((layer) => (layer.id === id ? next : layer)) };
  };

  const uniqueLayerId = (base: string): string => {
    let candidate = base;
    let n = 2;
    while (icon.layers.some((l) => l.id === candidate || l.name?.trim().toLowerCase() === candidate)) {
      candidate = `${base}-${n}`;
      n += 1;
    }
    return candidate;
  };

  switch (action.type) {
    case 'update_layer': {
      const layer = findLayer(action.layerId);
      if (!layer) {
        skipped.push(`Layer "${action.layerId}" was not found.`);
        break;
      }

      const next: Layer = { ...layer };
      const fields: string[] = [];

      if (action.name !== undefined) {
        next.name = action.name.trim().slice(0, 60);
        fields.push('name');
      }
      if (action.position) {
        next.p = [round(clamp(action.position[0], -1000, 1500)), round(clamp(action.position[1], -1000, 1500))];
        fields.push('position');
      }
      if (action.rotation !== undefined) {
        next.r = round(action.rotation);
        fields.push('rotation');
      }
      if (action.scale) {
        next.s = [round(clamp(action.scale[0], 15, 300)), round(clamp(action.scale[1], 15, 300))];
        fields.push('scale');
      }
      if (action.opacity !== undefined) {
        next.o = round(clamp(action.opacity, 0, 100));
        fields.push('opacity');
      }
      if (action.tilt) {
        next.tilt = [round(action.tilt[0]), round(action.tilt[1])];
        next.tiltFromView = false;
        fields.push('tilt');
      }
      if (action.hidden !== undefined) {
        next.hidden = action.hidden;
        fields.push('visibility');
      }
      if (action.locked !== undefined) {
        next.locked = action.locked;
        fields.push('lock');
      }
      if (action.motionPreset !== undefined) {
        if (!isMotionPresetId(action.motionPreset)) {
          skipped.push(`Unknown motion preset "${action.motionPreset}".`);
          break;
        }
        next.motionPreset = action.motionPreset;
        next.m = action.motionPreset === 'none' ? undefined : (createMotion(action.motionPreset) as Layer['m']);
        fields.push('motion');
      }
      if (action.fill !== undefined) {
        if (!next.shapes.length) {
          skipped.push(`Layer "${labelOf(layer)}" has no shape to recolor.`);
        } else {
          next.shapes = next.shapes.map((shape, index) => (index === 0 ? { ...shape, fill: action.fill } : shape));
          fields.push('fill');
        }
      }
      if (action.depth !== undefined) {
        if (!next.shapes.length) {
          skipped.push(`Layer "${labelOf(layer)}" has no shape to extrude.`);
        } else {
          const depth = round(clamp(action.depth, -5, 10));
          next.shapes = next.shapes.map((shape, index) => (index === 0 ? { ...shape, depth } : shape));
          fields.push('depth');
        }
      }
      if (action.outline !== undefined) {
        next.line = round(clamp(action.outline, 0, 40));
        fields.push('outline');
      }

      if (!fields.length) {
        skipped.push(`No supported changes for layer "${labelOf(layer)}".`);
        break;
      }

      const layerId = layer.id ?? action.layerId;
      replaceLayer(layerId, next);
      changed = true;
      applied.push(`Updated "${labelOf(layer)}" (${fields.join(', ')})`);
      break;
    }

    case 'clear_layers': {
      icon = { ...icon, layers: [] };
      changed = true;
      selectedLayerId = null;
      applied.push('Cleared canvas layers for new creation');
      break;
    }

    case 'create_group': {
      if (action.motionPreset !== undefined && !isMotionPresetId(action.motionPreset)) {
        skipped.push(`Unknown motion preset "${action.motionPreset}".`);
        break;
      }

      const name = action.name?.trim() || action.id?.trim() || 'Group';
      const id = uniqueLayerId(slugify(action.id ?? action.name ?? 'group'));
      const group: Layer = {
        id,
        name,
        isGroup: true,
        shapes: [],
        p: action.position
          ? [round(clamp(action.position[0], -1000, 1500)), round(clamp(action.position[1], -1000, 1500))]
          : [250, 250],
        // The group carries position + motion only. Children apply the isometric
        // tilt themselves, so the group must stay untilted or the tilt stacks twice.
        motionPreset: action.motionPreset ?? 'none',
        m:
          action.motionPreset && action.motionPreset !== 'none'
            ? (createMotion(action.motionPreset) as Layer['m'])
            : undefined,
        ...(action.outline !== undefined ? { line: round(clamp(action.outline, 0, 40)) } : {}),
      };

      icon = { ...icon, layers: [...icon.layers, group] };
      changed = true;
      selectedLayerId = id;
      applied.push(`Created group "${name}" (id "${id}")`);
      break;
    }

    case 'insert_template': {
      const template = getTemplate(action.name);
      if (!template) {
        skipped.push(`Unknown sticker "${action.name}". Available: ${TEMPLATE_IDS.join(', ')}.`);
        break;
      }

      const previousIds = icon.layers
        .map((layer) => layer.id)
        .filter((id): id is string => typeof id === 'string');

      const targetFacing = action.facing ?? facing;
      const view = VIEWS[targetFacing];
      facing = targetFacing;

      // Designed stickers keep their own hand-tuned geometry; only the facing
      // tilt/extrude is reapplied when a view is requested. Ids are filled in
      // because the editor targets layers by id (hide, lock, delete, reorder).
      const layers = ensureLayerIds({
        ...icon,
        layers: deepClone(template.layers).map((layer) =>
          layer.tilt && layer.tiltFromView !== false ? { ...layer, tilt: view.tilt } : layer
        ),
      }).layers;

      icon = {
        ...icon,
        name: prettyTemplateName(template.name),
        frames: template.frames,
        line: template.line,
        extrude: view.extrude,
        layers,
      };

      if (action.paletteId) {
        const cleanId = action.paletteId.toLowerCase().trim();
        const next = PALETTES[cleanId as keyof typeof PALETTES];
        if (next) {
          paletteId = cleanId;
          palette = { ...next };
        } else {
          skipped.push(`Unknown palette "${action.paletteId}"; kept the current palette.`);
        }
      }

      changed = true;
      removed.push(...previousIds);
      selectedLayerId = layers.find((layer) => !layer.isGroup)?.id ?? null;
      applied.push(`Inserted the designed "${icon.name}" sticker`);
      break;
    }

    case 'add_layer': {
      if (action.motionPreset !== undefined && !isMotionPresetId(action.motionPreset)) {
        skipped.push(`Unknown motion preset "${action.motionPreset}".`);
        break;
      }

      const shapes = resolveShapes(action);

      let groupId = action.groupId;
      if (groupId) {
        const group = findLayer(groupId);
        if (group?.isGroup) {
          // Store the group's real id so children actually follow it (the model
          // may have referenced the group by name).
          groupId = group.id ?? groupId;
        } else {
          skipped.push(`Group "${groupId}" was not found; the new layer was left ungrouped.`);
          groupId = undefined;
        }
      }

      // A grouped child is positioned RELATIVE to its group. Models often echo
      // the stage default (250,250) onto children, which composes to ~(500,500)
      // and scatters the sticker. Treat that exact value as "unset" for a child.
      let position = action.position;
      if (groupId && position && Math.round(position[0]) === 250 && Math.round(position[1]) === 250) {
        position = undefined;
      }

      const id = makeId('ai-layer');
      const name = action.name?.trim() || (action.shapes?.length ? 'AI Artwork' : `AI ${action.shape ?? 'rect'}`);
      const layer: Layer = {
        id,
        name,
        p: position
          ? [round(position[0]), round(position[1])]
          : groupId
            ? [0, 0]
            : [250, 250],
        r: action.rotation !== undefined ? round(action.rotation) : 0,
        s: action.scale ? [round(clamp(action.scale[0], 15, 300)), round(clamp(action.scale[1], 15, 300))] : [100, 100],
        o: action.opacity !== undefined ? round(clamp(action.opacity, 0, 100)) : 100,
        ...(action.outline !== undefined ? { line: round(clamp(action.outline, 0, 40)) } : {}),
        tilt: VIEWS[facing].tilt,
        tiltFromView: true,
        groupId,
        motionPreset: action.motionPreset ?? 'none',
        m:
          action.motionPreset && action.motionPreset !== 'none'
            ? (createMotion(action.motionPreset) as Layer['m'])
            : undefined,
        shapes,
      };

      icon = { ...icon, layers: [...icon.layers, layer] };
      changed = true;
      selectedLayerId = id;
      applied.push(
        action.shapes?.length
          ? `Added artwork "${name}" (${shapes.length} shapes)`
          : `Added ${action.shape ?? 'rect'} "${name}"`
      );
      break;
    }

    case 'add_shapes': {
      const layer = findLayer(action.layerId);
      if (!layer) {
        skipped.push(`Layer "${action.layerId}" was not found.`);
        break;
      }
      if (!action.shapes || !action.shapes.length) {
        skipped.push(`Layer "${labelOf(layer)}": no shapes were provided.`);
        break;
      }
      const next: Layer = { ...layer, shapes: [...layer.shapes, ...shapesFromSpecs(action.shapes)] };
      replaceLayer(layer.id ?? action.layerId, next);
      changed = true;
      applied.push(`Added ${action.shapes.length} shape(s) to "${labelOf(layer)}"`);
      break;
    }

    case 'delete_layer': {
      const layer = findLayer(action.layerId);
      if (!layer) {
        skipped.push(`Layer "${action.layerId}" was not found.`);
        break;
      }
      const targetId = layer.id ?? action.layerId;
      icon = {
        ...icon,
        layers: icon.layers
          .filter((candidate) => candidate.id !== targetId)
          .map((candidate) =>
            layer.isGroup && candidate.groupId === targetId
              ? { ...candidate, groupId: undefined }
              : candidate
          ),
      };
      changed = true;
      removed.push(targetId);
      applied.push(`Deleted "${labelOf(layer)}"`);
      break;
    }

    case 'select_layer': {
      const layer = findLayer(action.layerId);
      if (!layer) {
        skipped.push(`Layer "${action.layerId}" was not found.`);
        break;
      }
      selectedLayerId = layer.id ?? action.layerId;
      applied.push(`Selected "${labelOf(layer)}"`);
      break;
    }

    case 'set_palette': {
      const cleanId = action.paletteId.toLowerCase().trim();
      const next =
        PALETTES[cleanId as keyof typeof PALETTES] ||
        PALETTES[action.paletteId as keyof typeof PALETTES];
      if (!next) {
        skipped.push(`Unknown palette "${action.paletteId}".`);
        break;
      }
      paletteId = cleanId in PALETTES ? cleanId : action.paletteId;
      palette = { ...next };
      changed = true;
      applied.push(`Changed palette to "${paletteId}"`);
      break;
    }

    case 'set_palette_color': {
      palette = { ...palette, [action.role]: action.color } as Palette;
      paletteId = 'custom';
      changed = true;
      applied.push(`Set ${action.role} to ${action.color}`);
      break;
    }

    case 'set_outline': {
      outlineWidth = round(clamp(action.width, 0, 40));
      icon = { ...icon, line: outlineWidth };
      changed = true;
      applied.push(`Set outline width to ${outlineWidth}px`);
      break;
    }

    case 'set_facing': {
      const view = VIEWS[action.facing as View];
      facing = action.facing;
      icon = {
        ...icon,
        extrude: view.extrude,
        layers: icon.layers.map((layer) =>
          layer.tilt && layer.tiltFromView !== false ? { ...layer, tilt: view.tilt } : layer
        ),
      };
      changed = true;
      applied.push(`Changed view to "${action.facing}"`);
      break;
    }

    case 'rename_project': {
      icon = { ...icon, name: action.name.trim().slice(0, 80) };
      changed = true;
      applied.push(`Renamed project to "${icon.name}"`);
      break;
    }

    default: {
      skipped.push('Unsupported action.');
    }
  }

  return {
    doc: { ...doc, icon, palette, paletteId, facing, outlineWidth },
    applied,
    skipped,
    changed,
    selectedLayerId,
    removed,
  };
}

/**
 * Applies a batch atomically. Invalid ids and unknown presets are reported in
 * `skipped` while the remaining actions still run.
 */
export function applyAIActionsToDoc(
  doc: StudioDoc,
  actions: AIAction[],
  makeId: (prefix: string) => string = defaultId
): AIApplyResult {
  let current = doc;
  const applied: string[] = [];
  const skipped: string[] = [];
  const removed: string[] = [];
  let selectedLayerId: string | null | undefined;
  let changed = false;

  for (const action of actions) {
    // Each action sees the previous one because the reducer is applied in order.
    const result = applyOne(current, action, makeId);
    current = result.doc;
    applied.push(...result.applied);
    skipped.push(...result.skipped);
    removed.push(...result.removed);
    changed = changed || result.changed;

    if (result.selectedLayerId !== undefined) {
      selectedLayerId = result.selectedLayerId;
    }
  }

  // Freshly generated artwork is fit to the canvas and recentered so it never
  // lands off-canvas or overflows. Only batches that clear the canvas first are
  // touched, so wrapping or editing an existing composition is never disturbed.
  // Designed library stickers are already placed, so they are left exactly as
  // their author laid them out.
  const insertedTemplate = actions.some((action) => action.type === 'insert_template');
  const generatedFresh = actions.some((action) => action.type === 'clear_layers') && !insertedTemplate;
  if (changed && generatedFresh) {
    const fitted = centerComposition(fitComposition(current.icon));
    if (fitted !== current.icon) {
      current = { ...current, icon: fitted };
      applied.push('Fit and centered the composition on the canvas');
    }
  }

  // Guarantee ids on every layer the AI produced or replaced, so the editor's
  // per-layer controls (hide, lock, delete, reorder) keep working afterwards.
  if (changed) {
    const withIds = ensureLayerIds(current.icon, 'ai-layer');
    if (withIds !== current.icon) {
      current = { ...current, icon: withIds };
    }
  }

  return { doc: current, applied, skipped, changed, selectedLayerId, removed };
}
