import { StickerProject } from '@/types/sticker';
import { renderSticker } from './renderer';
import gifshot from 'gifshot';

export interface ExportProgress {
  stage: 'rendering' | 'encoding' | 'ready';
  progress: number; // 0..100
}

/**
 * Capture frame sequence from canvas offscreen
 */
export async function captureFrames(
  project: StickerProject,
  width: number,
  height: number,
  fps: number = 30,
  durationSec: number = 2
): Promise<HTMLCanvasElement[]> {
  const totalFrames = Math.floor(fps * durationSec);
  const canvases: HTMLCanvasElement[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    renderSticker(ctx, project, {
      frame: f,
      totalFrames,
      width,
      height,
      showHelpers: false,
    });

    canvases.push(canvas);
  }

  return canvases;
}

/**
 * Export animated GIF
 */
export async function exportGIF(
  project: StickerProject,
  width: number = 400,
  height: number = 400,
  onProgress?: (p: ExportProgress) => void
): Promise<string> {
  onProgress?.({ stage: 'rendering', progress: 10 });
  const fps = 25;
  const duration = 2; // 2s loop
  const canvases = await captureFrames(project, width, height, fps, duration);

  onProgress?.({ stage: 'encoding', progress: 40 });

  return new Promise((resolve, reject) => {
    gifshot.createGIF(
      {
        images: canvases,
        gifWidth: width,
        gifHeight: height,
        interval: 1 / fps,
        numWorkers: 2,
        progressCallback: (captureProgress: number) => {
          onProgress?.({
            stage: 'encoding',
            progress: Math.floor(40 + captureProgress * 55),
          });
        },
      },
      (obj) => {
        if (!obj.error) {
          onProgress?.({ stage: 'ready', progress: 100 });
          resolve(obj.image); // base64 gif url
        } else {
          reject(new Error(obj.errorMsg || 'Failed to generate GIF'));
        }
      }
    );
  });
}

/**
 * Export MP4 or MOV video using WebCodecs/MediaRecorder with high quality
 */
export async function exportVideo(
  project: StickerProject,
  format: 'mp4' | 'mov',
  width: number = 500,
  height: number = 500,
  onProgress?: (p: ExportProgress) => void
): Promise<Blob> {
  onProgress?.({ stage: 'rendering', progress: 15 });
  const fps = 30;
  const duration = 2.5;
  const totalFrames = Math.floor(fps * duration);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Stream from canvas
  const stream = canvas.captureStream(fps);

  // Determine mimeType
  let mimeType = 'video/webm;codecs=vp9';
  if (format === 'mp4' && MediaRecorder.isTypeSupported('video/mp4')) {
    mimeType = 'video/mp4';
  } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
    mimeType = 'video/webm;codecs=vp9';
  } else if (MediaRecorder.isTypeSupported('video/webm')) {
    mimeType = 'video/webm';
  }

  const mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8000000, // 8 Mbps
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      onProgress?.({ stage: 'ready', progress: 100 });
      // Pack into blob with appropriate target mime
      const finalType = format === 'mp4' ? 'video/mp4' : 'video/quicktime';
      const blob = new Blob(chunks, { type: finalType });
      resolve(blob);
    };

    mediaRecorder.onerror = (err) => {
      reject(err);
    };

    mediaRecorder.start();

    // Render loop synced to recorder
    let frame = 0;
    const interval = 1000 / fps;

    const intervalId = setInterval(() => {
      renderSticker(ctx, project, {
        frame,
        totalFrames,
        width,
        height,
        showHelpers: false,
      });

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
