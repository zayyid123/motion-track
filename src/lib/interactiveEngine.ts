import { at, render, scene } from './funIsometric/fun';
import type { Icon, Palette, Part, Pose, Scene } from './funIsometric/fun';
import { VIEWS } from './funIsometric/fun';
import type { View } from './funIsometric/fun';
import { boundsCenter, expandBounds, getLayerBounds } from './geometry/bounds';
import type { Bounds } from './geometry/bounds';
import { hitTestScene } from './geometry/hitTest';

export { VIEWS };
export type { Icon, Palette, View };

export interface RenderCanvasOptions {
  frame: number;
  width?: number;
  height?: number;
  palette?: Partial<Palette>;
  showHelpers?: boolean;
  selectedLayerId?: string | null;
  selectedLayerIds?: ReadonlyArray<string> | string[];
  /** Optional precomputed scene so callers can reuse it for hit testing. */
  sceneData?: Scene;
}

const layerBounds = (part: Part, icon: Icon, sc: Scene): Bounds | null =>
  getLayerBounds(part.L, sc.f, at(icon.extrude ?? [0, 0], sc.f), icon.line ?? 4);

/**
 * Renders the sticker plus editor-only helpers. The scene is computed once and
 * passed to the renderer, avoiding the previous double scene calculation.
 */
export function renderInteractiveSticker(
  ctx: CanvasRenderingContext2D,
  icon: Icon,
  options: RenderCanvasOptions
): Scene {
  const {
    frame = 0,
    width = 500,
    height = 500,
    palette,
    showHelpers = false,
    selectedLayerId = null,
    selectedLayerIds,
  } = options;

  ctx.clearRect(0, 0, width, height);

  if (showHelpers) drawCheckerboard(ctx, width, height);

  ctx.save();
  const scale = width / (icon.size ?? 500);
  ctx.scale(scale, scale);

  const sc = options.sceneData ?? scene(icon, frame);
  render(ctx, icon, sc, { ...(palette ?? {}) } as Palette);

  if (showHelpers) {
    const ids =
      selectedLayerIds && selectedLayerIds.length > 0
        ? selectedLayerIds
        : selectedLayerId
        ? [selectedLayerId]
        : [];

    const isMulti = ids.length > 1;
    const primaryId = selectedLayerId ?? (ids.length > 0 ? ids[ids.length - 1] : null);

    for (const id of ids) {
      const selectedPart = sc.parts.find((part) => part.L.id === id);
      if (selectedPart) {
        const bounds = layerBounds(selectedPart, icon, sc);
        if (bounds) {
          const isPrimary = !isMulti || id === primaryId;
          drawLayerHelpers(
            ctx,
            selectedPart.pose,
            bounds,
            Boolean(selectedPart.L.locked),
            !isPrimary
          );
        }
      }
    }
  }

  ctx.restore();
  return sc;
}

function drawLayerHelpers(
  ctx: CanvasRenderingContext2D,
  pose: Pose,
  bounds: Bounds,
  isLocked: boolean,
  isSecondary: boolean = false
) {
  ctx.save();
  const [a, b, c, d, e, f] = pose.m;
  ctx.transform(a, b, c, d, e, f);

  const box = expandBounds(bounds, 14);
  const handles = getLocalHandles(box);

  ctx.strokeStyle = isLocked ? '#f59e0b' : '#2563eb';
  ctx.lineWidth = 2;
  ctx.setLineDash(isLocked ? [4, 4] : isSecondary ? [5, 5] : [6, 6]);
  ctx.strokeRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
  ctx.setLineDash([]);

  if (isLocked) {
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(handles.center.x - 18, handles.center.y - 18, 36, 36, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(handles.center.x - 7, handles.center.y - 2, 14, 12);
    ctx.beginPath();
    ctx.arc(handles.center.x, handles.center.y - 3, 5, Math.PI, 0);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
    return;
  }

  // In multi-selection, secondary layers only need corner indicator markers
  if (isSecondary) {
    for (const corner of handles.corners) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.fillRect(corner.x - 5, corner.y - 5, 10, 10);
      ctx.strokeRect(corner.x - 5, corner.y - 5, 10, 10);
    }
    ctx.restore();
    return;
  }

  // Rotation stem + knob.
  ctx.beginPath();
  ctx.moveTo(handles.rotateAnchor.x, box.minY);
  ctx.lineTo(handles.rotateKnob.x, handles.rotateKnob.y);
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ff6b35';
  ctx.beginPath();
  ctx.arc(handles.rotateKnob.x, handles.rotateKnob.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Pivot.
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(handles.center.x, handles.center.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Corner handles.
  for (const corner of handles.corners) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.fillRect(corner.x - 7, corner.y - 7, 14, 14);
    ctx.strokeRect(corner.x - 7, corner.y - 7, 14, 14);
    ctx.fillStyle = '#ff6b35';
    ctx.beginPath();
    ctx.arc(corner.x, corner.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Horizontal edge handles (scale X).
  for (const edge of handles.edgesX) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(edge.x - 5, edge.y - 9, 10, 18, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(edge.x - 1.5, edge.y - 4, 3, 8);
  }

  // Vertical edge handles (scale Y).
  for (const edge of handles.edgesY) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(edge.x - 9, edge.y - 5, 18, 10, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(edge.x - 4, edge.y - 1.5, 8, 3);
  }

  ctx.restore();
}

type Point = { x: number; y: number };

function getLocalHandles(box: Bounds) {
  const center = boundsCenter(box);
  const pad = 30;
  return {
    center: { x: center[0], y: center[1] },
    rotateAnchor: { x: center[0], y: box.minY },
    rotateKnob: { x: center[0], y: box.minY - pad },
    corners: [
      { x: box.minX, y: box.minY },
      { x: box.maxX, y: box.minY },
      { x: box.maxX, y: box.maxY },
      { x: box.minX, y: box.maxY },
    ],
    edgesX: [
      { x: box.minX, y: center[1] },
      { x: box.maxX, y: center[1] },
    ],
    edgesY: [
      { x: center[0], y: box.minY },
      { x: center[0], y: box.maxY },
    ],
  };
}

function transformPoint(pose: Pose, point: Point): Point {
  const [a, b, c, d, e, f] = pose.m;
  return {
    x: a * point.x + c * point.y + e,
    y: b * point.x + d * point.y + f,
  };
}

export function getLayerScreenHandles(pose: Pose, bounds: Bounds) {
  const local = getLocalHandles(expandBounds(bounds, 14));
  return {
    center: transformPoint(pose, local.center),
    rotateKnob: transformPoint(pose, local.rotateKnob),
    corners: local.corners.map((point) => transformPoint(pose, point)),
    edgesX: local.edgesX.map((point) => transformPoint(pose, point)),
    edgesY: local.edgesY.map((point) => transformPoint(pose, point)),
  };
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const size = 16;
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      ctx.fillStyle = (x / size + y / size) % 2 === 0 ? '#f8fafc' : '#ffffff';
      ctx.fillRect(x, y, size, size);
    }
  }
}

export function findLayerAtPoint(icon: Icon, frame: number, x: number, y: number, sc?: Scene): string | null {
  return hitTestScene(sc ?? scene(icon, frame), icon, x, y);
}
