'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ArrowRight,
  Layers,
  Film,
  Bot,
  Boxes,
} from 'lucide-react';
import { draw } from '@/lib/funIsometric/fun';
import { padlock, chat, search, coins } from '@/lib/funIsometric/icons';
import { PALETTES } from '@/lib/funIsometric/fun';

interface LandingViewProps {
  onOpenStudio: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onOpenStudio }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activePreviewSticker, setActivePreviewSticker] = useState<'padlock' | 'chat' | 'search' | 'coins'>('padlock');

  const STICKER_MAP = {
    padlock,
    chat,
    search,
    coins,
  };

  // Preview animation loop for Hero Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let animId: number;
    const currentIcon = STICKER_MAP[activePreviewSticker];

    const render = () => {
      ctx.clearRect(0, 0, 480, 480);
      ctx.save();
      const scale = 480 / 500;
      ctx.scale(scale, scale);
      draw(ctx, currentIcon, frame, PALETTES.slush);
      ctx.restore();

      frame = (frame + 1) % (currentIcon.frames || 130);
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [activePreviewSticker]);

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-900 selection:bg-orange-100 selection:text-orange-600 font-sans">
      {/* Navigation Header */}
      <nav className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#ff6b35] text-white flex items-center justify-center font-mono font-bold text-sm shadow-sm shadow-orange-200">
            MT
          </div>
          <span className="font-mono font-bold text-lg tracking-tight text-slate-900">
            motion-track
          </span>
          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-orange-50 text-[#ff6b35] border border-orange-200 font-bold">
            v1.0 Studio
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenStudio}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-semibold transition shadow-sm hover:shadow"
          >
            <span>Open Studio</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#ff6b35]" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Bold Typography & Studio Intro */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-xs font-mono font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#ff6b35]" />
              <span>Interactive Isometric Sticker Studio</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-mono font-black tracking-tight text-slate-950 leading-[1.1]">
              Slab stickers that <span className="text-[#ff6b35] underline decoration-[#ffb703]">move</span> on real keyframes.
            </h1>

            <p className="text-base sm:text-lg text-slate-700 leading-relaxed font-sans max-w-xl font-normal">
              Create isometric animated 3D slab stickers with bold outlines, role-based color palettes, multi-track timeline, and export directly to MOV ProRes, MP4, or GIF.
            </p>

            {/* Quick Interactive Sticker Selector */}
            <div className="pt-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold block mb-2">
                Select Interactive Sticker Preview:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'padlock', name: 'Padlock (Clasp)', icon: '🔒' },
                  { id: 'chat', name: 'Chat Bot (Wobble)', icon: '💬' },
                  { id: 'search', name: 'Search Lens (Twist)', icon: '🔍' },
                  { id: 'coins', name: 'Gold Coin (Bounce)', icon: '🪙' },
                ].map((stk) => (
                  <button
                    key={stk.id}
                    onClick={() => setActivePreviewSticker(stk.id as 'padlock' | 'chat' | 'search' | 'coins')}
                    className={`px-3 py-2 rounded-xl border text-xs font-mono transition flex items-center gap-1.5 ${
                      activePreviewSticker === stk.id
                        ? 'bg-orange-50 border-[#ff6b35] text-slate-950 font-bold shadow-xs'
                        : 'bg-white border-slate-300 hover:border-slate-400 text-slate-700'
                    }`}
                  >
                    <span>{stk.icon}</span>
                    <span>{stk.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Primary CTA */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={onOpenStudio}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#ff6b35] hover:bg-[#e85926] text-white font-mono text-sm font-bold transition shadow-md shadow-orange-200"
              >
                <span>Launch Interactive Studio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Column: Isometric Canvas Preview */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative">
              {/* Subtle background glow */}
              <div className="absolute -inset-4 bg-gradient-to-tr from-orange-100 to-blue-100 rounded-3xl -z-10 blur-xl opacity-70" />

              <div className="w-[360px] sm:w-[440px] h-[360px] sm:h-[440px] rounded-3xl border border-slate-300 bg-white shadow-xl flex items-center justify-center p-4 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={480}
                  height={480}
                  className="w-full h-full block object-contain pointer-events-none"
                />
              </div>

              <div className="absolute -bottom-4 right-4 bg-white/95 backdrop-blur-md border border-slate-300 px-3.5 py-1.5 rounded-xl shadow-sm text-[11px] font-mono text-slate-700 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live 60 FPS Keyframes Canvas</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#ff6b35] flex items-center justify-center mb-4">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="font-mono font-bold text-sm text-slate-900">Multi-Track Timeline</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans font-medium">
              Control in-point and out-point timing (trimming) for each layer with an interactive multi-track layout.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
              <Boxes className="w-4 h-4" />
            </div>
            <h3 className="font-mono font-bold text-sm text-slate-900">Group Container</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans font-medium">
              Flexible group hierarchy to synchronize and move multiple layers together effortlessly via drag & drop.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <Film className="w-4 h-4" />
            </div>
            <h3 className="font-mono font-bold text-sm text-slate-900">High-Res Video Export</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans font-medium">
              Render ultra-smooth 60 FPS animation up to Full HD (1080p) and 2K QHD (1440p) in MOV, MP4, or GIF.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
              <Bot className="w-4 h-4" />
            </div>
            <h3 className="font-mono font-bold text-sm text-slate-900">Custom AI Assistant</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans font-medium">
              AI sidebar assistant with custom Base URL & API Key for live design suggestions, motion ideas, and palette advice.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-600 font-medium gap-4">
        <div>
          © 2026 motion-track. Minimalist Swiss-inspired Animated Isometric Engine.
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onOpenStudio} className="underline hover:text-[#ff6b35]">
            Open Studio
          </button>
        </div>
      </footer>
    </div>
  );
};
