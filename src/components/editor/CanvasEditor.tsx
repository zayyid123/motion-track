'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Icon, Palette, renderInteractiveSticker, getLayerScreenHandles, findLayerAtPoint } from '@/lib/interactiveEngine';
import { scene } from '@/lib/funIsometric/fun';

interface CanvasEditorProps {
  icon: Icon;
  palette: Palette;
  currentFrame: number;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayerPosition: (id: string, dx: number, dy: number) => void;
  onUpdateLayerRotation: (id: string, dRot: number) => void;
  onUpdateLayerScale: (id: string, dScalePctX: number, dScalePctY: number) => void;
  zoom: number;
  onZoomChange?: (newZoom: number) => void;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  icon,
  palette,
  currentFrame,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayerPosition,
  onUpdateLayerRotation,
  onUpdateLayerScale,
  zoom,
  onZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragMode, setDragMode] = useState<'move' | 'rotate' | 'resize-all' | 'resize-x' | 'resize-y' | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const initialAngleRef = useRef<number>(0);
  const initialDistRef = useRef<{ x: number; y: number }>({ x: 1, y: 1 });

  // Attach non-passive native wheel listener to safely call e.preventDefault()
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onZoomChange) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
      const newZoom = Math.min(2.5, Math.max(0.4, Number((zoom + zoomDelta).toFixed(2))));
      onZoomChange(newZoom);
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, [zoom, onZoomChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderInteractiveSticker(ctx, icon, {
      frame: currentFrame,
      width: 500,
      height: 500,
      palette,
      showHelpers: true,
      selectedLayerId,
    });
  }, [icon, palette, currentFrame, selectedLayerId]);

  // Handle direct canvas drag: move, rotate, resize, or auto-select layer on click
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoom;
    const mouseY = (e.clientY - rect.top) / zoom;

    // 1. If a layer is already selected, check if user clicked on its handles
    if (selectedLayerId) {
      const selectedLayerObj = icon.layers.find((l) => l.id === selectedLayerId);
      const isLocked = Boolean(selectedLayerObj?.locked);

      // If layer is locked, don't allow handle transformations or moving
      if (isLocked) {
        // Allow user to click another unlocked layer
        const clickedLayerId = findLayerAtPoint(icon, currentFrame, mouseX, mouseY);
        if (clickedLayerId && clickedLayerId !== selectedLayerId) {
          onSelectLayer(clickedLayerId);
        }
        return;
      }

      const sc = scene(icon, currentFrame);
      const selectedPart = sc.parts.find((p) => p.L.id === selectedLayerId);

      if (selectedPart) {
        const handles = getLayerScreenHandles(selectedPart.pose);

        // Check distance to top rotation knob
        const distToRot = Math.hypot(mouseX - handles.rotateKnob.x, mouseY - handles.rotateKnob.y);
        if (distToRot < 24) {
          setDragMode('rotate');
          initialAngleRef.current = Math.atan2(mouseY - handles.center.y, mouseX - handles.center.x);
          dragStartRef.current = { x: mouseX, y: mouseY };
          return;
        }

        // Check distance to Left/Right edge handles (Scale X: Kiri & Kanan)
        const hitEdgeX = handles.edgesX.some((pt) => Math.hypot(mouseX - pt.x, mouseY - pt.y) < 22);
        if (hitEdgeX) {
          setDragMode('resize-x');
          initialDistRef.current = {
            x: Math.max(10, Math.abs(mouseX - handles.center.x)),
            y: Math.max(10, Math.abs(mouseY - handles.center.y)),
          };
          dragStartRef.current = { x: mouseX, y: mouseY };
          return;
        }

        // Check distance to Top/Bottom edge handles (Scale Y: Atas & Bawah)
        const hitEdgeY = handles.edgesY.some((pt) => Math.hypot(mouseX - pt.x, mouseY - pt.y) < 22);
        if (hitEdgeY) {
          setDragMode('resize-y');
          initialDistRef.current = {
            x: Math.max(10, Math.abs(mouseX - handles.center.x)),
            y: Math.max(10, Math.abs(mouseY - handles.center.y)),
          };
          dragStartRef.current = { x: mouseX, y: mouseY };
          return;
        }

        // Check distance to any 4 Corner handles (Scale Seluruhnya: Proportional)
        const hitCorner = handles.corners.some((c) => Math.hypot(mouseX - c.x, mouseY - c.y) < 24);
        if (hitCorner) {
          setDragMode('resize-all');
          const r = Math.max(10, Math.hypot(mouseX - handles.center.x, mouseY - handles.center.y));
          initialDistRef.current = { x: r, y: r };
          dragStartRef.current = { x: mouseX, y: mouseY };
          return;
        }
      }
    }

    // 2. Auto-select component layer under mouse cursor!
    const clickedLayerId = findLayerAtPoint(icon, currentFrame, mouseX, mouseY);
    if (clickedLayerId) {
      onSelectLayer(clickedLayerId);
      const clickedLayerObj = icon.layers.find((l) => l.id === clickedLayerId);
      if (!clickedLayerObj?.locked) {
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
    const mouseX = (e.clientX - rect.left) / zoom;
    const mouseY = (e.clientY - rect.top) / zoom;

    const sc = scene(icon, currentFrame);
    const selectedPart = sc.parts.find((p) => p.L.id === selectedLayerId);
    const center = selectedPart ? getLayerScreenHandles(selectedPart.pose).center : { x: 250, y: 250 };

    if (dragMode === 'rotate') {
      const currentAngle = Math.atan2(mouseY - center.y, mouseX - center.x);
      let angleDiff = ((currentAngle - initialAngleRef.current) * 180) / Math.PI;

      while (angleDiff > 180) angleDiff -= 360;
      while (angleDiff < -180) angleDiff += 360;

      if (Math.abs(angleDiff) >= 1) {
        onUpdateLayerRotation(selectedLayerId, Math.round(angleDiff));
        initialAngleRef.current = currentAngle;
      }
    } else if (dragMode === 'resize-all') {
      const currentDist = Math.hypot(mouseX - center.x, mouseY - center.y);
      const ratio = currentDist / initialDistRef.current.x;
      const dScale = Math.round((ratio - 1) * 100);

      if (Math.abs(dScale) >= 2) {
        onUpdateLayerScale(selectedLayerId, dScale, dScale);
        initialDistRef.current = { x: currentDist, y: currentDist };
      }
    } else if (dragMode === 'resize-x') {
      // Scale Width X (Kiri & Kanan)
      const currentDistX = Math.abs(mouseX - center.x);
      const ratioX = currentDistX / initialDistRef.current.x;
      const dScaleX = Math.round((ratioX - 1) * 100);

      if (Math.abs(dScaleX) >= 2) {
        onUpdateLayerScale(selectedLayerId, dScaleX, 0);
        initialDistRef.current.x = currentDistX;
      }
    } else if (dragMode === 'resize-y') {
      // Scale Height Y (Atas & Bawah)
      const currentDistY = Math.abs(mouseY - center.y);
      const ratioY = currentDistY / initialDistRef.current.y;
      const dScaleY = Math.round((ratioY - 1) * 100);

      if (Math.abs(dScaleY) >= 2) {
        onUpdateLayerScale(selectedLayerId, 0, dScaleY);
        initialDistRef.current.y = currentDistY;
      }
    } else if (dragMode === 'move') {
      const dx = (e.clientX - dragStartRef.current.x) / zoom;
      const dy = (e.clientY - dragStartRef.current.y) / zoom;

      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        onUpdateLayerPosition(selectedLayerId, Math.round(dx), Math.round(dy));
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    }
  };

  const handleMouseUp = () => {
    setDragMode(null);
    dragStartRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative flex items-center justify-center w-full h-full overflow-hidden select-none outline-none focus:ring-1 focus:ring-orange-200"
      onClick={() => onSelectLayer(null)}
      onMouseUp={handleMouseUp}
    >
      <div
        className="relative shadow-2xl transition-transform duration-75 border border-slate-200/90 rounded-2xl overflow-hidden bg-white"
        style={{
          transform: `scale(${zoom})`,
          width: 500,
          height: 500,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`w-full h-full block ${
            dragMode === 'rotate'
              ? 'cursor-grab active:cursor-grabbing'
              : dragMode === 'resize-all'
              ? 'cursor-nwse-resize'
              : dragMode === 'resize-x'
              ? 'cursor-ew-resize'
              : dragMode === 'resize-y'
              ? 'cursor-ns-resize'
              : selectedLayerId
              ? 'cursor-move'
              : 'cursor-default'
          }`}
        />

        {/* Status tooltip on bottom canvas */}
        <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-sm border border-slate-200/90 px-2.5 py-1 rounded-lg text-[10px] font-mono text-slate-700 shadow-sm pointer-events-none flex items-center gap-2">
          {selectedLayerId ? (
            icon.layers.find((l) => l.id === selectedLayerId)?.locked ? (
              <>
                <span className="font-bold text-amber-600">Locked: {selectedLayerId}</span>
                <span className="text-slate-500">• Unlock in timeline track to move or edit</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-orange-600">Active: {selectedLayerId}</span>
                <span className="text-slate-400">• Drag corners: prop scale • Drag pills: scale W/H • Drag knob: rotate</span>
              </>
            )
          ) : (
            'Click any component to select • Scroll to zoom'
          )}
        </div>
      </div>
    </div>
  );
};
