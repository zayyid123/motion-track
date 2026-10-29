import { shift } from '@/lib/funIsometric/fun';
import type { Anim, Icon, Layer, Motion, Shape, Track } from '@/lib/funIsometric/fun';

/**
 * Tiles a keyframe track end-to-end `count` times, shifting repetition `n` by
 * `n * step` source frames. A track that already returns to its starting value
 * at the end of the cycle (the house style for looping motions) therefore reads
 * as one long, seamless animation rather than restarting.
 */
function tileTrack<T>(track: Track<T>, step: number, count: number): Track<T> {
  if (count <= 1 || track.length === 0) return track;
  const out: Array<Track<T>[number]> = [];
  for (let cycle = 0; cycle < count; cycle += 1) {
    if (cycle === 0) out.push(...track);
    else out.push(...shift(track, cycle * step));
  }
  return out;
}

/** Tiles any animated value: constant values and non-array values pass through. */
function tileAnim<T>(value: Anim<T> | undefined, step: number, count: number): Anim<T> | undefined {
  if (!Array.isArray(value) || !Array.isArray(value[0])) return value;
  return tileTrack(value as Track<T>, step, count);
}

const tileMotionTrack = <T>(value: Track<T> | undefined, step: number, count: number): Track<T> | undefined =>
  value ? tileTrack(value, step, count) : undefined;

const tileShape = (shape: Shape, step: number, count: number): Shape => ({
  ...shape,
  d: tileAnim(shape.d, step, count) as Shape['d'],
  trim: tileAnim(shape.trim, step, count),
});

const tileMotion = (motion: Motion, step: number, count: number, cycleLength: number): Motion => ({
  ...motion,
  // The window the track repeats over becomes the full multi-cycle clip, so
  // `mod(frame - at, loop)` walks through every tiled repetition.
  loop: (motion.loop ?? cycleLength) * count,
  r: tileMotionTrack(motion.r, step, count),
  p: tileMotionTrack(motion.p, step, count),
  s: tileMotionTrack(motion.s, step, count),
  o: tileMotionTrack(motion.o, step, count),
  x: tileMotionTrack(motion.x, step, count),
});

/**
 * Extends a single-cycle icon so its animation plays back over `cycles`
 * repetitions with a seamless seam. The icon's frame count is stretched to
 * `originalFrames * cycles`, and every keyframe track — motion and shape alike —
 * is tiled to match, so `scene()` / `draw()` keep working unchanged; they simply
 * see a longer clip.
 *
 * Constant values (`p: [250, 300]`, a static shape `d`, a fixed `extrude`) are
 * left untouched. A `loop` shorter than the design's length (e.g. `sway` looping
 * over 180 frames) keeps its own shorter period but is still tiled so it does not
 * run out mid-clip.
 */
export function repeatIcon(icon: Icon, cycles: number): Icon {
  if (cycles <= 1) return icon;

  const step = icon.frames;

  const layers: Layer[] = icon.layers.map((layer) => {
    const shapes = layer.shapes.map((shape) => tileShape(shape, step, cycles));
    if (!layer.m) return { ...layer, shapes };

    const motion = Array.isArray(layer.m)
      ? (layer.m as ReadonlyArray<Motion>).map((m) => tileMotion(m, step, cycles, icon.frames))
      : tileMotion(layer.m as Motion, step, cycles, icon.frames);

    return { ...layer, shapes, m: motion as Layer['m'] };
  });

  return {
    ...icon,
    frames: icon.frames * cycles,
    extrude: tileAnim(icon.extrude, step, cycles),
    layers,
  };
}
