'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Toolbar } from '@/components/editor/Toolbar';
import { LeftSidebar } from '@/components/editor/LeftSidebar';
import { RightSidebar } from '@/components/editor/RightSidebar';
import { CanvasEditor } from '@/components/editor/CanvasEditor';
import { Timeline } from '@/components/editor/Timeline';
import { AISidebar } from '@/components/editor/AISidebar';
import { SettingsModal } from '@/components/editor/SettingsModal';
import { ExportModal } from '@/components/editor/ExportModal';
import { useToast } from '@/components/ui/toast';
import { useIsPlaying } from '@/hooks/usePlayback';
import { PlaybackClock } from '@/lib/editor/clock';
import { useStudioState } from '@/lib/editor/useStudioState';
import { DEFAULT_AI_SETTINGS, loadAISettings, saveAISettings } from '@/lib/ai/settings';
import type { AISettings } from '@/lib/ai/types';
import { parseProject, serializeProject } from '@/lib/projectFile';

const slug = (name: string): string =>
  (name || 'sticker')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sticker';

export function MotionTrackStudio() {
  const [clock] = useState(() => new PlaybackClock());
  const studio = useStudioState(clock);
  const { actions } = studio;
  const { undo, redo, selectedLayerId } = studio;
  const isPlaying = useIsPlaying(clock);
  const { toast } = useToast();

  const [mobileTab, setMobileTab] = useState<'canvas' | 'templates' | 'properties'>('canvas');
  const [zoom, setZoom] = useState(1);
  const [isAISidebarOpen, setIsAISidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const settingsLoaded = useRef(false);

  const icon = studio.icon;
  const selectedLayer = studio.selectedLayer;

  // Start playback after mount unless the visitor prefers reduced motion.
  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) clock.play();
    return () => clock.dispose();
  }, [clock]);

  // Local settings are read after mount so the server and client markup match.
  useEffect(() => {
    if (settingsLoaded.current) return;
    settingsLoaded.current = true;
    setAiSettings(loadAISettings());
  }, []);

  const handleSaveAISettings = useCallback(
    (next: AISettings) => {
      setAiSettings(next);
      saveAISettings(next);
      toast('AI settings saved on this device.', 'success');
    },
    [toast]
  );

  // Global shortcuts. Text fields keep their native undo/delete behavior.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
      ) {
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedLayerId) {
        event.preventDefault();
        actions.deleteLayer(selectedLayerId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions, redo, selectedLayerId, undo]);

  const handleSaveJSON = useCallback(() => {
    try {
      const blob = new Blob([serializeProject(studio.doc)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${slug(icon.name)}.motion.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Project JSON downloaded.', 'success');
    } catch {
      toast('Could not create the project file.', 'error');
    }
  }, [icon.name, studio.doc, toast]);

  const handleLoadJSON = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const parsed = parseProject(await file.text());
        if (!parsed.ok) {
          toast(parsed.error, 'error');
          return;
        }
        actions.loadProject(parsed.doc);
        toast(`Opened "${parsed.doc.icon.name || 'project'}".`, 'success');
        setMobileTab('canvas');
      } catch {
        toast('Could not read that file.', 'error');
      }
    };
    input.click();
  }, [actions, toast]);

  const toggleLayerHidden = useCallback(
    (id: string) => {
      const layer = icon.layers.find((candidate) => candidate.id === id);
      if (!layer) return;
      actions.updateLayer(id, { hidden: !layer.hidden }, { mode: 'commit', label: 'Toggle visibility' });
    },
    [actions, icon.layers]
  );

  const toggleLayerLocked = useCallback(
    (id: string) => {
      const layer = icon.layers.find((candidate) => candidate.id === id);
      if (!layer) return;
      actions.updateLayer(id, { locked: !layer.locked }, { mode: 'commit', label: 'Toggle lock' });
    },
    [actions, icon.layers]
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100 font-sans">
      <Toolbar
        projectName={icon.name}
        saveState={studio.saveState}
        isPlaying={isPlaying}
        onTogglePlay={() => clock.toggle()}
        onResetFrame={() => clock.seek(0)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleAISidebar={() => setIsAISidebarOpen((open) => !open)}
        isAISidebarOpen={isAISidebarOpen}
        onOpenExport={() => setIsExportOpen(true)}
        onSaveJSON={handleSaveJSON}
        onLoadJSON={handleLoadJSON}
        onProjectNameChange={actions.renameProject}
        zoom={zoom}
        onZoomChange={setZoom}
        canUndo={studio.canUndo}
        canRedo={studio.canRedo}
        onUndo={studio.undo}
        onRedo={studio.redo}
        hasSelectedLayer={Boolean(studio.selectedLayerId)}
        onDeleteSelectedLayer={() => {
          if (studio.selectedLayerId) actions.deleteLayer(studio.selectedLayerId);
        }}
        activeMobileTab={mobileTab}
        onSelectMobileTab={setMobileTab}
      />

      <div className="relative flex flex-1 overflow-hidden">
        <div
          className={`h-full ${
            mobileTab === 'templates'
              ? 'absolute inset-0 z-20 block w-full bg-white sm:w-80'
              : 'hidden lg:block'
          }`}
        >
          <LeftSidebar
            icon={icon}
            onSelectTemplate={(template) => {
              actions.selectTemplate(template);
              setMobileTab('canvas');
            }}
            onUpdateFacing={actions.changeFacing}
            currentFacing={studio.facing}
            onAddShape={(shape) => {
              actions.addShape(shape);
              setMobileTab('canvas');
            }}
          />
        </div>

        <main
          aria-label="Sticker canvas workspace"
          className={`relative flex h-full flex-1 flex-col items-center justify-center overflow-hidden bg-[#f8fafc] ${
            mobileTab !== 'canvas' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <CanvasEditor
            icon={icon}
            palette={studio.palette}
            clock={clock}
            selectedLayerId={studio.selectedLayerId}
            onSelectLayer={studio.setSelectedLayerId}
            onUpdateLayerPosition={actions.moveLayerLive}
            onUpdateLayerRotation={actions.rotateLayerLive}
            onUpdateLayerScale={actions.scaleLayerLive}
            onBeginTransform={() => actions.beginTransform('Transform layer')}
            onEndTransform={() => actions.endTransform()}
            onTogglePlay={() => clock.toggle()}
            zoom={zoom}
            onZoomChange={setZoom}
          />
        </main>

        <div
          className={`h-full ${
            mobileTab === 'properties'
              ? 'absolute inset-0 z-20 block w-full bg-white sm:w-80'
              : 'hidden lg:block'
          }`}
        >
          <RightSidebar
            layers={icon.layers}
            palette={studio.palette}
            paletteId={studio.paletteId}
            selectedLayer={selectedLayer}
            onUpdateLayer={actions.updateLayer}
            onUpdateLayerShapeFill={actions.updateShapeFill}
            onUpdateLayerShapeDepth={actions.updateShapeDepth}
            onCreateGroup={actions.createGroup}
            onSetLayerGroup={actions.setLayerGroup}
            onApplyMotionToLayer={actions.applyMotion}
            onPaletteChange={actions.changePalette}
            onUpdatePaletteColor={actions.updatePaletteColor}
            outlineWidth={studio.outlineWidth}
            onUpdateOutlineWidth={actions.updateOutlineWidth}
          />
        </div>

        <AISidebar
          isOpen={isAISidebarOpen}
          onClose={() => setIsAISidebarOpen(false)}
          settings={aiSettings}
          onOpenSettings={() => setIsSettingsOpen(true)}
          icon={icon}
          palette={studio.palette}
          paletteId={studio.paletteId}
          facing={studio.facing}
          selectedLayerId={studio.selectedLayerId}
          onApplyActions={actions.applyAIActions}
        />
      </div>

      <Timeline
        layers={icon.layers}
        totalFrames={icon.frames || 180}
        clock={clock}
        selectedLayerId={studio.selectedLayerId}
        onSelectLayer={studio.setSelectedLayerId}
        onToggleHideLayer={toggleLayerHidden}
        onToggleLockLayer={toggleLayerLocked}
        onDeleteLayer={actions.deleteLayer}
        onUpdateLayerTiming={actions.updateLayerTiming}
        onMoveLayerIndex={actions.moveLayerIndex}
      />

      <SettingsModal
        key={isSettingsOpen ? 'settings-open' : 'settings-closed'}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={aiSettings}
        onSave={handleSaveAISettings}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        icon={icon}
        palette={studio.palette}
      />
    </div>
  );
}
