import { beforeEach, describe, expect, it } from 'vitest';
import { padlock } from '@/lib/funIsometric/icons';
import { PALETTES } from '@/lib/funIsometric/fun';
import {
  PROJECT_DRAFT_KEY,
  PROJECT_VERSION,
  clearProjectDraft,
  parseProject,
  readProjectDraft,
  serializeProject,
  writeProjectDraft,
} from './projectFile';
import type { StudioDoc } from './projectFile';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const doc = (): StudioDoc => ({
  icon: clone(padlock),
  paletteId: 'slush',
  palette: { ...PALETTES.slush },
  facing: 'left',
  outlineWidth: 7,
});

describe('project file v2', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('serializes a versioned envelope', () => {
    const parsed = JSON.parse(serializeProject(doc())) as Record<string, unknown>;

    expect(parsed.version).toBe(PROJECT_VERSION);
    expect(parsed.facing).toBe('left');
    expect(parsed.outlineWidth).toBe(7);
    expect(typeof parsed.savedAt).toBe('string');
    expect(parsed).toHaveProperty('icon');
  });

  it('round-trips a v2 project', () => {
    const original = doc();
    const result = parseProject(serializeProject(original));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.facing).toBe('left');
    expect(result.doc.outlineWidth).toBe(7);
    expect(result.doc.palette.main).toBe(PALETTES.slush.main);
    expect(result.doc.icon.name).toBe('padlock');
    expect(result.doc.icon.layers).toHaveLength(original.icon.layers.length);
  });

  it('round-trips a per-layer outline width', () => {
    const original = doc();
    original.icon = {
      ...original.icon,
      layers: original.icon.layers.map((layer, index) => (index === 0 ? { ...layer, line: 9 } : layer)),
    };

    const result = parseProject(serializeProject(original));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.icon.layers[0].line).toBe(9);
  });

  it('migrates a legacy bare icon JSON', () => {
    const result = parseProject(JSON.stringify(padlock));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.icon.name).toBe('padlock');
    expect(result.doc.paletteId).toBe('slush');
    expect(result.doc.facing).toBe('right');
    expect(result.doc.outlineWidth).toBe(padlock.line);
  });

  it('migrates a legacy wrapper with a version field', () => {
    const result = parseProject(JSON.stringify({ version: 1, icon: padlock, facing: 'flat' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.icon.layers.length).toBe(padlock.layers.length);
    expect(result.doc.facing).toBe('flat');
  });

  it('rejects malformed JSON and unknown shapes', () => {
    expect(parseProject('{ nope').ok).toBe(false);
    expect(parseProject('{}').ok).toBe(false);
    expect(parseProject('[]').ok).toBe(false);
  });

  it('rejects a v2 file with an invalid field', () => {
    const raw = JSON.parse(serializeProject(doc())) as Record<string, unknown>;
    raw.outlineWidth = 999;
    expect(parseProject(JSON.stringify(raw)).ok).toBe(false);
  });

  it('persists and clears the local draft', () => {
    const original = doc();
    writeProjectDraft(original);

    expect(window.localStorage.getItem(PROJECT_DRAFT_KEY)).toBeTruthy();
    const restored = readProjectDraft();
    expect(restored?.icon.name).toBe('padlock');
    expect(restored?.outlineWidth).toBe(7);

    clearProjectDraft();
    expect(readProjectDraft()).toBeNull();
  });

  it('ignores a corrupted draft', () => {
    window.localStorage.setItem(PROJECT_DRAFT_KEY, 'not json');
    expect(readProjectDraft()).toBeNull();
  });
});
