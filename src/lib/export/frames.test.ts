import { describe, expect, it } from 'vitest';
import { MIN_EXPORT_SECONDS, planFrames, planLoop, formatDuration, loopDurationSeconds } from './frames';

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

  it('scales planned frame count according to speed multiplier', () => {
    // At 2x speed, half the frames are needed to complete the loop in half the time
    const frames2x = planFrames(180, 60, 2);
    expect(frames2x).toHaveLength(90);

    // At 0.5x speed, double the frames are needed for a smooth slow-motion loop
    const framesHalf = planFrames(180, 60, 0.5);
    expect(framesHalf).toHaveLength(360);
  });
});

describe('duration helpers', () => {
  it('converts source frames to seconds', () => {
    expect(loopDurationSeconds(130)).toBeCloseTo(2.1667, 3);
    expect(formatDuration(180)).toBe('3.00s');
  });

  it('adjusts duration according to speed multiplier', () => {
    expect(loopDurationSeconds(180, 2)).toBeCloseTo(1.5, 3);
    expect(formatDuration(180, 2)).toBe('1.50s');
    expect(loopDurationSeconds(180, 0.5)).toBeCloseTo(6.0, 3);
    expect(formatDuration(180, 0.5)).toBe('6.00s');
  });
});

describe('planLoop minimum duration', () => {
  it('repeats short cycles until the clip lasts at least 6 seconds', () => {
    // A 123-frame design is ~2.05s per cycle, so three cycles clear 6s.
    const plan = planLoop(123, 30);
    expect(plan.totalSeconds).toBeGreaterThanOrEqual(MIN_EXPORT_SECONDS);
    expect(plan.cycleCount).toBe(3);
    expect(plan.totalFrames).toBe(123 * 3);
  });

  it('uses two cycles for a 3 second design', () => {
    const plan = planLoop(180, 30);
    expect(plan.cycleCount).toBe(2);
    expect(plan.totalSeconds).toBeGreaterThanOrEqual(MIN_EXPORT_SECONDS);
  });

  it('never repeats a clip that is already long enough', () => {
    // 360 frames at 1x is exactly 6 seconds.
    const plan = planLoop(360, 30);
    expect(plan.cycleCount).toBe(1);
    expect(plan.totalFrames).toBe(360);
    expect(plan.totalSeconds).toBeCloseTo(6, 5);
  });

  it('honours the speed multiplier when sizing cycles', () => {
    // 180 frames at 0.5x is 6s per cycle, so a single cycle is enough.
    const slow = planLoop(180, 30, 0.5);
    expect(slow.cycleCount).toBe(1);
    // 180 frames at 2x is 1.5s per cycle, so four cycles are needed.
    const fast = planLoop(180, 30, 2);
    expect(fast.cycleCount).toBe(4);
    expect(fast.totalSeconds).toBeGreaterThanOrEqual(MIN_EXPORT_SECONDS);
  });

  it('never references a frame outside the repeated clip', () => {
    for (const total of [1, 7, 123, 180, 360]) {
      for (const fps of [24, 30, 60]) {
        const plan = planLoop(total, fps);
        expect(plan.frames.length).toBeGreaterThan(0);
        for (const frame of plan.frames) {
          expect(frame).toBeGreaterThanOrEqual(0);
          expect(frame).toBeLessThan(plan.totalFrames);
        }
      }
    }
  });
});
