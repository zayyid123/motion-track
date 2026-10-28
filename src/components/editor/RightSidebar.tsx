'use client';

import React from 'react';
import { Palette as PaletteIcon, Activity, Sliders, Box, Paintbrush } from 'lucide-react';
import {
  StickerProject,
  StickerLayer,
  MotionPresetType,
  RoleColorKey,
} from '@/types/sticker';
import { PALETTES } from '@/types/palettes';
import { resolveColor } from '@/lib/renderer';

interface RightSidebarProps {
  project: StickerProject;
  selectedLayer: StickerLayer | null;
  onUpdateLayer: (id: string, updates: Partial<StickerLayer>) => void;
  onUpdateProjectMotion: (motion: StickerProject['motion']) => void;
  onPaletteChange: (paletteId: string) => void;
  onUpdateRoleColor: (role: RoleColorKey, hex: string) => void;
}

const MOTION_PRESETS: { id: MotionPresetType; name: string; desc: string }[] = [
  { id: 'wiggle', name: 'Wiggle', desc: 'Scribble / quick rocking' },
  { id: 'hop', name: 'Hop', desc: 'Snappy jump with settle' },
  { id: 'bounce', name: 'Bounce', desc: 'Springy rebound' },
  { id: 'drift', name: 'Drift', desc: 'Lazy banking figure-8' },
  { id: 'twist', name: 'Twist', desc: 'Sharp twist & hold' },
  { id: 'float', name: 'Float', desc: 'Gentle airy hover' },
  { id: 'twinkle', name: 'Twinkle', desc: 'Pulsing sparkle pop' },
];

const COLOR_ROLES: { role: RoleColorKey; label: string }[] = [
  { role: 'main', label: 'Main (Body)' },
  { role: 'gold', label: 'Gold (Accent)' },
  { role: 'tint', label: 'Tint (Soft fill)' },
  { role: 'ok', label: 'Ok (Green)' },
  { role: 'hot', label: 'Hot (Pink/Pop)' },
  { role: 'deep', label: 'Deep (Side slab)' },
  { role: 'paper', label: 'Paper (White)' },
  { role: 'ink', label: 'Ink (Outline)' },
];

export const RightSidebar: React.FC<RightSidebarProps> = ({
  project,
  selectedLayer,
  onUpdateLayer,
  onUpdateProjectMotion,
  onPaletteChange,
  onUpdateRoleColor,
}) => {
  const currentPalette = PALETTES[project.paletteId] || PALETTES.riso;

  const currentFillHex = selectedLayer
    ? selectedLayer.customHex || resolveColor(selectedLayer.fillRole, project)
    : '#ff6b35';
  const currentSideHex = selectedLayer
    ? selectedLayer.customSideHex ||
      resolveColor(selectedLayer.sideColorRole || 'deep', project)
    : '#1e3a8a';
  const currentOutlineHex = selectedLayer
    ? selectedLayer.customOutlineHex ||
      resolveColor(selectedLayer.outlineRole || 'ink', project, '#111827')
    : '#111827';

  return (
    <aside className="w-80 border-l border-slate-200/80 bg-white/95 backdrop-blur-md flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto select-none">
      {/* Motion Engine Section */}
      <div className="p-4 border-b border-slate-200/70">
        <div className="flex items-center gap-1.5 mb-3">
          <Activity className="w-4 h-4 text-[#ff6b35]" />
          <h3 className="font-mono text-xs uppercase tracking-wider font-bold text-slate-800">
            Motion Keyframes
          </h3>
        </div>

        {/* Preset Selector */}
        <div className="space-y-1.5 mb-3">
          <label className="text-[11px] font-mono text-slate-700 block font-bold uppercase">
            Motion Preset
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {MOTION_PRESETS.map((m) => (
              <button
                key={m.id}
                onClick={() =>
                  onUpdateProjectMotion({
                    ...project.motion,
                    preset: m.id,
                  })
                }
                className={`px-2.5 py-1.5 rounded-xl text-left border text-xs font-mono transition ${
                  project.motion.preset === m.id
                    ? 'bg-orange-50 border-[#ff6b35] text-slate-900 font-bold shadow-sm'
                    : 'bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100 font-medium'
                }`}
              >
                <div>{m.name}</div>
                <div className="text-[9px] text-slate-600 truncate font-medium">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Speed & Intensity Sliders */}
        <div className="space-y-2.5 pt-1">
          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-700 mb-1">
              <span className="font-bold">SPEED PACE</span>
              <span className="font-bold text-slate-900">{project.motion.speed}x</span>
            </div>
            <input
              type="range"
              min="0.4"
              max="2.0"
              step="0.1"
              value={project.motion.speed}
              onChange={(e) =>
                onUpdateProjectMotion({
                  ...project.motion,
                  speed: parseFloat(e.target.value),
                })
              }
              className="w-full accent-[#ff6b35] h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-700 mb-1">
              <span className="font-bold">MOTION INTENSITY</span>
              <span className="font-bold text-slate-900">
                {Math.round(project.motion.intensity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.0"
              step="0.1"
              value={project.motion.intensity}
              onChange={(e) =>
                onUpdateProjectMotion({
                  ...project.motion,
                  intensity: parseFloat(e.target.value),
                })
              }
              className="w-full accent-[#ff6b35] h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Role-Based Color Palette Section */}
      <div className="p-4 border-b border-slate-200/70">
        <div className="flex items-center gap-1.5 mb-3">
          <PaletteIcon className="w-4 h-4 text-blue-600" />
          <h3 className="font-mono text-xs uppercase tracking-wider font-bold text-slate-800">
            Role-Based Palette
          </h3>
        </div>

        {/* Palette selector buttons */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.values(PALETTES).map((pal) => (
            <button
              key={pal.id}
              onClick={() => onPaletteChange(pal.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition border ${
                project.paletteId === pal.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
              }`}
            >
              {pal.name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Palette Swatches */}
        <div className="grid grid-cols-4 gap-2">
          {COLOR_ROLES.map(({ role, label }) => {
            const hex =
              (project.customPalette && project.customPalette[role]) ||
              currentPalette.colors[role];

            return (
              <div key={role} className="flex flex-col items-center gap-1">
                <label
                  className="w-8 h-8 rounded-xl border border-slate-300 shadow-sm cursor-pointer relative overflow-hidden flex items-center justify-center transition hover:scale-105"
                  style={{ backgroundColor: hex }}
                  title={`${label}: ${hex}`}
                >
                  <input
                    type="color"
                    value={hex}
                    onChange={(e) => onUpdateRoleColor(role, e.target.value)}
                    className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                  />
                </label>
                <span className="text-[10px] font-mono text-slate-700 font-bold uppercase tracking-tight">
                  {role}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Layer Properties */}
      <div className="p-4 flex-1">
        <div className="flex items-center gap-1.5 mb-3">
          <Box className="w-4 h-4 text-[#ff6b35]" />
          <h3 className="font-mono text-xs uppercase tracking-wider font-bold text-slate-800">
            Selected Layer
          </h3>
        </div>

        {selectedLayer ? (
          <div className="space-y-3 font-mono text-xs">
            <div>
              <label className="text-[11px] text-slate-700 font-bold block mb-1">Layer Name</label>
              <input
                type="text"
                value={selectedLayer.name}
                placeholder="Nama Layer..."
                onChange={(e) =>
                  onUpdateLayer(selectedLayer.id, { name: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-slate-50 text-slate-900 font-semibold placeholder:text-slate-500"
              />
            </div>

            {/* Position X / Y */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-700 font-bold block mb-1">Pos X</label>
                <input
                  type="number"
                  value={selectedLayer.x}
                  onChange={(e) =>
                    onUpdateLayer(selectedLayer.id, { x: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-slate-50 text-slate-900 font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-700 font-bold block mb-1">Pos Y</label>
                <input
                  type="number"
                  value={selectedLayer.y}
                  onChange={(e) =>
                    onUpdateLayer(selectedLayer.id, { y: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-slate-50 text-slate-900 font-semibold"
                />
              </div>
            </div>

            {/* Width / Height */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-700 font-bold block mb-1">Width</label>
                <input
                  type="number"
                  value={selectedLayer.width}
                  onChange={(e) =>
                    onUpdateLayer(selectedLayer.id, {
                      width: Math.max(10, parseInt(e.target.value) || 10),
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-slate-50 text-slate-900 font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-700 font-bold block mb-1">Height</label>
                <input
                  type="number"
                  value={selectedLayer.height}
                  onChange={(e) =>
                    onUpdateLayer(selectedLayer.id, {
                      height: Math.max(10, parseInt(e.target.value) || 10),
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-slate-50 text-slate-900 font-semibold"
                />
              </div>
            </div>

            {/* Slab Depth & Rotation */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-700 font-bold block mb-1">Slab Depth</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={selectedLayer.depth}
                  onChange={(e) =>
                    onUpdateLayer(selectedLayer.id, {
                      depth: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-slate-50 text-slate-900 font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-700 font-bold block mb-1">Rotation (°)</label>
                <input
                  type="number"
                  value={selectedLayer.rotation}
                  onChange={(e) =>
                    onUpdateLayer(selectedLayer.id, {
                      rotation: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-slate-50 text-slate-900 font-semibold"
                />
              </div>
            </div>

            {/* Layer Colors & Styling (Fill, Shadow, Border) */}
            <div className="pt-2.5 border-t border-slate-200 space-y-3">
              <div className="flex items-center gap-1.5">
                <Paintbrush className="w-3.5 h-3.5 text-[#ff6b35]" />
                <span className="text-[11px] font-mono text-slate-800 font-bold uppercase tracking-wider">
                  Warna Layer & Outline
                </span>
              </div>

              {/* 1. Warna Asli (Front Face Fill) */}
              <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-900">1. Warna Asli (Fill)</span>
                  {selectedLayer.customHex && (
                    <button
                      type="button"
                      onClick={() => onUpdateLayer(selectedLayer.id, { customHex: undefined })}
                      className="text-[10px] text-blue-600 hover:text-blue-800 underline font-semibold"
                    >
                      Reset ke Role
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label
                    className="w-8 h-8 rounded-lg border border-slate-300 shadow-xs cursor-pointer relative overflow-hidden shrink-0 flex items-center justify-center transition hover:scale-105"
                    style={{ backgroundColor: currentFillHex }}
                    title="Klik untuk memilih warna kustom"
                  >
                    <input
                      type="color"
                      value={currentFillHex}
                      onChange={(e) =>
                        onUpdateLayer(selectedLayer.id, { customHex: e.target.value })
                      }
                      className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                    />
                  </label>
                  <select
                    value={selectedLayer.customHex ? 'custom' : selectedLayer.fillRole}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        onUpdateLayer(selectedLayer.id, {
                          fillRole: e.target.value as RoleColorKey,
                          customHex: undefined,
                        });
                      }
                    }}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-white text-slate-900 font-semibold text-xs"
                  >
                    {selectedLayer.customHex && (
                      <option value="custom">Kustom ({selectedLayer.customHex})</option>
                    )}
                    {COLOR_ROLES.map((r) => (
                      <option key={r.role} value={r.role}>
                        Role: {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2. Warna Shadow (Sisi Slab 3D) */}
              <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-900">2. Warna Shadow (Sisi Slab)</span>
                  {selectedLayer.customSideHex && (
                    <button
                      type="button"
                      onClick={() => onUpdateLayer(selectedLayer.id, { customSideHex: undefined })}
                      className="text-[10px] text-blue-600 hover:text-blue-800 underline font-semibold"
                    >
                      Reset ke Role
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label
                    className="w-8 h-8 rounded-lg border border-slate-300 shadow-xs cursor-pointer relative overflow-hidden shrink-0 flex items-center justify-center transition hover:scale-105"
                    style={{ backgroundColor: currentSideHex }}
                    title="Klik untuk memilih warna shadow kustom"
                  >
                    <input
                      type="color"
                      value={currentSideHex}
                      onChange={(e) =>
                        onUpdateLayer(selectedLayer.id, { customSideHex: e.target.value })
                      }
                      className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                    />
                  </label>
                  <select
                    value={
                      selectedLayer.customSideHex
                        ? 'custom'
                        : selectedLayer.sideColorRole || 'deep'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        onUpdateLayer(selectedLayer.id, {
                          sideColorRole: e.target.value as RoleColorKey,
                          customSideHex: undefined,
                        });
                      }
                    }}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-white text-slate-900 font-semibold text-xs"
                  >
                    {selectedLayer.customSideHex && (
                      <option value="custom">Kustom ({selectedLayer.customSideHex})</option>
                    )}
                    {COLOR_ROLES.map((r) => (
                      <option key={r.role} value={r.role}>
                        Role: {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Warna Border & Tebal Outline */}
              <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-900">3. Warna Border (Garis Tepi)</span>
                  {selectedLayer.customOutlineHex && (
                    <button
                      type="button"
                      onClick={() => onUpdateLayer(selectedLayer.id, { customOutlineHex: undefined })}
                      className="text-[10px] text-blue-600 hover:text-blue-800 underline font-semibold"
                    >
                      Reset ke Role
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label
                    className="w-8 h-8 rounded-lg border border-slate-300 shadow-xs cursor-pointer relative overflow-hidden shrink-0 flex items-center justify-center transition hover:scale-105"
                    style={{ backgroundColor: currentOutlineHex }}
                    title="Klik untuk memilih warna border kustom"
                  >
                    <input
                      type="color"
                      value={currentOutlineHex}
                      onChange={(e) =>
                        onUpdateLayer(selectedLayer.id, { customOutlineHex: e.target.value })
                      }
                      className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                    />
                  </label>
                  <select
                    value={
                      selectedLayer.customOutlineHex
                        ? 'custom'
                        : selectedLayer.outlineRole || 'ink'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        onUpdateLayer(selectedLayer.id, {
                          outlineRole: e.target.value as RoleColorKey,
                          customOutlineHex: undefined,
                        });
                      }
                    }}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-white text-slate-900 font-semibold text-xs"
                  >
                    {selectedLayer.customOutlineHex && (
                      <option value="custom">Kustom ({selectedLayer.customOutlineHex})</option>
                    )}
                    {COLOR_ROLES.map((r) => (
                      <option key={r.role} value={r.role}>
                        Role: {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tebal Border Slider */}
                <div className="pt-1.5 border-t border-slate-200">
                  <div className="flex justify-between text-[11px] font-mono text-slate-700 mb-1">
                    <span className="font-bold">TEBAL BORDER</span>
                    <span className="font-bold text-slate-900">{selectedLayer.outlineWidth ?? 5} px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="14"
                    step="1"
                    value={selectedLayer.outlineWidth ?? 5}
                    onChange={(e) =>
                      onUpdateLayer(selectedLayer.id, {
                        outlineWidth: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full accent-[#ff6b35] h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-600 font-mono text-xs font-medium">
            <Sliders className="w-7 h-7 mx-auto mb-2.5 text-slate-400" />
            Pilih layer di panel kiri atau kanvas untuk mengedit properti slab.
          </div>
        )}
      </div>
    </aside>
  );
};
