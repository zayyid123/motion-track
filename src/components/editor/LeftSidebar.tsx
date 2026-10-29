'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Compass,
} from 'lucide-react';
import { Icon, PALETTES, VIEWS, View, at, render, scene } from '@/lib/funIsometric';
import type { Anim, Vec } from '@/lib/funIsometric';
import { blankProject } from '@/lib/funIsometric/icons';
import { TEMPLATE_ICONS } from '@/lib/funIsometric/library';
import { SHAPE_CATEGORIES, SHAPES, shapePreviewIcon } from '@/lib/funIsometric/shapes';
import type { ShapeCategory, ShapeDef } from '@/lib/funIsometric/shapes';

interface LeftSidebarProps {
  icon: Icon;
  onSelectTemplate: (t: Icon) => void;
  onUpdateFacing: (facing: View) => void;
  currentFacing: View;
  onAddShape: (shapeId: string) => void;
  /** Active palette id, so shape swatches match the canvas colours. */
  paletteId: string;
}

const prettyName = (slug: string) =>
  slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const TEMPLATES = [
  { name: '+ Blank Page', icon: blankProject, desc: 'clean canvas' },
  ...TEMPLATE_ICONS.map((t) => ({ name: prettyName(t.name), icon: t, desc: 'sticker' })),
];

/**
 * Renders a shape swatch through the same pipeline the canvas uses, so the
 * preview shows the real isometric tilt, slab side and ink outline instead of a
 * flat silhouette.
 */
const ShapePreview: React.FC<{
  def: ShapeDef;
  facing: View;
  paletteId: string;
  extrude: Anim<Vec>;
  line: number;
}> = ({ def, facing, paletteId, extrude, line }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const size = 56;
    const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const preview = shapePreviewIcon(def, VIEWS[facing].tilt, at(extrude, 0));
    const withLine = { ...preview, line: Math.min(line, 3) };
    const palette = PALETTES[paletteId as keyof typeof PALETTES] ?? PALETTES.slush;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // Fit the shape's content box (centre ~250,264 in the 500-unit stage) into
    // the swatch with a small margin, so every swatch reads at a similar size.
    const fit = 0.32;
    ctx.translate(size / 2 - 250.5 * fit, size / 2 - 264 * fit);
    ctx.scale(fit, fit);
    render(ctx, withLine, scene(withLine, 0), palette);
  }, [def, facing, paletteId, extrude, line]);

  return <canvas ref={ref} className="h-7 w-7" aria-hidden="true" />;
};

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  icon,
  onSelectTemplate,
  onUpdateFacing,
  currentFacing,
  onAddShape,
  paletteId,
}) => {
  const [shapeCategory, setShapeCategory] = useState<ShapeCategory>('basic');
  const visibleShapes = SHAPES.filter((shape) => shape.category === shapeCategory);

  return (
    <aside className="w-full lg:w-64 border-r border-slate-200/80 bg-white/95 backdrop-blur-md flex flex-col h-full overflow-y-auto select-none">
      {/* Templates / Reference Stickers */}
      <div className="p-3.5 border-b border-slate-200/70">
        <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2 block">
          Sticker Library (Slush Set)
        </label>
        <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-0.5">
          {TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.name}
              onClick={() => onSelectTemplate(tmpl.icon)}
              className={`text-left px-2.5 py-1.5 rounded-xl border text-xs font-mono transition group ${
                icon.name === tmpl.icon.name
                  ? 'bg-orange-50 border-[#ff6b35] text-slate-900 font-bold shadow-xs'
                  : 'border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 text-slate-700'
              }`}
            >
              <div className="truncate">{tmpl.name}</div>
              <div className="text-[9px] text-slate-400 font-normal truncate">{tmpl.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Facing / Isometric Direction */}
      <div className="p-3.5 border-b border-slate-200/70">
        <div className="flex items-center gap-1.5 mb-2">
          <Compass className="w-3.5 h-3.5 text-slate-500" />
          <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
            Facing Direction
          </label>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(VIEWS) as View[]).map((facing) => (
            <button
              key={facing}
              onClick={() => onUpdateFacing(facing)}
              className={`py-1.5 px-2 rounded-lg text-xs font-mono font-medium transition capitalize text-center ${
                currentFacing === facing
                  ? 'bg-[#ff6b35] text-white shadow-sm shadow-orange-200'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {facing}
            </button>
          ))}
        </div>
      </div>

      {/* Add New Slab Shape */}
      <div className="p-3.5 flex-1">
        <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2 block">
          Add Isometric Shape
        </label>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-1 mb-2.5">
          {SHAPE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setShapeCategory(cat.id)}
              aria-pressed={shapeCategory === cat.id}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold transition ${
                shapeCategory === cat.id
                  ? 'bg-[#ff6b35] text-white shadow-sm shadow-orange-200'
                  : 'bg-slate-50 border border-slate-200/60 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Shapes in the selected category */}
        <div className="grid grid-cols-3 gap-1.5 max-h-64 overflow-y-auto pr-0.5">
          {visibleShapes.map((shape) => (
            <button
              key={shape.id}
              type="button"
              title={shape.label}
              onClick={() => onAddShape(shape.id)}
              className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-[#ff6b35]"
            >
              <ShapePreview
                def={shape}
                facing={currentFacing}
                paletteId={paletteId}
                extrude={icon.extrude ?? [-3, 14]}
                line={icon.line ?? 5}
              />
              <span className="w-full truncate text-center text-[9px] font-mono leading-none">
                {shape.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};
