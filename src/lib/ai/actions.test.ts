import { describe, expect, it } from 'vitest';
import { PALETTES, rect, VIEWS } from '@/lib/funIsometric/fun';
import type { Layer } from '@/lib/funIsometric/fun';
import type { StudioDoc } from '@/lib/projectFile';
import { applyAIActionsToDoc, buildShape, centerComposition, fitComposition, parseAIResponse, transformPathData } from './actions';
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

  it('normalizes trailing commas and color names in JSON', () => {
    const raw = `
      {
        "reply": "Fixed colors and position",
        "actions": [
          {
            "type": "update_layer",
            "layerId": "body",
            "position": { "x": 200, "y": 300 },
            "fill": "blue",
          },
        ],
      }
    `;
    const result = parseAIResponse(raw);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      type: 'update_layer',
      layerId: 'body',
      position: [200, 300],
      fill: 'main',
    });
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

  it('matches layers by case-insensitive name or 1-based index', () => {
    const doc = makeDoc();
    // In makeDoc(), layer 1 is 'body', layer 2 is 'glow'
    const result = apply(doc, [
      { type: 'update_layer', layerId: 'Body', position: [111, 222] },
      { type: 'update_layer', layerId: '2', opacity: 45 },
    ]);
    expect(result.changed).toBe(true);
    expect(result.applied).toHaveLength(2);
    const body = result.doc.icon.layers.find((l) => l.id === 'body');
    const glow = result.doc.icon.layers.find((l) => l.id === 'glow');
    expect(body?.p).toEqual([111, 222]);
    expect(glow?.o).toBe(45);
  });

  it('can clear layers and generate a new animation scene from scratch', () => {
    const doc = makeDoc();
    const result = apply(doc, [
      { type: 'clear_layers' },
      { type: 'set_palette', paletteId: 'sunset' },
      { type: 'rename_project', name: 'Glowing Bulb' },
      { type: 'add_layer', shape: 'pill', name: 'Lamp Base', position: [250, 330], fill: 'grey' },
      {
        type: 'add_layer',
        shape: 'circle',
        name: 'Light Bulb',
        position: [250, 230],
        fill: 'gold',
        motionPreset: 'bob',
      },
      {
        type: 'add_layer',
        shape: 'spark',
        name: 'Left Sparkle',
        position: [160, 170],
        fill: 'white',
        motionPreset: 'sparkle',
      },
      {
        type: 'add_layer',
        shape: 'star',
        name: 'Top Sparkle',
        position: [250, 130],
        fill: 'gold',
        motionPreset: 'twinkle',
      },
    ]);

    expect(result.changed).toBe(true);
    expect(result.doc.icon.name).toBe('Glowing Bulb');
    expect(result.doc.paletteId).toBe('sunset');
    // Initially 5 layers were wiped, then 4 new layers were added:
    expect(result.doc.icon.layers).toHaveLength(4);
    expect(result.doc.icon.layers[0].name).toBe('Lamp Base');
    expect(result.doc.icon.layers[1].name).toBe('Light Bulb');
    expect(result.doc.icon.layers[1].motionPreset).toBe('bob');
    expect(result.doc.icon.layers[2].name).toBe('Left Sparkle');
    expect(result.doc.icon.layers[2].motionPreset).toBe('sparkle');
    expect(result.doc.icon.layers[3].name).toBe('Top Sparkle');
    expect(result.doc.icon.layers[3].motionPreset).toBe('twinkle');
  });

  it('builds a multi-shape composite layer with primitives and custom paths', () => {
    const result = apply(makeDoc(), [
      { type: 'clear_layers' },
      {
        type: 'add_layer',
        name: 'Bulb Glass',
        position: [250, 220],
        depth: 1,
        motionPreset: 'bob',
        shapes: [
          {
            shape: 'path',
            viewBox: [0, 0, 200, 220],
            width: 180,
            height: 200,
            dx: -15,
            dy: -120,
            fill: 'tint',
            depth: 1,
            path: 'M100 10C48 10 12 52 12 108c0 40 22 62 34 84 6 11 8 20 8 30h92c0-10 2-19 8-30 12-22 34-44 34-84 0-56-36-98-88-98z',
          },
          { shape: 'circle', width: 34, height: 34, fill: 'white', depth: 0.1 },
          { shape: 'rect', width: 96, height: 16, dx2: -48, dy2: 18, round: 8, fill: 'grey', depth: 0.6 },
        ],
      },
    ]);

    expect(result.changed).toBe(true);
    const bulb = result.doc.icon.layers[0];
    expect(bulb.name).toBe('Bulb Glass');
    expect(bulb.motionPreset).toBe('bob');
    expect(bulb.shapes).toHaveLength(3);
    // The custom path is rescaled into layer-local coordinates (no transform prefix).
    expect(typeof bulb.shapes[0].d).toBe('string');
    expect(String(bulb.shapes[0].d)).not.toContain('translate(');
    expect(String(bulb.shapes[0].d)).not.toContain('scale(');
    expect(String(bulb.shapes[0].d).startsWith('M')).toBe(true);
    expect(bulb.shapes[0].fill).toBe('tint');
    expect(bulb.shapes[0].depth).toBe(1);
    expect(bulb.shapes[1].fill).toBe('white');
    expect(bulb.shapes[2].fill).toBe('grey');
  });

  it('appends detail shapes to an existing layer with add_shapes', () => {
    const first = apply(makeDoc(), [
      { type: 'clear_layers' },
      { type: 'add_layer', name: 'Coin', shape: 'circle', width: 120, height: 120, fill: 'gold' },
    ]);
    const coinId = first.doc.icon.layers[0].id as string;
    expect(first.doc.icon.layers[0].shapes).toHaveLength(1);

    const result = apply(first.doc, [
      {
        type: 'add_shapes',
        layerId: coinId,
        shapes: [
          { shape: 'ring', width: 96, height: 96, fill: 'gold', depth: 0.2 },
          { shape: 'star', width: 40, height: 40, fill: 'white', depth: 0 },
        ],
      },
    ]);

    const coin = result.doc.icon.layers.find((l) => l.id === coinId);
    expect(coin?.shapes).toHaveLength(3);
    expect(result.applied[0]).toMatch(/Added 2 shape/);
    expect(result.skipped).toHaveLength(0);
  });

  it('normalizes color names inside composite shape specs', () => {
    const raw = JSON.stringify({
      reply: 'Built it',
      actions: [
        {
          type: 'add_layer',
          name: 'Coin',
          position: [250, 250],
          shapes: [
            { shape: 'circle', width: 120, height: 120, fill: 'yellow' },
            { shape: 'circle', width: 60, height: 60, fill: 'grey' },
          ],
        },
      ],
    });

    const parsed = parseAIResponse(raw);
    expect(parsed.actions).toHaveLength(1);
    const apply2 = apply(makeDoc(), parsed.actions);
    const coin = apply2.doc.icon.layers.at(-1);
    expect(coin?.shapes[0].fill).toBe('gold');
    expect(coin?.shapes[1].fill).toBe('grey');
  });

  it('accepts a numeric outline width in shape specs instead of skipping the layer', () => {
    const raw = JSON.stringify({
      reply: 'Built it',
      actions: [
        {
          type: 'add_layer',
          name: 'Coin',
          position: [250, 250],
          shapes: [
            { shape: 'circle', width: 120, height: 120, fill: 'gold', line: 3 },
            { shape: 'circle', width: 60, height: 60, fill: 'white', line: false },
            { shape: 'rect', width: 40, height: 40, fill: 'ink', line: '2' },
          ],
        },
      ],
    });

    const parsed = parseAIResponse(raw);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.actions).toHaveLength(1);

    const result = apply(makeDoc(), parsed.actions);
    expect(result.skipped).toEqual([]);
    const coin = result.doc.icon.layers.at(-1);
    expect(coin?.shapes).toHaveLength(3);
    expect(coin?.shapes[0].line).toBe(3);
    expect(coin?.shapes[1].line).toBe(false);
    expect(coin?.shapes[2].line).toBe(2);
  });

  it('coerces quoted numbers in action fields', () => {
    const raw = JSON.stringify({
      reply: 'Resized',
      actions: [
        { type: 'update_layer', layerId: 'body', opacity: '50', rotation: '15' },
        { type: 'add_layer', name: 'Coin', shape: 'circle', width: '90', height: '90', position: ['120', '140'] },
      ],
    });

    const parsed = parseAIResponse(raw);
    expect(parsed.warnings).toEqual([]);
    const result = apply(makeDoc(), parsed.actions);
    expect(result.skipped).toEqual([]);
    const body = result.doc.icon.layers.find((candidate) => candidate.id === 'body');
    expect(body?.o).toBe(50);
    expect(body?.r).toBe(15);
  });

  it('sets a per-layer ink outline width with add_layer and update_layer', () => {
    const result = apply(makeDoc(), [
      { type: 'clear_layers' },
      { type: 'add_layer', name: 'Body', shape: 'circle', width: 120, height: 120, fill: 'main', outline: 8 },
      { type: 'add_layer', name: 'Spark', shape: 'spark', width: 40, height: 40, fill: 'white', outline: 2.5 },
    ]);

    expect(result.skipped).toEqual([]);
    const body = result.doc.icon.layers.find((l) => l.name === 'Body');
    const spark = result.doc.icon.layers.find((l) => l.name === 'Spark');
    expect(body?.line).toBe(8);
    expect(spark?.line).toBe(2.5);

    const updated = apply(result.doc, [{ type: 'update_layer', layerId: 'Body', outline: 3 }]);
    const body2 = updated.doc.icon.layers.find((l) => l.name === 'Body');
    expect(body2?.line).toBe(3);
    expect(updated.applied[0]).toMatch(/outline/);
  });

  it('leaves the outline unset (project default) when no outline is given', () => {
    const result = apply(makeDoc(), [
      { type: 'add_layer', name: 'Plain', shape: 'circle', width: 60, height: 60, fill: 'tint' },
    ]);
    const plain = result.doc.icon.layers.find((l) => l.name === 'Plain');
    expect(plain?.line).toBeUndefined();
  });
});

describe('create_group', () => {
  it('creates a group container and children follow it (resolved by id or name)', () => {
    const result = apply(makeDoc(), [
      { type: 'clear_layers' },
      { type: 'create_group', id: 'Bulb Group', name: 'Bulb', motionPreset: 'bob' },
      { type: 'add_layer', name: 'Body', shape: 'circle', width: 120, height: 120, groupId: 'Bulb' },
      { type: 'add_layer', name: 'Glass', shape: 'circle', width: 80, height: 80, groupId: 'bulb-group' },
    ]);

    expect(result.skipped).toEqual([]);
    const group = result.doc.icon.layers.find((l) => l.isGroup);
    expect(group?.id).toBe('bulb-group');
    expect(group?.name).toBe('Bulb');
    expect(group?.motionPreset).toBe('bob');
    expect(group?.shapes).toEqual([]);

    const body = result.doc.icon.layers.find((l) => l.name === 'Body');
    const glass = result.doc.icon.layers.find((l) => l.name === 'Glass');
    expect(body?.groupId).toBe('bulb-group');
    expect(glass?.groupId).toBe('bulb-group');
  });

  it('uniquifies duplicate group ids', () => {
    const result = apply(makeDoc(), [
      { type: 'clear_layers' },
      { type: 'create_group', id: 'sticker', name: 'One' },
      { type: 'create_group', id: 'sticker', name: 'Two' },
    ]);

    expect(result.doc.icon.layers.map((l) => l.id)).toEqual(['sticker', 'sticker-2']);
    expect(result.skipped).toEqual([]);
  });

  it('rejects an unknown group motion preset', () => {
    const result = apply(makeDoc(), [
      { type: 'clear_layers' },
      { type: 'create_group', id: 'grp', motionPreset: 'teleport' },
    ]);
    expect(result.doc.icon.layers).toHaveLength(0);
    expect(result.skipped[0]).toMatch(/Unknown motion preset/);
  });

  it('defaults grouped children to the local origin so they ride the group', () => {
    const result = apply(makeDoc(), [
      { type: 'clear_layers' },
      { type: 'create_group', id: 'grp', name: 'Grp', motionPreset: 'bob' },
      { type: 'add_layer', name: 'Child', shape: 'circle', width: 40, height: 40, groupId: 'grp' },
      { type: 'add_layer', name: 'Loose', shape: 'circle', width: 40, height: 40 },
    ]);

    const child = result.doc.icon.layers.find((l) => l.name === 'Child');
    const loose = result.doc.icon.layers.find((l) => l.name === 'Loose');
    expect(child?.p).toEqual([0, 0]);
    expect(loose?.p).toEqual([250, 250]);
  });

  it('keeps an explicit child position when the model supplies one', () => {
    const result = apply(makeDoc(), [
      { type: 'clear_layers' },
      { type: 'create_group', id: 'grp', name: 'Grp' },
      { type: 'add_layer', name: 'Child', shape: 'circle', width: 40, height: 40, groupId: 'grp', position: [10, -20] },
    ]);

    const child = result.doc.icon.layers.find((l) => l.name === 'Child');
    expect(child?.p).toEqual([10, -20]);
  });

  it('treats the stage default (250,250) on a child as unset so it does not scatter', () => {
    const result = apply(makeDoc(), [
      { type: 'clear_layers' },
      { type: 'create_group', id: 'grp', name: 'Grp' },
      { type: 'add_layer', name: 'Child', shape: 'circle', width: 40, height: 40, groupId: 'grp', position: [250, 250] },
    ]);

    const child = result.doc.icon.layers.find((l) => l.name === 'Child');
    expect(child?.p).toEqual([0, 0]);
  });

  it('gives the group no tilt so the isometric tilt is not stacked twice', () => {
    const result = apply(makeDoc(), [{ type: 'clear_layers' }, { type: 'create_group', id: 'grp', name: 'Grp' }]);
    const group = result.doc.icon.layers.find((l) => l.isGroup);
    expect(group?.tilt).toBeUndefined();
  });

  it('accepts the motion presets added from the fun-isometric skill', () => {
    for (const preset of ['toss', 'press', 'jolt', 'impact', 'latch']) {
      const result = apply(makeDoc(), [
        { type: 'clear_layers' },
        { type: 'create_group', id: 'grp', name: 'Grp', motionPreset: preset },
      ]);
      expect(result.skipped).toEqual([]);
      const group = result.doc.icon.layers[0];
      expect(group.motionPreset).toBe(preset);
      expect(group.m).toBeDefined();
    }
  });
});

describe('centerComposition', () => {
  it('recenters an off-center composition on (250,250)', () => {
    const icon = {
      name: 'Off center',
      frames: 180,
      line: 5,
      layers: [layer('body', { p: [420, 300] })],
    };
    const centered = centerComposition(icon);
    const moved = centered.layers.find((l) => l.id === 'body');
    expect(moved?.p).toEqual([250, 250]);
  });

  it('moves the group but never its children when recentering', () => {
    const icon = {
      name: 'Grouped',
      frames: 180,
      line: 5,
      layers: [
        { id: 'grp', name: 'Grp', isGroup: true, shapes: [], p: [420, 300] } as Layer,
        layer('child', { groupId: 'grp', p: [0, 0] }),
      ],
    };
    const centered = centerComposition(icon);
    const group = centered.layers.find((l) => l.id === 'grp');
    const child = centered.layers.find((l) => l.id === 'child');
    expect(group?.p).not.toEqual([420, 300]);
    expect(child?.p).toEqual([0, 0]);
  });

  it('is a no-op when the composition is already centered', () => {
    const icon = { name: 'Centered', frames: 180, line: 5, layers: [layer('body')] };
    expect(centerComposition(icon)).toBe(icon);
  });

  it('recenters a generative batch (clear_layers + create_group) on the canvas', () => {
    const result = apply(makeDoc(), [
      { type: 'clear_layers' },
      { type: 'create_group', id: 'grp', name: 'Grp', motionPreset: 'bob' },
      {
        type: 'add_layer',
        groupId: 'grp',
        name: 'Art',
        shapes: [{ shape: 'rect', width: 80, height: 80, dx2: 600, dy2: 600, fill: 'main' }],
      },
    ]);

    const group = result.doc.icon.layers.find((l) => l.isGroup);
    expect(group?.p).not.toEqual([250, 250]);
    // Already centered by the batch: a second pass is a no-op.
    expect(centerComposition(result.doc.icon)).toBe(result.doc.icon);
  });

  it('does not recenter a batch that does not clear the canvas', () => {
    const doc: StudioDoc = {
      icon: { name: 'Existing', frames: 180, line: 5, layers: [layer('body', { p: [420, 300] })] },
      paletteId: 'slush',
      palette: { ...PALETTES.slush },
      facing: 'right',
      outlineWidth: 5,
    };

    const result = apply(doc, [{ type: 'create_group', id: 'wrap', name: 'Wrap' }]);
    expect(result.doc.icon.layers.find((l) => l.id === 'body')?.p).toEqual([420, 300]);
    expect(result.applied).not.toContain('Fit and centered the composition on the canvas');
  });
});

describe('transformPathData', () => {
  it('scales and translates absolute commands', () => {
    const out = transformPathData('M0 0 L10 10 Z', 2, 100, 50);
    expect(out).toBe('M100 50 L120 70 Z');
  });

  it('handles relative commands, curves and arcs', () => {
    const out = transformPathData('m0 0 c1 1 2 2 3 3 a5 5 0 1 0 10 0 z', 1, 0, 0);
    expect(out).toContain('M0 0');
    expect(out).toContain('C1 1 2 2 3 3');
    expect(out).toContain('A5 5 0 1 0 13 3');
    expect(out.endsWith('Z')).toBe(true);
  });

  it('converts H and V into absolute line commands', () => {
    const out = transformPathData('M10 10 H20 V30', 1, 0, 0);
    expect(out).toBe('M10 10 L20 10 L20 30');
  });

  it('falls back to the original path when nothing parses', () => {
    expect(transformPathData('123 456', 1, 0, 0)).toBe('123 456');
  });
});

describe('buildShape', () => {
  it('builds centred primitives and path shapes', () => {
    const circle = buildShape({ shape: 'circle', width: 100, height: 100, fill: 'main' });
    expect(String(circle.d).startsWith('M')).toBe(true);
    expect(circle.fill).toBe('main');

    const rounded = buildShape({ shape: 'rect', width: 80, height: 40, dx2: 0, dy2: 0, fill: 'gold', round: 8 });
    expect(rounded.fill).toBe('gold');

    const path = buildShape({
      shape: 'path',
      path: 'M0 0 L100 0 L100 100 Z',
      viewBox: [0, 0, 100, 100],
      width: 50,
      height: 50,
      dx: 10,
      dy: 20,
      fill: 'tint',
      depth: 0,
    });
    expect(String(path.d)).not.toContain('translate');
    expect(String(path.d).startsWith('M')).toBe(true);
    expect(path.fill).toBe('tint');
    // Paths inherit the layer outline like primitives unless "line" is set.
    expect(path.line).toBeUndefined();
  });

  it('normalises a path by its own bounds and centres it on dx/dy', () => {
    const spec = {
      shape: 'path' as const,
      path: 'M0 0 L100 0 L100 100 Z',
      width: 50,
      height: 50,
      dx: 10,
      dy: 20,
      fill: 'tint' as const,
      depth: 0,
    };
    // scale 0.5, bounds 0..100 -> tx -15, ty -5.
    const shaped = buildShape(spec);
    expect(String(shaped.d)).toContain('M-15 -5');
    expect(String(shaped.d)).toContain('L35 45');
  });

  it('ignores a wrong viewBox so a mismatched guess cannot blow the piece up', () => {
    const base = { shape: 'path' as const, path: 'M0 0 L100 0 L100 100 Z', width: 50, height: 50, dx: 0, dy: 0 };
    const noBox = buildShape({ ...base });
    const badBox = buildShape({ ...base, viewBox: [0, 0, 10, 10] as [number, number, number, number] });
    expect(String(badBox.d)).toBe(String(noBox.d));
  });

  it('builds an arch band centred on dx/dy', () => {
    const arch = buildShape({ shape: 'arch', width: 220, height: 150, thickness: 34, dx: 0, dy: -20, fill: 'main' });
    const d = String(arch.d);
    // Baseline = dy + height/2 = 55; outer span = +/-110; inner span = +/-76.
    expect(d.startsWith('M-110 55')).toBe(true);
    expect(d).toContain('A110 150 0 0 1 110 55');
    expect(d).toContain('A76 116 0 0 0 -76 55');
    expect(d.endsWith('Z')).toBe(true);
    expect(d).not.toContain('NaN');
  });
});

describe('fitComposition', () => {
  const bigIcon = () => ({
    name: 'big',
    frames: 180,
    line: 5,
    layers: [
      {
        id: 'a',
        name: 'a',
        p: [250, 250] as [number, number],
        tilt: VIEWS.right.tilt,
        tiltFromView: true,
        shapes: [{ d: rect(-500, -500, 1000, 1000, 0), fill: 'main' as const, depth: 0 }],
      },
    ],
  });

  it('shrinks an oversized composition to the target box about its centre', () => {
    const fitted = fitComposition(bigIcon(), 380);
    const layer = fitted.layers[0];
    expect(layer.p).toEqual([250, 250]);
    const scale = layer.s as [number, number];
    expect(scale[0]).toBeLessThan(50);
    expect(scale[0]).toBeGreaterThan(30);
    // Already centred, so the follow-up centring pass is a no-op.
    expect(centerComposition(fitted)).toBe(fitted);
  });

  it('leaves a composition that already fits untouched', () => {
    const icon = bigIcon();
    (icon.layers[0].shapes as Array<{ d: string }>)[0] = { d: rect(-50, -50, 100, 100, 0) };
    expect(fitComposition(icon, 380)).toBe(icon);
  });
});
