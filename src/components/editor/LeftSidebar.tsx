'use client';

import React from 'react';
import {
  Compass,
  Plus,
} from 'lucide-react';
import { Icon, VIEWS, View } from '@/lib/funIsometric';
import { padlock, chat, search, coins, plane, blankProject } from '@/lib/funIsometric/icons';

interface LeftSidebarProps {
  icon: Icon;
  onSelectTemplate: (t: Icon) => void;
  onUpdateFacing: (facing: View) => void;
  currentFacing: View;
  onAddShape: (type: 'rect' | 'circle' | 'spark') => void;
}

const TEMPLATES = [
  { name: '+ Blank Page', icon: blankProject, desc: 'clean canvas' },
  { name: 'Padlock', icon: padlock, desc: 'clasp, shackle' },
  { name: 'Chat Bot', icon: chat, desc: 'wobble, look' },
  { name: 'Search Lens', icon: search, desc: 'twist, sparkle' },
  { name: 'Springing Coins', icon: coins, desc: 'bounce, glint' },
  { name: 'Paper Plane', icon: plane, desc: 'drift 3D' },
];

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  icon,
  onSelectTemplate,
  onUpdateFacing,
  currentFacing,
  onAddShape,
}) => {
  return (
    <aside className="w-64 border-r border-slate-200/80 bg-white/95 backdrop-blur-md flex flex-col h-full overflow-y-auto select-none">
      {/* Templates / Reference Stickers */}
      <div className="p-3.5 border-b border-slate-200/70">
        <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2 block">
          Preset Templates (Slush Set)
        </label>
        <div className="grid grid-cols-2 gap-1.5">
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
      <div className="p-3.5 border-b border-slate-200/70">
        <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2 block">
          Add Isometric Shape
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onAddShape('rect')}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-mono bg-slate-50 hover:bg-orange-50 hover:border-orange-300 border border-slate-200 text-slate-700 transition"
          >
            <Plus className="w-3 h-3 text-[#ff6b35]" /> Rect
          </button>
          <button
            onClick={() => onAddShape('circle')}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-mono bg-slate-50 hover:bg-orange-50 hover:border-orange-300 border border-slate-200 text-slate-700 transition"
          >
            <Plus className="w-3 h-3 text-[#ff6b35]" /> Circle
          </button>
          <button
            onClick={() => onAddShape('spark')}
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-mono bg-slate-50 hover:bg-orange-50 hover:border-orange-300 border border-slate-200 text-slate-700 transition"
          >
            <Plus className="w-3 h-3 text-[#ff6b35]" /> Spark
          </button>
        </div>
      </div>
    </aside>
  );
};
