'use client';

import { useSyncExternalStore } from 'react';
import type { PlaybackClock } from '@/lib/editor/clock';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function usePlaybackFrame(clock: PlaybackClock): number {
  return useSyncExternalStore(clock.subscribeFrame, clock.getFrame, clock.getFrame);
}

export function useIsPlaying(clock: PlaybackClock): boolean {
  return useSyncExternalStore(clock.subscribePlaying, clock.getPlaying, () => false);
}

export function useClockLoop(clock: PlaybackClock): boolean {
  return useSyncExternalStore(clock.subscribeLoop, clock.getLoop, () => true);
}

export function usePlaybackSpeed(clock: PlaybackClock): number {
  return useSyncExternalStore(clock.subscribeSpeed, clock.getSpeed, () => 1);
}

const subscribeReducedMotion = (onChange: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

const getReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches;

/** True when the OS asks for reduced motion. Safe during server rendering. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
}
