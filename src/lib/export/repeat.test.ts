import { describe, expect, it } from 'vitest';
import { at, scene } from '@/lib/funIsometric/fun';
import type { Icon, Motion, Track } from '@/lib/funIsometric/fun';
import { bounce, twist } from '@/lib/funIsometric/motions';
import { repeatIcon } from './repeat';

const iconWith = (frames: number, motion: Motion): Icon => ({
  name: 'test',
  frames,
  layers: [{ id: 'a', m: motion, shapes: [{ d: 'M0 0L10 0L10 10Z', fill: 'main' }] }],
});

describe('repeatIcon', () => {
  it('is a no-op for a single cycle', () => {
    const icon = iconWith(180, twist);
    expect(repeatIcon(icon, 1)).toBe(icon);
  });

  it('stretches the frame count across repetitions', () => {
    const icon = iconWith(180, twist);
    const repeated = repeatIcon(icon, 3);
    expect(repeated.frames).toBe(540);
  });

  it('preserves the pose at the start of every repetition', () => {
    const icon = iconWith(180, twist);
    const repeated = repeatIcon(icon, 3);
    // The tiled motion must evaluate to the same pose at the start of each cycle.
    for (const cycle of [0, 1, 2]) {
      const original = scene(icon, 0);
      const tiled = scene(repeated, cycle * 180);
      expect(tiled.parts[0].pose.m).toEqual(original.parts[0].pose.m);
    }
  });

  it('keeps the seam continuous instead of restarting mid-ease', () => {
    const icon = iconWith(180, bounce);
    const repeated = repeatIcon(icon, 2);
    const motion = repeated.layers[0].m as Motion;
    // The tiled track spans the whole stretched clip.
    const last = motion.p![motion.p!.length - 1];
    expect(last[0]).toBe(175 + 180);
    // A frame just before the seam is close to one just after it.
    const before = at(motion.p!, 178);
    const after = at(motion.p!, 180);
    expect(Math.hypot(after[0] - before[0], after[1] - before[1])).toBeLessThan(2);
  });

  it('tiles every motion track of an array motion', () => {
    const icon = iconWith(120, { p: [[0, [0, 0]], [120, [0, 0]]] });
    const repeated = repeatIcon(icon, 2);
    const motion = repeated.layers[0].m as Motion;
    expect(motion.p).toHaveLength(4);
    expect(motion.p![3][0]).toBe(120 + 120);
  });

  it('leaves a layer without motion structurally equal', () => {
    const icon: Icon = { name: 'plain', frames: 90, layers: [{ id: 'a', p: [10, 20], shapes: [] }] };
    const repeated = repeatIcon(icon, 2);
    expect(repeated.layers[0]).toEqual(icon.layers[0]);
    expect(repeated.frames).toBe(180);
  });

  it('tiles shape tracks so trims keep drawing across repetitions', () => {
    const icon: Icon = {
      name: 'ink',
      frames: 180,
      layers: [
        {
          id: 'a',
          shapes: [{ d: 'M0 0L1 1', trim: [[0, 0], [179, 1], [179, 0]] }],
        },
      ],
    };
    const repeated = repeatIcon(icon, 2);
    const trim = repeated.layers[0].shapes[0].trim as Track<number>;
    // Last keyframe of the second repetition: 179 + 180.
    expect(trim[trim.length - 1][0]).toBe(179 + 180);
  });
});
