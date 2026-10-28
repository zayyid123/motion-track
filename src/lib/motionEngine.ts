import { MotionPresetType } from '@/types/sticker';

export interface MotionTransform {
  dx: number;
  dy: number;
  dRotation: number;
  scale: number;
  opacity: number;
}

/**
 * Standard cubic bezier evaluation
 */
function cubicBezier(t: number, p1x: number, p1y: number, p2x: number, p2y: number): number {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  // Newton-Raphson to solve for x(u) = t
  let u = t;
  for (let i = 0; i < 5; i++) {
    const currentX = ((ax * u + bx) * u + cx) * u;
    const currentSlope = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(currentSlope) < 1e-5) break;
    u -= (currentX - t) / currentSlope;
    u = Math.max(0, Math.min(1, u));
  }

  return ((ay * u + by) * u + cy) * u;
}

function evaluateTrack1D(
  track: Array<[number, number, [number, number, number, number]?]>,
  frame: number,
  loopFrames: number
): number {
  const f = frame % loopFrames;
  if (f <= track[0][0]) return track[0][1];
  const lastKey = track[track.length - 1];
  if (f >= lastKey[0]) return lastKey[1];

  for (let i = 0; i < track.length - 1; i++) {
    const k1 = track[i];
    const k2 = track[i + 1];
    if (f >= k1[0] && f <= k2[0]) {
      const segT = (f - k1[0]) / (k2[0] - k1[0]);
      const ease = k1[2] || [0.333, 0, 0.667, 1];
      const easedT = cubicBezier(segT, ease[0], ease[1], ease[2], ease[3]);
      return k1[1] + (k2[1] - k1[1]) * easedT;
    }
  }
  return 0;
}

function evaluateTrack2D(
  track: Array<[number, [number, number], [number, number, number, number]?]>,
  frame: number,
  loopFrames: number
): [number, number] {
  const f = frame % loopFrames;
  if (f <= track[0][0]) return track[0][1];
  const lastKey = track[track.length - 1];
  if (f >= lastKey[0]) return lastKey[1];

  for (let i = 0; i < track.length - 1; i++) {
    const k1 = track[i];
    const k2 = track[i + 1];
    if (f >= k1[0] && f <= k2[0]) {
      const segT = (f - k1[0]) / (k2[0] - k1[0]);
      const ease = k1[2] || [0.333, 0, 0.667, 1];
      const easedT = cubicBezier(segT, ease[0], ease[1], ease[2], ease[3]);
      return [
        k1[1][0] + (k2[1][0] - k1[1][0]) * easedT,
        k1[1][1] + (k2[1][1] - k1[1][1]) * easedT,
      ];
    }
  }
  return [0, 0];
}

// AE Eases from kelvinkn17/skills
const EASY: [number, number, number, number] = [0.333, 0, 0.667, 1];
const POP: [number, number, number, number] = [0.75, 0, 0.25, 1];
const SNAP: [number, number, number, number] = [0.8, 0, 0.2, 1];

/**
 * Calculates deterministic keyframe transform based on frame
 * Replicates the exact After Effects keyframes from kelvinkn17/skills
 */
export function calculateMotion(
  preset: MotionPresetType,
  frame: number,
  totalFrames: number = 180,
  intensity: number = 1.0
): MotionTransform {
  switch (preset) {
    case 'hop': {
      // Badges and hearts: rises tilting 9°, slams through rest, two rebounds
      const rTrack: Array<[number, number, [number, number, number, number]?]> = [
        [0, 0, [0.44, 0, 0.42, 1]],
        [36, 9, [0.42, 0, 0.44, 1]],
        [54, -4, [0.59, 0, 0.66, 1]],
        [72, 2, [0.37, 0, 0.51, 1]],
        [94, 0],
        [123, 0],
      ];
      const pTrack: Array<[number, [number, number], [number, number, number, number]?]> = [
        [0, [0, 0], [0.64, 0, 0.47, 1]],
        [36, [7, -32], [0.59, 0, 0.52, 1]],
        [54, [-7.25, 23.25], [0.24, 0, 0.16, 1]],
        [88, [0, 0]],
        [123, [0, 0]],
      ];
      const loop = 123;
      const rot = evaluateTrack1D(rTrack, frame, loop);
      const pos = evaluateTrack2D(pTrack, frame, loop);
      return {
        dx: pos[0] * intensity,
        dy: pos[1] * intensity,
        dRotation: rot * intensity,
        scale: 1,
        opacity: 1,
      };
    }

    case 'bounce': {
      // Coins and tokens: springs up and right, holds, then drops back through rest
      const pTrack: Array<[number, [number, number], [number, number, number, number]?]> = [
        [0, [0, 0], EASY],
        [11, [14, -22], EASY],
        [24, [8, -12], EASY],
        [37, [11, -16], EASY],
        [49, [9, -14], EASY],
        [62, [10, -15], EASY],
        [79, [9.5, -14], EASY],
        [93, [-4, 6], EASY],
        [110, [2.5, -3.5], EASY],
        [126, [-1.2, 1.6], EASY],
        [142, [0.6, -0.8], EASY],
        [175, [0, 0]],
        [180, [0, 0]],
      ];
      const pos = evaluateTrack2D(pTrack, frame, 180);
      const s = 1 + (frame % 180 < 25 ? Math.sin((frame % 180) * 0.15) * 0.04 * intensity : 0);
      return {
        dx: pos[0] * intensity,
        dy: pos[1] * intensity,
        dRotation: 0,
        scale: s,
        opacity: 1,
      };
    }

    case 'wiggle': {
      // Bells and hands: rocks back 20°, taps twice and settles, sliding 12px
      const rTrack: Array<[number, number, [number, number, number, number]?]> = [
        [0, 0, EASY],
        [46, 20, EASY],
        [71, 11, EASY],
        [100, 19, EASY],
        [124, -3, EASY],
        [148, 5, EASY],
        [177, 0],
        [180, 0],
      ];
      const pTrack: Array<[number, [number, number], [number, number, number, number]?]> = [
        [0, [0, 0]],
        [46, [0, 0], [0.2, 0, 0, 1]],
        [71, [12, 0], [0.2, 0, 0.67, 1]],
        [100, [0, 0]],
        [180, [0, 0]],
      ];
      const rot = evaluateTrack1D(rTrack, frame, 180);
      const pos = evaluateTrack2D(pTrack, frame, 180);
      return {
        dx: pos[0] * intensity,
        dy: pos[1] * intensity,
        dRotation: rot * intensity,
        scale: 1,
        opacity: 1,
      };
    }

    case 'toss': {
      // Containers spilling contents: winds up 20°, whips past to 22°, lands hard
      const rTrack: Array<[number, number, [number, number, number, number]?]> = [
        [0, 0, [0.57, 0, 0.35, 1]],
        [22, -19.9, [0.88, 0, 0.75, 1]],
        [41, 21.8, [0.09, 0, 0, 1]],
        [86, 0],
        [180, 0],
      ];
      const pTrack: Array<[number, [number, number], [number, number, number, number]?]> = [
        [0, [0, 0], [0.57, 0, 0.35, 1]],
        [22, [-8.5, -11.5], [0.88, 0, 0.75, 1]],
        [41, [-3.63, 22.63], [0.09, 0, 0, 1]],
        [86, [0, 0]],
        [180, [0, 0]],
      ];
      const rot = evaluateTrack1D(rTrack, frame, 180);
      const pos = evaluateTrack2D(pTrack, frame, 180);
      return {
        dx: pos[0] * intensity,
        dy: pos[1] * intensity,
        dRotation: rot * intensity,
        scale: 1,
        opacity: 1,
      };
    }

    case 'jolt': {
      // Cards and calendars: kicked along vector with the spring, holds, eases home
      const pTrack: Array<[number, [number, number], [number, number, number, number]?]> = [
        [0, [0, 0]],
        [2, [0, 0], EASY],
        [15, [-11.4, 19.2], EASY],
        [31, [-6.1, 10.3], EASY],
        [47, [-8.7, 14.7], EASY],
        [62, [-7.5, 12.6], EASY],
        [77, [-8.0, 13.4], EASY],
        [98, [-7.86, 13.25], [0.65, 0, 0.35, 1]],
        [141, [0, 0]],
        [180, [0, 0]],
      ];
      const pos = evaluateTrack2D(pTrack, frame, 180);
      return {
        dx: pos[0] * intensity,
        dy: pos[1] * intensity,
        dRotation: 0,
        scale: 1,
        opacity: 1,
      };
    }

    case 'clasp': {
      // Locks & clips: lifts up & left as shackle opens, hangs, slams down right
      const pTrack: Array<[number, [number, number], [number, number, number, number]?]> = [
        [0, [0, 0]],
        [10, [0, 0], [0.31, 0, 0.12, 1]],
        [48, [-8.13, -12.37]],
        [61, [-8.13, -12.37], [0.83, 0, 0.49, 1]],
        [85, [9.75, 14.12], [0.46, 0, 0.33, 1]],
        [112, [0, 0]],
        [130, [0, 0]],
      ];
      const rTrack: Array<[number, number, [number, number, number, number]?]> = [
        [0, 0],
        [48, -4, EASY],
        [85, 6, EASY],
        [112, 0],
        [130, 0],
      ];
      const pos = evaluateTrack2D(pTrack, frame, 130);
      const rot = evaluateTrack1D(rTrack, frame, 130);
      return {
        dx: pos[0] * intensity,
        dy: pos[1] * intensity,
        dRotation: rot * intensity,
        scale: 1,
        opacity: 1,
      };
    }

    case 'wobble': {
      // Faces and mascots: dips and rocks a few degrees, never quite still
      const rTrack: Array<[number, number, [number, number, number, number]?]> = [
        [0, 0, [0.73, 0, 0.46, 1]],
        [28, -3.04, [0.59, 0, 0.66, 0.86]],
        [54, 2.03, [0.36, -0.33, 0.67, 1.01]],
        [77, 0, [0.52, -0.02, 0.66, 1]],
        [95, 2.02, [0.47, 0, 0.11, 1]],
        [128, -1.1, [0.58, 0, 0.56, 1]],
        [168, 0],
        [180, 0],
      ];
      const pTrack: Array<[number, [number, number], [number, number, number, number]?]> = [
        [0, [0, 0], [0.62, 0, 0.31, 1]],
        [35, [0, 17.5], [0.33, 0, 0.85, 0.63]],
        [84, [0, -0.15], [0.57, 0.91, 0.57, 1]],
        [108, [0, -13.9], [0.33, 0, 0.4, 1]],
        [168, [0, 0]],
        [180, [0, 0]],
      ];
      const rot = evaluateTrack1D(rTrack, frame, 180);
      const pos = evaluateTrack2D(pTrack, frame, 180);
      return {
        dx: pos[0] * intensity,
        dy: pos[1] * intensity,
        dRotation: rot * intensity,
        scale: 1,
        opacity: 1,
      };
    }

    case 'drift': {
      // Lazy figure of eight with a slow bank
      const t = (frame % 180) / 180;
      const rad = t * Math.PI * 2;
      const dx = Math.sin(rad) * 28.5 * intensity;
      const dy = Math.sin(rad * 2) * -16 * intensity;
      const dRot = Math.sin(rad) * 6.5 * intensity;
      return { dx, dy, dRotation: dRot, scale: 1, opacity: 1 };
    }

    case 'twist': {
      // Keys and tools: turns home sharp, then slow 17° twist out and back
      const rTrack: Array<[number, number, [number, number, number, number]?]> = [
        [0, -7, [0.17, 0, 0, 1]],
        [30, 0, SNAP],
        [90, -17.27, [0.8, 0, 0, 1]],
        [150, 0, SNAP],
        [180, -7],
      ];
      const pTrack: Array<[number, [number, number], [number, number, number, number]?]> = [
        [0, [0, 0], EASY],
        [90, [8, -10], EASY],
        [180, [0, 0]],
      ];
      const rot = evaluateTrack1D(rTrack, frame, 180);
      const pos = evaluateTrack2D(pTrack, frame, 180);
      return {
        dx: pos[0] * intensity,
        dy: pos[1] * intensity,
        dRotation: rot * intensity,
        scale: 1,
        opacity: 1,
      };
    }

    case 'press': {
      // Buttons & keys: pushed 23px into base, back, pops 13px proud
      const pTrack: Array<[number, [number, number], [number, number, number, number]?]> = [
        [0, [0, 0], [0.37, 0, 0.33, 1.31]],
        [34, [0, 22.69], [0.4, 0.2, 0.09, 1]],
        [69, [0, 0]],
        [76, [0, 0], [0.46, 0, 0.34, 1]],
        [114, [0, -13], [0.38, 0, 0.61, 1]],
        [145, [0, 0]],
        [180, [0, 0]],
      ];
      const pos = evaluateTrack2D(pTrack, frame, 180);
      return {
        dx: pos[0] * intensity,
        dy: pos[1] * intensity,
        dRotation: 0,
        scale: 1,
        opacity: 1,
      };
    }

    case 'sway': {
      // Ambient: 5 degree lean and back over 180 frames
      const rTrack: Array<[number, number, [number, number, number, number]?]> = [
        [0, 0, EASY],
        [90, -5, EASY],
        [180, 0],
      ];
      const rot = evaluateTrack1D(rTrack, frame, 180);
      return { dx: 0, dy: 0, dRotation: rot * intensity, scale: 1, opacity: 1 };
    }

    case 'float': {
      // Ambient: 10px down and up over 180 frames
      const pTrack: Array<[number, [number, number], [number, number, number, number]?]> = [
        [0, [0, 0], EASY],
        [90, [0, 10], EASY],
        [180, [0, 0]],
      ];
      const pos = evaluateTrack2D(pTrack, frame, 180);
      return { dx: 0, dy: pos[1] * intensity, dRotation: 0, scale: 1, opacity: 1 };
    }

    case 'bob': {
      // Ambient: smaller bob with sideways lean over 160 frames
      const pTrack: Array<[number, [number, number], [number, number, number, number]?]> = [
        [0, [0, 0], EASY],
        [80, [-1.5, 5], EASY],
        [160, [0, 0]],
      ];
      const pos = evaluateTrack2D(pTrack, frame, 160);
      return {
        dx: pos[0] * intensity,
        dy: pos[1] * intensity,
        dRotation: (pos[0] * 2) * intensity,
        scale: 1,
        opacity: 1,
      };
    }

    case 'twinkle': {
      // Star pops to 110% and settles in 30 frames
      const subFrame = frame % 60;
      let s = 1.0;
      if (subFrame < 10) {
        s = 0.8 + (subFrame / 10) * 0.3 * intensity;
      } else if (subFrame < 30) {
        s = 1.1 - ((subFrame - 10) / 20) * 0.1 * intensity;
      }
      return { dx: 0, dy: 0, dRotation: 0, scale: s, opacity: 1 };
    }

    case 'glint': {
      // Glare swells, eases to 80%, shrinks away
      const subFrame = frame % 90;
      let s = 1.0;
      if (subFrame < 30) {
        s = 1 + (subFrame / 30) * 0.25 * intensity;
      } else if (subFrame < 60) {
        s = 1.25 - ((subFrame - 30) / 30) * 0.25 * intensity;
      }
      return { dx: 0, dy: 0, dRotation: 0, scale: s, opacity: 1 };
    }

    case 'sparkle': {
      // Grows and turns 46° fast, shrinks back on ease in
      const subFrame = frame % 84;
      const t = subFrame / 84;
      const rot = t < 0.5 ? (t / 0.5) * 45.89 : 45.89 * (1 - (t - 0.5) / 0.5);
      const s = 1 + Math.sin(t * Math.PI) * 0.2 * intensity;
      return { dx: 0, dy: 0, dRotation: rot * intensity, scale: s, opacity: 1 };
    }

    default:
      return { dx: 0, dy: 0, dRotation: 0, scale: 1, opacity: 1 };
  }
}
