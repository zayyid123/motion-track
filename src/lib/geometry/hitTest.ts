import { at } from '@/lib/funIsometric/fun';
import type { Icon, Part, Scene, Shape, Vec } from '@/lib/funIsometric/fun';
import { getLayerBounds, pointInBounds } from './bounds';

let hitContext: CanvasRenderingContext2D | null = null;
const pathCache = new Map<string, Path2D>();

function getHitContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!hitContext) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    hitContext = canvas.getContext('2d');
  }
  return hitContext;
}

const pathOf = (d: string): Path2D => {
  let path = pathCache.get(d);
  if (!path) {
    path = new Path2D(d);
    if (pathCache.size > 4000) pathCache.clear();
    pathCache.set(d, path);
  }
  return path;
};

function pointInShape(ctx: CanvasRenderingContext2D, shape: Shape, d: string, x: number, y: number, lineWidth: number) {
  const path = pathOf(d);
  const filled = ctx.isPointInPath(path, x, y);
  if (filled && shape.fill) return true;
  if (!shape.fill) {
    const stroke = shape.line === false ? 0 : typeof shape.line === 'number' ? shape.line : lineWidth;
    if (stroke > 0) {
      ctx.lineWidth = Math.max(2, stroke);
      if (ctx.isPointInStroke(path, x, y)) return true;
    }
  }
  return false;
}

function localPoint(part: Part, x: number, y: number): { x: number; y: number } | null {
  const [a, b, c, d, e, f] = part.pose.m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-6) return null;
  return {
    x: (d * (x - e) - c * (y - f)) / det,
    y: (-b * (x - e) + a * (y - f)) / det,
  };
}

/**
 * Precise hit testing: topmost layer wins, bounding boxes prefilter, then the
 * actual Path2D geometry decides. This replaces the old fixed 110px box.
 */
export function hitTestScene(sc: Scene, icon: Icon, x: number, y: number): string | null {
  const ctx = getHitContext();
  if (!ctx) return null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const extrude = at(icon.extrude ?? ([0, 0] as Vec), sc.f) as Vec;
  const lineWidth = icon.line ?? 4;

  for (let index = sc.parts.length - 1; index >= 0; index -= 1) {
    const part = sc.parts[index];
    if (part.L.hidden || !part.L.shapes.length) continue;

    const bounds = getLayerBounds(part.L, sc.f, extrude, lineWidth);
    if (!bounds) continue;

    const local = localPoint(part, x, y);
    if (!local || !pointInBounds(bounds, local.x, local.y)) continue;

    for (let shapeIndex = 0; shapeIndex < part.L.shapes.length; shapeIndex += 1) {
      const shape = part.L.shapes[shapeIndex];
      const d = at(shape.d, sc.f);
      if (typeof d !== 'string') continue;
      if (pointInShape(ctx, shape, d, local.x, local.y, lineWidth)) {
        return part.L.id ?? null;
      }
    }
  }

  return null;
}
