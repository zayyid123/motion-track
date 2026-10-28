export const SOURCE_FPS = 60;

/**
 * Plans output frame indices from the 60 FPS source. The full loop is always
 * exported with seamless wrap-around. Optional speed multiplier (e.g. 0.5x, 2x)
 * scales the total frame count accordingly.
 */
export function planFrames(totalFrames: number, fps: number, speed: number = 1): number[] {
  const source = Math.max(1, Math.floor(totalFrames));
  const rate = Math.max(1, Math.min(60, Math.floor(fps)));
  const speedFactor = Math.max(0.1, Math.min(10, speed || 1));
  const count = Math.max(1, Math.round((source * rate) / (SOURCE_FPS * speedFactor)));
  return Array.from({ length: count }, (_, index) => {
    const frame = Math.round((index * source) / count);
    return Math.min(source - 1, frame);
  });
}

export function loopDurationSeconds(totalFrames: number, speed: number = 1): number {
  const speedFactor = Math.max(0.1, Math.min(10, speed || 1));
  return (Math.max(1, totalFrames) / SOURCE_FPS) / speedFactor;
}

export function formatDuration(totalFrames: number, speed: number = 1): string {
  return `${loopDurationSeconds(totalFrames, speed).toFixed(2)}s`;
}
