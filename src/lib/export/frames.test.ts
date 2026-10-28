import { describe, expect, it } from 'vitest';
import { planFrames, formatDuration, loopDurationSeconds } from './frames';

describe('planFrames', () => {
  it('exports the full loop at 30 fps without duplicating the boundary frame', () => {
    const frames = planFrames(130, 30);

    expect(frames).toHaveLength(65);
    expect(frames[0]).toBe(0);
    expect(frames[frames.length - 1]).toBe(128);
    expect(new Set(frames).size).toBe(frames.length);
  });

  it('keeps every source frame at 60 fps', () => {
    const frames = planFrames(180, 60);

    expect(frames).toHaveLength(180);
    expect(frames[0]).toBe(0);
    expect(frames[179]).toBe(179);
  });

  it('handles short clips and low frame rates', () => {
    expect(planFrames(1, 60)).toEqual([0]);
    expect(planFrames(130, 24)).toHaveLength(52);
  });

  it('never references a frame outside the clip', () => {
    for (const total of [1, 7, 130, 180, 181]) {
      for (const fps of [1, 24, 30, 60]) {
        for (const frame of planFrames(total, fps)) {
          expect(frame).toBeGreaterThanOrEqual(0);
          expect(frame).toBeLessThan(total);
        }
      }
    }
  });

  it('clamps unsupported frame rates', () => {
    expect(planFrames(60, 0)).toHaveLength(1);
    expect(planFrames(60, 240)).toHaveLength(60);
  });
});

describe('duration helpers', () => {
  it('converts source frames to seconds', () => {
    expect(loopDurationSeconds(130)).toBeCloseTo(2.1667, 3);
    expect(formatDuration(180)).toBe('3.00s');
  });
});
