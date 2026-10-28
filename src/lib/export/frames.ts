export const SOURCE_FPS = 60;

/**
 * Plans output frame indices from the 60 FPS source. The full loop is always
 * exported: 130 source frames at 30 FPS become 65 output frames lasting 2.166s,
 * instead of the previous truncated half-loop.
 */
export function planFrames(totalFrames: number, fps: number): number[] {
  const source = Math.max(1, Math.floor(totalFrames));
  const rate = Math.max(1, Math.min(60, Math.floor(fps)));
  const count = Math.max(1, Math.round((source * rate) / SOURCE_FPS));
  return Array.from({ length: count }, (_, index) => {
    const frame = Math.round((index * source) / count);
    return Math.min(source - 1, frame);
  });
}

export function loopDurationSeconds(totalFrames: number): number {
  return Math.max(1, totalFrames) / SOURCE_FPS;
}

export function formatDuration(totalFrames: number): string {
  return `${loopDurationSeconds(totalFrames).toFixed(2)}s`;
}
