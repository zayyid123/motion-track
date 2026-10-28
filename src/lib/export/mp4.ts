import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import type { Icon, Palette } from '@/lib/funIsometric/fun';
import { planFrames } from './frames';
import { renderFrameToCanvas } from './render';
import { assertNotCancelled, ExportCancelledError } from './types';
import type { ExportResult, ProgressFn } from './types';

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const cleanName = (icon: Icon) => (icon.name || 'sticker').toLowerCase().replace(/\s+/g, '-');

async function pickCodec(width: number, height: number, fps: number): Promise<{ codec: string; bitrate: number } | null> {
  if (typeof VideoEncoder === 'undefined' || !VideoEncoder.isConfigSupported) return null;

  const bitrate = Math.min(24_000_000, Math.max(4_000_000, Math.round(width * height * fps * 0.12)));
  const candidates =
    width * height > 1920 * 1080
      ? ['avc1.640033', 'avc1.640032', 'avc1.640028']
      : ['avc1.640028', 'avc1.4d0028', 'avc1.42001f'];

  for (const codec of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate: fps });
      if (support.supported) return { codec, bitrate };
    } catch {
      // Try the next codec.
    }
  }
  return null;
}

async function exportWithWebCodecs(
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
  const codec = await pickCodec(width, height, fps);
  if (!codec) throw new Error('No supported H.264 encoder configuration.');

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height, frameRate: fps },
    fastStart: 'in-memory',
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      encoderError = error;
    },
  });

  encoder.configure({
    codec: codec.codec,
    width,
    height,
    bitrate: codec.bitrate,
    framerate: fps,
    latencyMode: 'quality',
  });

  try {
    const frames = planFrames(icon.frames || 180, fps, speed);
    const duration = Math.round(1_000_000 / fps);

    for (let index = 0; index < frames.length; index += 1) {
      assertNotCancelled(signal);
      const canvas = renderFrameToCanvas(icon, palette, frames[index], {
        width,
        height,
        background,
        opaqueFallback: '#ffffff',
      });
      const videoFrame = new VideoFrame(canvas, {
        timestamp: Math.round((index * 1_000_000) / fps),
        duration,
      });
      encoder.encode(videoFrame, { keyFrame: index % Math.max(1, fps) === 0 });
      videoFrame.close();

      onProgress?.({
        stage: 'encoding',
        progress: Math.round(10 + (index / frames.length) * 75),
        detail: `Encoding frame ${index + 1} of ${frames.length}`,
      });
      if (index % 3 === 0) await yieldToUi();
    }

    await encoder.flush();
    if (encoderError) throw encoderError;
    if (signal?.aborted) throw new ExportCancelledError();

    onProgress?.({ stage: 'encoding', progress: 92, detail: 'Finalizing MP4 container' });
    muxer.finalize();

    const blob = new Blob([target.buffer], { type: 'video/mp4' });
    onProgress?.({ stage: 'ready', progress: 100, detail: 'MP4 ready' });
    return {
      url: URL.createObjectURL(blob),
      filename: `${cleanName(icon)}.mp4`,
      mimeType: 'video/mp4',
      extension: 'mp4',
      note: background ? undefined : 'MP4/H.264 does not support alpha; default white was used.',
    };
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
}

async function exportWithMediaRecorder(
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
  if (typeof MediaRecorder === 'undefined') throw new Error('This browser does not support video recording.');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Unable to create the export canvas.');

  const mimeCandidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm',
  ];
  const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  if (!mimeType) throw new Error('This browser cannot record MP4 or WebM video.');

  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: Math.min(24_000_000, Math.max(4_000_000, Math.round(width * height * fps * 0.12))),
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error('Video recorder failed.'));
  });

  const frames = planFrames(icon.frames || 180, fps, speed);
  const frameDuration = 1000 / fps;

  try {
    recorder.start();
    for (let index = 0; index < frames.length; index += 1) {
      assertNotCancelled(signal);
      const rendered = renderFrameToCanvas(icon, palette, frames[index], {
        width,
        height,
        background,
        opaqueFallback: '#ffffff',
      });
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(rendered, 0, 0);
      track.requestFrame();
      onProgress?.({
        stage: 'encoding',
        progress: Math.round(10 + (index / frames.length) * 80),
        detail: `Recording frame ${index + 1} of ${frames.length}`,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, frameDuration));
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 120));
    recorder.stop();
    await stopped;
  } finally {
    stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
  }

  if (signal?.aborted) throw new ExportCancelledError();

  const actualMime = recorder.mimeType || mimeType;
  const extension = actualMime.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob(chunks, { type: actualMime });
  onProgress?.({ stage: 'ready', progress: 100, detail: `${extension.toUpperCase()} ready` });

  return {
    url: URL.createObjectURL(blob),
    filename: `${cleanName(icon)}.${extension}`,
    mimeType: actualMime,
    extension,
    note:
      extension === 'webm'
        ? 'WebCodecs H.264 is unavailable in this browser, so a WebM file was produced instead of MP4.'
        : undefined,
  };
}

export async function exportMP4(
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
  const solidBg = background ?? '#ffffff';
  const codec = await pickCodec(width, height, fps);
  if (codec) {
    return exportWithWebCodecs(icon, palette, width, height, fps, solidBg, onProgress, signal, speed);
  }
  return exportWithMediaRecorder(icon, palette, width, height, fps, solidBg, onProgress, signal, speed);
}
