import { describe, expect, it } from 'vitest';
import { annotatePresets, inferMotionPreset, MOTION_PRESET_DEFS } from './presets';
import { ICONS, TEMPLATE_ICONS, getTemplate } from './library';
import { bob, bounce, glint, hop, jolt, latch, toss, twinkle, wiggle } from './motions'

describe('inferMotionPreset', () => {
  it('recognises the shared preset tracks by value', () => {
    expect(inferMotionPreset(toss)).toBe('toss');
    expect(inferMotionPreset(hop)).toBe('hop');
    expect(inferMotionPreset(bounce)).toBe('bounce');
    expect(inferMotionPreset(wiggle)).toBe('wiggle');
    expect(inferMotionPreset(bob)).toBe('bob');
  });

  it('recognises parameterised presets built with the same arguments', () => {
    expect(inferMotionPreset(jolt())).toBe('jolt');
    expect(inferMotionPreset(latch())).toBe('latch');
    expect(inferMotionPreset(twinkle(0))).toBe('twinkle');
  });

  it('recognises parameterised presets applied with different arguments', () => {
    // A different offset or size is still the same preset: these were built by
    // calling the preset itself with custom arguments.
    expect(inferMotionPreset(twinkle(48))).toBe('twinkle');
    expect(inferMotionPreset(jolt([-4, 10]))).toBe('jolt');
    expect(inferMotionPreset(glint(2, 98))).toBe('glint');
  });

  it('returns undefined for bespoke tracks and empty motion', () => {
    expect(inferMotionPreset(undefined)).toBeUndefined();
    expect(
      inferMotionPreset({ s: [[0, [100, 100]], [90, [120, 120]]] })
    ).toBeUndefined();
  });

  it('is insensitive to object key order', () => {
    expect(inferMotionPreset({ ...hop })).toBe('hop');
    expect(inferMotionPreset({ r: hop.r, p: hop.p })).toBe('hop');
  });

  it('resolves every preset to its own id without collisions', () => {
    for (const id of [
      'toss', 'hop', 'bounce', 'wiggle', 'jolt', 'press', 'impact', 'latch', 'clasp',
      'shackle', 'drift', 'twist', 'wobble', 'look', 'sparkle', 'twinkle', 'glint',
      'sway', 'float', 'bob',
    ] as const) {
      expect(inferMotionPreset(MOTION_PRESET_DEFS[id].create()), id).toBe(id);
    }
  });
});

describe('template preset annotation', () => {
  it('tags every layer whose track matches a preset', () => {
    for (const icon of TEMPLATE_ICONS) {
      for (const layer of icon.layers) {
        if (layer.m === undefined) continue;
        const inferred = inferMotionPreset(layer.m);
        if (inferred) {
          expect(layer.motionPreset, `${icon.name}/${layer.id} should be ${inferred}`).toBe(inferred);
        }
      }
    }
  });

  it('names the hero motion of well-known stickers', () => {
    const byId = (name: string, id: string) =>
      TEMPLATE_ICONS.find((icon) => icon.name === name)?.layers.find((layer) => layer.id === id);

    expect(byId('heart', 'heart')?.motionPreset).toBe('hop');
    expect(byId('padlock', 'lock')?.motionPreset).toBe('clasp');
    // The springing coin is a shape-bearing layer, so its bounce track lives on
    // the group container that drives it.
    expect(byId('coins', 'coin-grp')?.motionPreset).toBe('bounce');
    expect(byId('bulb', 'lamp')?.motionPreset).toBe('hop');
    expect(byId('cloud', 'sky')?.motionPreset).toBe('float');
  });

  it('leaves bespoke tracks untagged so the UI can label them custom', () => {
    // These tracks are hand-written rather than a preset, so tagging them would
    // let the sidebar claim a preset the layer does not actually play.
    const bespoke: Array<[string, unknown]> = [
      ['slide (toggle knob)', { s: [[20, [36, 100]], [80, [100, 100]], [120, [100, 100]], [180, [36, 100]]] }],
      ['deal (phone arrival)', { p: [[0, [-46, 34]]], r: [[0, -21]] }],
    ];
    for (const [label, motion] of bespoke) {
      expect(inferMotionPreset(motion as never), label).toBeUndefined();
    }
    const toggle = TEMPLATE_ICONS.find((icon) => icon.name === 'toggle');
    expect(toggle?.layers.some((layer) => layer.motionPreset === undefined)).toBe(true);
  });

  it('never labels a bespoke layer with a different preset', () => {
    // The looser structural pass must not turn the toggle's slide into `latch`
    // or the cloud's drift into `float`; a wrong name is worse than `custom`.
    const toggle = TEMPLATE_ICONS.find((icon) => icon.name === 'toggle');
    const knob = toggle?.layers.find((layer) => layer.motionPreset === undefined && layer.m !== undefined);
    expect(knob).toBeDefined();
    expect(inferMotionPreset(knob?.m)).toBeUndefined();
  });

  it('annotates getTemplate results as well', () => {
    const heart = getTemplate('heart');
    expect(heart?.layers.some((layer) => layer.motionPreset === 'hop')).toBe(true);
  });

  it('is idempotent and does not mutate the source icons', () => {
    const once = annotatePresets(ICONS[0]);
    const twice = annotatePresets(once);
    expect(twice.layers.map((l) => l.motionPreset)).toEqual(once.layers.map((l) => l.motionPreset));
    // The shared ICONS array must stay untouched so tests are order-independent.
    expect(ICONS[0].layers.some((layer) => layer.motionPreset !== undefined)).toBe(false);
  });
});
