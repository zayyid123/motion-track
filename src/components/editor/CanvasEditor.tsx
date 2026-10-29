'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  findLayerAtPoint,
  getLayerScreenHandles,
  renderInteractiveSticker,
  type Icon,
  type Palette,
} from '@/lib/interactiveEngine';
import { at, scene } from '@/lib/funIsometric/fun';
import type { Scene } from '@/lib/funIsometric/fun';
import { getLayerBounds } from '@/lib/geometry/bounds';
import type { Bounds } from '@/lib/geometry/bounds';
import type { PlaybackClock } from '@/lib/editor/clock';

interface CanvasEditorProps {
  icon: Icon;
  palette: Palette;
  clock: PlaybackClock;
  selectedLayerId: string | null;
  selectedLayerIds?: string[];
  onSelectLayer: (id: string | null) => void;
  onToggleSelectLayer?: (id: string, additive?: boolean) => void;
  onSelectMultipleLayers?: (ids: string[]) => void;
  onSelectAllLayers?: () => void;
  onClearSelection?: () => void;
  onUpdateLayerPosition: (id: string, dx: number, dy: number) => void;
  onUpdateLayersPosition?: (ids: string[], dx: number, dy: number) => void;
  onUpdateLayerRotation: (id: string, dRot: number) => void;
  onUpdateLayerScale: (id: string, dScalePctX: number, dScalePctY: number) => void;
  onBeginTransform: () => void;
  onEndTransform: () => void;
  onTogglePlay: () => void;
  zoom: number;
  onZoomChange?: (newZoom: number) => void;
}

type DragMode = 'move' | 'rotate' | 'resize-all' | 'resize-x' | 'resize-y' | 'marquee' | null;

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  icon,
  palette,
  clock,
  selectedLayerId,
  selectedLayerIds,
  onSelectLayer,
  onToggleSelectLayer,
  onSelectMultipleLayers,
  onSelectAllLayers,
  onClearSelection,
  onUpdateLayerPosition,
  onUpdateLayersPosition,
  onUpdateLayerRotation,
  onUpdateLayerScale,
  onBeginTransform,
  onEndTransform,
  onTogglePlay,
  zoom,
  onZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const initialAngleRef = useRef<number>(0);
  const initialDistRef = useRef<{ x: number; y: number }>({ x: 1, y: 1 });
  const sceneCacheRef = useRef<{ icon: Icon; frame: number; scene: Scene } | null>(null);

  const sceneScale = 500 / (icon.size ?? 500);

  const effectiveSelectedIds = useMemo(() => {
    if (selectedLayerIds && selectedLayerIds.length > 0) return selectedLayerIds;
    if (selectedLayerId) return [selectedLayerId];
    return [];
  }, [selectedLayerId, selectedLayerIds]);

  const getScene = useCallback((): Scene => {
    const frame = clock.getFrame();
    const cached = sceneCacheRef.current;
    if (cached && cached.icon === icon && cached.frame === frame) return cached.scene;
    const next = scene(icon, frame);
    sceneCacheRef.current = { icon, frame, scene: next };
    return next;
  }, [clock, icon]);

  const getBounds = useCallback(
    (sc: Scene, layerId: string): Bounds | null => {
      const part = sc.parts.find((candidate) => candidate.L.id === layerId);
      if (!part) return null;
      return getLayerBounds(part.L, sc.f, at(icon.extrude ?? [0, 0], sc.f), icon.line ?? 4);
    },
    [icon]
  );

  // Render on every clock frame without re-rendering the React tree.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const draw = () => {
      const sc = getScene();
      renderInteractiveSticker(ctx, icon, {
        frame: sc.f,
        width: 500,
        height: 500,
        palette,
        showHelpers: true,
        selectedLayerId,
        selectedLayerIds: effectiveSelectedIds,
        sceneData: sc,
      });
    };

    draw();
    return clock.subscribeFrame(draw);
  }, [clock, effectiveSelectedIds, getScene, icon, palette, selectedLayerId]);

  // Cursor-centered zoom.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onZoomChange) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const direction = e.deltaY < 0 ? 1 : -1;
      const next = Math.min(2.5, Math.max(0.4, Number((zoom + direction * 0.08).toFixed(2))));
      onZoomChange(next);
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleNativeWheel);
  }, [zoom, onZoomChange]);

  const toScene = useCallback(
    (clientX: number, clientY: number, rect: DOMRect) => ({
      x: (clientX - rect.left) / zoom / sceneScale,
      y: (clientY - rect.top) / zoom / sceneScale,
    }),
    [sceneScale, zoom]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const point = toScene(e.clientX, e.clientY, rect);
    const sc = getScene();
    const isAdditive = e.shiftKey || e.metaKey || e.ctrlKey;

    if (selectedLayerId) {
      const selectedLayer = icon.layers.find((layer) => layer.id === selectedLayerId);
      const isLocked = Boolean(selectedLayer?.locked);

      if (!isLocked) {
        const bounds = getBounds(sc, selectedLayerId);
        const part = sc.parts.find((candidate) => candidate.L.id === selectedLayerId);
        if (bounds && part) {
          const handles = getLayerScreenHandles(part.pose, bounds);
          const near = (target: { x: number; y: number }, radius = 22) =>
            Math.hypot(point.x - target.x, point.y - target.y) < radius / sceneScale;

          if (near(handles.rotateKnob, 26)) {
            onBeginTransform();
            setDragMode('rotate');
            initialAngleRef.current = Math.atan2(point.y - handles.center.y, point.x - handles.center.x);
            dragStartRef.current = { x: e.clientX, y: e.clientY };
            return;
          }

          if (handles.edgesX.some((handle) => near(handle))) {
            onBeginTransform();
            setDragMode('resize-x');
            initialDistRef.current = {
              x: Math.max(10, Math.abs(point.x - handles.center.x)),
              y: Math.max(10, Math.abs(point.y - handles.center.y)),
            };
            dragStartRef.current = { x: e.clientX, y: e.clientY };
            return;
          }

          if (handles.edgesY.some((handle) => near(handle))) {
            onBeginTransform();
            setDragMode('resize-y');
            initialDistRef.current = {
              x: Math.max(10, Math.abs(point.x - handles.center.x)),
              y: Math.max(10, Math.abs(point.y - handles.center.y)),
            };
            dragStartRef.current = { x: e.clientX, y: e.clientY };
            return;
          }

          if (handles.corners.some((corner) => near(corner, 24))) {
            onBeginTransform();
            setDragMode('resize-all');
            const radius = Math.max(10, Math.hypot(point.x - handles.center.x, point.y - handles.center.y));
            initialDistRef.current = { x: radius, y: radius };
            dragStartRef.current = { x: e.clientX, y: e.clientY };
            return;
          }
        }
      }
    }

    const clickedId = findLayerAtPoint(icon, sc.f, point.x, point.y, sc);
    if (clickedId) {
      if (isAdditive) {
        if (onToggleSelectLayer) {
          onToggleSelectLayer(clickedId, true);
        } else {
          onSelectLayer(clickedId);
        }
        return;
      }

      const isAlreadySelected = effectiveSelectedIds.includes(clickedId);
      if (!isAlreadySelected) {
        onSelectLayer(clickedId);
      }

      const clickedLayer = icon.layers.find((layer) => layer.id === clickedId);
      if (!clickedLayer?.locked) {
        onBeginTransform();
        setDragMode('move');
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      } else {
        setDragMode(null);
      }
    } else {
      if (!isAdditive) {
        onSelectLayer(null);
        if (onClearSelection) onClearSelection();
      }
      setDragMode('marquee');
      marqueeStartRef.current = { x: point.x, y: point.y };
      setMarquee({ startX: point.x, startY: point.y, currentX: point.x, currentY: point.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragMode) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const point = toScene(e.clientX, e.clientY, rect);

    if (dragMode === 'marquee' && marqueeStartRef.current) {
      setMarquee({
        startX: marqueeStartRef.current.x,
        startY: marqueeStartRef.current.y,
        currentX: point.x,
        currentY: point.y,
      });
      return;
    }

    if (!dragStartRef.current) return;

    const sc = getScene();
    const primaryId = selectedLayerId ?? effectiveSelectedIds[0];
    const bounds = primaryId ? getBounds(sc, primaryId) : null;
    const part = primaryId ? sc.parts.find((candidate) => candidate.L.id === primaryId) : null;
    const center = bounds && part ? getLayerScreenHandles(part.pose, bounds).center : { x: 250, y: 250 };

    if (dragMode === 'rotate' && primaryId) {
      const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);
      let delta = ((currentAngle - initialAngleRef.current) * 180) / Math.PI;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      if (Math.abs(delta) >= 1) {
        onUpdateLayerRotation(primaryId, Math.round(delta));
        initialAngleRef.current = currentAngle;
      }
    } else if (dragMode === 'resize-all' && primaryId) {
      const distance = Math.hypot(point.x - center.x, point.y - center.y);
      const ratio = distance / initialDistRef.current.x;
      const delta = Math.round((ratio - 1) * 100);
      if (Math.abs(delta) >= 2) {
        onUpdateLayerScale(primaryId, delta, delta);
        initialDistRef.current = { x: distance, y: distance };
      }
    } else if (dragMode === 'resize-x' && primaryId) {
      const distance = Math.abs(point.x - center.x);
      const delta = Math.round((distance / initialDistRef.current.x - 1) * 100);
      if (Math.abs(delta) >= 2) {
        onUpdateLayerScale(primaryId, delta, 0);
        initialDistRef.current.x = distance;
      }
    } else if (dragMode === 'resize-y' && primaryId) {
      const distance = Math.abs(point.y - center.y);
      const delta = Math.round((distance / initialDistRef.current.y - 1) * 100);
      if (Math.abs(delta) >= 2) {
        onUpdateLayerScale(primaryId, 0, delta);
        initialDistRef.current.y = distance;
      }
    } else if (dragMode === 'move') {
      const dx = (e.clientX - dragStartRef.current.x) / zoom / sceneScale;
      const dy = (e.clientY - dragStartRef.current.y) / zoom / sceneScale;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        const roundedDx = Math.round(dx * 10) / 10;
        const roundedDy = Math.round(dy * 10) / 10;
        if (onUpdateLayersPosition && effectiveSelectedIds.length > 0) {
          onUpdateLayersPosition(effectiveSelectedIds, roundedDx, roundedDy);
        } else if (primaryId) {
          onUpdateLayerPosition(primaryId, roundedDx, roundedDy);
        }
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    }
  };

  const finishDrag = useCallback(() => {
    if (dragMode === 'marquee' && marquee) {
      const minX = Math.min(marquee.startX, marquee.currentX);
      const maxX = Math.max(marquee.startX, marquee.currentX);
      const minY = Math.min(marquee.startY, marquee.currentY);
      const maxY = Math.max(marquee.startY, marquee.currentY);
      const width = maxX - minX;
      const height = maxY - minY;

      if (width > 6 || height > 6) {
        const sc = getScene();
        const selected: string[] = [];
        for (const layer of icon.layers) {
          if (!layer.id) continue;
          const bounds = getBounds(sc, layer.id);
          if (bounds) {
            const intersects = !(bounds.maxX < minX || bounds.minX > maxX || bounds.maxY < minY || bounds.minY > maxY);
            if (intersects) {
              selected.push(layer.id);
            }
          }
        }
        if (selected.length > 0) {
          if (onSelectMultipleLayers) {
            onSelectMultipleLayers(selected);
          } else if (selected[0]) {
            onSelectLayer(selected[0]);
          }
        }
      }
      setMarquee(null);
      marqueeStartRef.current = null;
    } else if (dragMode) {
      onEndTransform();
    }
    setDragMode(null);
    dragStartRef.current = null;
  }, [dragMode, getBounds, getScene, icon.layers, marquee, onEndTransform, onSelectLayer, onSelectMultipleLayers]);

  useEffect(() => {
    if (!dragMode) return;
    const handleUp = () => finishDrag();
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, [dragMode, finishDrag]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      onTogglePlay();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      if (onSelectAllLayers) onSelectAllLayers();
      return;
    }

    const step = e.shiftKey ? 10 : 1;
    const nudges: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const nudge = nudges[e.key];
    if (!nudge || effectiveSelectedIds.length === 0) return;

    e.preventDefault();
    onBeginTransform();
    if (onUpdateLayersPosition && effectiveSelectedIds.length > 0) {
      onUpdateLayersPosition(effectiveSelectedIds, nudge[0], nudge[1]);
    } else if (selectedLayerId) {
      onUpdateLayerPosition(selectedLayerId, nudge[0], nudge[1]);
    }
    onEndTransform();
  };

  const cursorClass =
    dragMode === 'rotate'
      ? 'cursor-grabbing'
      : dragMode === 'resize-all'
      ? 'cursor-nwse-resize'
      : dragMode === 'resize-x'
      ? 'cursor-ew-resize'
      : dragMode === 'resize-y'
      ? 'cursor-ns-resize'
      : dragMode === 'marquee'
      ? 'cursor-crosshair'
      : effectiveSelectedIds.length > 0
      ? 'cursor-move'
      : 'cursor-default';

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Sticker canvas. Arrow keys nudge selected layers, space toggles playback, click background to clear selection."
      className="relative flex items-center justify-center w-full h-full overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b35]/60 focus-visible:ring-offset-2"
      onKeyDown={handleKeyDown}
      onMouseUp={finishDrag}
      onClick={() => {
        onSelectLayer(null);
        if (onClearSelection) onClearSelection();
      }}
    >
      <div
        className="relative shadow-2xl transition-transform duration-75 border border-slate-200/90 rounded-2xl overflow-hidden bg-white"
        style={{ transform: `scale(${zoom})`, width: 500, height: 500 }}
        onClick={(event) => event.stopPropagation()}
      >
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={finishDrag}
          className={`w-full h-full block ${cursorClass}`}
        />

        {marquee && (
          <div
            className="absolute border border-blue-500 bg-blue-500/20 pointer-events-none rounded-xs"
            style={{
              left: `${Math.min(marquee.startX, marquee.currentX) * sceneScale}px`,
              top: `${Math.min(marquee.startY, marquee.currentY) * sceneScale}px`,
              width: `${Math.abs(marquee.currentX - marquee.startX) * sceneScale}px`,
              height: `${Math.abs(marquee.currentY - marquee.startY) * sceneScale}px`,
            }}
          />
        )}

        <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-sm border border-slate-200/90 px-2.5 py-1 rounded-lg text-[10px] font-mono text-slate-700 shadow-sm pointer-events-none flex items-center gap-2">
          {effectiveSelectedIds.length > 1 ? (
            <>
              <span className="font-semibold text-orange-600">{effectiveSelectedIds.length} layers selected</span>
              <span className="text-slate-400">• Drag to move all • Arrow keys nudge • Click canvas to clear</span>
            </>
          ) : selectedLayerId ? (
            icon.layers.find((layer) => layer.id === selectedLayerId)?.locked ? (
              <>
                <span className="font-bold text-amber-600">Locked: {selectedLayerId}</span>
                <span className="text-slate-500">• Unlock in timeline to edit</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-orange-600">Active: {selectedLayerId}</span>
                <span className="text-slate-400">• Drag corners/pills to scale • Drag knob to rotate</span>
              </>
            )
          ) : (
            'Click or drag marquee to select • Shift/Cmd+Click for multi-select • Arrow keys nudge'
          )}
        </div>
      </div>
    </div>
  );
};
