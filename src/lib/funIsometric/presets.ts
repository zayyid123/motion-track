import type { Motion } from './fun'
import {
  bob,
  bounce,
  clasp,
  drift,
  float,
  glint,
  hop,
  impact,
  jolt,
  latch,
  look,
  press,
  shackle,
  sparkle,
  sway,
  toss,
  twinkle,
  twist,
  wiggle,
  wobble,
} from './motions'

export type MotionValue = Motion | ReadonlyArray<Motion> | undefined

export type MotionPresetId =
  | 'none'
  | 'toss'
  | 'hop'
  | 'bounce'
  | 'wiggle'
  | 'jolt'
  | 'press'
  | 'impact'
  | 'latch'
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
 * AI prompt, and project validation all read from this map. Presets and their
 * verbs follow the fun-isometric house style (see docs/FUN-ISOMETRIC.md).
 */
export const MOTION_PRESET_DEFS: Record<MotionPresetId, MotionPresetDefinition> = {
  none: { label: 'None (Still)', description: 'No animation', create: () => undefined },
  toss: { label: 'Toss', description: 'Throw & spill: containers emptying (wallet, folder, bag)', create: () => toss },
  hop: { label: 'Hop', description: 'Rise & slam: badges, hearts, rewards, pins', create: () => hop },
  bounce: { label: 'Bounce', description: 'Spring to a spot: coins, tokens, chips', create: () => bounce },
  wiggle: { label: 'Wiggle', description: 'Rock & tap: bells, thumbs, hands', create: () => wiggle },
  jolt: { label: 'Jolt', description: 'Kicked & held: cards, calendars, mailboxes', create: () => jolt() },
  press: { label: 'Press', description: 'Pushed in & pops proud: buttons, keys, shutters', create: () => press },
  impact: { label: 'Impact', description: 'Lid slams in: lids, stamps, caps', create: () => impact() },
  latch: { label: 'Latch', description: 'Closes & holds: lids, clasps, caps', create: () => latch() },
  clasp: { label: 'Clasp', description: 'Lift & slam: locks, clips, toggles', create: () => clasp },
  shackle: { label: 'Shackle', description: 'Spring open/shut: the moving half of a lock', create: () => shackle },
  drift: { label: 'Drift', description: 'Figure-8 hover: planes, balloons, floating things', create: () => drift },
  twist: { label: 'Twist', description: 'Turn out & back: keys, magnifiers, wands', create: () => twist },
  wobble: { label: 'Wobble', description: 'Never still: faces, characters, headphones', create: () => wobble },
  look: { label: 'Look', description: 'Glance & dart: any face with pupils', create: () => look },
  sparkle: { label: 'Sparkle', description: 'Pop & turn: an accent on the beat', create: () => sparkle(0) },
  twinkle: { label: 'Twinkle', description: 'Star pop: an accent on the beat', create: () => twinkle(0) },
  glint: { label: 'Glint', description: 'Glare drift: a highlight on the beat', create: () => glint(0) },
  sway: { label: 'Sway', description: 'Gentle lean: idle layers', create: () => sway },
  float: { label: 'Float', description: 'Airy hover: idle layers', create: () => float },
  bob: { label: 'Bob', description: 'Small bob: idle layers, phased apart', create: () => bob },
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
