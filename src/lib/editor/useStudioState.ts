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
import { ellipse, ensureLayerIds, PALETTES, rect, spark, VIEWS } from '@/lib/funIsometric/fun';
import type { Icon, Layer, Palette, View } from '@/lib/funIsometric/fun';
import { findShape, shapeLayer } from '@/lib/funIsometric/shapes';
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

/**
 * Deep clone of an icon before it enters the editor. Ids are guaranteed here so
 * the per-layer controls (hide, lock, delete, reorder) work on every design,
 * including the vendored stickers that omit ids on decorative layers.
 */
const cloneIcon = (icon: Icon): Icon => ensureLayerIds(JSON.parse(JSON.stringify(icon)) as Icon);

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
  addShape: (shapeId: string) => void;
  deleteLayer: (id: string) => void;
  deleteLayers: (ids: string[]) => void;
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
  moveLayersLive: (ids: string[], dx: number, dy: number) => void;
  rotateLayerLive: (id: string, delta: number) => void;
  scaleLayerLive: (id: string, deltaX: number, deltaY: number) => void;
  setSelectedLayerIds: (ids: string[]) => void;
  toggleSelectLayer: (id: string, additive?: boolean) => void;
  selectAllLayers: () => void;
  clearSelection: () => void;
}

export interface StudioState {
  doc: StudioDoc;
  icon: Icon;
  palette: Palette;
  paletteId: string;
  facing: View;
  outlineWidth: number;
  selectedLayerId: string | null;
  selectedLayerIds: string[];
  selectedLayer: Layer | null;
  setSelectedLayerId: (id: string | null) => void;
  setSelectedLayerIds: (ids: string[]) => void;
  toggleSelectLayer: (id: string, additive?: boolean) => void;
  selectAllLayers: () => void;
  clearSelection: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  saveState: SaveState;
  actions: StudioActions;
}

export function useStudioState(clock: PlaybackClock): StudioState {
  const [history, setHistory] = useState<HistoryState<StudioDoc>>(() => createHistory(defaultDoc(), 'New project'));
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>(() => {
    const initial = firstVisualLayer(history.present.icon);
    return initial ? [initial] : [];
  });
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const restoredRef = useRef(false);

  const doc = history.present;
  // AI replies arrive asynchronously; this ref lets the action batch run against
  // the newest document instead of the closure captured at request time.
  const docRef = useRef<StudioDoc>(doc);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const selectedLayerId = selectedLayerIds[selectedLayerIds.length - 1] ?? null;
  const selectedLayer = doc.icon.layers.find((layer) => layer.id === selectedLayerId) ?? null;

  const setSelectedLayerId = useCallback((id: string | null) => {
    setSelectedLayerIds(id ? [id] : []);
  }, []);

  const toggleSelectLayer = useCallback((id: string, additive = false) => {
    setSelectedLayerIds((current) => {
      if (!additive) return [id];
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      return [...current, id];
    });
  }, []);

  const selectAllLayers = useCallback(() => {
    setSelectedLayerIds(docRef.current.icon.layers.map((layer) => layer.id || '').filter(Boolean));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLayerIds([]);
  }, []);

  // Restore the autosaved draft after mount to keep server/client markup identical.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const draft = readProjectDraft();
    if (!draft) return;
    // Restoring the autosaved draft after hydration is a deliberate one-time
    // external-store sync; reading localStorage during render would desync SSR.
    const restored = { ...draft, icon: ensureLayerIds(draft.icon) };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(createHistory(restored, 'Restored draft'));
    const initialLayer = firstVisualLayer(restored.icon);
    setSelectedLayerIds(initialLayer ? [initialLayer] : []);
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
    setSelectedLayerIds([groupId]);
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
    (shapeId: string) => {
      const def = findShape(shapeId);
      const layerId = nextId('layer');
      updateDoc(
        (current) => {
          const selected = current.icon.layers.find((layer) => layer.id === selectedLayerId);
          const groupId = selected?.groupId;

          // A known catalogue shape reuses the exact layer the picker previews;
          // unknown ids fall back to the legacy primitives so nothing breaks.
          const layer: Layer = def
            ? {
                ...shapeLayer(layerId, def.label, def, {
                  tilt: VIEWS[current.facing].tilt,
                  fill: 'main',
                  at: [250, 250],
                }),
                groupId,
              }
            : {
                id: layerId,
                name: shapeId,
                p: [250, 250],
                tilt: VIEWS[current.facing].tilt,
                tiltFromView: true,
                groupId,
                isGroupLeader: false,
                shapes: [
                  {
                    d:
                      shapeId === 'circle'
                        ? ellipse(0, 0, 50, 40)
                        : shapeId === 'spark'
                          ? spark(0, 0, 32)
                          : rect(-50, -50, 100, 100, 12),
                    fill: 'main',
                    depth: shapeId === 'spark' ? 0 : 0.8,
                  },
                ],
              };

          return { ...current, icon: { ...current.icon, layers: [...current.icon.layers, layer] } };
        },
        { label: `Add ${def?.label ?? shapeId}` }
      );
      setSelectedLayerIds([layerId]);
    },
    [selectedLayerId, updateDoc]
  );

  const deleteLayers = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      const idSet = new Set(ids);
      updateIcon(
        (icon) => {
          const targets = icon.layers.filter((layer) => layer.id && idSet.has(layer.id));
          const groupIds = new Set(targets.filter((t) => t.isGroup && t.id).map((t) => t.id as string));
          const layers = icon.layers
            .filter((layer) => !layer.id || !idSet.has(layer.id))
            .map((layer) =>
              layer.groupId && groupIds.has(layer.groupId) ? { ...layer, groupId: undefined } : layer
            );
          return { ...icon, layers };
        },
        { label: ids.length > 1 ? `Delete ${ids.length} layers` : 'Delete layer' }
      );
      setSelectedLayerIds((current) => current.filter((id) => !idSet.has(id)));
    },
    [updateIcon]
  );

  const deleteLayer = useCallback(
    (id: string) => {
      deleteLayers([id]);
    },
    [deleteLayers]
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
      const initialLayer = firstVisualLayer(template);
      setSelectedLayerIds(initialLayer ? [initialLayer] : []);
      clock.seek(0);
    },
    [clock, updateDoc]
  );

  const loadProject = useCallback(
    (next: StudioDoc) => {
      const icon = cloneIcon(next.icon);
      icon.line = next.outlineWidth;
      setHistory(createHistory({ ...next, icon }, 'Open project'));
      const initialLayer = firstVisualLayer(icon);
      setSelectedLayerIds(initialLayer ? [initialLayer] : []);
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
    const initialLayer = firstVisualLayer(icon);
    setSelectedLayerIds(initialLayer ? [initialLayer] : []);
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
    setSelectedLayerIds((current) => {
      const filtered = current.filter((id) => !result.removed.includes(id));
      if (result.selectedLayerId !== undefined) {
        return result.selectedLayerId ? [result.selectedLayerId] : [];
      }
      return filtered;
    });

    return { applied: result.applied, skipped: result.skipped, changed: result.changed };
  }, []);

  const beginTransform = useCallback((label = 'Transform') => {
    setHistory((current) => beginGestureHistory(current, label));
  }, []);

  const endTransform = useCallback((label?: string) => {
    setHistory((current) => endGestureHistory(current, label));
  }, []);

  const moveLayersLive = useCallback(
    (ids: string[], dx: number, dy: number) => {
      if (!ids.length || (dx === 0 && dy === 0)) return;
      const idSet = new Set(ids);
      updateIcon(
        (icon) => ({
          ...icon,
          layers: icon.layers.map((layer) => {
            if (!layer.id || !idSet.has(layer.id) || layer.locked) return layer;
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

  const moveLayerLive = useCallback(
    (id: string, dx: number, dy: number) => {
      moveLayersLive([id], dx, dy);
    },
    [moveLayersLive]
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
      deleteLayers,
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
      moveLayersLive,
      rotateLayerLive,
      scaleLayerLive,
      setSelectedLayerIds,
      toggleSelectLayer,
      selectAllLayers,
      clearSelection,
    }),
    [
      addShape,
      applyAIActions,
      applyMotion,
      beginTransform,
      changeFacing,
      changePalette,
      clearSelection,
      createGroup,
      deleteLayer,
      deleteLayers,
      endTransform,
      loadProject,
      moveLayerIndex,
      moveLayerLive,
      moveLayersLive,
      newProject,
      renameProject,
      rotateLayerLive,
      scaleLayerLive,
      selectAllLayers,
      selectTemplate,
      setLayerGroup,
      setSelectedLayerIds,
      toggleSelectLayer,
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
    selectedLayerIds,
    selectedLayer,
    setSelectedLayerId,
    setSelectedLayerIds,
    toggleSelectLayer,
    selectAllLayers,
    clearSelection,
    canUndo: historyCanUndo(history),
    canRedo: historyCanRedo(history),
    undo,
    redo,
    saveState,
    actions,
  };
}
