import { z } from 'zod';
import { ellipse, PALETTES, rect, spark, VIEWS } from '@/lib/funIsometric/fun';
import type { Icon, Layer, Palette, View } from '@/lib/funIsometric/fun';
import { createMotion, isMotionPresetId } from '@/lib/funIsometric/presets';
import type { StudioDoc } from '@/lib/projectFile';

const ROLE = z.enum(['main', 'gold', 'tint', 'ok', 'hot', 'deep', 'white', 'grey', 'paper', 'ink']);
const FACE = z.enum(['right', 'left', 'front', 'flat']);
const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a #rrggbb hex value.');

const updateLayer = z.object({
  type: z.literal('update_layer'),
  layerId: z.string().min(1),
  name: z.string().min(1).max(60).optional(),
  position: z.tuple([z.number(), z.number()]).optional(),
  rotation: z.number().optional(),
  scale: z.tuple([z.number(), z.number()]).optional(),
  opacity: z.number().min(0).max(100).optional(),
  tilt: z.tuple([z.number(), z.number()]).optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  motionPreset: z.string().min(1).optional(),
  fill: ROLE.optional(),
  depth: z.number().min(-5).max(10).optional(),
});

const addLayer = z.object({
  type: z.literal('add_layer'),
  shape: z.enum(['rect', 'circle', 'spark']),
  name: z.string().min(1).max(60).optional(),
  width: z.number().min(4).max(1000).optional(),
  height: z.number().min(4).max(1000).optional(),
  position: z.tuple([z.number(), z.number()]).optional(),
  fill: ROLE.optional(),
  depth: z.number().min(-5).max(10).optional(),
  motionPreset: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
});

export const aiActionSchema = z.discriminatedUnion('type', [
  updateLayer,
  addLayer,
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

let actionCounter = 0;
function defaultId(prefix: string): string {
  actionCounter += 1;
  const stamp = Date.now().toString(36).slice(-4);
  return `${prefix}-${stamp}${actionCounter.toString(36)}`;
}

function extractJsonCandidates(text: string): string[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = (fenced ? fenced[1] : text).trim();
  const candidates = [source];

  const objectStart = source.indexOf('{');
  const objectEnd = source.lastIndexOf('}');
  if (objectStart !== -1 && objectEnd > objectStart) {
    candidates.push(source.slice(objectStart, objectEnd + 1));
  }

  const arrayStart = source.indexOf('[');
  const arrayEnd = source.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    candidates.push(source.slice(arrayStart, arrayEnd + 1));
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
      const single = aiActionSchema.safeParse(parsed);
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
    const result = aiActionSchema.safeParse(item);
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

  const findLayer = (id: string): Layer | undefined => icon.layers.find((layer) => layer.id === id);
  const replaceLayer = (id: string, next: Layer) => {
    icon = { ...icon, layers: icon.layers.map((layer) => (layer.id === id ? next : layer)) };
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

      if (!fields.length) {
        skipped.push(`No supported changes for layer "${labelOf(layer)}".`);
        break;
      }

      replaceLayer(action.layerId, next);
      changed = true;
      applied.push(`Updated "${labelOf(layer)}" (${fields.join(', ')})`);
      break;
    }

    case 'add_layer': {
      if (action.motionPreset !== undefined && !isMotionPresetId(action.motionPreset)) {
        skipped.push(`Unknown motion preset "${action.motionPreset}".`);
        break;
      }

      const width = clamp(action.width ?? 120, 4, 1000);
      const height = clamp(action.height ?? 120, 4, 1000);
      const shape =
        action.shape === 'circle'
          ? ellipse(0, 0, width / 2, height / 2)
          : action.shape === 'spark'
            ? spark(0, 0, Math.min(width, height) / 2)
            : rect(-width / 2, -height / 2, width, height, 12);

      let groupId = action.groupId;
      if (groupId && !findLayer(groupId)?.isGroup) {
        skipped.push(`Group "${groupId}" was not found; the new layer was left ungrouped.`);
        groupId = undefined;
      }

      const id = makeId('ai-layer');
      const name = action.name?.trim() || `AI ${action.shape}`;
      const layer: Layer = {
        id,
        name,
        p: action.position ? [round(action.position[0]), round(action.position[1])] : [250, 250],
        tilt: VIEWS[facing].tilt,
        tiltFromView: true,
        groupId,
        motionPreset: action.motionPreset ?? 'none',
        m:
          action.motionPreset && action.motionPreset !== 'none'
            ? (createMotion(action.motionPreset) as Layer['m'])
            : undefined,
        shapes: [
          {
            d: shape,
            fill: action.fill ?? 'main',
            depth: action.depth ?? (action.shape === 'spark' ? 0 : 0.8),
          },
        ],
      };

      icon = { ...icon, layers: [...icon.layers, layer] };
      changed = true;
      selectedLayerId = id;
      applied.push(`Added ${action.shape} "${name}"`);
      break;
    }

    case 'delete_layer': {
      const layer = findLayer(action.layerId);
      if (!layer) {
        skipped.push(`Layer "${action.layerId}" was not found.`);
        break;
      }
      icon = {
        ...icon,
        layers: icon.layers
          .filter((candidate) => candidate.id !== action.layerId)
          .map((candidate) =>
            layer.isGroup && candidate.groupId === action.layerId
              ? { ...candidate, groupId: undefined }
              : candidate
          ),
      };
      changed = true;
      removed.push(action.layerId);
      applied.push(`Deleted "${labelOf(layer)}"`);
      break;
    }

    case 'select_layer': {
      const layer = findLayer(action.layerId);
      if (!layer) {
        skipped.push(`Layer "${action.layerId}" was not found.`);
        break;
      }
      selectedLayerId = action.layerId;
      applied.push(`Selected "${labelOf(layer)}"`);
      break;
    }

    case 'set_palette': {
      const next = PALETTES[action.paletteId as keyof typeof PALETTES];
      if (!next) {
        skipped.push(`Unknown palette "${action.paletteId}".`);
        break;
      }
      paletteId = action.paletteId;
      palette = { ...next };
      changed = true;
      applied.push(`Changed palette to "${action.paletteId}"`);
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

  return { doc: current, applied, skipped, changed, selectedLayerId, removed };
}
