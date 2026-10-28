'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  onSelectLayer: (id: string | null) => void;
  onUpdateLayerPosition: (id: string, dx: number, dy: number) => void;
  onUpdateLayerRotation: (id: string, dRot: number) => void;
  onUpdateLayerScale: (id: string, dScalePctX: number, dScalePctY: number) => void;
  onBeginTransform: () => void;
  onEndTransform: () => void;
  onTogglePlay: () => void;
  zoom: number;
  onZoomChange?: (newZoom: number) => void;
}

type DragMode = 'move' | 'rotate' | 'resize-all' | 'resize-x' | 'resize-y' | null;

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  icon,
  palette,
  clock,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayerPosition,
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
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const initialAngleRef = useRef<number>(0);
  const initialDistRef = useRef<{ x: number; y: number }>({ x: 1, y: 1 });
  const sceneCacheRef = useRef<{ icon: Icon; frame: number; scene: Scene } | null>(null);

  const sceneScale = 500 / (icon.size ?? 500);

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
        sceneData: sc,
      });
    };

    draw();
    return clock.subscribeFrame(draw);
  }, [clock, getScene, icon, palette, selectedLayerId]);

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

    if (selectedLayerId) {
      const selectedLayer = icon.layers.find((layer) => layer.id === selectedLayerId);
      const isLocked = Boolean(selectedLayer?.locked);

      if (isLocked) {
        const clicked = findLayerAtPoint(icon, sc.f, point.x, point.y, sc);
        if (clicked && clicked !== selectedLayerId) onSelectLayer(clicked);
        return;
      }

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

    const clickedId = findLayerAtPoint(icon, sc.f, point.x, point.y, sc);
    if (clickedId) {
      onSelectLayer(clickedId);
      const clickedLayer = icon.layers.find((layer) => layer.id === clickedId);
      if (!clickedLayer?.locked) {
        onBeginTransform();
        setDragMode('move');
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      } else {
        setDragMode(null);
      }
    } else {
      onSelectLayer(null);
      setDragMode(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragMode || !dragStartRef.current || !selectedLayerId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const point = toScene(e.clientX, e.clientY, rect);
    const sc = getScene();
    const bounds = getBounds(sc, selectedLayerId);
    const part = sc.parts.find((candidate) => candidate.L.id === selectedLayerId);
    const center = bounds && part ? getLayerScreenHandles(part.pose, bounds).center : { x: 250, y: 250 };

    if (dragMode === 'rotate') {
      const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);
      let delta = ((currentAngle - initialAngleRef.current) * 180) / Math.PI;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      if (Math.abs(delta) >= 1) {
        onUpdateLayerRotation(selectedLayerId, Math.round(delta));
        initialAngleRef.current = currentAngle;
      }
    } else if (dragMode === 'resize-all') {
      const distance = Math.hypot(point.x - center.x, point.y - center.y);
      const ratio = distance / initialDistRef.current.x;
      const delta = Math.round((ratio - 1) * 100);
      if (Math.abs(delta) >= 2) {
        onUpdateLayerScale(selectedLayerId, delta, delta);
        initialDistRef.current = { x: distance, y: distance };
      }
    } else if (dragMode === 'resize-x') {
      const distance = Math.abs(point.x - center.x);
      const delta = Math.round((distance / initialDistRef.current.x - 1) * 100);
      if (Math.abs(delta) >= 2) {
        onUpdateLayerScale(selectedLayerId, delta, 0);
        initialDistRef.current.x = distance;
      }
    } else if (dragMode === 'resize-y') {
      const distance = Math.abs(point.y - center.y);
      const delta = Math.round((distance / initialDistRef.current.y - 1) * 100);
      if (Math.abs(delta) >= 2) {
        onUpdateLayerScale(selectedLayerId, 0, delta);
        initialDistRef.current.y = distance;
      }
    } else if (dragMode === 'move') {
      const dx = (e.clientX - dragStartRef.current.x) / zoom / sceneScale;
      const dy = (e.clientY - dragStartRef.current.y) / zoom / sceneScale;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        onUpdateLayerPosition(selectedLayerId, Math.round(dx * 10) / 10, Math.round(dy * 10) / 10);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    }
  };

  const finishDrag = useCallback(() => {
    if (dragMode) onEndTransform();
    setDragMode(null);
    dragStartRef.current = null;
  }, [dragMode, onEndTransform]);

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

    const step = e.shiftKey ? 10 : 1;
    const nudges: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const nudge = nudges[e.key];
    if (!nudge || !selectedLayerId) return;

    e.preventDefault();
    onBeginTransform();
    onUpdateLayerPosition(selectedLayerId, nudge[0], nudge[1]);
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
      : selectedLayerId
      ? 'cursor-move'
      : 'cursor-default';

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Sticker canvas. Arrow keys nudge the selected layer, space toggles playback."
      className="relative flex items-center justify-center w-full h-full overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b35]/60 focus-visible:ring-offset-2"
      onKeyDown={handleKeyDown}
      onMouseUp={finishDrag}
      onClick={() => onSelectLayer(null)}
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

        <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-sm border border-slate-200/90 px-2.5 py-1 rounded-lg text-[10px] font-mono text-slate-700 shadow-sm pointer-events-none flex items-center gap-2">
          {selectedLayerId ? (
            icon.layers.find((layer) => layer.id === selectedLayerId)?.locked ? (
              <>
                <span className="font-bold text-amber-600">Locked: {selectedLayerId}</span>
                <span className="text-slate-500">• Unlock in the timeline to edit</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-orange-600">Active: {selectedLayerId}</span>
                <span className="text-slate-400">• Drag corners/pills to scale • Drag knob to rotate</span>
              </>
            )
          ) : (
            'Click any component to select • Scroll to zoom • Arrow keys nudge'
          )}
        </div>
      </div>
    </div>
  );
};
