'use client';

import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Settings,
  Download,
  FolderOpen,
  Save,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Redo2,
  Trash2,
} from 'lucide-react';
import { StickerProject } from '@/types/sticker';

interface ToolbarProps {
  project: StickerProject;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetFrame: () => void;
  onOpenSettings: () => void;
  onToggleAISidebar: () => void;
  isAISidebarOpen: boolean;
  onOpenExport: () => void;
  onSaveJSON: () => void;
  onLoadJSON: () => void;
  onProjectNameChange: (name: string) => void;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  hasSelectedLayer?: boolean;
  onDeleteSelectedLayer?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  project,
  isPlaying,
  onTogglePlay,
  onResetFrame,
  onOpenSettings,
  onToggleAISidebar,
  isAISidebarOpen,
  onOpenExport,
  onSaveJSON,
  onLoadJSON,
  onProjectNameChange,
  zoom,
  onZoomChange,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  hasSelectedLayer = false,
  onDeleteSelectedLayer,
}) => {
  return (
    <header className="h-14 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-4 flex items-center justify-between z-20">
      {/* Brand & Project Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
          <div className="w-8 h-8 rounded-xl bg-[#ff6b35] text-white flex items-center justify-center font-mono font-bold text-sm shadow-sm shadow-orange-200">
            MT
          </div>
          <span className="font-mono font-bold tracking-tight text-slate-900 hidden sm:inline">
            motion-track
          </span>
          <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold border border-blue-200">
            isometric
          </span>
        </div>

        <input
          type="text"
          value={project.name}
          placeholder="Project Name..."
          onChange={(e) => onProjectNameChange(e.target.value)}
          className="font-mono text-sm px-2.5 py-1 rounded-lg border border-slate-300 hover:border-slate-400 focus:border-[#ff6b35] focus:outline-none bg-slate-50 transition w-44 sm:w-60 text-slate-900 font-bold placeholder:text-slate-500"
        />

        {/* Undo / Redo & Delete Layer Quick Buttons */}
        <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
            title="Undo (Ctrl + Z / Cmd + Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
            title="Redo (Ctrl + Shift + Z / Cmd + Shift + Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          {hasSelectedLayer && (
            <button
              onClick={onDeleteSelectedLayer}
              className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition ml-1"
              title="Delete Selected Layer (Delete / Backspace)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Playback Controls & Zoom */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-300">
        <button
          onClick={onTogglePlay}
          className={`p-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 px-3 ${
            isPlaying
              ? 'bg-[#ff6b35] text-white shadow-sm shadow-orange-200'
              : 'bg-white text-slate-900 hover:bg-slate-50 border border-slate-300'
          }`}
          title={isPlaying ? 'Pause Animation' : 'Play Animation'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span className="text-xs font-mono">{isPlaying ? 'PAUSE' : 'PLAY'}</span>
        </button>

        <button
          onClick={onResetFrame}
          className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-white transition"
          title="Reset Frame"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-300 mx-1" />

        {/* Zoom Controls */}
        <button
          onClick={() => onZoomChange(Math.max(0.4, Number((zoom - 0.1).toFixed(1))))}
          className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-white transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono text-slate-900 font-bold w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => onZoomChange(Math.min(2.0, Number((zoom + 0.1).toFixed(1))))}
          className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-white transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => onZoomChange(1.0)}
          className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-white transition"
          title="Reset Zoom"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Action Buttons: AI, File, Export, Settings */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleAISidebar}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition border ${
            isAISidebarOpen
              ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-sm'
              : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>AI CHAT</span>
        </button>

        <button
          onClick={onLoadJSON}
          className="p-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition border border-slate-300 bg-white"
          title="Open JSON Project File"
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        <button
          onClick={onSaveJSON}
          className="p-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition border border-slate-300 bg-white"
          title="Save JSON Project File"
        >
          <Save className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition border border-slate-300 bg-white"
          title="AI Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono font-semibold transition shadow-sm hover:shadow"
        >
          <Download className="w-3.5 h-3.5 text-[#ff6b35]" />
          <span>EXPORT</span>
        </button>
      </div>
    </header>
  );
};
