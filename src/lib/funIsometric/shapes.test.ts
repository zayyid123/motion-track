import { describe, expect, it, vi } from 'vitest';
import { SHAPE_CATEGORIES, SHAPES, findShape, shapeLayer, shapePreviewIcon, shapesByCategory } from './shapes';
import { PALETTES, VIEWS, render, scene } from './fun';
import type { Vec } from './fun';

describe('isometric shapes', () => {
  it('uses unique ids and non-empty paths', () => {
    const ids = SHAPES.map((shape) => shape.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const shape of SHAPES) {
      expect(shape.d.length).toBeGreaterThan(4);
      expect(shape.d.startsWith('M')).toBe(true);
      // Stroked lines are open paths; every solid shape is a closed silhouette.
      if (shape.category !== 'line') {
        expect(shape.d.trim().endsWith('Z')).toBe(true);
      }
      expect(shape.label).not.toBe('');
    }
  });

  it('only uses known categories, and every category has at least one shape', () => {
    const known = new Set(SHAPE_CATEGORIES.map((category) => category.id));
    for (const shape of SHAPES) {
      expect(known.has(shape.category)).toBe(true);
    }
    for (const category of SHAPE_CATEGORIES) {
      expect(shapesByCategory(category.id).length).toBeGreaterThan(0);
    }
  });

  it('produces finite coordinates with no NaN in any path', () => {
    for (const shape of SHAPES) {
      expect(shape.d).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it('centres every shape near the origin so it lands on the canvas centre', () => {
    for (const shape of SHAPES) {
      const nums = shape.d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
      // Absolute path coordinates are written as "x y" pairs; bounding the raw
      // numbers catches a shape that drifted far from the origin.
      const max = Math.max(...nums.map((n) => Math.abs(n)));
      expect(max).toBeLessThan(400);
      expect(max).toBeGreaterThan(10);
    }
  });

  it('gives slab depth to solid shapes and none to flat lines', () => {
    for (const shape of SHAPES) {
      if (shape.category === 'line') {
        expect(shape.depth).toBe(0);
      } else if (shape.id !== 'sparkle') {
        expect(shape.depth).toBeGreaterThan(0);
      }
    }
  });

  it('finds shapes by id', () => {
    expect(findShape('hexagon')?.category).toBe('polygon');
    expect(findShape('cog')?.category).toBe('cog');
    expect(findShape('nope')).toBeUndefined();
  });

  it('covers the reference categories', () => {
    const ids = SHAPE_CATEGORIES.map((category) => category.id);
    expect(ids).toEqual(
      expect.arrayContaining(['basic', 'polygon', 'star', 'arrow', 'flowchart', 'teardrop', 'cog', 'organic', 'abstract', 'line'])
    );
  });
});

describe('shape layers', () => {
  it('previews the exact layer that insertion creates', () => {
    const tilt: Vec = [-18, 36];
    for (const def of SHAPES) {
      const preview = shapePreviewIcon(def, tilt).layers[0];
      const inserted = shapeLayer('layer-1', def.label, def, { tilt, fill: 'main' });
      // The path, fill, depth, outline and tilt must match so the swatch is the
      // shape the user actually gets on the canvas.
      expect(preview.shapes).toEqual(inserted.shapes);
      expect(preview.tilt).toEqual(inserted.tilt);
      expect(preview.p).toEqual(inserted.p);
    }
  });

  it('gives solid shapes a slab and an ink outline', () => {
    for (const def of SHAPES.filter((shape) => shape.category !== 'line')) {
      const layer = shapeLayer('id', def.label, def, { tilt: [0, 0] });
      const shape = layer.shapes[0];
      expect(shape.fill).toBe('main');
      expect(shape.depth).toBe(def.depth);
      // Outline is inherited from the icon default, so it must not be disabled.
      expect(shape.line).toBeUndefined();
    }
  });

  it('keeps stroked lines filled-free with a visible stroke', () => {
    for (const def of SHAPES.filter((shape) => shape.category === 'line')) {
      const layer = shapeLayer('id', def.label, def, { tilt: [0, 0], line: 6 });
      const shape = layer.shapes[0];
      expect(shape.fill).toBeUndefined();
      expect(shape.depth).toBeUndefined();
      expect(shape.line).toBe(6);
    }
  });

  it('marks the tilt as view-driven so facing changes still apply', () => {
    const layer = shapeLayer('id', 'Shape', findShape('circle')!, { tilt: [-18, 36] });
    expect(layer.tiltFromView).toBe(true);
  });
});

describe('shape preview rendering', () => {
  // jsdom omits the canvas geometry classes the pipeline relies on.
  class FakeMatrix {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    setTransform() {}
  }
  class FakePath2D {
    addPath() {}
  }

  /** A 2D context that records the draw calls the pipeline makes. */
  const recorder = () => {
    const ops = { strokes: 0, fills: 0, widths: [] as number[] };
    const ctx = {
      miterLimit: 0,
      lineCap: 'butt',
      lineJoin: 'miter',
      lineDash: [] as number[],
      strokeStyle: '',
      fillStyle: '',
      _lineWidth: 0,
      get lineWidth() {
        return this._lineWidth;
      },
      set lineWidth(value: number) {
        this._lineWidth = value;
        ops.widths.push(value);
      },
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      save() {},
      restore() {},
      setTransform() {},
      translate() {},
      scale() {},
      clip() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      setLineDash() {},
      clearRect() {},
      stroke() {
        ops.strokes += 1;
      },
      fill() {
        ops.fills += 1;
      },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
  };

  it('outlines and fills every shape so none renders flat or bare', () => {
    vi.stubGlobal('DOMMatrix', FakeMatrix);
    vi.stubGlobal('Path2D', FakePath2D);
    try {
      for (const def of SHAPES) {
        const icon = shapePreviewIcon(def, VIEWS.right.tilt, VIEWS.right.extrude);
        const { ctx, ops } = recorder();
        render(ctx, icon, scene(icon, 0), PALETTES.slush);

        // Every shape must draw an ink outline…
        expect(ops.strokes, `${def.id} drew no outline`).toBeGreaterThan(0);
        expect(ops.widths.some((w) => w > 0), `${def.id} drew a zero-width outline`).toBe(true);
        // …and every solid shape must also fill its face.
        if (def.category !== 'line') {
          expect(ops.fills, `${def.id} drew no fill`).toBeGreaterThan(0);
        }
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
