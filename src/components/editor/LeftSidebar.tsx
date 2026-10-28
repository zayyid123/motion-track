'use client';

import React from 'react';
import {
  Layers,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  ChevronUp,
  ChevronDown,
  Compass,
} from 'lucide-react';
import { StickerProject, StickerLayer, ViewDirection, ShapeType } from '@/types/sticker';
import { SAMPLE_PROJECTS } from '@/data/sampleStickers';
import { resolveColor } from '@/lib/renderer';

interface LeftSidebarProps {
  project: StickerProject;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onAddLayer: (shape: ShapeType) => void;
  onUpdateLayer: (id: string, updates: Partial<StickerLayer>) => void;
  onDeleteLayer: (id: string) => void;
  onReorderLayer: (id: string, direction: 'up' | 'down') => void;
  onFacingChange: (facing: ViewDirection) => void;
  onLoadPreset: (key: string) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  project,
  selectedLayerId,
  onSelectLayer,
  onAddLayer,
  onUpdateLayer,
  onDeleteLayer,
  onReorderLayer,
  onFacingChange,
  onLoadPreset,
}) => {
  return (
    <aside className="w-72 border-r border-slate-200/80 bg-white/95 backdrop-blur-md flex flex-col h-[calc(100vh-3.5rem)] select-none">
      {/* Templates / Presets */}
      <div className="p-3.5 border-b border-slate-200">
        <label className="text-[11px] font-mono uppercase tracking-wider text-slate-700 font-bold mb-2 block">
          Preset Templates
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(SAMPLE_PROJECTS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => onLoadPreset(key)}
              className="text-left px-2.5 py-1.5 rounded-xl border border-slate-300 hover:border-[#ff6b35] hover:bg-orange-50/50 transition group bg-white shadow-2xs"
            >
              <div className="font-mono text-xs font-bold text-slate-900 group-hover:text-[#ff6b35] truncate">
                {p.name}
              </div>
              <div className="text-[10px] text-slate-600 font-mono font-medium">
                {p.layers.length} layers • {p.facing}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Facing / Isometric Perspective */}
      <div className="p-3.5 border-b border-slate-200">
        <div className="flex items-center gap-1.5 mb-2">
          <Compass className="w-3.5 h-3.5 text-slate-700" />
          <label className="text-[11px] font-mono uppercase tracking-wider text-slate-700 font-bold">
            Facing Direction
          </label>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {(['right', 'left', 'front', 'flat'] as ViewDirection[]).map((facing) => (
            <button
              key={facing}
              onClick={() => onFacingChange(facing)}
              className={`py-1.5 px-2 rounded-lg text-xs font-mono font-semibold transition capitalize text-center ${
                project.facing === facing
                  ? 'bg-[#ff6b35] text-white shadow-sm shadow-orange-200 font-bold'
                  : 'bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              {facing}
            </button>
          ))}
        </div>
      </div>

      {/* Add Shapes Quick Bar */}
      <div className="p-3.5 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-mono uppercase tracking-wider text-slate-700 font-bold">
            Add Slab Shape
          </label>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onAddLayer('slab-rect')}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-mono font-semibold bg-slate-50 hover:bg-orange-50 hover:border-orange-300 border border-slate-300 text-slate-800 transition"
          >
            <Plus className="w-3.5 h-3.5 text-[#ff6b35]" /> Rect
          </button>
          <button
            onClick={() => onAddLayer('slab-circle')}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-mono font-semibold bg-slate-50 hover:bg-orange-50 hover:border-orange-300 border border-slate-300 text-slate-800 transition"
          >
            <Plus className="w-3.5 h-3.5 text-[#ff6b35]" /> Circle
          </button>
          <button
            onClick={() => onAddLayer('spark')}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-mono font-semibold bg-slate-50 hover:bg-orange-50 hover:border-orange-300 border border-slate-300 text-slate-800 transition"
          >
            <Plus className="w-3.5 h-3.5 text-[#ff6b35]" /> Spark
          </button>
        </div>
      </div>

      {/* Layers List */}
      <div className="flex-1 overflow-y-auto p-3.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-700" />
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-700 font-bold">
              Layers ({project.layers.length})
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          {project.layers
            .slice()
            .reverse()
            .map((layer, revIdx) => {
              const actualIndex = project.layers.length - 1 - revIdx;
              const isSelected = selectedLayerId === layer.id;

              return (
                <div
                  key={layer.id}
                  onClick={() => onSelectLayer(layer.id)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-mono transition border cursor-pointer ${
                    isSelected
                      ? 'bg-orange-50 border-[#ff6b35] text-slate-900 shadow-sm'
                      : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full border border-slate-400 shrink-0" style={{
                      backgroundColor: layer.customHex || resolveColor(layer.fillRole, project),
                    }} />
                    <span className="truncate font-semibold text-slate-900">{layer.name}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onUpdateLayer(layer.id, { visible: !layer.visible })}
                      className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100"
                      title={layer.visible ? 'Hide' : 'Show'}
                    >
                      {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                    <button
                      onClick={() => onUpdateLayer(layer.id, { locked: !layer.locked })}
                      className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100"
                      title={layer.locked ? 'Unlock' : 'Lock'}
                    >
                      {layer.locked ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      disabled={actualIndex >= project.layers.length - 1}
                      onClick={() => onReorderLayer(layer.id, 'up')}
                      className="p-0.5 text-slate-600 hover:text-slate-900 disabled:opacity-30"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={actualIndex <= 0}
                      onClick={() => onReorderLayer(layer.id, 'down')}
                      className="p-0.5 text-slate-600 hover:text-slate-900 disabled:opacity-30"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteLayer(layer.id)}
                      className="p-1 text-slate-500 hover:text-red-600 rounded hover:bg-red-50"
                      title="Delete layer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </aside>
  );
};
