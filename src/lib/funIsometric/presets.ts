import type { Motion } from './fun'
import {
  bob,
  bounce,
  clasp,
  drift,
  float,
  glint,
  hop,
  look,
  shackle,
  sparkle,
  sway,
  twinkle,
  twist,
  wiggle,
  wobble,
} from './motions'

export type MotionValue = Motion | ReadonlyArray<Motion> | undefined

export type MotionPresetId =
  | 'none'
  | 'wiggle'
  | 'hop'
  | 'bounce'
  | 'clasp'
  | 'shackle'
  | 'drift'
  | 'twist'
  | 'wobble'
  | 'look'
  | 'sparkle'
  | 'twinkle'
  | 'glint'
  | 'sway'
  | 'float'
  | 'bob'

export interface MotionPresetDefinition {
  label: string
  description: string
  create: () => MotionValue
}

/**
 * Single source of truth for motion presets. The editor sidebar, right panel,
 * AI prompt, and project validation all read from this map.
 */
export const MOTION_PRESET_DEFS: Record<MotionPresetId, MotionPresetDefinition> = {
  none: { label: 'None (Still)', description: 'No animation', create: () => undefined },
  wiggle: { label: 'Wiggle', description: 'Rocking taps', create: () => wiggle },
  hop: { label: 'Hop', description: 'Jump & slam', create: () => hop },
  bounce: { label: 'Bounce', description: 'Spring rebound', create: () => bounce },
  clasp: { label: 'Clasp', description: 'Lift & slam', create: () => clasp },
  shackle: { label: 'Shackle', description: 'Spring open/shut', create: () => shackle },
  drift: { label: 'Drift', description: 'Figure-8 hover', create: () => drift },
  twist: { label: 'Twist', description: 'Sharp twist', create: () => twist },
  wobble: { label: 'Wobble', description: 'Organic rock', create: () => wobble },
  look: { label: 'Look', description: 'Glance & dart', create: () => look },
  sparkle: { label: 'Sparkle', description: 'Pop & turn', create: () => sparkle(0) },
  twinkle: { label: 'Twinkle', description: 'Star pop', create: () => twinkle(0) },
  glint: { label: 'Glint', description: 'Glare drift', create: () => glint(0) },
  sway: { label: 'Sway', description: 'Gentle lean', create: () => sway },
  float: { label: 'Float', description: 'Airy hover', create: () => float },
  bob: { label: 'Bob', description: 'Small bob', create: () => bob },
}

export const MOTION_PRESET_IDS = Object.keys(MOTION_PRESET_DEFS) as MotionPresetId[]

export interface MotionPreset {
  id: MotionPresetId
  label: string
  description: string
}

export const MOTION_PRESETS: ReadonlyArray<MotionPreset> = MOTION_PRESET_IDS.map((id) => ({
  id,
  label: MOTION_PRESET_DEFS[id].label,
  description: MOTION_PRESET_DEFS[id].description,
}))

export function isMotionPresetId(value: unknown): value is MotionPresetId {
  return typeof value === 'string' && value in MOTION_PRESET_DEFS
}

/** Returns a fresh motion value for a preset. Unknown ids are treated as `none`. */
export function createMotion(preset: string): MotionValue {
  return isMotionPresetId(preset) ? MOTION_PRESET_DEFS[preset].create() : undefined
}
