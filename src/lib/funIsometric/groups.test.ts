import { describe, expect, it } from 'vitest';
import { TEMPLATE_ICONS } from './library';
import { ICONS as DEFAULT_ICONS } from './icons';
import { type Icon } from './fun';

/** Every sticker users can start from: the template library plus the default docs. */
const ALL_ICONS: ReadonlyArray<Icon> = [...TEMPLATE_ICONS, ...DEFAULT_ICONS];

describe('layer grouping', () => {
  it('never uses the legacy `parent` field', () => {
    for (const icon of ALL_ICONS) {
      for (const layer of icon.layers) {
        expect(layer).not.toHaveProperty('parent');
      }
    }
  });

  it('resolves every `groupId` to a real layer', () => {
    for (const icon of ALL_ICONS) {
      const ids = new Set(icon.layers.map((layer) => layer.id));
      for (const layer of icon.layers) {
        if (!layer.groupId) continue;
        expect(ids.has(layer.groupId), `${icon.name}/${layer.id ?? '?'} → ${layer.groupId}`).toBe(true);
        expect(layer.groupId).not.toBe(layer.id);
      }
    }
  });

  it('points every `groupId` at a container flagged `isGroup`', () => {
    for (const icon of ALL_ICONS) {
      const byId = new Map(icon.layers.map((layer) => [layer.id, layer]));
      for (const layer of icon.layers) {
        if (!layer.groupId) continue;
        const group = byId.get(layer.groupId);
        expect(group?.isGroup, `${icon.name}/${layer.id ?? '?'} → ${layer.groupId}`).toBe(true);
      }
    }
  });

  it('gives every group container a stable id and no drawable shapes', () => {
    for (const icon of ALL_ICONS) {
      for (const layer of icon.layers) {
        if (!layer.isGroup) continue;
        expect(typeof layer.id === 'string' && layer.id.length > 0, `${icon.name} group without id`).toBe(true);
        // Containers carry transform/motion only; a group with shapes would render twice.
        expect(layer.shapes ?? []).toHaveLength(0);
      }
    }
  });

  it('lists every group container above the layers it drives', () => {
    // The timeline renders rows in list order, so a container must appear before
    // its children or the children would show above their group. Walk the whole
    // ancestor chain so nested containers keep the same guarantee.
    for (const icon of ALL_ICONS) {
      const index = new Map(icon.layers.map((layer, i) => [layer.id, i]));
      icon.layers.forEach((layer, i) => {
        let ancestor = layer.groupId;
        let depth = 0;
        while (ancestor && depth < 32) {
          const gi = index.get(ancestor);
          expect(gi, `${icon.name}/${layer.id ?? '?'} → ${ancestor}`).toBeDefined();
          expect(
            gi as number,
            `${icon.name}/${layer.id ?? '?'}: group ${ancestor} must be listed above its child`,
          ).toBeLessThan(i);
          ancestor = icon.layers[gi as number]?.groupId;
          depth += 1;
        }
      });
    }
  });

  it('keeps clip targets resolving to a real layer', () => {
    for (const icon of ALL_ICONS) {
      const ids = new Set(icon.layers.map((layer) => layer.id));
      for (const layer of icon.layers) {
        if (!layer.clip) continue;
        expect(ids.has(layer.clip), `${icon.name}/${layer.id ?? '?'} clip → ${layer.clip}`).toBe(true);
      }
    }
  });
});
