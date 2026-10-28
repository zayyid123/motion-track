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
  Icon,
  Layer,
  Palette,
  PALETTES,
  VIEWS,
  View,
  Swatch,
} from '@/lib/funIsometric';
import { padlock } from '@/lib/funIsometric/icons';
import { rect, ellipse, spark } from '@/lib/funIsometric/fun';
import { wiggle, hop, bounce, drift, twist, wobble, sway, float, bob, clasp, shackle, look, sparkle, twinkle, glint } from '@/lib/funIsometric/motions';
import { AISettings, StickerProject } from '@/types/sticker';
import { DEFAULT_AI_SETTINGS } from '@/types/palettes';

// Motion Preset Dictionary: complete and direct Motion objects
export const PRESET_MOTIONS_MAP: Record<string, unknown> = {
  none: undefined,
  wiggle,
  hop,
  bounce,
  clasp,
  shackle,
  drift,
  twist,
  wobble,
  look,
  sparkle: sparkle(0),
  twinkle: twinkle(0),
  glint: glint(0),
  sway,
  float,
  bob,
};

export function MotionTrackStudio() {
  const [icon, setIcon] = useState<Icon>(() => JSON.parse(JSON.stringify(padlock)));
  const [history, setHistory] = useState<Icon[]>([JSON.parse(JSON.stringify(padlock))]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const [palette, setPalette] = useState<Palette>(PALETTES.slush);
  const [currentFacing, setCurrentFacing] = useState<View>('right');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>('body');
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1.0);
  const [outlineWidth, setOutlineWidth] = useState<number>(5);

  // Push snapshot to undo history
  const updateIconWithHistory = (updater: (prev: Icon) => Icon) => {
    setIcon((prev) => {
      const next = updater(prev);
      setHistory((h) => {
        const sliced = h.slice(0, historyIndex + 1);
        return [...sliced, JSON.parse(JSON.stringify(next))];
      });
      setHistoryIndex((idx) => idx + 1);
      return next;
    });
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setIcon(JSON.parse(JSON.stringify(history[prevIdx])));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setIcon(JSON.parse(JSON.stringify(history[nextIdx])));
    }
  };

  const handleDeleteLayer = (id: string) => {
    updateIconWithHistory((prev) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.id !== id),
    }));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Shift+Z, Delete/Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerId) {
          e.preventDefault();
          handleDeleteLayer(selectedLayerId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history, selectedLayerId, handleUndo, handleRedo]);

  // Modals & Panels
  const [isAISidebarOpen, setIsAISidebarOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // AI Settings
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('motion_track_ai_settings');
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return DEFAULT_AI_SETTINGS;
  });

  const handleSaveAISettings = (newSettings: AISettings) => {
    setAiSettings(newSettings);
    try {
      localStorage.setItem('motion_track_ai_settings', JSON.stringify(newSettings));
    } catch {
      // ignore
    }
  };

  // 60 FPS requestAnimationFrame loop
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    let lastTime = performance.now();
    const frameDuration = 1000 / 60;

    const step = (time: number) => {
      const delta = time - lastTime;
      if (delta >= frameDuration) {
        lastTime = time - (delta % frameDuration);
        setCurrentFrame((prev) => (prev + 1) % (icon.frames || 180));
      }
      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, icon.frames]);

  // Handle layer movement from canvas dragging or input
  const handleUpdateLayerPosition = (layerId: string, dx: number, dy: number) => {
    setIcon((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => {
        if (l.id === layerId && !l.locked) {
          const currentP = Array.isArray(l.p) && typeof l.p[0] === 'number'
            ? (l.p as [number, number])
            : [250, 250];
          return {
            ...l,
            p: [currentP[0] + dx, currentP[1] + dy] as [number, number],
          };
        }
        return l;
      }),
    }));
  };

  // Handle layer rotation from canvas rotation handle drag
  const handleUpdateLayerRotation = (layerId: string, dRot: number) => {
    setIcon((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => {
        if (l.id === layerId && !l.locked) {
          const currentR = typeof l.r === 'number' ? l.r : 0;
          return {
            ...l,
            r: (currentR + dRot) % 360,
          };
        }
        return l;
      }),
    }));
  };

  // Handle layer resize/scale: can scale proportional (X & Y), scale X only (kiri/kanan), or scale Y only (atas/bawah)
  const handleUpdateLayerScale = (layerId: string, dScalePctX: number, dScalePctY: number) => {
    setIcon((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => {
        if (l.id === layerId && !l.locked) {
          const currentSX = Array.isArray(l.s) && typeof l.s[0] === 'number' ? l.s[0] : 100;
          const currentSY = Array.isArray(l.s) && typeof l.s[1] === 'number' ? l.s[1] : 100;

          const nextSX = Math.min(300, Math.max(15, currentSX + dScalePctX));
          const nextSY = Math.min(300, Math.max(15, currentSY + dScalePctY));

          return {
            ...l,
            s: [nextSX, nextSY],
          };
        }
        return l;
      }),
    }));
  };

  const handleToggleHideLayer = (layerId: string) => {
    updateIconWithHistory((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === layerId ? { ...l, hidden: !l.hidden } : l)),
    }));
  };

  const handleToggleLockLayer = (layerId: string) => {
    updateIconWithHistory((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l)),
    }));
  };

  const handleUpdateLayerTiming = (layerId: string, ip: number, op: number) => {
    setIcon((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === layerId ? { ...l, ip, op } : l)),
    }));
  };

  const handleUpdateLayer = (id: string, updates: Partial<Layer>) => {
    updateIconWithHistory((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    }));
  };

  const handleUpdateLayerShapeFill = (layerId: string, fill: Swatch) => {
    updateIconWithHistory((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => {
        if (l.id === layerId) {
          return {
            ...l,
            shapes: l.shapes.map((s, idx) => (idx === 0 ? { ...s, fill } : s)),
          };
        }
        return l;
      }),
    }));
  };

  const handleUpdateLayerShapeDepth = (layerId: string, depth: number) => {
    updateIconWithHistory((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => {
        if (l.id === layerId) {
          return {
            ...l,
            shapes: l.shapes.map((s, idx) => (idx === 0 ? { ...s, depth } : s)),
          };
        }
        return l;
      }),
    }));
  };

  // Create a new empty container Group Layer
  const handleCreateGroup = () => {
    const newGid = `group-${Date.now().toString().slice(-4)}`;
    const newGroupLayer: Layer = {
      id: newGid,
      name: `Group ${newGid.slice(-4)}`,
      isGroup: true,
      p: [250, 250],
      motionPreset: 'wiggle',
      m: PRESET_MOTIONS_MAP.wiggle as Layer['m'],
      shapes: [],
    };

    updateIconWithHistory((prev) => {
      // Put the new empty group on top of the layer list
      let nextLayers = [newGroupLayer, ...prev.layers];
      if (selectedLayerId) {
        nextLayers = nextLayers.map((l) => (l.id === selectedLayerId && !l.isGroup ? { ...l, groupId: newGid } : l));
      }
      return {
        ...prev,
        layers: nextLayers,
      };
    });
    setSelectedLayerId(newGid);
  };

  const handleSetLayerGroup = (layerId: string, groupId: string | undefined) => {
    updateIconWithHistory((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => {
        if (l.id === layerId) {
          return {
            ...l,
            groupId,
            // When leaving a group, also remove any parent reference so it is completely independent!
            parent: groupId ? l.parent : undefined,
          };
        }
        return l;
      }),
    }));
  };

  const handleApplyMotionToLayer = (layerId: string, motionName: string) => {
    const motionObj = PRESET_MOTIONS_MAP[motionName];

    updateIconWithHistory((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => {
        if (l.id === layerId) {
          return {
            ...l,
            motionPreset: motionName,
            m: motionName === 'none' ? undefined : (motionObj as Layer['m']),
          };
        }
        return l;
      }),
    }));
  };

  const handleAddShape = (type: 'rect' | 'circle' | 'spark') => {
    const newId = `layer-${Date.now().toString().slice(-4)}`;
    let d = rect(-50, -50, 100, 100, 12);
    if (type === 'circle') d = ellipse(0, 0, 50, 40);
    if (type === 'spark') d = spark(0, 0, 32);

    // If currently selected layer has a group, new layer automatically joins the group as a follower
    let autoGroup: string | undefined = undefined;
    if (selectedLayerId) {
      const activeLayer = icon.layers.find((l) => l.id === selectedLayerId);
      if (activeLayer?.groupId) {
        autoGroup = activeLayer.groupId;
      }
    }

    const newLayer: Layer = {
      id: newId,
      name: `New ${type}`,
      p: [250, 250],
      groupId: autoGroup,
      isGroupLeader: false,
      shapes: [
        {
          d,
          fill: 'main',
          depth: type === 'spark' ? 0 : 0.8,
        },
      ],
    };

    updateIconWithHistory((prev) => ({
      ...prev,
      layers: [...prev.layers, newLayer],
    }));
    setSelectedLayerId(newId);
  };

  // Move layer order and dynamically join/leave group on drop
  const handleMoveLayerIndex = (fromIndex: number, toIndex: number, targetGroupId?: string | null) => {
    updateIconWithHistory((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.layers.length) return prev;
      if (toIndex < 0 || toIndex >= prev.layers.length) return prev;

      const nextLayers = [...prev.layers];
      const [movedItem] = nextLayers.splice(fromIndex, 1);

      // If dropped onto a group or independent layer, update its groupId accordingly
      if (targetGroupId !== undefined) {
        // Can't put a group container into another group
        if (!movedItem.isGroup) {
          movedItem.groupId = targetGroupId || undefined;
          // If leaving group (targetGroupId is null/undefined), also clear parent reference!
          if (!targetGroupId) {
            movedItem.parent = undefined;
          }
        }
      }

      nextLayers.splice(toIndex, 0, movedItem);

      return {
        ...prev,
        layers: nextLayers,
      };
    });
  };

  const handleUpdateFacing = (facing: View) => {
    setCurrentFacing(facing);
    const viewConfig = VIEWS[facing];
    updateIconWithHistory((prev) => ({
      ...prev,
      extrude: viewConfig.extrude,
      layers: prev.layers.map((l) => (l.tilt ? { ...l, tilt: viewConfig.tilt } : l)),
    }));
  };

  const handleSelectTemplate = (templateIcon: Icon) => {
    const cloned = JSON.parse(JSON.stringify(templateIcon));
    cloned.line = outlineWidth;
    updateIconWithHistory(() => cloned);
    // Auto select first visual body layer
    const firstBody = cloned.layers.find((l: Layer) => l.shapes && l.shapes.length > 0);
    setSelectedLayerId(firstBody?.id || cloned.layers[0]?.id || null);
    setCurrentFrame(0);
  };

  const handlePaletteChange = (palKey: keyof typeof PALETTES) => {
    setPalette(PALETTES[palKey] || PALETTES.slush);
  };

  const handleUpdatePaletteColor = (role: keyof Palette, hex: string) => {
    setPalette((prev) => ({ ...prev, [role]: hex }));
  };

  const handleUpdateOutlineWidth = (w: number) => {
    setOutlineWidth(w);
    setIcon((prev) => ({ ...prev, line: w }));
  };

  // Save / Load JSON
  const handleSaveJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(icon, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `${(icon.name || 'sticker').toLowerCase().replace(/\s+/g, '-')}.json`;
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
            setIcon(parsed);
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

  const selectedLayer = icon.layers.find((l) => l.id === selectedLayerId) || null;

  // Fake project adapter for Toolbar compatibility
  const projectAdapter: StickerProject = {
    version: 1,
    name: icon.name,
    facing: currentFacing,
    paletteId: 'slush',
    layers: [],
    motion: { preset: 'wiggle', speed: 1, intensity: 1, loop: true },
    canvasBg: null,
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      <Toolbar
        project={projectAdapter}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onResetFrame={() => setCurrentFrame(0)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleAISidebar={() => setIsAISidebarOpen(!isAISidebarOpen)}
        isAISidebarOpen={isAISidebarOpen}
        onOpenExport={() => setIsExportOpen(true)}
        onSaveJSON={handleSaveJSON}
        onLoadJSON={handleLoadJSON}
        onProjectNameChange={(name) => updateIconWithHistory((prev) => ({ ...prev, name }))}
        zoom={zoom}
        onZoomChange={setZoom}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        hasSelectedLayer={!!selectedLayerId}
        onDeleteSelectedLayer={() => {
          if (selectedLayerId) handleDeleteLayer(selectedLayerId);
        }}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <LeftSidebar
          icon={icon}
          onSelectTemplate={handleSelectTemplate}
          onUpdateFacing={handleUpdateFacing}
          currentFacing={currentFacing}
          onAddShape={handleAddShape}
        />

        <main className="flex-1 h-full bg-[#f8fafc] flex flex-col items-center justify-center relative overflow-hidden">
          <CanvasEditor
            icon={icon}
            palette={palette}
            currentFrame={currentFrame}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onUpdateLayerPosition={handleUpdateLayerPosition}
            onUpdateLayerRotation={handleUpdateLayerRotation}
            onUpdateLayerScale={handleUpdateLayerScale}
            zoom={zoom}
            onZoomChange={setZoom}
          />
        </main>

        <RightSidebar
          layers={icon.layers}
          palette={palette}
          selectedLayer={selectedLayer}
          onUpdateLayer={handleUpdateLayer}
          onUpdateLayerShapeFill={handleUpdateLayerShapeFill}
          onUpdateLayerShapeDepth={handleUpdateLayerShapeDepth}
          onCreateGroup={handleCreateGroup}
          onSetLayerGroup={handleSetLayerGroup}
          onApplyMotionToLayer={handleApplyMotionToLayer}
          onPaletteChange={handlePaletteChange}
          onUpdatePaletteColor={handleUpdatePaletteColor}
          outlineWidth={outlineWidth}
          onUpdateOutlineWidth={handleUpdateOutlineWidth}
        />

        <AISidebar
          isOpen={isAISidebarOpen}
          onClose={() => setIsAISidebarOpen(false)}
          settings={aiSettings}
          onOpenSettings={() => setIsSettingsOpen(true)}
          icon={icon}
          palette={palette}
          selectedLayerId={selectedLayerId}
        />
      </div>

      <Timeline
        layers={icon.layers}
        currentFrame={currentFrame}
        totalFrames={icon.frames || 180}
        isPlaying={isPlaying}
        selectedLayerId={selectedLayerId}
        onSelectLayer={setSelectedLayerId}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onSeek={setCurrentFrame}
        loop={true}
        onToggleLoop={() => {}}
        onToggleHideLayer={handleToggleHideLayer}
        onToggleLockLayer={handleToggleLockLayer}
        onUpdateLayerTiming={handleUpdateLayerTiming}
        onMoveLayerIndex={handleMoveLayerIndex}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={aiSettings}
        onSave={handleSaveAISettings}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        icon={icon}
        palette={palette}
      />
    </div>
  );
}
