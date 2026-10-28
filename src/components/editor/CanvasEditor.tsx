'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { StickerProject, StickerLayer } from '@/types/sticker';
import { renderSticker, getExtrudeVector } from '@/lib/renderer';
import { calculateMotion, MotionTransform } from '@/lib/motionEngine';
import { Move, Maximize2, RotateCw } from 'lucide-react';

interface CanvasEditorProps {
  project: StickerProject;
  currentFrame: number;
  totalFrames: number;
  isPlaying: boolean;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, updates: Partial<StickerLayer>) => void;
  onDeleteLayer?: (id: string) => void;
  zoom: number;
}

type HandleType = 'nw' | 'ne' | 'se' | 'sw';

interface DragMoveState {
  type: 'move';
  layerId: string;
  startClientX: number;
  startClientY: number;
  startLayerX: number;
  startLayerY: number;
  motionTransform: MotionTransform;
}

interface DragResizeState {
  type: 'resize';
  layerId: string;
  handle: HandleType;
  startLayer: StickerLayer;
  motionTransform: MotionTransform;
}

interface DragRotateState {
  type: 'rotate';
  layerId: string;
  startRotation: number;
  motionTransform: MotionTransform;
}

type DragState = DragMoveState | DragResizeState | DragRotateState | null;

const ROTATE_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%232563eb' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8'/%3E%3Cpath d='M21 3v5h-5'/%3E%3C/svg%3E") 12 12, crosshair`;

/**
 * Invert scene root motion transform to convert canvas coords (0..500) to rest scene coords
 */
function canvasToScene(
  canvasX: number,
  canvasY: number,
  motionTransform: MotionTransform
): { x: number; y: number } {
  const cx = 250 + motionTransform.dx;
  const cy = 250 + motionTransform.dy;
  const px = canvasX - cx;
  const py = canvasY - cy;

  const rad = (-motionTransform.dRotation * Math.PI) / 180;
  const s = motionTransform.scale || 1;

  const unscaledX = px / s;
  const unscaledY = py / s;

  const rotX = unscaledX * Math.cos(rad) - unscaledY * Math.sin(rad);
  const rotY = unscaledX * Math.sin(rad) + unscaledY * Math.cos(rad);

  return {
    x: rotX + 250,
    y: rotY + 250,
  };
}

/**
 * Convert scene point to layer local coordinate space (layer center = 0,0)
 */
function sceneToLayerLocal(
  sceneX: number,
  sceneY: number,
  layer: StickerLayer
): { x: number; y: number } {
  const dx = sceneX - layer.x;
  const dy = sceneY - layer.y;
  const rad = (-layer.rotation * Math.PI) / 180;
  return {
    x: dx * Math.cos(rad) - dy * Math.sin(rad),
    y: dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

/**
 * Checks if point hits one of the 4 selection handles of a layer
 */
function getHandleAt(
  localX: number,
  localY: number,
  layer: StickerLayer
): HandleType | null {
  const pad = 8;
  const hw = layer.width / 2 + pad;
  const hh = layer.height / 2 + pad;
  const hitRadius = 12; // comfortable hit radius

  const handles: { type: HandleType; x: number; y: number }[] = [
    { type: 'nw', x: -hw, y: -hh },
    { type: 'ne', x: hw, y: -hh },
    { type: 'se', x: hw, y: hh },
    { type: 'sw', x: -hw, y: hh },
  ];

  for (const h of handles) {
    if (Math.abs(localX - h.x) <= hitRadius && Math.abs(localY - h.y) <= hitRadius) {
      return h.type;
    }
  }
  return null;
}

/**
 * Checks if point hits the top circular rotation handle
 */
function isPointInRotateHandle(
  localX: number,
  localY: number,
  layer: StickerLayer
): boolean {
  const pad = 8;
  const hh = layer.height / 2 + pad;
  const targetY = -hh - 22;
  return Math.hypot(localX, localY - targetY) <= 14;
}

/**
 * Check if local point is inside the layer body (including depth extrusion)
 */
function isPointInLayer(
  localX: number,
  localY: number,
  layer: StickerLayer,
  extrudeVector: { x: number; y: number }
): boolean {
  const pad = 6;
  const hw = layer.width / 2 + pad;
  const hh = layer.height / 2 + pad;

  const depthX = extrudeVector.x * layer.depth;
  const depthY = extrudeVector.y * layer.depth;

  const minX = Math.min(-hw, -hw + depthX);
  const maxX = Math.max(hw, hw + depthX);
  const minY = Math.min(-hh, -hh + depthY);
  const maxY = Math.max(hh, hh + depthY);

  return localX >= minX && localX <= maxX && localY >= minY && localY <= maxY;
}

/**
 * Finds top-most hit layer from layers array (front to back)
 */
function findHitLayer(
  sceneX: number,
  sceneY: number,
  layers: StickerLayer[],
  extrudeVector: { x: number; y: number }
): StickerLayer | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.visible || layer.locked) continue;
    const local = sceneToLayerLocal(sceneX, sceneY, layer);
    if (isPointInLayer(local.x, local.y, layer, extrudeVector)) {
      return layer;
    }
  }
  return null;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  project,
  currentFrame,
  totalFrames,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onDeleteLayer,
  zoom,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [hoverCursor, setHoverCursor] = useState<string>('default');

  const selectedLayer = project.layers.find((l) => l.id === selectedLayerId) || null;
  const extrudeVector = getExtrudeVector(project.facing);

  // Render Canvas Scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderSticker(ctx, project, {
      frame: currentFrame,
      totalFrames,
      width: 500,
      height: 500,
      showHelpers: true,
      selectedLayerId,
    });
  }, [project, currentFrame, totalFrames, selectedLayerId]);

  // Convert MouseEvent client coords to 500x500 canvas coordinates
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    },
    []
  );

  // Handle Mouse Down on Canvas: hit test handles or layers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only left click

    const motionTransform = calculateMotion(
      project.motion.preset,
      currentFrame,
      totalFrames,
      project.motion.intensity
    );

    const canvasPt = getCanvasCoords(e);
    const scenePt = canvasToScene(canvasPt.x, canvasPt.y, motionTransform);

    // 1. Check if user clicked on rotate handle or resize handles of the selected layer
    if (selectedLayer && !selectedLayer.locked) {
      const local = sceneToLayerLocal(scenePt.x, scenePt.y, selectedLayer);

      // Rotation handle takes priority
      if (isPointInRotateHandle(local.x, local.y, selectedLayer)) {
        setDragState({
          type: 'rotate',
          layerId: selectedLayer.id,
          startRotation: selectedLayer.rotation,
          motionTransform,
        });
        return;
      }

      const handle = getHandleAt(local.x, local.y, selectedLayer);
      if (handle) {
        setDragState({
          type: 'resize',
          layerId: selectedLayer.id,
          handle,
          startLayer: { ...selectedLayer },
          motionTransform,
        });
        return;
      }
    }

    // 2. Check if user clicked on any visible layer (front to back)
    const hit = findHitLayer(scenePt.x, scenePt.y, project.layers, extrudeVector);
    if (hit) {
      onSelectLayer(hit.id);
      setDragState({
        type: 'move',
        layerId: hit.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startLayerX: hit.x,
        startLayerY: hit.y,
        motionTransform,
      });
      return;
    }

    // 3. Clicked empty background: deselect
    onSelectLayer(null);
  };

  // Handle Hover over Canvas (Update Cursor)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragState) return; // Cursor managed during drag

    const motionTransform = calculateMotion(
      project.motion.preset,
      currentFrame,
      totalFrames,
      project.motion.intensity
    );

    const canvasPt = getCanvasCoords(e);
    const scenePt = canvasToScene(canvasPt.x, canvasPt.y, motionTransform);

    // Check handle hover
    if (selectedLayer && !selectedLayer.locked) {
      const local = sceneToLayerLocal(scenePt.x, scenePt.y, selectedLayer);

      // Check rotation handle
      if (isPointInRotateHandle(local.x, local.y, selectedLayer)) {
        setHoverCursor(ROTATE_CURSOR);
        return;
      }

      const handle = getHandleAt(local.x, local.y, selectedLayer);
      if (handle) {
        if (handle === 'nw' || handle === 'se') {
          setHoverCursor('nwse-resize');
        } else {
          setHoverCursor('nesw-resize');
        }
        return;
      }

      // Check if over selected layer body
      if (isPointInLayer(local.x, local.y, selectedLayer, extrudeVector)) {
        setHoverCursor('grab');
        return;
      }
    }

    // Check if over any other layer
    const hit = findHitLayer(scenePt.x, scenePt.y, project.layers, extrudeVector);
    if (hit) {
      setHoverCursor('pointer');
      return;
    }

    setHoverCursor('default');
  };

  // Global Window Event Listeners during Dragging
  useEffect(() => {
    if (!dragState) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (dragState.type === 'move') {
        const deltaClientX = (e.clientX - dragState.startClientX) / zoom;
        const deltaClientY = (e.clientY - dragState.startClientY) / zoom;

        // Convert canvas delta to scene delta accounting for motion rotation & scale
        const rad = (-dragState.motionTransform.dRotation * Math.PI) / 180;
        const s = dragState.motionTransform.scale || 1;
        const deltaSceneX = (deltaClientX * Math.cos(rad) - deltaClientY * Math.sin(rad)) / s;
        const deltaSceneY = (deltaClientX * Math.sin(rad) + deltaClientY * Math.cos(rad)) / s;

        const newX = Math.round(dragState.startLayerX + deltaSceneX);
        const newY = Math.round(dragState.startLayerY + deltaSceneY);

        onUpdateLayer(dragState.layerId, { x: newX, y: newY });
      } else if (dragState.type === 'resize') {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);

        const currentScene = canvasToScene(canvasX, canvasY, dragState.motionTransform);
        const local = sceneToLayerLocal(currentScene.x, currentScene.y, dragState.startLayer);

        const newWidth = Math.max(16, Math.round(Math.abs(local.x) * 2));
        let newHeight = Math.max(16, Math.round(Math.abs(local.y) * 2));

        // Preserve aspect ratio if holding Shift
        if (e.shiftKey) {
          const ratio = (dragState.startLayer.width || 1) / (dragState.startLayer.height || 1);
          newHeight = Math.max(16, Math.round(newWidth / ratio));
        }

        onUpdateLayer(dragState.layerId, {
          width: newWidth,
          height: newHeight,
        });
      } else if (dragState.type === 'rotate') {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);

        const currentScene = canvasToScene(canvasX, canvasY, dragState.motionTransform);
        const targetLayer = project.layers.find((l) => l.id === dragState.layerId);
        if (!targetLayer) return;

        const vx = currentScene.x - targetLayer.x;
        const vy = currentScene.y - targetLayer.y;

        const rad = Math.atan2(vy, vx);
        let deg = (rad * 180) / Math.PI + 90;

        // Normalize to -180..180
        while (deg > 180) deg -= 360;
        while (deg < -180) deg += 360;

        // Snap to 15 degrees if Shift is held
        if (e.shiftKey) {
          deg = Math.round(deg / 15) * 15;
        } else {
          deg = Math.round(deg);
        }

        onUpdateLayer(dragState.layerId, { rotation: deg });
      }
    };

    const handleWindowMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [dragState, onUpdateLayer, zoom]);

  // Keyboard Navigation: Nudge position with arrow keys & Delete with Backspace/Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (!selectedLayer || selectedLayer.locked) return;

      const step = e.shiftKey ? 10 : 1;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          onUpdateLayer(selectedLayer.id, { x: selectedLayer.x - step });
          break;
        case 'ArrowRight':
          e.preventDefault();
          onUpdateLayer(selectedLayer.id, { x: selectedLayer.x + step });
          break;
        case 'ArrowUp':
          e.preventDefault();
          onUpdateLayer(selectedLayer.id, { y: selectedLayer.y - step });
          break;
        case 'ArrowDown':
          e.preventDefault();
          onUpdateLayer(selectedLayer.id, { y: selectedLayer.y + step });
          break;
        case 'Delete':
        case 'Backspace':
          if (onDeleteLayer) {
            e.preventDefault();
            onDeleteLayer(selectedLayer.id);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onSelectLayer(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayer, onUpdateLayer, onDeleteLayer, onSelectLayer]);

  // Active cursor style
  const currentCursor = dragState
    ? dragState.type === 'move'
      ? 'grabbing'
      : dragState.type === 'rotate'
      ? ROTATE_CURSOR
      : dragState.handle === 'nw' || dragState.handle === 'se'
      ? 'nwse-resize'
      : 'nesw-resize'
    : hoverCursor;

  return (
    <div
      className="relative flex items-center justify-center w-full h-full overflow-hidden select-none"
      onClick={() => onSelectLayer(null)}
    >
      {/* Zoomable Canvas Box */}
      <div
        className="relative shadow-2xl transition-transform duration-75 border border-slate-200/80 rounded-2xl overflow-hidden bg-white"
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
          style={{ cursor: currentCursor }}
          className="w-full h-full block"
        />
      </div>

      {/* Floating HUD Indicator for Selected Layer */}
      {selectedLayer && (
        <div className="absolute bottom-4 left-6 bg-white/95 backdrop-blur-md border border-slate-300 shadow-md px-3.5 py-1.5 rounded-xl font-mono text-[11px] text-slate-800 flex items-center gap-3 z-10 animate-in fade-in">
          <div className="flex items-center gap-1.5 font-bold text-slate-950">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b35]" />
            <span className="truncate max-w-[120px]">{selectedLayer.name}</span>
          </div>
          <div className="h-3 w-px bg-slate-300" />
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <Move className="w-3.5 h-3.5 text-slate-600" />
            <span>
              X: <strong className="text-slate-950">{selectedLayer.x}</strong> Y:{' '}
              <strong className="text-slate-950">{selectedLayer.y}</strong>
            </span>
          </div>
          <div className="h-3 w-px bg-slate-300" />
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <Maximize2 className="w-3.5 h-3.5 text-slate-600" />
            <span>
              <strong className="text-slate-950">{selectedLayer.width}</strong> ×{' '}
              <strong className="text-slate-950">{selectedLayer.height}</strong> px
            </span>
          </div>
          <div className="h-3 w-px bg-slate-300" />
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <RotateCw className="w-3.5 h-3.5 text-slate-600" />
            <span>
              Rot: <strong className="text-slate-950">{selectedLayer.rotation}°</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
