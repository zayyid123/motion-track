// A catalogue of isometric slab shapes for the "Add Isometric Shape" panel.
//
// Every shape is a single closed path traced in the layer's own face space
// (centred on the origin), so the editor can drop it onto the canvas with the
// current tilt and give it a slab side with `depth`. Shapes are grouped into the
// same categories a design tool uses (basic, polygons, stars, arrows, flow
// chart, teardrops, cogs, organic, abstract, lines) so the picker reads cleanly.
//
// Only the primitives from `fun.ts` are used, which keeps the paths consistent
// with the hand-tuned library in `library.ts`.
import { ellipse, line, poly, spark, star } from './fun'
import type { Icon, Layer, Swatch, Vec } from './fun'

export type ShapeCategory =
  | 'basic'
  | 'polygon'
  | 'star'
  | 'arrow'
  | 'flowchart'
  | 'teardrop'
  | 'cog'
  | 'organic'
  | 'abstract'
  | 'line'

export interface ShapeDef {
  /** Stable id persisted when a shape is inserted. */
  id: string
  /** Human label shown in the palette. */
  label: string
  category: ShapeCategory
  /** The closed path, centred on the origin. */
  d: string
  /** How far the layer's slab side should extrude out of the face, in px. */
  depth: number
}

export const SHAPE_CATEGORIES: ReadonlyArray<{ id: ShapeCategory; label: string }> = [
  { id: 'basic', label: 'Basic' },
  { id: 'polygon', label: 'Polygons' },
  { id: 'star', label: 'Stars' },
  { id: 'arrow', label: 'Arrows' },
  { id: 'flowchart', label: 'Flowchart' },
  { id: 'teardrop', label: 'Teardrops' },
  { id: 'cog', label: 'Cogs' },
  { id: 'organic', label: 'Organic' },
  { id: 'abstract', label: 'Abstract' },
  { id: 'line', label: 'Lines' },
]

/** Builds a regular polygon or star traced around the origin. */
const regular = (sides: number, r: number, inner = 1): Vec[] => {
  // A plain polygon has `sides` corners; a star interleaves inner points.
  const count = inner < 1 ? sides * 2 : sides
  return Array.from({ length: count }, (_, i): Vec => {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2
    const k = inner < 1 && i % 2 ? inner : 1
    return [Math.cos(a) * r * k, Math.sin(a) * r * k]
  })
}

/** A regular polygon of `sides` corners. */
const polygon = (sides: number, r: number, rounds = 8): string => poly(regular(sides, r, 1), rounds)

/** A many-pointed burst (square-star / sparkle core). */
const burst = (points: number, r: number, inner: number): string => poly(regular(points, r, inner), 0)

/** A cog: a toothed ring with a round bore cut through the middle. */
const cog = (teeth: number, outer: number, tooth: number, bore: number): string => {
  const pts: Vec[] = []
  for (let i = 0; i < teeth; i++) {
    const base = (i / teeth) * Math.PI * 2
    const step = (Math.PI * 2) / teeth
    for (const [k, offset] of [
      [tooth, -0.22],
      [outer, -0.1],
      [outer, 0.1],
      [tooth, 0.22],
    ] as ReadonlyArray<readonly [number, number]>) {
      const a = base + step * offset
      pts.push([Math.cos(a) * k, Math.sin(a) * k])
    }
  }
  // Outer silhouette, then a counter-clockwise circle so the bore reads as a
  // hole under the default even-odd fill rule.
  return poly(pts, 3) + reverseCircle(bore)
}

/** A circle traced counter-clockwise so it punches a hole in a silhouette. */
function reverseCircle(r: number): string {
  const f = (n: number) => `${+n.toFixed(2)}`
  return `M${f(-r)} 0A${f(r)} ${f(r)} 0 1 0 ${f(r)} 0A${f(r)} ${f(r)} 0 1 0 ${f(-r)} 0Z`
}

/** A petal/flower outline: rounded lobes around the origin. */
const flower = (petals: number, r: number, lobe: number): string => {
  const pts: Vec[] = []
  const steps = petals * 12
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const k = r + lobe * Math.cos(petals * a)
    pts.push([Math.cos(a) * k, Math.sin(a) * k])
  }
  return poly(pts, 0)
}

/** A rounded blob: radius wobbles a little around the circle. */
const blob = (r: number, wobble: number, lobes: number, phase = 0): string => {
  const pts: Vec[] = []
  const steps = 96
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const k = r + wobble * Math.sin(lobes * a + phase)
    pts.push([Math.cos(a) * k, Math.sin(a) * k])
  }
  return poly(pts, 0)
}

const W = 56
const D = 0.8

export const SHAPES: ReadonlyArray<ShapeDef> = [
  // ── basic ──────────────────────────────────────────────────────────────────
  { id: 'rect', label: 'Square', category: 'basic', d: poly([[-W, -W], [W, -W], [W, W], [-W, W]], 8), depth: D },
  { id: 'rounded', label: 'Rounded square', category: 'basic', d: poly([[-W, -W], [W, -W], [W, W], [-W, W]], 24), depth: D },
  { id: 'circle', label: 'Circle', category: 'basic', d: ellipse(0, 0, W, W), depth: D },
  { id: 'triangle', label: 'Triangle', category: 'basic', d: poly([[0, -W], [W, W], [-W, W]], 8), depth: D },
  { id: 'diamond', label: 'Diamond', category: 'basic', d: poly([[0, -W], [W, 0], [0, W], [-W, 0]], 8), depth: D },
  { id: 'capsule', label: 'Capsule', category: 'basic', d: poly([[-W, -34], [W, -34], [W, 34], [-W, 34]], 34), depth: D },

  // ── polygons ───────────────────────────────────────────────────────────────
  { id: 'pentagon', label: 'Pentagon', category: 'polygon', d: polygon(5, W, 10), depth: D },
  { id: 'hexagon', label: 'Hexagon', category: 'polygon', d: polygon(6, W, 10), depth: D },
  { id: 'heptagon', label: 'Heptagon', category: 'polygon', d: polygon(7, W, 9), depth: D },
  { id: 'octagon', label: 'Octagon', category: 'polygon', d: polygon(8, W, 9), depth: D },
  { id: 'nonagon', label: 'Nonagon', category: 'polygon', d: polygon(9, W, 8), depth: D },
  { id: 'decagon', label: 'Decagon', category: 'polygon', d: polygon(10, W, 8), depth: D },

  // ── stars ──────────────────────────────────────────────────────────────────
  { id: 'star4', label: 'Star 4', category: 'star', d: star(0, 0, W, 0.36, 4, 0), depth: D },
  { id: 'star5', label: 'Star 5', category: 'star', d: star(0, 0, W, 0.46, 5, 4), depth: D },
  { id: 'star6', label: 'Star 6', category: 'star', d: star(0, 0, W, 0.58, 6, 3), depth: D },
  { id: 'star8', label: 'Star 8', category: 'star', d: star(0, 0, W, 0.64, 8, 2), depth: D },
  { id: 'sparkle', label: 'Sparkle', category: 'star', d: spark(0, 0, W), depth: 0 },

  // ── arrows ─────────────────────────────────────────────────────────────────
  { id: 'arrow-right', label: 'Arrow right', category: 'arrow', d: arrow(0), depth: D },
  { id: 'arrow-left', label: 'Arrow left', category: 'arrow', d: arrow(180), depth: D },
  { id: 'arrow-up', label: 'Arrow up', category: 'arrow', d: arrow(90), depth: D },
  { id: 'arrow-down', label: 'Arrow down', category: 'arrow', d: arrow(-90), depth: D },
  { id: 'arrow-double', label: 'Double arrow', category: 'arrow', d: doubleArrow(), depth: D },
  { id: 'chevron', label: 'Chevron', category: 'arrow', d: poly([[-16, -44], [16, -44], [52, 0], [16, 44], [-16, 44], [20, 0]], 6), depth: D },

  // ── flowchart ──────────────────────────────────────────────────────────────
  { id: 'process', label: 'Process', category: 'flowchart', d: poly([[-W, -38], [W, -38], [W, 38], [-W, 38]], 4), depth: D },
  { id: 'terminator', label: 'Terminator', category: 'flowchart', d: poly([[-W, -34], [W, -34], [W, 34], [-W, 34]], 34), depth: D },
  { id: 'decision', label: 'Decision', category: 'flowchart', d: poly([[0, -W], [W + 18, 0], [0, W], [-W - 18, 0]], 5), depth: D },
  { id: 'document', label: 'Document', category: 'flowchart', d: 'M-56 -40L56 -40L56 30C36 48 20 26 -56 44Z', depth: D },
  { id: 'parallelogram', label: 'Data', category: 'flowchart', d: poly([[-34, -38], [W + 20, -38], [34, 38], [-W - 20, 38]], 4), depth: D },
  { id: 'predefined', label: 'Predefined', category: 'flowchart', d: predefined(), depth: D },
  { id: 'manual-input', label: 'Manual input', category: 'flowchart', d: poly([[-W, 40], [-W, -38], [W, -38], [W, 26]], 4), depth: D },

  // ── teardrops ──────────────────────────────────────────────────────────────
  { id: 'drop', label: 'Drop', category: 'teardrop', d: drop(1), depth: D },
  { id: 'drop-wide', label: 'Wide drop', category: 'teardrop', d: drop(1.35), depth: D },
  { id: 'drop-round', label: 'Round drop', category: 'teardrop', d: drop(1.6), depth: D },

  // ── cogs ───────────────────────────────────────────────────────────────────
  { id: 'cog', label: 'Cog', category: 'cog', d: cog(10, 34, 56, 22), depth: D },
  { id: 'cog-fine', label: 'Fine cog', category: 'cog', d: cog(14, 32, 52, 20), depth: D },
  { id: 'cog-spoke', label: 'Spoked cog', category: 'cog', d: cog(12, 34, 56, 26), depth: D },
  { id: 'gear', label: 'Gear', category: 'cog', d: cog(8, 36, 58, 30), depth: D },

  // ── organic ────────────────────────────────────────────────────────────────
  { id: 'flower-5', label: 'Flower 5', category: 'organic', d: flower(5, 40, 18), depth: D },
  { id: 'flower-6', label: 'Flower 6', category: 'organic', d: flower(6, 38, 18), depth: D },
  { id: 'flower-8', label: 'Flower 8', category: 'organic', d: flower(8, 34, 16), depth: D },
  { id: 'flower-10', label: 'Flower 10', category: 'organic', d: flower(10, 32, 14), depth: D },
  { id: 'blob', label: 'Blob', category: 'organic', d: blob(46, 12, 4), depth: D },
  { id: 'leaf', label: 'Leaf', category: 'organic', d: 'M0 -50C40 -30 52 6 28 42C8 68 -16 62 -30 40C-52 6 -40 -30 0 -50Z', depth: D },

  // ── abstract ───────────────────────────────────────────────────────────────
  { id: 'burst-10', label: 'Burst 10', category: 'abstract', d: burst(10, W, 0.42), depth: D },
  { id: 'burst-12', label: 'Burst 12', category: 'abstract', d: burst(12, W, 0.5), depth: D },
  { id: 'asterisk', label: 'Asterisk', category: 'abstract', d: asterisk(6), depth: D },
  { id: 'blade', label: 'Pinwheel', category: 'abstract', d: pinwheel(6), depth: D },
  { id: 'quarter', label: 'Quarter', category: 'abstract', d: 'M-48 -48L48 -48C48 5 14 48 -48 48Z', depth: D },
  { id: 'wave', label: 'Wave', category: 'abstract', d: 'M-56 -30C-20 -58 20 -6 56 -30L56 30C20 6 -20 58 -56 30Z', depth: D },

  // ── lines ──────────────────────────────────────────────────────────────────
  { id: 'line-plain', label: 'Line', category: 'line', d: line([-W, 0], [W, 0]), depth: 0 },
  { id: 'line-arrow', label: 'Line arrow', category: 'line', d: line([-W, 0], [W - 22, 0]) + 'M' + ptPair([W - 22, -14]) + 'L' + ptPair([W, 0]) + 'L' + ptPair([W - 22, 14]) + 'Z', depth: 0 },
  { id: 'line-zigzag', label: 'Zigzag', category: 'line', d: 'M-56 -10L-28 -34L0 -10L28 -34L56 -10L56 6L28 30L0 6L-28 30L-56 6Z', depth: 0 },
  { id: 'line-dots', label: 'Dotted line', category: 'line', d: line([-W, 0], [W, 0]), depth: 0 },
]

/** A "predefined process" box: a rectangle with a thin bar inset on each side. */
function predefined(): string {
  const h = 38
  const inset = 12
  const gap = 5
  const outer = `M${f(-W)} ${f(-h)}L${f(W)} ${f(-h)}L${f(W)} ${f(h)}L${f(-W)} ${f(h)}Z`
  // Two slots punched between the outer edge and the inset bar, so the
  // even-odd fill leaves a rectangle with the flowchart's double side lines.
  const left = `M${f(-W + 1)} ${f(-h + 1)}L${f(-W + inset)} ${f(-h + 1)}L${f(-W + inset)} ${f(h - 1)}L${f(-W + 1)} ${f(h - 1)}Z`
  const right = `M${f(-W + inset + gap)} ${f(-h + 1)}L${f(-W + 2 * inset + gap)} ${f(-h + 1)}L${f(-W + 2 * inset + gap)} ${f(h - 1)}L${f(-W + inset + gap)} ${f(h - 1)}Z`
  return outer + left + right
}

/** Formats a coordinate for hand-written path fragments. */
function f(n: number): string {
  return `${+n.toFixed(2)}`
}

/** An arrow pointing along `deg`, built from a shaft and a head. */
function arrow(deg: number): string {
  const shaft = 20
  const head = 40
  const half = 40
  const len = W + head / 2
  const pts: Vec[] = [
    [-len, -shaft / 2],
    [len - head, -shaft / 2],
    [len - head, -half],
    [len, 0],
    [len - head, half],
    [len - head, shaft / 2],
    [-len, shaft / 2],
  ]
  const a = (deg * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  return poly(
    pts.map(([x, y]): Vec => [x * cos - y * sin, x * sin + y * cos]),
    3,
  )
}

/** A double-headed arrow along the x axis. */
function doubleArrow(): string {
  const shaft = 20
  const head = 36
  const half = 40
  const len = W + head / 2
  return poly(
    [
      [-len, 0],
      [-len + head, -half],
      [-len + head, -shaft / 2],
      [len - head, -shaft / 2],
      [len - head, -half],
      [len, 0],
      [len - head, half],
      [len - head, shaft / 2],
      [-len + head, shaft / 2],
      [-len + head, half],
    ],
    3,
  )
}

/** A chunky asterisk: a star with narrow, straight arms. */
function asterisk(arms: number): string {
  const r = W
  const inner = 0.42
  return poly(
    Array.from({ length: arms * 2 }, (_, i): Vec => {
      const a = (i / (arms * 2)) * Math.PI * 2 - Math.PI / 2
      const k = i % 2 ? inner : 1
      // A slight tangential skew widens the arms so they read as bars.
      const skew = i % 2 ? 0.12 : 0
      const nx = -Math.sin(a) * skew * r
      const ny = Math.cos(a) * skew * r
      return [Math.cos(a) * r * k + nx, Math.sin(a) * r * k + ny]
    }),
    0,
  )
}

/** A pinwheel: swept blades around a hub. */
function pinwheel(blades: number): string {
  const steps = blades * 8
  const pts: Vec[] = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const k = 14 + 42 * ((i / steps * blades) % 1)
    pts.push([Math.cos(a) * k, Math.sin(a) * k])
  }
  return poly(pts, 0)
}

/** A teardrop: a pointed top and a round body scaled by `w`. */
function drop(w: number): string {
  const rx = 46 * w
  return (
    `M0 ${-W - 6}` +
    `C${-rx * 0.5} ${-20} ${-rx} ${-4} ${-rx} ${20}` +
    `A${rx} ${rx} 0 0 0 ${rx} ${20}` +
    `C${rx} ${-4} ${rx * 0.5} ${-20} 0 ${-W - 6}Z`
  )
}

/** Formats an absolute point for hand-written path fragments. */
function ptPair([x, y]: Vec): string {
  return `${+x.toFixed(2)} ${+y.toFixed(2)}`
}

export function findShape(id: string): ShapeDef | undefined {
  return SHAPES.find((shape) => shape.id === id)
}

/** The shapes of one category, in catalogue order. */
export function shapesByCategory(category: ShapeCategory): ReadonlyArray<ShapeDef> {
  return SHAPES.filter((shape) => shape.category === category)
}

export interface ShapeLayerOptions {
  /** Outline width in px. Stroked lines default to a thinner ink stroke. */
  line?: number
  /** Fill swatch for the slab face. */
  fill?: Swatch
  /** Canvas centre for the new layer. */
  at?: Vec
  /** Isometric tilt for the layer, normally `VIEWS[facing].tilt`. */
  tilt?: Vec
}

/**
 * Builds the layer that an inserted shape becomes.
 *
 * This is the single source of truth shared by the editor (`addShape`) and the
 * picker preview, so the swatch a user taps is exactly what lands on the canvas:
 * same path, same slab depth, same outline and the same isometric tilt.
 */
export function shapeLayer(id: string, name: string, def: ShapeDef, options: ShapeLayerOptions = {}): Layer {
  const stroked = def.category === 'line'
  const fill = options.fill ?? 'main'
  return {
    id,
    name,
    p: options.at ?? [250, 250],
    tilt: options.tilt,
    tiltFromView: Boolean(options.tilt),
    isGroupLeader: false,
    // Stroked lines carry no slab and read as ink; solid shapes get a slab side
    // and the standard outline unless the caller overrides it.
    shapes: stroked
      ? [{ d: def.d, line: options.line ?? 6 }]
      : [{ d: def.d, fill, depth: def.depth, line: options.line }],
  }
}

/** Builds a one-layer icon for a shape, used to render its picker preview. */
export function shapePreviewIcon(def: ShapeDef, tilt: Vec, extrude?: Vec, fill: Swatch = 'main'): Icon {
  return {
    name: `preview-${def.id}`,
    frames: 1,
    line: 5,
    extrude: extrude ?? [-3, 14],
    layers: [shapeLayer('preview', def.label, def, { tilt, fill, at: [250, 250] })],
  }
}
