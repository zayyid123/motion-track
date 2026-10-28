import { Icon, Palette } from '@/lib/funIsometric';
import { draw } from '@/lib/funIsometric/fun';
import gifshot from 'gifshot';

export interface ExportProgress {
  stage: 'rendering' | 'encoding' | 'ready';
  progress: number;
}

export async function captureIconFrames(
  icon: Icon,
  width: number,
  height: number,
  palette: Palette,
  fps: number = 30,
  durationSec: number = 2
): Promise<HTMLCanvasElement[]> {
  const totalFrames = Math.min(icon.frames, Math.floor(fps * durationSec));
  const canvases: HTMLCanvasElement[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) continue;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.save();
    const scale = width / (icon.size ?? 500);
    ctx.scale(scale, scale);
    draw(ctx, icon, f, palette);
    ctx.restore();

    canvases.push(canvas);
  }

  return canvases;
}

export async function exportGIF(
  icon: Icon,
  palette: Palette,
  width: number = 600,
  height: number = 600,
  onProgress?: (p: ExportProgress) => void
): Promise<string> {
  onProgress?.({ stage: 'rendering', progress: 10 });
  const fps = 30; // 30 FPS for fluid high-def GIF
  const duration = (icon.frames || 180) / 60;
  const canvases = await captureIconFrames(icon, width, height, palette, fps, duration);

  onProgress?.({ stage: 'encoding', progress: 35 });

  return new Promise((resolve, reject) => {
    gifshot.createGIF(
      {
        images: canvases,
        gifWidth: width,
        gifHeight: height,
        interval: 1 / fps,
        sampleInterval: 5, // Higher sampling precision for color gradient accuracy
        numWorkers: 4,
        progressCallback: (captureProgress: number) => {
          onProgress?.({
            stage: 'encoding',
            progress: Math.floor(35 + captureProgress * 60),
          });
        },
      },
      (obj) => {
        if (!obj.error) {
          onProgress?.({ stage: 'ready', progress: 100 });
          resolve(obj.image);
        } else {
          reject(new Error(obj.errorMsg || 'Failed to generate GIF'));
        }
      }
    );
  });
}

export async function exportVideo(
  icon: Icon,
  palette: Palette,
  format: 'mp4' | 'mov',
  width: number = 1080,
  height: number = 1080,
  onProgress?: (p: ExportProgress) => void
): Promise<Blob> {
  onProgress?.({ stage: 'rendering', progress: 15 });
  const fps = 60; // 60 FPS Ultra Smooth
  const totalFrames = icon.frames || 180;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: format === 'mov' })!;

  // Smooth image scaling settings
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const stream = canvas.captureStream(fps);

  let mimeType = 'video/webm;codecs=vp9';
  if (format === 'mp4' && MediaRecorder.isTypeSupported('video/mp4')) {
    mimeType = 'video/mp4';
  } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
    mimeType = 'video/webm;codecs=vp9';
  } else if (MediaRecorder.isTypeSupported('video/webm')) {
    mimeType = 'video/webm';
  }

  // High bitrate 24 Mbps for crisp, crystal-clear 1080p/2K renders
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 24000000,
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      onProgress?.({ stage: 'ready', progress: 100 });
      const finalType = format === 'mp4' ? 'video/mp4' : 'video/quicktime';
      const blob = new Blob(chunks, { type: finalType });
      resolve(blob);
    };

    mediaRecorder.onerror = (err) => reject(err);

    mediaRecorder.start();

    let frame = 0;
    const interval = 1000 / fps;

    const intervalId = setInterval(() => {
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      const scale = width / (icon.size ?? 500);
      ctx.scale(scale, scale);
      draw(ctx, icon, frame, palette);
      ctx.restore();

      frame++;
      const currentPct = Math.min(95, Math.floor(15 + (frame / totalFrames) * 75));
      onProgress?.({ stage: 'encoding', progress: currentPct });

      if (frame >= totalFrames) {
        clearInterval(intervalId);
        setTimeout(() => {
          mediaRecorder.stop();
        }, 100);
      }
    }, interval);
  });
}
