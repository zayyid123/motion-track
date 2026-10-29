import type { Icon, Layer, Motion } from './fun'
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

/** Order used when inferring a preset, so a more specific match wins. */
const PRESET_MATCH_ORDER = MOTION_PRESET_IDS.filter((id) => id !== 'none')

/**
 * Exact JSON for a motion value, ignoring key order, so a layer whose track is
 * literally the preset's own default is matched without any guesswork.
 */
function signature(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return `[${value.map(signature).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
    return `{${entries.map(([k, v]) => `${k}:${signature(v)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** Motion fields that drive the animation itself, as opposed to tuning. */
const TRACK_KEYS = ['r', 'p', 's', 'o', 'x'] as const

/** Tuning fields that shift or scale a preset without changing its character. */
const TUNING_KEYS = new Set(['at', 'k', 'loop'])

/**
 * A fingerprint of the motion a layer plays, used as a fallback when no preset
 * matches by value. It keeps each track's keyframe count and relative timeline,
 * plus the shape of each keyframe's value (scalar versus vector size), which is
 * enough to identify a preset applied with a different offset or size — for
 * example `glint(2, 98)`, `twinkle(48)` or a pair of twinkles — without
 * pretending an unrelated bespoke track is that preset.
 */
function shape(value: unknown): string {
  if (value === undefined) return 'u'
  if (Array.isArray(value)) return `[${value.map(shape).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const parts: string[] = []
    for (const key of Object.keys(record).sort()) {
      if (TUNING_KEYS.has(key)) continue
      if (!(TRACK_KEYS as ReadonlyArray<string>).includes(key)) continue
      const track = record[key]
      if (!Array.isArray(track)) continue
      const start = typeof track[0]?.[0] === 'number' ? (track[0][0] as number) : 0
      const keys = track.map((keyframe) => {
        if (!Array.isArray(keyframe)) return 'k'
        const time = typeof keyframe[0] === 'number' ? keyframe[0] - start : keyframe[0]
        return `${time}|${arity(keyframe[1])}|${arity(keyframe[2])}`
      })
      parts.push(`${key}:${keys.join('.')}`)
    }
    return `{${parts.join(',')}}`
  }
  return 'v'
}

/** A value's structure, ignoring the numbers themselves: scalar or vector size. */
function arity(value: unknown): string {
  if (value === undefined) return 'u'
  if (Array.isArray(value)) return `v${value.length}`
  return typeof value === 'number' ? 'n' : 'o'
}

/**
 * Finds the preset id whose motion matches `motion`, or `undefined` when the
 * layer uses a bespoke track (for example the toggle slide or the phone deal-in).
 *
 * The library templates animate with hand-written tracks but never carried the
 * preset id, so the editor showed them all as "custom" and the timeline as
 * "static". Inference runs in two passes — an exact value match, then a
 * structural fingerprint so parameterised presets (`jolt(v)`, `latch(v)`) are
 * still recognised when their arguments differ from the defaults.
 */
export function inferMotionPreset(motion: Motion | ReadonlyArray<Motion> | undefined): MotionPresetId | undefined {
  if (motion === undefined) return undefined
  const target = signature(motion)
  // Exact value match first.
  for (const id of PRESET_MATCH_ORDER) {
    const candidate = MOTION_PRESET_DEFS[id].create()
    if (candidate !== undefined && signature(candidate) === target) return id
  }
  // Then structural match, comparing like with like: a single motion against the
  // preset default, or the items of an array (for example a pair of twinkles)
  // against the default when the preset itself is a single motion.
  const targetShape = shape(motion)
  const targetItems = Array.isArray(motion) ? motion.map(shape) : null
  for (const id of PRESET_MATCH_ORDER) {
    const candidate = MOTION_PRESET_DEFS[id].create()
    if (candidate === undefined) continue
    if (shape(candidate) === targetShape) return id
    if (targetItems && !Array.isArray(candidate)) {
      const single = shape(candidate)
      if (targetItems.every((item) => item === single)) return id
    }
  }
  return undefined
}

/**
 * Returns a copy of an icon whose layers carry the `motionPreset` id that their
 * motion corresponds to. Layers with bespoke tracks are left untouched so the UI
 * can still label them "custom". Idempotent: layers that already name a preset
 * keep it.
 */
export function annotatePresets(icon: Icon): Icon {
  let changed = false
  const layers: Layer[] = icon.layers.map((layer) => {
    if (layer.motionPreset !== undefined) return layer
    const inferred = inferMotionPreset(layer.m)
    if (!inferred) return layer
    changed = true
    return { ...layer, motionPreset: inferred }
  })
  return changed ? { ...icon, layers } : icon
}
