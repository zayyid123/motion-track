import { at } from '@/lib/funIsometric/fun';
import type { Layer, Shape, Vec } from '@/lib/funIsometric/fun';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const pathBoundsCache = new Map<string, Bounds | null>();

function samplePathBounds(d: string): Bounds | null {
  const cached = pathBoundsCache.get(d);
  if (cached !== undefined) return cached;

  if (typeof document === 'undefined') return null;

  try {
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    element.setAttribute('d', d);
    const length = element.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) {
      pathBoundsCache.set(d, null);
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const samples = 96;
    for (let index = 0; index <= samples; index += 1) {
      const point = element.getPointAtLength((length * index) / samples);
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    const bounds = { minX, minY, maxX, maxY };
    if (pathBoundsCache.size > 4000) pathBoundsCache.clear();
    pathBoundsCache.set(d, bounds);
    return bounds;
  } catch {
    pathBoundsCache.set(d, null);
    return null;
  }
}

function union(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function getShapeBounds(shape: Shape, frame: number): Bounds | null {
  const d = at(shape.d, frame);
  if (typeof d !== 'string') return null;
  return samplePathBounds(d);
}

/**
 * Local-space bounds for a layer, including stroke width and slab extrusion.
 * Used for selection boxes, resize handles, and hit-test prefiltering.
 */
export function getLayerBounds(layer: Layer, frame: number, extrude: Vec = [0, 0], lineWidth = 0): Bounds | null {
  let bounds: Bounds | null = null;

  for (const shape of layer.shapes) {
    const shapeBounds = getShapeBounds(shape, frame);
    if (!shapeBounds) continue;
    let next = shapeBounds;

    const stroke = shape.line === false ? 0 : typeof shape.line === 'number' ? shape.line : lineWidth;
    if (stroke > 0) {
      next = {
        minX: next.minX - stroke / 2,
        minY: next.minY - stroke / 2,
        maxX: next.maxX + stroke / 2,
        maxY: next.maxY + stroke / 2,
      };
    }

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

    bounds = union(bounds, next);
  }

  if (!bounds) return null;
  return expandBounds(bounds, 4);
}

export function expandBounds(bounds: Bounds, amount: number): Bounds {
  return {
    minX: bounds.minX - amount,
    minY: bounds.minY - amount,
    maxX: bounds.maxX + amount,
    maxY: bounds.maxY + amount,
  };
}

export function pointInBounds(bounds: Bounds, x: number, y: number): boolean {
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

export function boundsCenter(bounds: Bounds): Vec {
  return [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
}
