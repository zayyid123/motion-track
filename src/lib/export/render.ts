import { draw } from '@/lib/funIsometric/fun';
import type { Icon, Palette } from '@/lib/funIsometric/fun';

export interface FrameRendererOptions {
  width: number;
  height: number;
  background: string | null;
  /** GIF/MP4 cannot encode alpha, so callers can force an opaque background. */
  opaqueFallback?: string;
}

export function renderFrameToCanvas(
  icon: Icon,
  palette: Palette,
  frame: number,
  options: FrameRendererOptions
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = options.width;
  canvas.height = options.height;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Unable to create a 2D canvas for export.');

  const background = options.background ?? options.opaqueFallback;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, options.width, options.height);
  }

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const scale = options.width / (icon.size ?? 500);
  ctx.scale(scale, scale);
  draw(ctx, icon, frame, palette);
  ctx.restore();

  return canvas;
}
