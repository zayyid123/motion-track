'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Layers,
  Palette,
  Film,
  Bot,
} from 'lucide-react';
import { renderSticker } from '@/lib/renderer';
import { PADLOCK_HERO_PROJECT } from '@/data/sampleStickers';

interface LandingViewProps {
  onOpenStudio: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onOpenStudio }) => {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const command = 'npx skills add kelvinkn17/skills@fun-isometric';

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Preview animation loop for Hero Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let animId: number;

    const render = () => {
      renderSticker(ctx, PADLOCK_HERO_PROJECT, {
        frame,
        totalFrames: 120,
        width: 440,
        height: 440,
        showHelpers: false,
      });
      frame = (frame + 1) % 120;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-900 selection:bg-orange-100 selection:text-orange-600 font-sans">
      {/* Navigation Header */}
      <nav className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between border-b border-slate-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#ff6b35] text-white flex items-center justify-center font-mono font-bold text-sm shadow-sm shadow-orange-200">
            MT
          </div>
          <span className="font-mono font-bold text-lg tracking-tight text-slate-900">
            motion-track
          </span>
          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-medium">
            isometric kit
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
          {/* Left Column: Bold Typography & Developer Details */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-mono font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#ff6b35]" />
              <span>Animated Isometric Sticker Studio</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-mono font-black tracking-tight text-slate-900 leading-[1.1]">
              Stickers that <span className="text-[#ff6b35] underline decoration-[#ffb703]">move</span> on real keyframes.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-sans max-w-xl">
              Desain stiker slab isometrik dengan garis hitam tebal, palet warna oranye hangat & biru elektrik yang khas, serta animasi After Effects keyframe presets. Ekspor instan ke MOV, MP4, atau GIF.
            </p>

            {/* Developer-Focused CLI Command Box */}
            <div className="pt-2">
              <div className="flex items-center justify-between bg-white border border-slate-300 rounded-2xl p-2.5 sm:p-3 font-mono text-xs max-w-xl shadow-xs">
                <div className="flex items-center gap-2.5 text-slate-800 overflow-x-auto py-1">
                  <Terminal className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-slate-600 font-bold select-none">$</span>
                  <span className="font-semibold text-slate-900">{command}</span>
                </div>
                <button
                  onClick={handleCopy}
                  className="p-2 text-slate-600 hover:text-slate-950 hover:bg-slate-50 rounded-xl transition border border-transparent hover:border-slate-300 shrink-0 ml-2"
                  title="Salin perintah instalasi skill"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600 font-bold" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[11px] font-mono text-slate-600 font-medium block mt-2 ml-1">
                Diadaptasi dari ekosistem agen skill <a href="https://github.com/kelvinkn17/skills" target="_blank" rel="noreferrer" className="underline hover:text-[#ff6b35] font-semibold">kelvinkn17/skills</a> (MIT License).
              </span>
            </div>

            {/* CTA Buttons */}
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

          {/* Right Column: Isometric Signature Sticker Preview */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative">
              {/* Subtle background glow */}
              <div className="absolute -inset-4 bg-gradient-to-tr from-orange-100 to-blue-100 rounded-3xl -z-10 blur-xl opacity-70" />

              <div className="w-[360px] sm:w-[420px] h-[360px] sm:h-[420px] rounded-3xl border border-slate-200/90 bg-white shadow-xl flex items-center justify-center p-4 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={440}
                  height={440}
                  className="w-full h-full block object-contain pointer-events-none"
                />
              </div>

              <div className="absolute -bottom-4 right-4 bg-white/95 backdrop-blur-md border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-sm text-[11px] font-mono text-slate-600 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Canvas • 60 FPS Keyframes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-300">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-300 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#ff6b35] flex items-center justify-center mb-4">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="font-mono font-bold text-sm text-slate-900">Isometric Slab System</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans font-medium">
              Ekstrusi 3D solid dengan garis tebal 5px, bayangan terarah, dan 4 sudut pandang: right, left, front, serta flat.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-300 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
              <Palette className="w-4 h-4" />
            </div>
            <h3 className="font-mono font-bold text-sm text-slate-900">Warm Orange & Blue</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans font-medium">
              Palet ikonik Slush: Tangerine orange cerah dipadukan dengan aksen electric cobalt blue dan soft sky tints.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-300 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <Film className="w-4 h-4" />
            </div>
            <h3 className="font-mono font-bold text-sm text-slate-900">MOV / MP4 / GIF Export</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans font-medium">
              Rendering animasi stiker bergerak resolusi tinggi bersih tanpa elemen editor yang siap digunakan di produk web & video.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-300 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
              <Bot className="w-4 h-4" />
            </div>
            <h3 className="font-mono font-bold text-sm text-slate-900">Custom AI Chat</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans font-medium">
              Sidebar asisten AI dengan endpoint URL & API Key Anda sendiri untuk brainstorming ide stiker dan kombinasi gerak.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-600 font-medium gap-4">
        <div>
          © 2026 motion-track. Minimalist Swiss-inspired Isometric Engine.
        </div>
        <div>
          Inspired by <a href="https://github.com/kelvinkn17/skills" target="_blank" rel="noreferrer" className="underline hover:text-[#ff6b35] font-semibold">fun-isometric</a> (MIT).
        </div>
      </footer>
    </div>
  );
};
