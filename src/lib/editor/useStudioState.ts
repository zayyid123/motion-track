'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlaybackClock } from '@/lib/editor/clock';
import {
  applyMutation,
  beginGesture as beginGestureHistory,
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  createHistory,
  endGesture as endGestureHistory,
  redo as redoHistory,
  undo as undoHistory,
} from '@/lib/editor/history';
import type { HistoryState, MutationOptions } from '@/lib/editor/history';
import { applyAIActionsToDoc } from '@/lib/ai/actions';
import type { AIAction, AIApplyOutcome } from '@/lib/ai/actions';
import { ellipse, PALETTES, rect, spark, VIEWS } from '@/lib/funIsometric/fun';
import type { Icon, Layer, Palette, View } from '@/lib/funIsometric/fun';
import { blankProject, padlock } from '@/lib/funIsometric/icons';
import { createMotion } from '@/lib/funIsometric/presets';
import {
  DEFAULT_FACING,
  DEFAULT_OUTLINE,
  DEFAULT_PALETTE_ID,
  readProjectDraft,
  writeProjectDraft,
} from '@/lib/projectFile';
import type { StudioDoc } from '@/lib/projectFile';

const cloneIcon = (icon: Icon): Icon => JSON.parse(JSON.stringify(icon)) as Icon;

const defaultDoc = (): StudioDoc => ({
  icon: cloneIcon(padlock),
  paletteId: DEFAULT_PALETTE_ID,
  palette: { ...PALETTES.slush },
  facing: DEFAULT_FACING,
  outlineWidth: DEFAULT_OUTLINE,
});

const firstVisualLayer = (icon: Icon): string | null =>
  icon.layers.find((layer) => !layer.isGroup && layer.shapes.length > 0)?.id ?? icon.layers[0]?.id ?? null;

let idCounter = 0;
const nextId = (prefix: string): string => {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36).slice(-4)}${idCounter.toString(36)}`;
};

export type SaveState = 'saved' | 'saving';

export interface StudioActions {
  updateIcon: (updater: (icon: Icon) => Icon, options?: MutationOptions) => void;
  updateLayer: (id: string, updates: Partial<Layer>, options?: MutationOptions) => void;
  updateShapeFill: (id: string, fill: Layer['shapes'][number]['fill']) => void;
  updateShapeDepth: (id: string, depth: number) => void;
  updateLayerTiming: (id: string, ip: number, op: number) => void;
  moveLayerIndex: (fromIndex: number, toIndex: number, targetGroupId?: string | null) => void;
  applyMotion: (id: string, preset: string) => void;
  createGroup: () => void;
  setLayerGroup: (id: string, groupId: string | undefined) => void;
  addShape: (type: 'rect' | 'circle' | 'spark') => void;
  deleteLayer: (id: string) => void;
  changePalette: (paletteId: string) => void;
  updatePaletteColor: (role: keyof Palette, hex: string) => void;
  updateOutlineWidth: (width: number) => void;
  changeFacing: (facing: View) => void;
  renameProject: (name: string) => void;
  selectTemplate: (icon: Icon) => void;
  newProject: () => void;
  loadProject: (doc: StudioDoc) => void;
  /** Applies a validated AI action batch as a single undo entry. */
  applyAIActions: (batch: AIAction[]) => AIApplyOutcome;
  beginTransform: (label?: string) => void;
  endTransform: (label?: string) => void;
  moveLayerLive: (id: string, dx: number, dy: number) => void;
  rotateLayerLive: (id: string, delta: number) => void;
  scaleLayerLive: (id: string, deltaX: number, deltaY: number) => void;
}

export interface StudioState {
  doc: StudioDoc;
  icon: Icon;
  palette: Palette;
  paletteId: string;
  facing: View;
  outlineWidth: number;
  selectedLayerId: string | null;
  selectedLayer: Layer | null;
  setSelectedLayerId: (id: string | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  saveState: SaveState;
  actions: StudioActions;
}

export function useStudioState(clock: PlaybackClock): StudioState {
  const [history, setHistory] = useState<HistoryState<StudioDoc>>(() => createHistory(defaultDoc(), 'New project'));
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(() => firstVisualLayer(history.present.icon));
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const restoredRef = useRef(false);

  const doc = history.present;
  // AI replies arrive asynchronously; this ref lets the action batch run against
  // the newest document instead of the closure captured at request time.
  const docRef = useRef<StudioDoc>(doc);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  // Restore the autosaved draft after mount to keep server/client markup identical.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const draft = readProjectDraft();
    if (!draft) return;
    // Restoring the autosaved draft after hydration is a deliberate one-time
    // external-store sync; reading localStorage during render would desync SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(createHistory(draft, 'Restored draft'));
    setSelectedLayerId(firstVisualLayer(draft.icon));
    clock.seek(0);
  }, [clock]);

  // Keep the playback clock aligned with the current icon length.
  useEffect(() => {
    clock.setFrames(doc.icon.frames || 180);
  }, [clock, doc.icon.frames]);

  // Debounced autosave. The timer is reset on every edit so history dragging
  // does not write localStorage 60 times per second.
  useEffect(() => {
    if (!restoredRef.current) return;
    setSaveState('saving');
    const timeout = window.setTimeout(() => {
      writeProjectDraft(doc);
      setSaveState('saved');
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [doc]);

  const updateDoc = useCallback(
    (updater: (current: StudioDoc) => StudioDoc, options?: MutationOptions) => {
      setHistory((current) => applyMutation(current, updater, options));
    },
    []
  );

  const updateIcon = useCallback(
    (updater: (icon: Icon) => Icon, options?: MutationOptions) => {
      updateDoc((current) => ({ ...current, icon: updater(current.icon) }), options);
    },
    [updateDoc]
  );

  const updateLayer = useCallback(
    (id: string, updates: Partial<Layer>, options?: MutationOptions) => {
      updateIcon(
        (icon) => ({
          ...icon,
          layers: icon.layers.map((layer) => (layer.id === id ? { ...layer, ...updates } : layer)),
        }),
        options ?? { mode: 'coalesce', key: `layer:${id}`, label: 'Edit layer' }
      );
    },
    [updateIcon]
  );

  const updateShapeFill = useCallback(
    (id: string, fill: Layer['shapes'][number]['fill']) => {
      updateIcon(
        (icon) => ({
          ...icon,
          layers: icon.layers.map((layer) =>
            layer.id === id
              ? { ...layer, shapes: layer.shapes.map((shape, index) => (index === 0 ? { ...shape, fill } : shape)) }
              : layer
          ),
        }),
        { label: 'Change color role' }
      );
    },
    [updateIcon]
  );

  const updateShapeDepth = useCallback(
    (id: string, depth: number) => {
      updateIcon(
        (icon) => ({
          ...icon,
          layers: icon.layers.map((layer) =>
            layer.id === id
              ? { ...layer, shapes: layer.shapes.map((shape, index) => (index === 0 ? { ...shape, depth } : shape)) }
              : layer
          ),
        }),
        { mode: 'coalesce', key: `depth:${id}`, label: 'Change slab depth' }
      );
    },
    [updateIcon]
  );

  const updateLayerTiming = useCallback(
    (id: string, ip: number, op: number) => {
      updateIcon(
        (icon) => ({
          ...icon,
          layers: icon.layers.map((layer) => (layer.id === id ? { ...layer, ip, op } : layer)),
        }),
        { mode: 'coalesce', key: `timing:${id}`, label: 'Trim layer' }
      );
    },
    [updateIcon]
  );

  const moveLayerIndex = useCallback(
    (fromIndex: number, toIndex: number, targetGroupId?: string | null) => {
      updateIcon(
        (icon) => {
          if (fromIndex < 0 || fromIndex >= icon.layers.length) return icon;
          if (toIndex < 0 || toIndex >= icon.layers.length) return icon;

          const layers = [...icon.layers];
          const [removed] = layers.splice(fromIndex, 1);
          const moved = { ...removed };

          if (targetGroupId !== undefined && !moved.isGroup) {
            moved.groupId = targetGroupId || undefined;
            if (!targetGroupId) moved.parent = undefined;
          }

          layers.splice(toIndex, 0, moved);
          return { ...icon, layers };
        },
        { label: 'Reorder layers' }
      );
    },
    [updateIcon]
  );

  const applyMotion = useCallback(
    (id: string, preset: string) => {
      updateIcon(
        (icon) => ({
          ...icon,
          layers: icon.layers.map((layer) =>
            layer.id === id
              ? { ...layer, motionPreset: preset, m: preset === 'none' ? undefined : (createMotion(preset) as Layer['m']) }
              : layer
          ),
        }),
        { label: 'Apply motion preset' }
      );
    },
    [updateIcon]
  );

  const createGroup = useCallback(() => {
    const groupId = nextId('group');
    updateIcon(
      (icon) => {
        const group: Layer = {
          id: groupId,
          name: `Group ${groupId.slice(-4)}`,
          isGroup: true,
          p: [250, 250],
          motionPreset: 'wiggle',
          m: createMotion('wiggle') as Layer['m'],
          shapes: [],
        };

        let layers = [group, ...icon.layers];
        if (selectedLayerId) {
          const selected = icon.layers.find((layer) => layer.id === selectedLayerId);
          if (selected && !selected.isGroup) {
            layers = layers.map((layer) => (layer.id === selectedLayerId ? { ...layer, groupId } : layer));
          }
        }
        return { ...icon, layers };
      },
      { label: 'Create group' }
    );
    setSelectedLayerId(groupId);
  }, [selectedLayerId, updateIcon]);

  const setLayerGroup = useCallback(
    (id: string, groupId: string | undefined) => {
      updateIcon(
        (icon) => ({
          ...icon,
          layers: icon.layers.map((layer) =>
            layer.id === id
              ? { ...layer, groupId, parent: groupId ? layer.parent : undefined }
              : layer
          ),
        }),
        { label: groupId ? 'Add layer to group' : 'Remove layer from group' }
      );
    },
    [updateIcon]
  );

  const addShape = useCallback(
    (type: 'rect' | 'circle' | 'spark') => {
      const layerId = nextId('layer');
      updateDoc(
        (current) => {
          const shape =
            type === 'circle' ? ellipse(0, 0, 50, 40) : type === 'spark' ? spark(0, 0, 32) : rect(-50, -50, 100, 100, 12);
          const selected = current.icon.layers.find((layer) => layer.id === selectedLayerId);
          const groupId = selected?.groupId;

          const layer: Layer = {
            id: layerId,
            name: `New ${type}`,
            p: [250, 250],
            tilt: VIEWS[current.facing].tilt,
            tiltFromView: true,
            groupId,
            isGroupLeader: false,
            shapes: [{ d: shape, fill: 'main', depth: type === 'spark' ? 0 : 0.8 }],
          };

          return { ...current, icon: { ...current.icon, layers: [...current.icon.layers, layer] } };
        },
        { label: `Add ${type}` }
      );
      setSelectedLayerId(layerId);
    },
    [selectedLayerId, updateDoc]
  );

  const deleteLayer = useCallback(
    (id: string) => {
      updateIcon(
        (icon) => {
          const target = icon.layers.find((layer) => layer.id === id);
          const layers = icon.layers
            .filter((layer) => layer.id !== id)
            .map((layer) =>
              target?.isGroup && layer.groupId === id ? { ...layer, groupId: undefined } : layer
            );
          return { ...icon, layers };
        },
        { label: 'Delete layer' }
      );
      setSelectedLayerId((current) => (current === id ? null : current));
    },
    [updateIcon]
  );

  const changePalette = useCallback(
    (paletteId: string) => {
      const palette = PALETTES[paletteId as keyof typeof PALETTES] ?? PALETTES.slush;
      updateDoc((current) => ({ ...current, paletteId, palette: { ...palette } }), { label: 'Change palette' });
    },
    [updateDoc]
  );

  const updatePaletteColor = useCallback(
    (role: keyof Palette, hex: string) => {
      updateDoc(
        (current) => ({
          ...current,
          paletteId: 'custom',
          palette: { ...current.palette, [role]: hex },
        }),
        { mode: 'coalesce', key: `palette:${String(role)}`, label: 'Edit palette color' }
      );
    },
    [updateDoc]
  );

  const updateOutlineWidth = useCallback(
    (width: number) => {
      updateDoc(
        (current) => ({
          ...current,
          outlineWidth: width,
          icon: { ...current.icon, line: width },
        }),
        { mode: 'coalesce', key: 'outline-width', label: 'Change outline width' }
      );
    },
    [updateDoc]
  );

  const changeFacing = useCallback(
    (facing: View) => {
      const view = VIEWS[facing];
      updateDoc(
        (current) => ({
          ...current,
          facing,
          icon: {
            ...current.icon,
            extrude: view.extrude,
            layers: current.icon.layers.map((layer) =>
              layer.tilt && layer.tiltFromView !== false ? { ...layer, tilt: view.tilt } : layer
            ),
          },
        }),
        { label: 'Change facing' }
      );
    },
    [updateDoc]
  );

  const renameProject = useCallback(
    (name: string) => {
      updateIcon((icon) => ({ ...icon, name }), { mode: 'coalesce', key: 'project-name', label: 'Rename project' });
    },
    [updateIcon]
  );

  const selectTemplate = useCallback(
    (template: Icon) => {
      updateDoc(
        (current) => {
          const icon = cloneIcon(template);
          icon.line = current.outlineWidth;
          return { ...current, icon };
        },
        { label: 'Load template' }
      );
      setSelectedLayerId(firstVisualLayer(template));
      clock.seek(0);
    },
    [clock, updateDoc]
  );

  const loadProject = useCallback(
    (next: StudioDoc) => {
      const icon = cloneIcon(next.icon);
      icon.line = next.outlineWidth;
      setHistory(createHistory({ ...next, icon }, 'Open project'));
      setSelectedLayerId(firstVisualLayer(icon));
      clock.seek(0);
    },
    [clock]
  );

  const newProject = useCallback(() => {
    const icon = cloneIcon(blankProject);
    const current = history.present;
    icon.line = current.outlineWidth;
    const next: StudioDoc = {
      icon,
      paletteId: current.paletteId === 'custom' ? DEFAULT_PALETTE_ID : current.paletteId,
      palette: current.paletteId === 'custom' ? { ...PALETTES.slush } : current.palette,
      facing: current.facing,
      outlineWidth: current.outlineWidth,
    };
    setHistory(createHistory(next, 'New project'));
    setSelectedLayerId(firstVisualLayer(icon));
    clock.seek(0);
  }, [clock, history.present]);

  const applyAIActions = useCallback((batch: AIAction[]): AIApplyOutcome => {
    if (!batch.length) return { applied: [], skipped: [], changed: false };

    const base = docRef.current;
    const result = applyAIActionsToDoc(base, batch, nextId);

    if (result.changed) {
      setHistory((current) => {
        if (current.present === base) {
          return applyMutation(current, () => result.doc, {
            mode: 'commit',
            label: 'Apply AI changes',
          });
        }
        // An edit landed between computing the batch and committing it, so the
        // batch is replayed on the newer document instead of overwriting it.
        const latest = applyAIActionsToDoc(current.present, batch, nextId);
        if (!latest.changed) return current;
        return applyMutation(current, () => latest.doc, {
          mode: 'commit',
          label: 'Apply AI changes',
        });
      });
    }

    // Newly added layers become the selection; removed ones clear it.
    setSelectedLayerId((current) => {
      if (current && result.removed.includes(current)) return null;
      return result.selectedLayerId !== undefined ? result.selectedLayerId : current;
    });

    return { applied: result.applied, skipped: result.skipped, changed: result.changed };
  }, []);

  const beginTransform = useCallback((label = 'Transform') => {
    setHistory((current) => beginGestureHistory(current, label));
  }, []);

  const endTransform = useCallback((label?: string) => {
    setHistory((current) => endGestureHistory(current, label));
  }, []);

  const moveLayerLive = useCallback(
    (id: string, dx: number, dy: number) => {
      updateIcon(
        (icon) => ({
          ...icon,
          layers: icon.layers.map((layer) => {
            if (layer.id !== id || layer.locked) return layer;
            const currentP =
              Array.isArray(layer.p) && typeof layer.p[0] === 'number'
                ? (layer.p as unknown as readonly [number, number])
                : ([250, 250] as const);
            return { ...layer, p: [currentP[0] + dx, currentP[1] + dy] };
          }),
        }),
        { mode: 'live' }
      );
    },
    [updateIcon]
  );

  const rotateLayerLive = useCallback(
    (id: string, delta: number) => {
      updateIcon(
        (icon) => ({
          ...icon,
          layers: icon.layers.map((layer) =>
            layer.id === id && !layer.locked
              ? { ...layer, r: ((typeof layer.r === 'number' ? layer.r : 0) + delta) % 360 }
              : layer
          ),
        }),
        { mode: 'live' }
      );
    },
    [updateIcon]
  );

  const scaleLayerLive = useCallback(
    (id: string, deltaX: number, deltaY: number) => {
      updateIcon(
        (icon) => ({
          ...icon,
          layers: icon.layers.map((layer) => {
            if (layer.id !== id || layer.locked) return layer;
            const scale = Array.isArray(layer.s) && typeof layer.s[0] === 'number' ? layer.s : [100, 100];
            return {
              ...layer,
              s: [
                Math.min(300, Math.max(15, scale[0] + deltaX)),
                Math.min(300, Math.max(15, scale[1] + deltaY)),
              ],
            };
          }),
        }),
        { mode: 'live' }
      );
    },
    [updateIcon]
  );

  const undo = useCallback(() => {
    setHistory((current) => undoHistory(current));
    clock.pause();
  }, [clock]);

  const redo = useCallback(() => {
    setHistory((current) => redoHistory(current));
    clock.pause();
  }, [clock]);

  const actions: StudioActions = useMemo(
    () => ({
      updateIcon,
      updateLayer,
      updateShapeFill,
      updateShapeDepth,
      updateLayerTiming,
      moveLayerIndex,
      applyMotion,
      createGroup,
      setLayerGroup,
      addShape,
      deleteLayer,
      changePalette,
      updatePaletteColor,
      updateOutlineWidth,
      changeFacing,
      renameProject,
      selectTemplate,
      newProject,
      loadProject,
      applyAIActions,
      beginTransform,
      endTransform,
      moveLayerLive,
      rotateLayerLive,
      scaleLayerLive,
    }),
    [
      addShape,
      applyAIActions,
      applyMotion,
      beginTransform,
      changeFacing,
      changePalette,
      createGroup,
      deleteLayer,
      endTransform,
      loadProject,
      moveLayerIndex,
      moveLayerLive,
      newProject,
      renameProject,
      rotateLayerLive,
      scaleLayerLive,
      selectTemplate,
      setLayerGroup,
      updateIcon,
      updateLayer,
      updateLayerTiming,
      updateOutlineWidth,
      updatePaletteColor,
      updateShapeDepth,
      updateShapeFill,
    ]
  );

  return {
    doc,
    icon: doc.icon,
    palette: doc.palette,
    paletteId: doc.paletteId,
    facing: doc.facing,
    outlineWidth: doc.outlineWidth,
    selectedLayerId,
    selectedLayer: doc.icon.layers.find((layer) => layer.id === selectedLayerId) ?? null,
    setSelectedLayerId,
    canUndo: historyCanUndo(history),
    canRedo: historyCanRedo(history),
    undo,
    redo,
    saveState,
    actions,
  };
}
