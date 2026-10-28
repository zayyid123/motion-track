'use client';

import React from 'react';
import { Play, Pause, SkipBack, Repeat } from 'lucide-react';

interface TimelineProps {
  currentFrame: number;
  totalFrames: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (frame: number) => void;
  loop: boolean;
  onToggleLoop: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  currentFrame,
  totalFrames,
  isPlaying,
  onTogglePlay,
  onSeek,
  loop,
  onToggleLoop,
}) => {
  return (
    <footer className="h-16 border-t border-slate-200 bg-white/95 backdrop-blur-md px-6 flex items-center gap-6 z-10 select-none">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSeek(0)}
          className="p-2 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-xl transition"
          title="Jump to frame 0"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={onTogglePlay}
          className={`p-2 rounded-xl transition ${
            isPlaying
              ? 'bg-[#ff6b35] text-white shadow-sm shadow-orange-200'
              : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
          }`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <button
          onClick={onToggleLoop}
          className={`p-2 rounded-xl transition ${
            loop
              ? 'text-blue-700 bg-blue-100/80 font-bold'
              : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
          }`}
          title="Toggle Seamless Loop"
        >
          <Repeat className="w-4 h-4" />
        </button>
      </div>

      {/* Frame Counter Display */}
      <div className="font-mono text-xs text-slate-700 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl font-medium">
        <span className="font-bold text-slate-950">{currentFrame}</span>
        <span className="text-slate-600 font-semibold"> / {totalFrames} f</span>
      </div>

      {/* Scrubber Slider */}
      <div className="flex-1 flex items-center gap-3">
        <input
          type="range"
          min="0"
          max={totalFrames - 1}
          value={currentFrame}
          onChange={(e) => onSeek(parseInt(e.target.value) || 0)}
          className="w-full accent-[#ff6b35] h-2.5 bg-slate-200 rounded-lg cursor-pointer"
        />
      </div>

      {/* 60 FPS Badge */}
      <div className="font-mono text-[11px] font-bold text-slate-700">
        60 FPS • 2.0s LOOP
      </div>
    </footer>
  );
};
