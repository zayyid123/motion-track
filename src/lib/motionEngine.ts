import { MotionPresetType } from '@/types/sticker';

export interface MotionTransform {
  dx: number;
  dy: number;
  dRotation: number;
  scale: number;
  opacity: number;
}

/**
 * Calculates deterministic keyframe transform based on frame (0 to totalFrames)
 * Default loop duration is ~120 frames (2 seconds at 60fps)
 */
export function calculateMotion(
  preset: MotionPresetType,
  frame: number,
  totalFrames: number = 120,
  intensity: number = 1.0
): MotionTransform {
  const t = (frame % totalFrames) / totalFrames; // 0..1
  const rad = t * Math.PI * 2;

  switch (preset) {
    case 'hop': {
      // Rise, tilt, hard landing with settle
      const jump = Math.sin(t * Math.PI);
      const dy = t < 0.5 ? -Math.pow(jump, 1.5) * 60 * intensity : Math.sin(t * Math.PI * 4) * 8 * (1 - t) * intensity;
      const dRot = Math.sin(t * Math.PI * 2) * 8 * intensity;
      const scale = t < 0.15 ? 1 + 0.1 * intensity : t > 0.45 && t < 0.65 ? 1 - 0.08 * intensity : 1;
      return { dx: 0, dy, dRotation: dRot, scale, opacity: 1 };
    }

    case 'bounce': {
      // Spring bounce up & right, holds, falls back
      const dy = -Math.abs(Math.sin(rad)) * 50 * intensity;
      const dx = Math.sin(rad) * 20 * intensity;
      const dRot = Math.sin(rad) * 6 * intensity;
      const squash = 1 + (Math.cos(rad * 2) * 0.08 * intensity);
      return { dx, dy, dRotation: dRot, scale: squash, opacity: 1 };
    }

    case 'wiggle': {
      // Quick rocking back & forth with settle
      let dRot = 0;
      let dx = 0;
      if (t < 0.6) {
        const subT = t / 0.6;
        dRot = Math.sin(subT * Math.PI * 6) * 16 * (1 - subT) * intensity;
        dx = Math.cos(subT * Math.PI * 4) * 10 * (1 - subT) * intensity;
      }
      return { dx, dy: 0, dRotation: dRot, scale: 1, opacity: 1 };
    }

    case 'drift': {
      // Lazy figure of eight with gentle banking
      const dx = Math.sin(rad) * 25 * intensity;
      const dy = Math.sin(rad * 2) * 15 * intensity;
      const dRot = Math.cos(rad) * 10 * intensity;
      return { dx, dy, dRotation: dRot, scale: 1, opacity: 1 };
    }

    case 'twist': {
      // Sharp turn, slow twist out and back
      const dRot = Math.sin(rad) * 24 * intensity;
      const scale = 1 + Math.sin(rad * 2) * 0.06 * intensity;
      return { dx: 0, dy: 0, dRotation: dRot, scale, opacity: 1 };
    }

    case 'float': {
      // Gentle bobbing up and down
      const dy = Math.sin(rad) * 18 * intensity;
      const dRot = Math.sin(rad * 0.5) * 4 * intensity;
      return { dx: 0, dy, dRotation: dRot, scale: 1, opacity: 1 };
    }

    case 'twinkle': {
      // Scale pop and sparkle burst
      const pop = 1 + Math.sin(rad * 2) * 0.22 * intensity;
      const dRot = (t * 360 * 0.5) * intensity;
      return { dx: 0, dy: 0, dRotation: dRot, scale: Math.max(0.7, pop), opacity: 1 };
    }

    default:
      return { dx: 0, dy: 0, dRotation: 0, scale: 1, opacity: 1 };
  }
}
