'use client';

import React, { useRef, useEffect } from 'react';
import { StickerProject } from '@/types/sticker';
import { renderSticker } from '@/lib/renderer';

interface CanvasEditorProps {
  project: StickerProject;
  currentFrame: number;
  totalFrames: number;
  isPlaying: boolean;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  zoom: number;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  project,
  currentFrame,
  totalFrames,
  selectedLayerId,
  onSelectLayer,
  zoom,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderSticker(ctx, project, {
      frame: currentFrame,
      totalFrames,
      width: 500,
      height: 500,
      showHelpers: true,
      selectedLayerId,
    });
  }, [project, currentFrame, totalFrames, selectedLayerId]);

  return (
    <div
      className="relative flex items-center justify-center w-full h-full overflow-hidden select-none"
      onClick={() => onSelectLayer(null)}
    >
      <div
        className="relative shadow-2xl transition-transform duration-75 border border-slate-200/80 rounded-2xl overflow-hidden bg-white"
        style={{
          transform: `scale(${zoom})`,
          width: 500,
          height: 500,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          className="w-full h-full block cursor-crosshair"
        />
      </div>
    </div>
  );
};
