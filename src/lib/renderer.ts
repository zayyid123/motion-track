import { StickerProject, StickerLayer, RoleColorKey } from '@/types/sticker';
import { PALETTES } from '@/types/palettes';
import { calculateMotion } from './motionEngine';

export interface RenderOptions {
  frame: number;
  totalFrames?: number;
  width?: number;
  height?: number;
  showHelpers?: boolean;
  selectedLayerId?: string | null;
}

/**
 * Resolves color from role or custom hex
 */
export function resolveColor(
  role: RoleColorKey,
  project: StickerProject,
  fallback = '#111827'
): string {
  if (project.customPalette && project.customPalette[role]) {
    return project.customPalette[role]!;
  }
  const currentPalette = PALETTES[project.paletteId] || PALETTES.riso;
  return currentPalette.colors[role] || fallback;
}

/**
 * Direction vectors for isometric extrusions
 */
export function getExtrudeVector(facing: string): { x: number; y: number } {
  if (facing === 'right') return { x: 0.8, y: 0.6 };
  if (facing === 'left') return { x: -0.8, y: 0.6 };
  if (facing === 'front') return { x: 0, y: 1.0 };
  if (facing === 'flat') return { x: 0.4, y: 0.3 };
  return { x: 0, y: 1 };
}

/**
 * Draw isometric sticker scene on HTML5 2D Canvas
 */
export function renderSticker(
  ctx: CanvasRenderingContext2D,
  project: StickerProject,
  options: RenderOptions
) {
  const {
    frame = 0,
    totalFrames = 120,
    width = 500,
    height = 500,
    showHelpers = false,
    selectedLayerId = null,
  } = options;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Background
  if (project.canvasBg) {
    ctx.fillStyle = project.canvasBg;
    ctx.fillRect(0, 0, width, height);
  } else if (showHelpers) {
    // Subtle checkerboard pattern for editor canvas
    drawCheckerboard(ctx, width, height);
  }

  // Calculate motion transform
  const motionTransform = calculateMotion(
    project.motion.preset,
    frame,
    totalFrames,
    project.motion.intensity
  );

  // Global scale to fit canvas
  const scale = width / 500;
  ctx.save();
  ctx.scale(scale, scale);

  // Apply root motion to scene
  ctx.translate(250 + motionTransform.dx, 250 + motionTransform.dy);
  ctx.rotate((motionTransform.dRotation * Math.PI) / 180);
  ctx.scale(motionTransform.scale, motionTransform.scale);
  ctx.translate(-250, -250);

  // Facing extrude direction vectors
  const extrudeVector = getExtrudeVector(project.facing);

  // Draw each layer back to front
  for (const layer of project.layers) {
    if (!layer.visible) continue;

    ctx.save();
    renderLayer(ctx, layer, project, extrudeVector);

    // Draw selection helper in editor mode
    if (showHelpers && selectedLayerId === layer.id) {
      drawSelectionBox(ctx, layer);
    }
    ctx.restore();
  }

  ctx.restore();
}

function renderLayer(
  ctx: CanvasRenderingContext2D,
  layer: StickerLayer,
  project: StickerProject,
  extrudeVector: { x: number; y: number }
) {
  const fillColor = layer.customHex || resolveColor(layer.fillRole, project);
  const sideColor = layer.sideColorRole
    ? resolveColor(layer.sideColorRole, project)
    : resolveColor('deep', project);
  const inkColor = resolveColor('ink', project, '#111827');

  ctx.save();
  ctx.translate(layer.x, layer.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);

  // Draw extruded slab if depth > 0
  if (layer.depth > 0) {
    const steps = Math.max(2, Math.floor(layer.depth));
    for (let i = steps; i >= 1; i--) {
      const offsetX = extrudeVector.x * (i * (layer.depth / steps));
      const offsetY = extrudeVector.y * (i * (layer.depth / steps));

      ctx.save();
      ctx.translate(offsetX, offsetY);
      drawShapePath(ctx, layer);
      ctx.fillStyle = sideColor;
      ctx.fill();
      ctx.lineWidth = layer.outlineWidth;
      ctx.strokeStyle = inkColor;
      ctx.lineJoin = 'miter';
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw front face
  drawShapePath(ctx, layer);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.lineWidth = layer.outlineWidth;
  ctx.strokeStyle = inkColor;
  ctx.lineJoin = 'miter';
  ctx.stroke();

  ctx.restore();
}

function drawShapePath(ctx: CanvasRenderingContext2D, layer: StickerLayer) {
  const hw = layer.width / 2;
  const hh = layer.height / 2;

  ctx.beginPath();

  switch (layer.shapeType) {
    case 'slab-rect': {
      const radius = 12;
      ctx.roundRect(-hw, -hh, layer.width, layer.height, radius);
      break;
    }
    case 'slab-circle': {
      ctx.ellipse(0, 0, hw, hh * 0.7, 0, 0, Math.PI * 2);
      break;
    }
    case 'spark': {
      // 4-pointed sparkle
      const s = hw;
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(0, 0, s, 0);
      ctx.quadraticCurveTo(0, 0, 0, s);
      ctx.quadraticCurveTo(0, 0, -s, 0);
      ctx.quadraticCurveTo(0, 0, 0, -s);
      ctx.closePath();
      break;
    }
    case 'pencil-body': {
      // Isometric pencil hexagon bar representation
      ctx.roundRect(-hw, -hh, layer.width, layer.height, 8);
      break;
    }
    case 'pencil-tip': {
      // Triangle tip
      ctx.moveTo(-hw, -hh);
      ctx.lineTo(hw, 0);
      ctx.lineTo(-hw, hh);
      ctx.closePath();
      break;
    }
    case 'paper-sheet': {
      // Isometric folded paper sheet
      const radius = 10;
      ctx.roundRect(-hw, -hh, layer.width, layer.height, radius);
      break;
    }
    default: {
      ctx.rect(-hw, -hh, layer.width, layer.height);
    }
  }
}

function drawSelectionBox(ctx: CanvasRenderingContext2D, layer: StickerLayer) {
  ctx.save();
  ctx.translate(layer.x, layer.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);

  const pad = 8;
  const hw = layer.width / 2 + pad;
  const hh = layer.height / 2 + pad;

  ctx.strokeStyle = '#2563eb'; // Electric Cobalt Blue
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
  ctx.setLineDash([]);

  // Rotation stem line & handle
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -hh);
  ctx.lineTo(0, -hh - 22);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, -hh - 22, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Corner Resize Handles
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 2.5;
  const handleSize = 8;
  [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].forEach(([x, y]) => {
    ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
  });

  ctx.restore();
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const size = 16;
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      ctx.fillStyle = ((x / size) + (y / size)) % 2 === 0 ? '#e2e8f0' : '#ffffff';
      ctx.fillRect(x, y, size, size);
    }
  }
}
