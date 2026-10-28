'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Toolbar } from '@/components/editor/Toolbar';
import { LeftSidebar } from '@/components/editor/LeftSidebar';
import { RightSidebar } from '@/components/editor/RightSidebar';
import { CanvasEditor } from '@/components/editor/CanvasEditor';
import { Timeline } from '@/components/editor/Timeline';
import { AISidebar } from '@/components/editor/AISidebar';
import { SettingsModal } from '@/components/editor/SettingsModal';
import { ExportModal } from '@/components/editor/ExportModal';

import {
  StickerProject,
  StickerLayer,
  ViewDirection,
  ShapeType,
  RoleColorKey,
  AISettings,
} from '@/types/sticker';
import { PADLOCK_HERO_PROJECT, SAMPLE_PROJECTS } from '@/data/sampleStickers';
import { DEFAULT_AI_SETTINGS } from '@/types/palettes';

export function MotionTrackStudio() {
  const [project, setProject] = useState<StickerProject>(PADLOCK_HERO_PROJECT);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>('padlock-body');
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1.0);

  // Modals & Panels
  const [isAISidebarOpen, setIsAISidebarOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // AI Settings from LocalStorage
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('motion_track_ai_settings');
        if (saved) {
          return JSON.parse(saved);
        }
      } catch {
        // Fallback
      }
    }
    return DEFAULT_AI_SETTINGS;
  });

  const handleSaveAISettings = (newSettings: AISettings) => {
    setAiSettings(newSettings);
    try {
      localStorage.setItem('motion_track_ai_settings', JSON.stringify(newSettings));
    } catch {
      // Ignore
    }
  };

  // 60 FPS Animation Loop
  const totalFrames = 120;
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    let lastTime = performance.now();
    const frameDuration = (1000 / 60) / (project.motion.speed || 1.0);

    const step = (time: number) => {
      const delta = time - lastTime;
      if (delta >= frameDuration) {
        lastTime = time - (delta % frameDuration);
        setCurrentFrame((prev) => (prev + 1) % totalFrames);
      }
      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, project.motion.speed]);

  // Project handlers
  const handleAddLayer = (shape: ShapeType) => {
    const newId = `layer-${Date.now()}`;
    const newLayer: StickerLayer = {
      id: newId,
      name: `Slab ${shape.replace('slab-', '')}`,
      shapeType: shape,
      visible: true,
      locked: false,
      x: 250,
      y: 250,
      width: shape === 'spark' ? 40 : 120,
      height: shape === 'spark' ? 40 : 80,
      depth: shape === 'spark' ? 0 : 16,
      rotation: 0,
      fillRole: 'main',
      outlineWidth: 5,
    };
    setProject((prev) => ({
      ...prev,
      layers: [...prev.layers, newLayer],
    }));
    setSelectedLayerId(newId);
  };

  const handleUpdateLayer = (id: string, updates: Partial<StickerLayer>) => {
    setProject((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    }));
  };

  const handleDeleteLayer = (id: string) => {
    setProject((prev) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.id !== id),
    }));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const handleReorderLayer = (id: string, direction: 'up' | 'down') => {
    setProject((prev) => {
      const index = prev.layers.findIndex((l) => l.id === id);
      if (index === -1) return prev;
      const targetIndex = direction === 'up' ? index + 1 : index - 1;
      if (targetIndex < 0 || targetIndex >= prev.layers.length) return prev;

      const newLayers = [...prev.layers];
      const temp = newLayers[index];
      newLayers[index] = newLayers[targetIndex];
      newLayers[targetIndex] = temp;

      return { ...prev, layers: newLayers };
    });
  };

  const handleFacingChange = (facing: ViewDirection) => {
    setProject((prev) => ({ ...prev, facing }));
  };

  const handleLoadPreset = (key: string) => {
    const found = SAMPLE_PROJECTS[key];
    if (found) {
      setProject(JSON.parse(JSON.stringify(found)));
      setSelectedLayerId(found.layers[0]?.id || null);
    }
  };

  const handleUpdateRoleColor = (role: RoleColorKey, hex: string) => {
    setProject((prev) => ({
      ...prev,
      customPalette: {
        ...(prev.customPalette || {}),
        [role]: hex,
      },
    }));
  };

  // Save / Load JSON
  const handleSaveJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
  };

  const handleLoadJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && parsed.layers) {
            setProject(parsed);
            setSelectedLayerId(parsed.layers[0]?.id || null);
          }
        } catch {
          alert('Format file JSON tidak valid.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const selectedLayer = project.layers.find((l) => l.id === selectedLayerId) || null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Top Header Toolbar */}
      <Toolbar
        project={project}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onResetFrame={() => setCurrentFrame(0)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleAISidebar={() => setIsAISidebarOpen(!isAISidebarOpen)}
        isAISidebarOpen={isAISidebarOpen}
        onOpenExport={() => setIsExportOpen(true)}
        onSaveJSON={handleSaveJSON}
        onLoadJSON={handleLoadJSON}
        onProjectNameChange={(name) => setProject((prev) => ({ ...prev, name }))}
        zoom={zoom}
        onZoomChange={setZoom}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Shapes, Layers, Templates */}
        <LeftSidebar
          project={project}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
          onAddLayer={handleAddLayer}
          onUpdateLayer={handleUpdateLayer}
          onDeleteLayer={handleDeleteLayer}
          onReorderLayer={handleReorderLayer}
          onFacingChange={handleFacingChange}
          onLoadPreset={handleLoadPreset}
        />

        {/* Central Canvas Editor */}
        <main className="flex-1 h-full bg-[#f8fafc] flex flex-col items-center justify-center relative overflow-hidden">
          <CanvasEditor
            project={project}
            currentFrame={currentFrame}
            totalFrames={totalFrames}
            isPlaying={isPlaying}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onUpdateLayer={handleUpdateLayer}
            onDeleteLayer={handleDeleteLayer}
            zoom={zoom}
          />
        </main>

        {/* Right Sidebar: Motion, Palette, Layer Props */}
        <RightSidebar
          project={project}
          selectedLayer={selectedLayer}
          onUpdateLayer={handleUpdateLayer}
          onUpdateProjectMotion={(motion) => setProject((prev) => ({ ...prev, motion }))}
          onPaletteChange={(paletteId) => setProject((prev) => ({ ...prev, paletteId }))}
          onUpdateRoleColor={handleUpdateRoleColor}
        />

        {/* AI Chat Sidebar Drawer */}
        <AISidebar
          isOpen={isAISidebarOpen}
          onClose={() => setIsAISidebarOpen(false)}
          settings={aiSettings}
          onOpenSettings={() => setIsSettingsOpen(true)}
          project={project}
        />
      </div>

      {/* Bottom Timeline Bar */}
      <Timeline
        currentFrame={currentFrame}
        totalFrames={totalFrames}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onSeek={setCurrentFrame}
        loop={project.motion.loop}
        onToggleLoop={() =>
          setProject((prev) => ({
            ...prev,
            motion: { ...prev.motion, loop: !prev.motion.loop },
          }))
        }
      />

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={aiSettings}
        onSave={handleSaveAISettings}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        project={project}
      />
    </div>
  );
}
