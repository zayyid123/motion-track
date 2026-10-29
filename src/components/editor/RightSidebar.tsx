'use client';

import React from 'react';
import { Palette as PaletteIcon, Activity, Box, Sliders } from 'lucide-react';
import { Palette, PALETTES, ACCENTS, Swatch, Layer } from '@/lib/funIsometric';
import { MOTION_PRESETS } from '@/lib/funIsometric/presets';

interface RightSidebarProps {
  layers: ReadonlyArray<Layer>;
  palette: Palette;
  paletteId: string;
  selectedLayer: Layer | null;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onUpdateLayerShapeFill: (id: string, role: Swatch) => void;
  onUpdateLayerShapeDepth: (id: string, depth: number) => void;
  onCreateGroup: () => void;
  onSetLayerGroup: (layerId: string, groupId: string | undefined) => void;
  onApplyMotionToLayer: (id: string, motionPreset: string) => void;
  onPaletteChange: (palKey: keyof typeof PALETTES) => void;
  onUpdatePaletteColor: (role: keyof Palette, hex: string) => void;
  outlineWidth: number;
  onUpdateOutlineWidth: (w: number) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  layers,
  palette,
  paletteId,
  selectedLayer,
  onUpdateLayer,
  onUpdateLayerShapeFill,
  onUpdateLayerShapeDepth,
  onCreateGroup,
  onSetLayerGroup,
  onApplyMotionToLayer,
  onPaletteChange,
  onUpdatePaletteColor,
  outlineWidth,
  onUpdateOutlineWidth,
}) => {
  const currentPos = Array.isArray(selectedLayer?.p) && typeof selectedLayer?.p[0] === 'number'
    ? (selectedLayer.p as unknown as readonly [number, number])
    : [250, 250];

  const currentLayerMotion = selectedLayer?.motionPreset || (selectedLayer?.m ? 'custom' : 'none');

  return (
    <aside className="w-full lg:w-80 border-l border-slate-200/80 bg-white/95 backdrop-blur-md flex flex-col h-full overflow-y-auto select-none">
      {/* Motion Engine Section - PER LAYER */}
      <div className="p-4 border-b border-slate-200/70">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-[#ff6b35]" />
            <h3 className="font-mono text-xs uppercase tracking-wider font-bold text-slate-800">
              Layer Motion Preset
            </h3>
          </div>
          {selectedLayer && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-100 text-[#ff6b35] font-semibold">
              {currentLayerMotion === 'none' ? 'no motion' : currentLayerMotion === 'custom' ? 'custom track' : currentLayerMotion}
            </span>
          )}
        </div>

        {selectedLayer ? (
          <>
            <p className="text-[10px] text-slate-500 font-mono mb-2">
              Active motion for: <strong className="text-slate-800">{selectedLayer.name || selectedLayer.id}</strong>
            </p>
            <div className="grid grid-cols-2 gap-1.5 mb-3 max-h-48 overflow-y-auto p-0.5">
              {MOTION_PRESETS.map((m) => {
                const isSelected = currentLayerMotion === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onApplyMotionToLayer(selectedLayer.id!, m.id)}
                    className={`px-2 py-1.5 rounded-xl border text-left text-xs font-mono transition ${
                      isSelected
                        ? 'bg-orange-50 border-[#ff6b35] text-slate-900 font-bold shadow-xs ring-1 ring-[#ff6b35]'
                        : 'border-slate-200 hover:border-orange-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="truncate">{m.label}</div>
                    <div className="text-[9px] text-slate-400 font-normal truncate">{m.description}</div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-4 text-slate-400 font-mono text-xs">
            Select a layer on canvas to configure its motion preset.
          </div>
        )}

        <div className="pt-2 border-t border-slate-100">
          <div className="flex justify-between text-[11px] font-mono text-slate-500 mb-1">
            <span>DEFAULT INK OUTLINE</span>
            <span className="font-semibold text-slate-800">{outlineWidth}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="20"
            value={outlineWidth}
            onChange={(e) => onUpdateOutlineWidth(parseInt(e.target.value) || 0)}
            className="w-full accent-[#ff6b35] h-1.5 bg-slate-100 rounded-lg cursor-pointer"
          />
          <p className="mt-1 text-[10px] text-slate-400 font-mono leading-tight">
            Fallback width for layers that do not set their own outline. Override it per layer below.
          </p>
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

        <div className="flex flex-wrap gap-1.5 mb-3">
          {(Object.keys(PALETTES) as Array<keyof typeof PALETTES>).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={paletteId === key}
              onClick={() => onPaletteChange(key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition border capitalize ${
                paletteId === key
                  ? 'bg-[#ff6b35] border-[#ff6b35] text-white font-bold shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
              }`}
            >
              {key}
            </button>
          ))}
          {paletteId === 'custom' ? (
            <span className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-mono font-bold text-orange-700">
              custom
            </span>
          ) : null}
        </div>

        {/* Swatches */}
        <div className="grid grid-cols-4 gap-2">
          {ACCENTS.map((role) => {
            const hex = palette[role];
            return (
              <div key={role} className="flex flex-col items-center gap-1">
                <label
                  className="w-8 h-8 rounded-xl border border-slate-300 shadow-sm cursor-pointer relative overflow-hidden flex items-center justify-center transition hover:scale-105"
                  style={{ backgroundColor: hex }}
                  title={`${role}: ${hex}`}
                >
                  <input
                    type="color"
                    value={hex}
                    onChange={(e) => onUpdatePaletteColor(role, e.target.value)}
                    className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                  />
                </label>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tight">
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

        {selectedLayer && selectedLayer.id ? (
          <div className="space-y-3 font-mono text-xs">
            <div>
              <label className="text-[11px] text-slate-700 font-bold block mb-1">Layer Name / ID</label>
              <input
                type="text"
                value={selectedLayer.name || selectedLayer.id}
                placeholder="Contoh: Padlock Body"
                onChange={(e) =>
                  onUpdateLayer(selectedLayer.id!, { name: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-white text-slate-950 font-bold placeholder:text-slate-500 shadow-xs"
              />
            </div>

            {/* Position X / Y */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-700 font-bold block mb-1">Position X</label>
                <input
                  type="number"
                  value={currentPos[0]}
                  placeholder="250"
                  onChange={(e) =>
                    onUpdateLayer(selectedLayer.id!, {
                      p: [parseInt(e.target.value) || 0, currentPos[1]],
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-white text-slate-950 font-bold placeholder:text-slate-500 shadow-xs"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-700 font-bold block mb-1">Position Y</label>
                <input
                  type="number"
                  value={currentPos[1]}
                  placeholder="250"
                  onChange={(e) =>
                    onUpdateLayer(selectedLayer.id!, {
                      p: [currentPos[0], parseInt(e.target.value) || 0],
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-white text-slate-950 font-bold placeholder:text-slate-500 shadow-xs"
                />
              </div>
            </div>

            {/* Rotation Angle */}
            <div>
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>ROTATION ANGLE</span>
                <span className="font-semibold text-slate-800">
                  {typeof selectedLayer.r === 'number' ? selectedLayer.r : 0}°
                </span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                value={typeof selectedLayer.r === 'number' ? selectedLayer.r : 0}
                onChange={(e) =>
                  onUpdateLayer(selectedLayer.id!, {
                    r: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full accent-[#ff6b35] h-1.5 bg-slate-100 rounded-lg cursor-pointer"
              />
            </div>

            {/* Scale / Resize */}
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>SCALE WIDTH (X)</span>
                  <span className="font-semibold text-slate-800">
                    {Array.isArray(selectedLayer.s) && typeof selectedLayer.s[0] === 'number'
                      ? `${selectedLayer.s[0]}%`
                      : '100%'}
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="300"
                  value={
                    Array.isArray(selectedLayer.s) && typeof selectedLayer.s[0] === 'number'
                      ? selectedLayer.s[0]
                      : 100
                  }
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 100;
                    const curY = Array.isArray(selectedLayer.s) && typeof selectedLayer.s[1] === 'number'
                      ? selectedLayer.s[1]
                      : 100;
                    onUpdateLayer(selectedLayer.id!, {
                      s: [val, curY],
                    });
                  }}
                  className="w-full accent-[#ff6b35] h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>SCALE HEIGHT (Y)</span>
                  <span className="font-semibold text-slate-800">
                    {Array.isArray(selectedLayer.s) && typeof selectedLayer.s[1] === 'number'
                      ? `${selectedLayer.s[1]}%`
                      : '100%'}
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="300"
                  value={
                    Array.isArray(selectedLayer.s) && typeof selectedLayer.s[1] === 'number'
                      ? selectedLayer.s[1]
                      : 100
                  }
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 100;
                    const curX = Array.isArray(selectedLayer.s) && typeof selectedLayer.s[0] === 'number'
                      ? selectedLayer.s[0]
                      : 100;
                    onUpdateLayer(selectedLayer.id!, {
                      s: [curX, val],
                    });
                  }}
                  className="w-full accent-[#ff6b35] h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Grouping Section (Empty Container Parent with Children) */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-slate-800 font-bold block">
                  Group Parent
                </label>
                <button
                  onClick={onCreateGroup}
                  className="px-2 py-1 rounded-lg bg-orange-100 hover:bg-orange-200 text-[#ff6b35] font-bold text-[10px] transition"
                  title="Create a new empty group container"
                >
                  + Create Group
                </button>
              </div>

              {selectedLayer.isGroup ? (
                <div className="bg-orange-50 p-2.5 rounded-xl border border-orange-200 text-xs space-y-1">
                  <div className="font-bold text-orange-950 flex items-center gap-1.5">
                    <span>📁 Group Container (Empty Parent)</span>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-tight">
                    This container holds no visual shapes itself, but drives motion keyframes for all child layers assigned inside it.
                  </p>
                  <div className="pt-1 text-[11px] font-semibold text-orange-800">
                    Children: {layers.filter((l) => l.groupId === selectedLayer.id).length} layers
                  </div>
                </div>
              ) : selectedLayer.groupId ? (
                <div className="space-y-2 bg-orange-50/70 p-2.5 rounded-xl border border-orange-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-orange-950 truncate">
                      Group: {layers.find((g) => g.id === selectedLayer.groupId)?.name || selectedLayer.groupId}
                    </span>
                    <button
                      onClick={() => onSetLayerGroup(selectedLayer.id!, undefined)}
                      className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-700 hover:bg-red-200 font-bold shrink-0 ml-1"
                      title="Remove this layer from group"
                    >
                      Leave Group
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 block leading-tight">
                    ↳ Layer is inside a group and automatically inherits the group container&apos;s motion.
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <select
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-[#ff6b35] focus:outline-none bg-slate-50 text-slate-800 text-xs"
                    onChange={(e) => {
                      if (e.target.value) {
                        onSetLayerGroup(selectedLayer.id!, e.target.value);
                      }
                    }}
                    value=""
                  >
                    <option value="" disabled>Select Group to Join...</option>
                    {layers.filter((l) => l.isGroup).map((g) => (
                      <option key={g.id} value={g.id}>
                        📁 Join: {g.name || g.id}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 block leading-tight">
                    {layers.some((l) => l.isGroup)
                      ? 'Select group above or click "+ Create Group" to create a new container.'
                      : 'No group available yet. Click "+ Create Group" to create one.'}
                  </span>
                </div>
              )}
            </div>

            {/* Per-Layer Ink Outline Width */}
            <div>
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>INK OUTLINE WIDTH</span>
                <span className="font-semibold text-slate-800">
                  {typeof selectedLayer.line === 'number' ? `${selectedLayer.line}px` : `${outlineWidth}px · default`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                value={typeof selectedLayer.line === 'number' ? selectedLayer.line : outlineWidth}
                onChange={(e) => onUpdateLayer(selectedLayer.id!, { line: parseInt(e.target.value) || 0 })}
                className="w-full accent-[#ff6b35] h-1.5 bg-slate-100 rounded-lg cursor-pointer"
              />
              <button
                type="button"
                onClick={() => onUpdateLayer(selectedLayer.id!, { line: undefined })}
                disabled={typeof selectedLayer.line !== 'number'}
                className="mt-1 text-[10px] font-mono text-slate-500 hover:text-[#ff6b35] disabled:text-slate-300 disabled:cursor-not-allowed transition"
              >
                ↺ Use project default
              </button>
            </div>

            {/* Slab Depth Slider */}
            <div>
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>SLAB DEPTH</span>
                <span className="font-semibold text-slate-800">
                  {selectedLayer.shapes[0]?.depth ?? 1}x
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={selectedLayer.shapes[0]?.depth ?? 1}
                onChange={(e) =>
                  onUpdateLayerShapeDepth(
                    selectedLayer.id!,
                    parseFloat(e.target.value) || 0
                  )
                }
                className="w-full accent-[#ff6b35] h-1.5 bg-slate-100 rounded-lg cursor-pointer"
              />
            </div>

            {/* Fill Role Mapping */}
            <div>
              <label className="text-[11px] text-slate-700 font-bold block mb-1">Color Role Slot</label>
              <select
                value={selectedLayer.shapes[0]?.fill || 'main'}
                onChange={(e) =>
                  onUpdateLayerShapeFill(selectedLayer.id!, e.target.value as Swatch)
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-white text-slate-950 font-bold capitalize shadow-xs"
              >
                {['main', 'gold', 'tint', 'ok', 'hot', 'deep', 'white', 'grey', 'paper', 'ink'].map(
                  (role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 font-mono text-xs">
            <Sliders className="w-6 h-6 mx-auto mb-2 text-slate-300" />
            Click any component on canvas or track in timeline to edit its properties.
          </div>
        )}
      </div>
    </aside>
  );
};
