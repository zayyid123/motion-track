export const SOURCE_FPS = 60;

/** Every export is padded with whole animation cycles until it lasts at least this long. */
export const MIN_EXPORT_SECONDS = 6;

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

/**
 * The result of repeating the animation cycle enough times to clear the minimum
 * export duration. `frames[i]` is the absolute source frame for output frame
 * `i` (in `[0, cycleFrames * cycleCount)`), matching the frame count of the
 * icon produced by `repeatIcon`.
 */
export interface LoopPlan {
  frames: number[];
  cycleCount: number;
  /** Source frames in one cycle (the design's native length). */
  cycleFrames: number;
  /** Absolute frame count the repeated icon plays over (`cycleFrames * cycleCount`). */
  totalFrames: number;
  totalSeconds: number;
}

/**
 * Repeats the animation cycle back-to-back until the clip lasts at least
 * `MIN_EXPORT_SECONDS`, keeping the original motion speed and easing intact.
 *
 * The plan is just a single frame plan over the stretched clip length, so the
 * frame math stays identical to `planFrames`; `repeatIcon` tiles the motion
 * tracks over the same stretched length so the seam between repetitions is
 * seamless rather than a hard restart.
 */
export function planLoop(totalFrames: number, fps: number, speed: number = 1): LoopPlan {
  const source = Math.max(1, Math.floor(totalFrames));
  const speedFactor = Math.max(0.1, Math.min(10, speed || 1));
  const cycleSeconds = (source / SOURCE_FPS) / speedFactor;
  const cycleCount = Math.max(1, Math.ceil(MIN_EXPORT_SECONDS / cycleSeconds));

  const stretched = source * cycleCount;
  const frames = planFrames(stretched, fps, speed);
  const totalSeconds = frames.length / Math.max(1, Math.min(60, Math.floor(fps)));

  return {
    frames,
    cycleCount,
    cycleFrames: source,
    totalFrames: stretched,
    totalSeconds,
  };
}

export function loopDurationSeconds(totalFrames: number, speed: number = 1): number {
  const speedFactor = Math.max(0.1, Math.min(10, speed || 1));
  return (Math.max(1, totalFrames) / SOURCE_FPS) / speedFactor;
}

export function formatDuration(totalFrames: number, speed: number = 1): string {
  return `${loopDurationSeconds(totalFrames, speed).toFixed(2)}s`;
}
