import { describe, expect, it } from 'vitest';
import { PALETTES, rect, VIEWS } from '@/lib/funIsometric/fun';
import type { Layer } from '@/lib/funIsometric/fun';
import type { StudioDoc } from '@/lib/projectFile';
import { applyAIActionsToDoc, parseAIResponse } from './actions';
import type { AIAction } from './actions';

const layer = (id: string, overrides: Partial<Layer> = {}): Layer => ({
  id,
  name: id,
  p: [250, 250],
  tilt: VIEWS.right.tilt,
  tiltFromView: true,
  shapes: [{ d: rect(-25, -25, 50, 50, 6), fill: 'main', depth: 1 }],
  ...overrides,
});

const makeDoc = (): StudioDoc => ({
  icon: {
    name: 'Test sticker',
    frames: 180,
    line: 5,
    layers: [
      layer('body'),
      layer('glow', { shapes: [{ d: rect(-5, -5, 10, 10, 2), fill: 'hot', depth: 0.2 }] }),
      layer('group', { isGroup: true, shapes: [] }),
      layer('child', { groupId: 'group' }),
      layer('locked', { locked: true, hidden: true }),
    ],
  },
  paletteId: 'slush',
  palette: { ...PALETTES.slush },
  facing: 'right',
  outlineWidth: 5,
});

const makeId = (prefix: string) => `${prefix}-test`;

const apply = (doc: StudioDoc, actions: AIAction[]) => applyAIActionsToDoc(doc, actions, makeId);

describe('parseAIResponse', () => {
  it('keeps plain prose with no actions', () => {
    const result = parseAIResponse('Try a warmer palette with a deeper slab.');
    expect(result.reply).toBe('Try a warmer palette with a deeper slab.');
    expect(result.actions).toEqual([]);
  });

  it('parses the JSON envelope and validates actions', () => {
    const result = parseAIResponse(
      JSON.stringify({
        reply: 'Made the body bigger.',
        actions: [
          { type: 'update_layer', layerId: 'body', scale: [140, 140] },
          { type: 'set_palette', paletteId: 'matcha' },
        ],
      })
    );

    expect(result.reply).toBe('Made the body bigger.');
    expect(result.actions).toHaveLength(2);
    expect(result.warnings).toEqual([]);
  });

  it('parses fenced JSON blocks', () => {
    const result = parseAIResponse(
      '```json\n{"reply":"Done","actions":[{"type":"set_outline","width":8}]}\n```'
    );
    expect(result.reply).toBe('Done');
    expect(result.actions).toEqual([{ type: 'set_outline', width: 8 }]);
  });

  it('accepts a bare array of actions', () => {
    const result = parseAIResponse('[{"type":"set_facing","facing":"front"}]');
    expect(result.actions).toEqual([{ type: 'set_facing', facing: 'front' }]);
    expect(result.reply).toMatch(/Applying/);
  });

  it('drops invalid actions and reports warnings', () => {
    const result = parseAIResponse(
      JSON.stringify({
        reply: 'Partially applied.',
        actions: [
          { type: 'update_layer', layerId: 'body', scale: [140, 140] },
          { type: 'set_palette', paletteId: '' },
          { type: 'set_palette_color', role: 'main', color: 'blue' },
          { type: 'not_a_real_action' },
        ],
      })
    );

    expect(result.actions).toHaveLength(1);
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings[0]).toMatch(/set_palette/);
  });

  it('falls back to prose when JSON is broken', () => {
    const result = parseAIResponse('{"reply": "oops", actions: [}');
    expect(result.actions).toEqual([]);
    expect(result.reply).toContain('oops');
  });

  it('handles an empty reply', () => {
    expect(parseAIResponse('   ')).toEqual({ reply: '', actions: [], warnings: [] });
  });
});

describe('applyAIActionsToDoc', () => {
  it('returns the original document when the batch is empty', () => {
    const doc = makeDoc();
    const result = apply(doc, []);
    expect(result.doc).toBe(doc);
    expect(result.changed).toBe(false);
  });

  it('updates position, rotation, scale and opacity', () => {
    const result = apply(makeDoc(), [
      {
        type: 'update_layer',
        layerId: 'body',
        position: [300, 400],
        rotation: 15,
        scale: [140, 120],
        opacity: 60,
      },
    ]);

    const body = result.doc.icon.layers.find((candidate) => candidate.id === 'body');
    expect(body?.p).toEqual([300, 400]);
    expect(body?.r).toBe(15);
    expect(body?.s).toEqual([140, 120]);
    expect(body?.o).toBe(60);
    expect(result.applied[0]).toMatch(/position, rotation, scale, opacity/);
  });

  it('clamps numeric values into safe ranges', () => {
    const result = apply(makeDoc(), [
      { type: 'update_layer', layerId: 'body', scale: [1, 900], opacity: 200 },
      { type: 'set_outline', width: 500 },
    ]);

    const body = result.doc.icon.layers.find((candidate) => candidate.id === 'body');
    expect(body?.s).toEqual([15, 300]);
    expect(body?.o).toBe(100);
    expect(result.doc.outlineWidth).toBe(40);
    expect(result.doc.icon.line).toBe(40);
  });

  it('recolors only the first shape and can change the motion preset', () => {
    const result = apply(makeDoc(), [
      { type: 'update_layer', layerId: 'body', fill: 'gold', depth: 2, motionPreset: 'bob' },
    ]);

    const body = result.doc.icon.layers.find((candidate) => candidate.id === 'body');
    expect(body?.shapes[0].fill).toBe('gold');
    expect(body?.shapes[0].depth).toBe(2);
    expect(body?.motionPreset).toBe('bob');
    expect(body?.m).toBeDefined();
  });

  it('clears motion when the preset is "none"', () => {
    const base = makeDoc();
    const doc: StudioDoc = {
      ...base,
      icon: {
        ...base.icon,
        layers: base.icon.layers.map((candidate) =>
          candidate.id === 'body' ? { ...candidate, motionPreset: 'bob' } : candidate
        ),
      },
    };
    const result = apply(doc, [{ type: 'update_layer', layerId: 'body', motionPreset: 'none' }]);
    const body = result.doc.icon.layers.find((candidate) => candidate.id === 'body');
    expect(body?.motionPreset).toBe('none');
    expect(body?.m).toBeUndefined();
  });

  it('skips unknown layers and unknown presets without touching the document', () => {
    const result = apply(makeDoc(), [
      { type: 'update_layer', layerId: 'missing', opacity: 50 },
      { type: 'update_layer', layerId: 'body', motionPreset: 'teleport' },
      { type: 'delete_layer', layerId: 'ghost' },
    ]);

    expect(result.changed).toBe(false);
    expect(result.applied).toEqual([]);
    expect(result.skipped).toHaveLength(3);
    expect(result.doc.icon.layers).toHaveLength(5);
  });

  it('adds a layer, selects it and uses the current facing', () => {
    const doc = makeDoc();
    doc.facing = 'left';
    const result = apply(doc, [
      {
        type: 'add_layer',
        shape: 'circle',
        name: 'Badge',
        width: 80,
        height: 40,
        position: [120, 90],
        fill: 'gold',
        motionPreset: 'float',
      },
    ]);

    const added = result.doc.icon.layers.find((candidate) => candidate.id === 'ai-layer-test');
    expect(added?.name).toBe('Badge');
    expect(added?.p).toEqual([120, 90]);
    expect(added?.tilt).toEqual(VIEWS.left.tilt);
    expect(added?.shapes[0].fill).toBe('gold');
    expect(added?.motionPreset).toBe('float');
    expect(result.selectedLayerId).toBe('ai-layer-test');
    expect(result.changed).toBe(true);
  });

  it('leaves a new layer ungrouped when the group does not exist', () => {
    const result = apply(makeDoc(), [
      { type: 'add_layer', shape: 'rect', groupId: 'body' },
      { type: 'add_layer', shape: 'spark', groupId: 'missing' },
    ]);

    const [first, second] = result.doc.icon.layers.slice(-2);
    expect(first.groupId).toBeUndefined();
    expect(second.groupId).toBeUndefined();
    expect(result.skipped.some((entry) => entry.includes('missing'))).toBe(true);
  });

  it('deletes a group and ungroups its children', () => {
    const result = apply(makeDoc(), [{ type: 'delete_layer', layerId: 'group' }]);

    expect(result.doc.icon.layers.some((candidate) => candidate.id === 'group')).toBe(false);
    expect(result.doc.icon.layers.find((candidate) => candidate.id === 'child')?.groupId).toBeUndefined();
    expect(result.removed).toEqual(['group']);
  });

  it('selects a layer without creating a document change', () => {
    const result = apply(makeDoc(), [{ type: 'select_layer', layerId: 'glow' }]);
    expect(result.selectedLayerId).toBe('glow');
    expect(result.changed).toBe(false);
    expect(result.doc).toBeDefined();
  });

  it('switches palettes and marks custom colors', () => {
    const paletteResult = apply(makeDoc(), [{ type: 'set_palette', paletteId: 'matcha' }]);
    expect(paletteResult.doc.paletteId).toBe('matcha');
    expect(paletteResult.doc.palette.main).toBe(PALETTES.matcha.main);

    const customResult = apply(makeDoc(), [
      { type: 'set_palette_color', role: 'main', color: '#123456' },
    ]);
    expect(customResult.doc.paletteId).toBe('custom');
    expect(customResult.doc.palette.main).toBe('#123456');
  });

  it('skips unknown palettes', () => {
    const result = apply(makeDoc(), [{ type: 'set_palette', paletteId: 'neon' }]);
    expect(result.changed).toBe(false);
    expect(result.skipped[0]).toMatch(/Unknown palette/);
  });

  it('changes the facing only for view-derived tilts', () => {
    const base = makeDoc();
    const doc: StudioDoc = {
      ...base,
      icon: {
        ...base.icon,
        layers: base.icon.layers.map((candidate) =>
          candidate.id === 'glow'
            ? { ...candidate, tilt: [12, 34] as [number, number], tiltFromView: false }
            : candidate
        ),
      },
    };

    const result = apply(doc, [{ type: 'set_facing', facing: 'front' }]);
    const body = result.doc.icon.layers.find((candidate) => candidate.id === 'body');
    const glow = result.doc.icon.layers.find((candidate) => candidate.id === 'glow');

    expect(result.doc.facing).toBe('front');
    expect(body?.tilt).toEqual(VIEWS.front.tilt);
    expect(glow?.tilt).toEqual([12, 34]);
    expect(result.doc.icon.extrude).toEqual(VIEWS.front.extrude);
  });

  it('renames the project', () => {
    const result = apply(makeDoc(), [{ type: 'rename_project', name: '  New name  ' }]);
    expect(result.doc.icon.name).toBe('New name');
  });

  it('applies a mixed batch in order', () => {
    const result = apply(makeDoc(), [
      { type: 'set_palette', paletteId: 'candy' },
      { type: 'add_layer', shape: 'spark', position: [400, 120] },
      { type: 'select_layer', layerId: 'body' },
    ]);

    expect(result.doc.paletteId).toBe('candy');
    expect(result.doc.icon.layers.at(-1)?.id).toBe('ai-layer-test');
    expect(result.selectedLayerId).toBe('body');
    expect(result.applied).toHaveLength(3);
    expect(result.changed).toBe(true);
  });

  it('does not mutate the input document', () => {
    const doc = makeDoc();
    const snapshot = JSON.stringify(doc);
    apply(doc, [
      { type: 'update_layer', layerId: 'body', position: [10, 10] },
      { type: 'delete_layer', layerId: 'glow' },
    ]);
    expect(JSON.stringify(doc)).toBe(snapshot);
  });
});
