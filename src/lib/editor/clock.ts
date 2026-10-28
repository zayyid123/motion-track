export type ClockListener = () => void;

/**
 * Playback clock kept outside React state. Only components that need the
 * current frame subscribe, so the editor panels never re-render at 60 FPS.
 */
export class PlaybackClock {
  private frame = 0;
  private frames = 180;
  private playing = false;
  private loop = true;
  private lastTime = 0;
  private accumulator = 0;
  private raf: number | null = null;

  private frameListeners = new Set<ClockListener>();
  private playingListeners = new Set<ClockListener>();
  private loopListeners = new Set<ClockListener>();

  getFrame = (): number => this.frame;
  getFrames = (): number => this.frames;
  getPlaying = (): boolean => this.playing;
  getLoop = (): boolean => this.loop;

  subscribeFrame = (listener: ClockListener): (() => void) => {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  };

  subscribePlaying = (listener: ClockListener): (() => void) => {
    this.playingListeners.add(listener);
    return () => this.playingListeners.delete(listener);
  };

  subscribeLoop = (listener: ClockListener): (() => void) => {
    this.loopListeners.add(listener);
    return () => this.loopListeners.delete(listener);
  };

  private emitFrame(): void {
    for (const listener of this.frameListeners) listener();
  }

  private emitPlaying(): void {
    for (const listener of this.playingListeners) listener();
  }

  private emitLoop(): void {
    for (const listener of this.loopListeners) listener();
  }

  setFrames(frames: number): void {
    const next = Math.max(1, Math.floor(frames) || 1);
    if (next === this.frames) return;
    this.frames = next;
    if (this.frame >= next) {
      this.frame = next - 1;
      this.emitFrame();
    }
  }

  setLoop(loop: boolean): void {
    if (this.loop === loop) return;
    this.loop = loop;
    this.emitLoop();
  }

  toggleLoop(): void {
    this.setLoop(!this.loop);
  }

  seek(frame: number): void {
    const next = Math.max(0, Math.min(this.frames - 1, Math.round(frame)));
    if (next === this.frame) return;
    this.frame = next;
    this.accumulator = 0;
    this.emitFrame();
  }

  play(): void {
    if (this.playing) return;
    // Restart from the beginning when the playhead is parked at the end.
    if (!this.loop && this.frame >= this.frames - 1) this.seek(0);
    this.playing = true;
    this.accumulator = 0;
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.emitPlaying();
    this.schedule();
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    this.emitPlaying();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  private schedule(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (time: number): void => {
    if (!this.playing) return;

    const step = 1000 / 60;
    const delta = Math.max(0, time - this.lastTime);
    this.lastTime = time;
    this.accumulator += delta;

    let changed = false;
    // Cap catch-up work so a background tab cannot freeze the UI on return.
    let budget = 4;
    while (this.accumulator >= step && budget-- > 0) {
      this.accumulator -= step;
      this.frame += 1;
      changed = true;
    }
    if (this.accumulator > step * 4) this.accumulator = 0;

    if (this.frame >= this.frames) {
      if (this.loop) {
        this.frame %= this.frames;
        changed = true;
      } else {
        this.frame = this.frames - 1;
        this.pause();
        changed = true;
      }
    }

    if (changed) this.emitFrame();
    if (this.playing) this.schedule();
  };

  dispose(): void {
    this.pause();
    this.frameListeners.clear();
    this.playingListeners.clear();
    this.loopListeners.clear();
  }
}
