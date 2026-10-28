import type { FFmpeg } from '@ffmpeg/ffmpeg';
import type { Icon, Palette } from '@/lib/funIsometric/fun';
import { planFrames } from './frames';
import { renderFrameToCanvas } from './render';
import { assertNotCancelled, ExportCancelledError } from './types';
import type { ExportResult, ProgressFn } from './types';

// Served from public/ffmpeg by scripts/sync-ffmpeg.mjs. Serving both wrapper
// and core ESM same-origin avoids external CDN latency, rate limits, CORS issues,
// and lets the module worker load ffmpeg-core ESM directly.
const WRAPPER_URL = '/ffmpeg/index.js';
const CORE_JS_URL = '/ffmpeg/ffmpeg-core.js';
const CORE_WASM_URL = '/ffmpeg/ffmpeg-core.wasm';

let ffmpegPromise: Promise<FFmpeg> | null = null;

function resetFFmpeg(): void {
  const pending = ffmpegPromise;
  ffmpegPromise = null;
  void pending?.then((instance) => instance.terminate()).catch(() => {});
}

async function getFFmpeg(onProgress?: ProgressFn): Promise<FFmpeg> {
  if (ffmpegPromise) return ffmpegPromise;

  ffmpegPromise = (async () => {
    onProgress?.({ stage: 'rendering', progress: 1, detail: 'Loading ProRes encoder (first run only)' });
    const [{ toBlobURL }, wrapper] = await Promise.all([
      import('@ffmpeg/util'),
      import(/* turbopackIgnore: true */ WRAPPER_URL) as Promise<typeof import('@ffmpeg/ffmpeg')>,
    ]);
    const instance = new wrapper.FFmpeg();
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(CORE_JS_URL, 'text/javascript'),
      toBlobURL(CORE_WASM_URL, 'application/wasm'),
    ]);
    await instance.load({ coreURL, wasmURL });
    return instance;
  })().catch((error) => {
    ffmpegPromise = null;
    throw error instanceof Error ? error : new Error(String(error));
  });

  return ffmpegPromise;
}

const canvasToPng = (canvas: HTMLCanvasElement): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Unable to encode PNG frame.'));
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });

const cleanup = async (ffmpeg: FFmpeg, paths: string[]) => {
  await Promise.all(
    paths.map((path) =>
      ffmpeg.deleteFile(path).catch(() => {
        // Best-effort cleanup; the worker may already be gone after an abort.
      })
    )
  );
};

export async function exportMOV(
  icon: Icon,
  palette: Palette,
  width: number,
  height: number,
  fps: number,
  background: string | null,
  onProgress?: ProgressFn,
  signal?: AbortSignal,
  speed: number = 1
): Promise<ExportResult> {
  assertNotCancelled(signal);
  const ffmpeg = await getFFmpeg(onProgress);
  const frames = planFrames(icon.frames || 180, fps, speed);
  const inputPattern = 'frame%05d.png';
  const output = 'motion-track.mov';
  const files = frames.map((_, index) => `frame${String(index + 1).padStart(5, '0')}.png`);

  const logs: string[] = [];
  const logHandler = ({ message }: { message: string }) => {
    logs.push(message);
    if (logs.length > 40) logs.shift();
  };
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.({
      stage: 'encoding',
      progress: Math.min(96, Math.round(25 + progress * 70)),
      detail: 'Encoding ProRes 4444 MOV',
    });
  };

  try {
    // Render a PNG sequence (RGBA) for ffmpeg.
    for (let index = 0; index < frames.length; index += 1) {
      assertNotCancelled(signal);
      const canvas = renderFrameToCanvas(icon, palette, frames[index], {
        width,
        height,
        background,
      });
      const png = await canvasToPng(canvas);
      await ffmpeg.writeFile(files[index], png);
      onProgress?.({
        stage: 'rendering',
        progress: Math.round(2 + (index / frames.length) * 20),
        detail: `Rendering frame ${index + 1} of ${frames.length}`,
      });
      if (index % 3 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    assertNotCancelled(signal);
    onProgress?.({ stage: 'encoding', progress: 24, detail: 'Encoding ProRes 4444 MOV' });
    ffmpeg.on('log', logHandler);
    ffmpeg.on('progress', progressHandler);

    const proresArgs = [
      '-framerate',
      String(fps),
      '-i',
      inputPattern,
      '-c:v',
      'prores_ks',
      '-profile:v',
      '4',
      '-pix_fmt',
      'yuva444p10le',
      '-vendor',
      'apl0',
      '-alpha_bits',
      '16',
      '-an',
      '-y',
      output,
    ];

    let exitCode = await ffmpeg.exec(proresArgs, undefined, { signal });

    if (exitCode !== 0) {
      logs.length = 0;
      onProgress?.({ stage: 'encoding', progress: 30, detail: 'ProRes unavailable, trying QuickTime Animation' });
      await cleanup(ffmpeg, [output]);
      // QuickTime Animation (qtrle) also supports alpha and is available in
      // more ffmpeg.wasm builds than prores_ks.
      exitCode = await ffmpeg.exec(
        ['-framerate', String(fps), '-i', inputPattern, '-c:v', 'qtrle', '-pix_fmt', 'argb', '-an', '-y', output],
        undefined,
        { signal }
      );
    }

    if (exitCode !== 0) {
      const detail = logs.slice(-4).join(' | ');
      throw new Error(`MOV encoding failed${detail ? `: ${detail}` : '.'}`);
    }

    if (signal?.aborted) throw new ExportCancelledError();

    const data = await ffmpeg.readFile(output);
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], { type: 'video/quicktime' });
    onProgress?.({ stage: 'ready', progress: 100, detail: 'MOV ready' });

    const name = (icon.name || 'sticker').toLowerCase().replace(/\s+/g, '-');
    return {
      url: URL.createObjectURL(blob),
      filename: `${name}.mov`,
      mimeType: 'video/quicktime',
      extension: 'mov',
      note: background
        ? 'ProRes 4444 always stores an alpha channel; the opaque background is baked into the frames.'
        : 'ProRes 4444 with alpha channel. Verify playback in QuickTime or your NLE.',
    };
  } catch (error) {
    if (signal?.aborted) {
      resetFFmpeg();
      throw new ExportCancelledError();
    }
    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    ffmpeg.off('log', logHandler);
    ffmpeg.off('progress', progressHandler);
    await cleanup(ffmpeg, [...files, output]);
  }
}
