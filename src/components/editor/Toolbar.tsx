'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
  Menu,
  X,
  Layers,
  Sliders,
  Gauge,
  ChevronDown,
  Check,
} from 'lucide-react';

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

interface ToolbarProps {
  projectName: string;
  saveState?: 'saved' | 'saving';
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetFrame: () => void;
  speed?: number;
  onSpeedChange?: (speed: number) => void;
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
  activeMobileTab?: 'canvas' | 'templates' | 'properties';
  onSelectMobileTab?: (tab: 'canvas' | 'templates' | 'properties') => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  projectName,
  saveState = 'saved',
  isPlaying,
  onTogglePlay,
  onResetFrame,
  speed = 1,
  onSpeedChange,
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
  activeMobileTab = 'canvas',
  onSelectMobileTab,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSpeedOpen, setIsSpeedOpen] = useState(false);
  const speedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSpeedOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (speedRef.current && !speedRef.current.contains(e.target as Node)) {
        setIsSpeedOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isSpeedOpen]);

  return (
    <>
      <header className="h-14 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between z-20 shrink-0 w-full relative">
        {/* Brand & Project Name */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/"
            className="flex items-center gap-1.5 sm:gap-2 pr-1.5 sm:pr-3 border-r border-slate-200 hover:opacity-80 transition cursor-pointer"
            title="Back to Landing Page"
          >
            <div className="w-8 h-8 rounded-xl bg-[#ff6b35] text-white flex items-center justify-center font-mono font-bold text-xs sm:text-sm shadow-sm shadow-orange-200 shrink-0">
              MT
            </div>
            <span className="font-mono font-bold tracking-tight text-slate-900 hidden sm:inline">
              motion-track
            </span>
          </Link>

          <input
            type="text"
            value={projectName}
            placeholder="Project Name..."
            aria-label="Project name"
            onChange={(e) => onProjectNameChange(e.target.value)}
            className="font-mono text-xs sm:text-sm px-2.5 py-1.5 rounded-lg border border-slate-300 hover:border-slate-400 focus:border-[#ff6b35] focus:outline-none bg-slate-50 transition w-32 xs:w-40 sm:w-48 md:w-56 text-slate-900 font-bold placeholder:text-slate-500"
          />
          <span
            className={`hidden xl:inline-flex items-center gap-1 font-mono text-[10px] font-semibold ${
              saveState === 'saving' ? 'text-amber-600' : 'text-emerald-600'
            }`}
            title={saveState === 'saving' ? 'Saving draft…' : 'Draft saved to this browser'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${saveState === 'saving' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            {saveState === 'saving' ? 'Saving' : 'Saved'}
          </span>

          {/* Undo / Redo & Delete Buttons (Visible on Desktop, moved to Hamburger on Mobile) */}
          <div className="hidden sm:flex items-center gap-0.5 sm:gap-1 pl-1 sm:pl-2 border-l border-slate-200">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo"
              className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Undo (Ctrl + Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo"
              className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Redo (Ctrl + Shift + Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            {hasSelectedLayer && (
              <button
                onClick={onDeleteSelectedLayer}
                aria-label="Delete selected layer"
                className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition"
                title="Delete Selected Layer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Playback Controls & Zoom (Desktop) */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-300 shrink-0">
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
            aria-pressed={isPlaying}
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
            aria-label="Jump to first frame"
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-white transition"
            title="Reset Frame"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed Selector (Desktop) */}
          <div className="relative" ref={speedRef}>
            <button
              type="button"
              onClick={() => setIsSpeedOpen((prev) => !prev)}
              aria-label="Playback speed"
              title="Playback speed multiplier"
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-xs font-semibold transition ${
                speed !== 1
                  ? 'border-[#ff6b35] bg-orange-50 text-[#ff6b35]'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Gauge className="w-3.5 h-3.5 text-slate-500" />
              <span>{speed}x</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {isSpeedOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-32 rounded-xl border border-slate-200 bg-white py-1 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Speed
                </div>
                {SPEED_OPTIONS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      onSpeedChange?.(val);
                      setIsSpeedOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-2.5 py-1 text-xs font-mono transition hover:bg-orange-50 ${
                      speed === val
                        ? 'font-bold text-[#ff6b35] bg-orange-50/60'
                        : 'text-slate-700'
                    }`}
                  >
                    <span>{val}x</span>
                    {speed === val && <Check className="h-3.5 w-3.5 text-[#ff6b35]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-slate-300 mx-1" />

          {/* Zoom Controls */}
          <button
            onClick={() => onZoomChange(Math.max(0.4, Number((zoom - 0.1).toFixed(1))))}
            aria-label="Zoom out"
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
            aria-label="Zoom in"
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-white transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => onZoomChange(1.0)}
            aria-label="Reset zoom"
            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-white transition"
            title="Reset Zoom"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action Buttons: Desktop & Mobile Hamburger Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Desktop AI, File, Settings, Export */}
          <button
            onClick={onToggleAISidebar}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition border ${
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
            aria-label="Open project JSON"
            className="p-1.5 sm:p-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition border border-slate-300 bg-white hidden lg:block"
            title="Open JSON Project File"
          >
            <FolderOpen className="w-4 h-4" />
          </button>

          <button
            onClick={onSaveJSON}
            aria-label="Save project JSON"
            className="p-1.5 sm:p-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition border border-slate-300 bg-white hidden lg:block"
            title="Save JSON Project File"
          >
            <Save className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSettings}
            aria-label="Open AI settings"
            className="p-1.5 sm:p-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition border border-slate-300 bg-white hidden sm:block"
            title="AI Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenExport}
            className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono font-semibold transition shadow-sm hover:shadow"
          >
            <Download className="w-3.5 h-3.5 text-[#ff6b35]" />
            <span>EXPORT</span>
          </button>

          {/* Mobile Hamburger Button (Screens < lg) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl text-slate-800 hover:bg-slate-100 border border-slate-300 bg-white lg:hidden transition"
            title="Toggle Menu"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Hamburger Dropdown Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed top-14 left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-slate-200 z-50 p-4 shadow-xl flex flex-col gap-3 font-mono text-xs">
          {/* Section: Quick Actions (Undo, Redo, Delete) on Mobile */}
          <div className="sm:hidden flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-700">Quick Actions:</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  onUndo?.();
                  setIsMobileMenuOpen(false);
                }}
                disabled={!canUndo}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 disabled:opacity-30 font-semibold flex items-center gap-1 text-[11px]"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
              <button
                onClick={() => {
                  onRedo?.();
                  setIsMobileMenuOpen(false);
                }}
                disabled={!canRedo}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 disabled:opacity-30 font-semibold flex items-center gap-1 text-[11px]"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span>Redo</span>
              </button>
              {hasSelectedLayer && (
                <button
                  onClick={() => {
                    onDeleteSelectedLayer?.();
                    setIsMobileMenuOpen(false);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 font-bold flex items-center gap-1 text-[11px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>

          {/* Section: Playback Speed on Mobile */}
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
              Animation Speed:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SPEED_OPTIONS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onSpeedChange?.(val)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition border ${
                    speed === val
                      ? 'bg-[#ff6b35] border-[#ff6b35] text-white font-bold shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  {val}x
                </button>
              ))}
            </div>
          </div>

          {/* Section: Panels Switcher */}
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
              Switch Studio View:
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => {
                  onSelectMobileTab?.('templates');
                  setIsMobileMenuOpen(false);
                }}
                className={`py-2 px-2 rounded-xl border text-center transition flex items-center justify-center gap-1.5 ${
                  activeMobileTab === 'templates'
                    ? 'bg-orange-50 border-[#ff6b35] text-orange-950 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-[#ff6b35]" />
                <span>Shapes</span>
              </button>

              <button
                onClick={() => {
                  onSelectMobileTab?.('canvas');
                  setIsMobileMenuOpen(false);
                }}
                className={`py-2 px-2 rounded-xl border text-center transition flex items-center justify-center gap-1.5 ${
                  activeMobileTab === 'canvas'
                    ? 'bg-orange-50 border-[#ff6b35] text-orange-950 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Canvas</span>
              </button>

              <button
                onClick={() => {
                  onSelectMobileTab?.('properties');
                  setIsMobileMenuOpen(false);
                }}
                className={`py-2 px-2 rounded-xl border text-center transition flex items-center justify-center gap-1.5 ${
                  activeMobileTab === 'properties'
                    ? 'bg-orange-50 border-[#ff6b35] text-orange-950 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-slate-600" />
                <span>Props</span>
              </button>
            </div>
          </div>

          {/* Section: Actions & Settings */}
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <button
              onClick={() => {
                onToggleAISidebar();
                setIsMobileMenuOpen(false);
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 font-semibold flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Open AI Chat Assistant</span>
              </div>
              <span className="text-[10px] bg-blue-200/60 px-2 py-0.5 rounded-full font-bold">AI</span>
            </button>

            <button
              onClick={() => {
                onOpenExport();
                setIsMobileMenuOpen(false);
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-950 font-bold flex items-center justify-between sm:hidden"
            >
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-[#ff6b35]" />
                <span>Export Animated Video (MP4/MOV/GIF)</span>
              </div>
            </button>

            <button
              onClick={() => {
                onOpenSettings();
                setIsMobileMenuOpen(false);
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold flex items-center gap-2"
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span>AI API Connection Settings</span>
            </button>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  onLoadJSON();
                  setIsMobileMenuOpen(false);
                }}
                className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold flex items-center justify-center gap-1.5"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Load JSON</span>
              </button>
              <button
                onClick={() => {
                  onSaveJSON();
                  setIsMobileMenuOpen(false);
                }}
                className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Save JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
