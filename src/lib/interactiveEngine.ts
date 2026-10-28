import { Icon, Palette, VIEWS, View, draw, scene } from './funIsometric';

export { VIEWS };
export type { Icon, Palette, View };

export interface RenderCanvasOptions {
  frame: number;
  width?: number;
  height?: number;
  palette?: Partial<Palette>;
  showHelpers?: boolean;
  selectedLayerId?: string | null;
  dragging?: {
    x: number;
    y: number;
  } | null;
}

/**
 * Render standard fun-isometric sticker onto 2D canvas with interactive editor bounding boxes and drag guides
 */
export function renderInteractiveSticker(
  ctx: CanvasRenderingContext2D,
  icon: Icon,
  options: RenderCanvasOptions
) {
  const {
    frame = 0,
    width = 500,
    height = 500,
    palette,
    showHelpers = false,
    selectedLayerId = null,
  } = options;

  ctx.clearRect(0, 0, width, height);

  // Subtle checkered grid for transparency in editor mode
  if (showHelpers) {
    drawCheckerboard(ctx, width, height);
  }

  // Draw sticker using fun-isometric renderer
  ctx.save();
  const scale = width / (icon.size ?? 500);
  ctx.scale(scale, scale);

  const sc = scene(icon, frame);
  draw(ctx, icon, frame, palette);

  // Draw selection outlines and interactive handles for the selected layer
  if (showHelpers && selectedLayerId) {
    const selectedPart = sc.parts.find((p) => p.L.id === selectedLayerId);
    if (selectedPart) {
      drawLayerHelpers(ctx, selectedPart.pose, Boolean(selectedPart.L.locked));
    }
  }

  ctx.restore();
}

function drawLayerHelpers(ctx: CanvasRenderingContext2D, pose: { m: [number, number, number, number, number, number] }, isLocked: boolean = false) {
  ctx.save();
  // Transform to layer world space
  const [a, b, c, d, e, f] = pose.m;
  ctx.transform(a, b, c, d, e, f);

  // Draw bounding indicator (amber/gold if locked, blue if unlocked)
  const pad = 120;
  ctx.strokeStyle = isLocked ? '#f59e0b' : '#2563eb';
  ctx.lineWidth = 2;
  ctx.setLineDash(isLocked ? [4, 4] : [6, 6]);
  ctx.strokeRect(-pad, -pad, pad * 2, pad * 2);
  ctx.setLineDash([]);

  // If locked, show a distinct lock badge and don't render active move/resize/rotate handles
  if (isLocked) {
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(-24, -24, 48, 48, 12);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Lock icon shape
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-10, -4, 20, 16);
    ctx.beginPath();
    ctx.arc(0, -5, 7, Math.PI, 0);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.restore();
    return;
  }

  // Rotation Handle at Top
  const rotDist = pad + 38;
  ctx.beginPath();
  ctx.moveTo(0, -pad);
  ctx.lineTo(0, -rotDist);
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Rotation Handle Knob (Generous 12px circle with inner icon)
  ctx.fillStyle = '#ff6b35'; // Tangerine orange rotation knob
  ctx.beginPath();
  ctx.arc(0, -rotDist, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Center pivot handle
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Corner handles (uniform scale) & Edge handles (width / height scale)
  const cornerHandles = [
    [-pad, -pad],
    [pad, -pad],
    [pad, pad],
    [-pad, pad],
  ];

  // Draw 4 corner handles (squares)
  cornerHandles.forEach(([hx, hy]) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.fillRect(hx - 8, hy - 8, 16, 16);
    ctx.strokeRect(hx - 8, hy - 8, 16, 16);

    ctx.fillStyle = '#ff6b35';
    ctx.beginPath();
    ctx.arc(hx, hy, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw 4 edge handles (horizontal & vertical pills)
  // Top & Bottom (Scale Height Y)
  const tbHandles = [
    [0, -pad],
    [0, pad],
  ];
  tbHandles.forEach(([hx, hy]) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(hx - 10, hy - 5, 20, 10, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#2563eb';
    ctx.fillRect(hx - 4, hy - 1.5, 8, 3);
  });

  // Left & Right (Scale Width X)
  const lrHandles = [
    [-pad, 0],
    [pad, 0],
  ];
  lrHandles.forEach(([hx, hy]) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(hx - 5, hy - 10, 10, 20, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#2563eb';
    ctx.fillRect(hx - 1.5, hy - 4, 3, 8);
  });

  ctx.restore();
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

export function getLayerScreenHandles(pose: { m: [number, number, number, number, number, number] }) {
  const [a, b, c, d, e, f] = pose.m;
  const pad = 120;
  const rotDist = pad + 38;

  const transformPoint = (x: number, y: number) => ({
    x: a * x + c * y + e,
    y: b * x + d * y + f,
  });

  return {
    center: transformPoint(0, 0),
    rotateKnob: transformPoint(0, -rotDist),
    corners: [
      transformPoint(-pad, -pad), // Top-left
      transformPoint(pad, -pad),  // Top-right
      transformPoint(pad, pad),   // Bottom-right
      transformPoint(-pad, pad),  // Bottom-left
    ],
    edgesX: [
      transformPoint(-pad, 0),    // Left
      transformPoint(pad, 0),     // Right
    ],
    edgesY: [
      transformPoint(0, -pad),    // Top
      transformPoint(0, pad),     // Bottom
    ],
  };
}

export function findLayerAtPoint(icon: Icon, frame: number, x: number, y: number): string | null {
  const sc = scene(icon, frame);

  // Check from top-most layer to bottom-most layer
  for (let i = sc.parts.length - 1; i >= 0; i--) {
    const part = sc.parts[i];
    if (part.L.hidden) continue;

    // Inverse transform mouse point to layer local coordinates
    const [a, b, c, d, e, f] = part.pose.m;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-6) continue;

    const localX = (d * (x - e) - c * (y - f)) / det;
    const localY = (-b * (x - e) + a * (y - f)) / det;

    // Check hit against layer shapes bounding box
    const hitBox = 110;
    if (Math.abs(localX) <= hitBox && Math.abs(localY) <= hitBox) {
      return part.L.id || null;
    }
  }

  return null;
}
