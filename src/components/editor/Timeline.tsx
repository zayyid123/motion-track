'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  Repeat,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  GripVertical,
  CornerDownRight,
  Trash2,
} from 'lucide-react';
import { Layer } from '@/lib/funIsometric';

interface MultiTrackTimelineProps {
  layers: ReadonlyArray<Layer>;
  currentFrame: number;
  totalFrames: number;
  isPlaying: boolean;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onTogglePlay: () => void;
  onSeek: (frame: number) => void;
  loop: boolean;
  onToggleLoop: () => void;
  onToggleHideLayer: (id: string) => void;
  onToggleLockLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onUpdateLayerTiming: (id: string, ip: number, op: number) => void;
  onMoveLayerIndex: (fromIndex: number, toIndex: number, targetGroupId?: string | null) => void;
}

export const Timeline: React.FC<MultiTrackTimelineProps> = ({
  layers,
  currentFrame,
  totalFrames,
  isPlaying,
  selectedLayerId,
  onSelectLayer,
  onTogglePlay,
  onSeek,
  loop,
  onToggleLoop,
  onToggleHideLayer,
  onToggleLockLayer,
  onDeleteLayer,
  onUpdateLayerTiming,
  onMoveLayerIndex,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [timelineHeight, setTimelineHeight] = useState(260); // Adjustable height in px
  const [isResizingHeight, setIsResizingHeight] = useState(false);

  const [controlWidth, setControlWidth] = useState(280); // Width of left control panel (adjustable)
  const [isResizingControl, setIsResizingControl] = useState(false);

  const rightTracksRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [draggedTrackIndex, setDraggedTrackIndex] = useState<number | null>(null);
  const [dragOverTrackIndex, setDragOverTrackIndex] = useState<number | null>(null);

  const [trimming, setTrimming] = useState<{
    layerId: string;
    type: 'start' | 'end' | 'body';
    startX: number;
    initialIp: number;
    initialOp: number;
  } | null>(null);

  // Resize timeline height upward (drag top border to expand/collapse vertically)
  useEffect(() => {
    const handleHeightMouseMove = (e: MouseEvent) => {
      if (!isResizingHeight) return;
      // Calculate height from bottom of window to mouse position
      const newHeight = Math.min(window.innerHeight * 0.75, Math.max(140, window.innerHeight - e.clientY));
      setTimelineHeight(newHeight);
      if (!isExpanded) setIsExpanded(true);
    };

    const handleHeightMouseUp = () => {
      setIsResizingHeight(false);
    };

    if (isResizingHeight) {
      window.addEventListener('mousemove', handleHeightMouseMove);
      window.addEventListener('mouseup', handleHeightMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleHeightMouseMove);
      window.removeEventListener('mouseup', handleHeightMouseUp);
    };
  }, [isResizingHeight, isExpanded]);

  // Resize left control panel width (drag left-right to widen / narrow)
  useEffect(() => {
    const handleResizeMouseMove = (e: MouseEvent) => {
      if (!isResizingControl) return;
      // Width bounded between 180px and 550px
      const newWidth = Math.min(550, Math.max(180, e.clientX));
      setControlWidth(newWidth);
    };

    const handleResizeMouseUp = () => {
      setIsResizingControl(false);
    };

    if (isResizingControl) {
      window.addEventListener('mousemove', handleResizeMouseMove);
      window.addEventListener('mouseup', handleResizeMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleResizeMouseMove);
      window.removeEventListener('mouseup', handleResizeMouseUp);
    };
  }, [isResizingControl]);

  // Playhead scrubbing (geser playhead kiri-kanan secara langsung)
  useEffect(() => {
    const handlePlayheadMove = (e: MouseEvent) => {
      if (!isDraggingPlayhead || !rightTracksRef.current) return;
      const rect = rightTracksRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const targetFrame = Math.max(0, Math.min(totalFrames - 1, Math.round((clickX / rect.width) * totalFrames)));
      onSeek(targetFrame);
    };

    const handlePlayheadUp = () => {
      setIsDraggingPlayhead(false);
    };

    if (isDraggingPlayhead) {
      window.addEventListener('mousemove', handlePlayheadMove);
      window.addEventListener('mouseup', handlePlayheadUp);
    }
    return () => {
      window.removeEventListener('mousemove', handlePlayheadMove);
      window.removeEventListener('mouseup', handlePlayheadUp);
    };
  }, [isDraggingPlayhead, totalFrames, onSeek]);

  // Dragging / Trimming clip clips on timeline track
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!trimming || !rightTracksRef.current) return;
      const rect = rightTracksRef.current.getBoundingClientRect();
      const trackWidth = rect.width;
      const dxPx = e.clientX - trimming.startX;
      const dFrames = Math.round((dxPx / trackWidth) * totalFrames);

      const duration = trimming.initialOp - trimming.initialIp;

      if (trimming.type === 'start') {
        const nextIp = Math.max(0, Math.min(trimming.initialOp - 5, trimming.initialIp + dFrames));
        onUpdateLayerTiming(trimming.layerId, nextIp, trimming.initialOp);
      } else if (trimming.type === 'end') {
        const nextOp = Math.min(totalFrames, Math.max(trimming.initialIp + 5, trimming.initialOp + dFrames));
        onUpdateLayerTiming(trimming.layerId, trimming.initialIp, nextOp);
      } else if (trimming.type === 'body') {
        let nextIp = trimming.initialIp + dFrames;
        let nextOp = nextIp + duration;
        if (nextIp < 0) {
          nextIp = 0;
          nextOp = duration;
        }
        if (nextOp > totalFrames) {
          nextOp = totalFrames;
          nextIp = totalFrames - duration;
        }
        onUpdateLayerTiming(trimming.layerId, nextIp, nextOp);
      }
    };

    const handleWindowMouseUp = () => {
      setTrimming(null);
    };

    if (trimming) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [trimming, totalFrames, onUpdateLayerTiming]);

  // Click on ruler to seek playhead
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rightTracksRef.current) return;
    const rect = rightTracksRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetFrame = Math.max(0, Math.min(totalFrames - 1, Math.round((clickX / rect.width) * totalFrames)));
    onSeek(targetFrame);
  };

  const playheadPercent = (currentFrame / totalFrames) * 100;

  // Track colors matching clean Swiss design: Electric Blue & Tangerine Orange tones
  const CLIP_COLORS = [
    'bg-blue-600 border-blue-500 text-white',
    'bg-[#ff6b35] border-orange-500 text-white',
    'bg-slate-700 border-slate-600 text-white',
    'bg-indigo-600 border-indigo-500 text-white',
    'bg-amber-600 border-amber-500 text-white',
    'bg-sky-600 border-sky-500 text-white',
  ];

  return (
    <footer
      style={{
        height: isExpanded ? `${timelineHeight}px` : '3.5rem',
      }}
      className="border-t border-slate-200 bg-white text-slate-800 select-none flex flex-col z-20 shadow-lg relative"
    >
      {/* Top Vertical Height Resizer Bar (Drag upward to expand timeline height) */}
      <div
        onMouseDown={() => setIsResizingHeight(true)}
        className="absolute -top-1.5 left-0 right-0 h-3 cursor-ns-resize hover:bg-[#ff6b35]/40 active:bg-[#ff6b35] z-30 transition-colors flex items-center justify-center group"
        title="Drag up/down to expand or reduce timeline height"
      >
        <div className="w-12 h-1 bg-slate-300 group-hover:bg-[#ff6b35] rounded-full transition-colors" />
      </div>

      {/* Top Timeline Transport Header */}
      <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between bg-slate-50/95 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSeek(0)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition"
            title="Jump to frame 0"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            className={`p-2 rounded-xl transition ${
              isPlaying
                ? 'bg-[#ff6b35] text-white shadow-sm shadow-orange-200'
                : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-300'
            }`}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            onClick={onToggleLoop}
            className={`p-2 rounded-lg transition ${
              loop
                ? 'text-[#ff6b35] bg-orange-100 font-bold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title="Toggle Seamless Loop"
          >
            <Repeat className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-300 mx-1" />

          {/* Timecode / Frame Counter */}
          <div className="font-mono text-xs text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs">
            <span className="text-[#ff6b35] font-bold">
              {Math.floor(currentFrame / 60).toString().padStart(2, '0')}:
              {((currentFrame % 60) / 60 * 100).toFixed(0).padStart(2, '0')}
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600 font-semibold">{currentFrame} / {totalFrames} f</span>
          </div>
        </div>

        {/* Center Title */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium">Multi-Track Timeline</span>
        </div>

        {/* Toggle Minimize/Maximize Timeline */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition shadow-xs"
          >
            <span>{isExpanded ? 'Collapse' : 'Expand Tracks'}</span>
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Multi-Track Timeline: Controls & Tracks Unified in ONE Vertical Scroll */}
      {isExpanded && (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Header Bar: Fixed Top Row containing Track Counter (Left) and Time Ruler (Right) */}
          <div className="h-7 border-b border-slate-200 bg-slate-100 flex shrink-0 relative z-20">
            {/* Left Header Title */}
            <div
              style={{ width: `${controlWidth}px` }}
              className="px-3 flex items-center justify-between text-[10px] font-mono text-slate-600 font-bold uppercase shrink-0 border-r border-slate-200"
            >
              <span>Tracks ({layers.length})</span>
              <span className="text-[9px] text-slate-400 font-normal">Controls & Hierarchy</span>
            </div>

            {/* Resizer Header Handle */}
            <div
              onMouseDown={() => setIsResizingControl(true)}
              className="w-1.5 -ml-1 cursor-col-resize hover:bg-[#ff6b35] z-30 transition-colors"
              title="Drag left/right to resize track controls width"
            />

            {/* Right Header: Time Ruler (Click or Drag to Scrub Player) */}
            <div
              ref={rightTracksRef}
              onClick={handleRulerClick}
              onMouseDown={(e) => {
                setIsDraggingPlayhead(true);
                handleRulerClick(e);
              }}
              className="flex-1 bg-slate-100/80 relative flex items-center cursor-ew-resize select-none overflow-hidden"
            >
              {Array.from({ length: 9 }).map((_, i) => {
                const tickFrame = Math.round((i / 8) * totalFrames);
                return (
                  <div
                    key={i}
                    className="absolute text-[9px] font-mono text-slate-500 flex flex-col items-center -translate-x-1/2 pointer-events-none"
                    style={{ left: `${(i / 8) * 100}%` }}
                  >
                    <span>{tickFrame}f</span>
                    <div className="w-px h-1.5 bg-slate-300 mt-0.5" />
                  </div>
                );
              })}

              {/* Top Playhead Needle in Ruler */}
              <div
                className="absolute top-0 bottom-0 z-30 flex flex-col items-center -translate-x-1/2 pointer-events-none"
                style={{ left: `${playheadPercent}%` }}
              >
                <div className="w-3.5 h-3.5 bg-[#ff6b35] rotate-45 -mt-1 shadow-md rounded-xs" />
              </div>
            </div>
          </div>

          {/* UNIFIED SCROLL CONTAINER: Left controls and Right tracks are row-by-row inside the SAME container! */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative bg-white">
            {/* Playhead Vertical Line traversing entire height of all tracks */}
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{
                left: `${controlWidth}px`,
                right: 0,
              }}
            >
              <div
                className="absolute top-0 bottom-0 flex flex-col items-center -translate-x-1/2 pointer-events-none"
                style={{ left: `${playheadPercent}%` }}
              >
                <div className="w-0.5 h-full bg-[#ff6b35] shadow-xs" />
              </div>
            </div>

            {/* List of Unified Track Rows */}
            <div className="divide-y divide-slate-100">
              {layers.map((layer, idx) => {
                const layerId = layer.id || `layer-${idx}`;
                const isSelected = selectedLayerId === layerId;
                const isLocked = Boolean(layer.locked);
                const isDragOver = dragOverTrackIndex === idx;

                const isGroupContainer = Boolean(layer.isGroup);
                const inGroup = Boolean(layer.groupId);

                const ip = layer.ip ?? 0;
                const op = layer.op ?? totalFrames;
                const clipLeft = (ip / totalFrames) * 100;
                const clipWidth = Math.max(3, ((op - ip) / totalFrames) * 100);
                const colorTheme = CLIP_COLORS[idx % CLIP_COLORS.length];

                return (
                  <div
                    key={layerId}
                    onClick={() => onSelectLayer(layerId)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverTrackIndex !== idx) {
                        setDragOverTrackIndex(idx);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverTrackIndex === idx) {
                        setDragOverTrackIndex(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedTrackIndex !== null && draggedTrackIndex !== idx) {
                        const targetLayer = layers[idx];
                        let targetGroupId: string | null = null;

                        if (targetLayer.isGroup) {
                          if (idx < draggedTrackIndex) {
                            targetGroupId = null; // Above group -> leave group
                          } else {
                            targetGroupId = targetLayer.id || null; // Into group
                          }
                        } else if (targetLayer.groupId) {
                          targetGroupId = targetLayer.groupId;
                        } else {
                          targetGroupId = null;
                        }

                        onMoveLayerIndex(draggedTrackIndex, idx, targetGroupId);
                      }
                      setDraggedTrackIndex(null);
                      setDragOverTrackIndex(null);
                    }}
                    className={`h-11 flex items-center transition relative cursor-pointer ${
                      isDragOver
                        ? isGroupContainer
                          ? 'bg-orange-200 ring-2 ring-[#ff6b35] z-10'
                          : 'bg-orange-100 ring-2 ring-[#ff6b35] z-10'
                        : isSelected
                        ? 'bg-orange-50/70'
                        : isGroupContainer
                        ? 'bg-orange-50/30'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* LEFT COLUMN: Controls & Hierarchy (Synchronously scrolls together) */}
                    <div
                      style={{ width: `${controlWidth}px` }}
                      className={`h-full px-2.5 flex items-center justify-between border-r border-slate-200 shrink-0 text-xs font-mono select-none ${
                        isSelected ? 'border-l-2 border-l-[#ff6b35]' : ''
                      }`}
                    >
                      {/* Drag Handle Icon */}
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDraggedTrackIndex(idx);
                          e.dataTransfer.setData('text/plain', String(idx));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDraggedTrackIndex(null);
                          setDragOverTrackIndex(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center text-slate-400 hover:text-slate-800 p-1 rounded hover:bg-slate-200 shrink-0 mr-1 cursor-grab active:cursor-grabbing transition"
                        title="Drag icon to reorder track position"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>

                      {/* Layer Name & Indentation for Children */}
                      <div
                        className={`flex items-center gap-1.5 truncate flex-1 min-w-0 transition-all ${
                          inGroup ? 'pl-4 border-l-2 border-blue-300 ml-1' : ''
                        }`}
                      >
                        {isGroupContainer ? (
                          <div className="flex items-center gap-1 text-orange-600 shrink-0 font-bold">
                            <span>📁</span>
                            <span className="text-[9px] px-1 py-0.5 rounded bg-orange-200 text-orange-900 uppercase">
                              group
                            </span>
                          </div>
                        ) : inGroup ? (
                          <div className="flex items-center gap-0.5 shrink-0 text-blue-600">
                            <CornerDownRight className="w-3 h-3 text-blue-500" />
                            <span className="text-[9px] font-bold px-1 rounded bg-blue-100 text-blue-700">
                              child
                            </span>
                          </div>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-[#ff6b35] shrink-0" />
                        )}

                        <div className="truncate min-w-0">
                          <div className="font-semibold truncate text-[11px] leading-tight text-slate-900">
                            {layer.name || layerId}
                          </div>
                          <div className="text-[9px] text-slate-400 font-normal truncate flex items-center gap-1">
                            <span>{layer.motionPreset ? `motion: ${layer.motionPreset}` : 'static'}</span>
                            {isGroupContainer ? (
                              <span className="text-orange-600 font-semibold truncate">• (Empty Container)</span>
                            ) : inGroup ? (
                              <span className="text-blue-500 font-medium truncate">• ↳ {layer.groupId}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Quick Layer Controls: Eye (Hide), Lock & Delete */}
                      <div className="flex items-center gap-1 shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onToggleHideLayer(layerId)}
                          className={`p-1 rounded hover:bg-slate-200 transition ${
                            layer.hidden ? 'text-slate-400' : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title={layer.hidden ? 'Show layer' : 'Hide layer'}
                        >
                          {layer.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => onToggleLockLayer(layerId)}
                          className={`p-1 rounded hover:bg-slate-200 transition ${
                            isLocked ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:text-slate-700'
                          }`}
                          title={isLocked ? 'Unlock layer' : 'Lock layer'}
                        >
                          {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => onDeleteLayer(layerId)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                          title={layer.isGroup ? 'Delete this group container' : 'Delete this layer'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Resizer Vertical Border */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setIsResizingControl(true);
                      }}
                      className="w-1.5 h-full -ml-1 cursor-col-resize hover:bg-[#ff6b35] z-30 transition-colors shrink-0"
                      title="Drag left/right to resize track controls width"
                    />

                    {/* RIGHT COLUMN: Interactive Clip Bars (Synchronously scrolls together with left column!) */}
                    <div className="flex-1 h-full relative flex items-center px-1 overflow-hidden select-none">
                      <div
                        className={`absolute h-8 rounded-lg border shadow-xs flex items-center justify-between px-2 text-xs font-mono truncate transition-opacity select-none ${colorTheme} ${
                          layer.hidden ? 'opacity-30' : 'opacity-95 hover:opacity-100'
                        }`}
                        style={{
                          left: `${clipLeft}%`,
                          width: `${clipWidth}%`,
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onSelectLayer(layerId);
                          setTrimming({
                            layerId,
                            type: 'body',
                            startX: e.clientX,
                            initialIp: ip,
                            initialOp: op,
                          });
                        }}
                      >
                        {/* Left Trim Handle */}
                        <div
                          className="w-2.5 h-full -ml-2 hover:bg-white/40 cursor-ew-resize flex items-center justify-center shrink-0 rounded-l"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setTrimming({
                              layerId,
                              type: 'start',
                              startX: e.clientX,
                              initialIp: ip,
                              initialOp: op,
                            });
                          }}
                        >
                          <div className="w-0.5 h-3 bg-white/70" />
                        </div>

                        {/* Clip Label */}
                        <div className="flex items-center gap-1.5 truncate px-1 pointer-events-none">
                          {layer.isGroup ? (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500 text-white font-bold">
                              📁 group
                            </span>
                          ) : layer.groupId ? (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500 text-white/90 font-medium">
                              ↳ child
                            </span>
                          ) : null}
                          <span className="truncate font-semibold text-[11px]">
                            {layer.name || layerId}
                          </span>
                        </div>

                        {/* Right Trim Handle */}
                        <div
                          className="w-2.5 h-full -mr-2 hover:bg-white/40 cursor-ew-resize flex items-center justify-center shrink-0 rounded-r"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setTrimming({
                              layerId,
                              type: 'end',
                              startX: e.clientX,
                              initialIp: ip,
                              initialOp: op,
                            });
                          }}
                        >
                          <div className="w-0.5 h-3 bg-white/70" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
