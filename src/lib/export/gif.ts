import gifshot from 'gifshot';
import type { Icon, Palette } from '@/lib/funIsometric/fun';
import { planFrames } from './frames';
import { renderFrameToCanvas } from './render';
import { assertNotCancelled, ExportCancelledError } from './types';
import type { ExportResult, ProgressFn } from './types';

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function exportGIF(
  icon: Icon,
  palette: Palette,
  width: number,
  height: number,
  fps: number,
  background: string | null,
  onProgress?: ProgressFn,
  signal?: AbortSignal
): Promise<ExportResult> {
  const solidBg = background ?? '#ffffff';
  const frames = planFrames(icon.frames || 180, fps);
  const canvases: HTMLCanvasElement[] = [];

  for (let index = 0; index < frames.length; index += 1) {
    assertNotCancelled(signal);
    canvases.push(
      renderFrameToCanvas(icon, palette, frames[index], {
        width,
        height,
        background: solidBg,
        opaqueFallback: '#ffffff',
      })
    );
    onProgress?.({
      stage: 'rendering',
      progress: Math.round((index / frames.length) * 30),
      detail: `Rendering frame ${index + 1} of ${frames.length}`,
    });
    if (index % 4 === 0) await yieldToUi();
  }

  assertNotCancelled(signal);
  onProgress?.({ stage: 'encoding', progress: 30, detail: 'Quantizing colors' });

  const dataUrl = await new Promise<string>((resolve, reject) => {
    let settled = false;
    gifshot.createGIF(
      {
        images: canvases,
        gifWidth: width,
        gifHeight: height,
        interval: 1 / fps,
        sampleInterval: 10,
        numWorkers: 2,
        progressCallback: (captureProgress: number) => {
          onProgress?.({
            stage: 'encoding',
            progress: Math.round(30 + captureProgress * 65),
            detail: 'Encoding GIF',
          });
        },
      },
      (result) => {
        if (settled) return;
        settled = true;
        if (result.error) {
          reject(new Error(result.errorMsg || 'Failed to encode GIF.'));
          return;
        }
        resolve(result.image);
      }
    );
  });

  if (signal?.aborted) throw new ExportCancelledError();

  onProgress?.({ stage: 'ready', progress: 100, detail: 'GIF ready' });
  const name = (icon.name || 'sticker').toLowerCase().replace(/\s+/g, '-');
  return {
    url: dataUrl,
    filename: `${name}.gif`,
    mimeType: 'image/gif',
    extension: 'gif',
    note: background ? undefined : 'GIF requires an opaque background; default white was used.',
  };
}
