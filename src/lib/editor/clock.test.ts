import { describe, expect, it } from 'vitest';
import { PlaybackClock } from './clock';

describe('PlaybackClock', () => {
  it('clamps seek and emits only on change', () => {
    const clock = new PlaybackClock();
    let emissions = 0;
    clock.subscribeFrame(() => {
      emissions += 1;
    });

    clock.setFrames(10);
    clock.seek(5);
    expect(clock.getFrame()).toBe(5);
    expect(emissions).toBe(1);

    clock.seek(5);
    expect(emissions).toBe(1);

    clock.seek(999);
    expect(clock.getFrame()).toBe(9);
    expect(emissions).toBe(2);

    clock.seek(-10);
    expect(clock.getFrame()).toBe(0);

    clock.dispose();
  });

  it('clamps the playhead when the clip gets shorter', () => {
    const clock = new PlaybackClock();
    clock.setFrames(100);
    clock.seek(80);

    let emissions = 0;
    clock.subscribeFrame(() => {
      emissions += 1;
    });

    clock.setFrames(50);
    expect(clock.getFrame()).toBe(49);
    expect(emissions).toBe(1);
    expect(clock.getFrames()).toBe(50);

    clock.dispose();
  });

  it('toggles loop and notifies loop subscribers', () => {
    const clock = new PlaybackClock();
    let emissions = 0;
    clock.subscribeLoop(() => {
      emissions += 1;
    });

    expect(clock.getLoop()).toBe(true);
    clock.toggleLoop();
    expect(clock.getLoop()).toBe(false);
    expect(emissions).toBe(1);

    clock.setLoop(false);
    expect(emissions).toBe(1);

    clock.dispose();
  });

  it('toggles play state', () => {
    const clock = new PlaybackClock();
    let emissions = 0;
    clock.subscribePlaying(() => {
      emissions += 1;
    });

    clock.play();
    expect(clock.getPlaying()).toBe(true);
    clock.pause();
    expect(clock.getPlaying()).toBe(false);
    expect(emissions).toBe(2);

    clock.dispose();
  });
});
