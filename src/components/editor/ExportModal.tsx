'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, Film, Loader2, Sparkles, TriangleAlert } from 'lucide-react';
import type { Icon, Palette } from '@/lib/funIsometric/fun';
import {
  ExportCancelledError,
  exportGIF,
  exportMOV,
  exportMP4,
  planLoop,
} from '@/lib/export';
import type { ExportFormat, ExportProgress, ExportResult } from '@/lib/export';
import { Modal } from '@/components/ui/Modal';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  icon: Icon;
  palette: Palette;
  initialSpeed?: number;
}

const FORMATS: Array<{ id: ExportFormat; label: string; detail: string }> = [
  {
    id: 'gif',
    label: 'GIF',
    detail: 'Lightweight loop for chat apps and docs. Requires an opaque or custom background.',
  },
  {
    id: 'mp4',
    label: 'MP4',
    detail: 'H.264 video for web and social media. Requires an opaque or custom background.',
  },
  {
    id: 'mov',
    label: 'MOV',
    detail: 'ProRes 4444 video for editors. Preserves transparent alpha or uses custom background.',
  },
];

const RESOLUTIONS = [
  { value: 500, label: '500', hint: 'SD' },
  { value: 720, label: '720', hint: 'HD' },
  { value: 1080, label: '1080', hint: 'Full HD' },
  { value: 1440, label: '1440', hint: '2K' },
];

const FPS_OPTIONS = [24, 30, 60];

const SPEED_OPTIONS: Array<{ value: number; label: string; hint: string }> = [
  { value: 0.5, label: '0.5x', hint: 'Half' },
  { value: 1, label: '1x', hint: 'Normal' },
  { value: 1.5, label: '1.5x', hint: 'Fast' },
  { value: 2, label: '2x', hint: 'Double' },
];

const BACKGROUND_PRESETS: Array<{ id: string; value: string | null; label: string; swatch: string }> = [
  {
    id: 'transparent',
    value: null,
    label: 'Transparent',
    swatch:
      'bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%),linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%)] bg-[length:8px_8px] bg-[position:0_0,4px_4px]',
  },
  { id: 'white', value: '#ffffff', label: 'White', swatch: 'bg-white' },
  { id: 'dark', value: '#0f172a', label: 'Dark', swatch: 'bg-slate-900' },
  { id: 'orange', value: '#ff6b35', label: 'Orange', swatch: 'bg-[#ff6b35]' },
];

const QUICK_COLORS = [
  { hex: '#f8fafc', label: 'Light Slate' },
  { hex: '#6366f1', label: 'Indigo' },
  { hex: '#0ea5e9', label: 'Sky' },
  { hex: '#10b981', label: 'Emerald' },
  { hex: '#f59e0b', label: 'Amber' },
  { hex: '#f43f5e', label: 'Rose' },
  { hex: '#1e293b', label: 'Charcoal' },
];

const stageLabel = (stage: ExportProgress['stage']): string => {
  if (stage === 'rendering') return 'Rendering frames';
  if (stage === 'encoding') return 'Encoding';
  return 'Finishing';
};

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  icon,
  palette,
  initialSpeed = 1,
}) => {
  const [format, setFormat] = useState<ExportFormat>('mp4');
  const [resolution, setResolution] = useState(1080);
  const [fps, setFps] = useState(30);
  const [exportSpeed, setExportSpeed] = useState<number>(initialSpeed);
  const [backgroundId, setBackgroundId] = useState<string>('white');
  const [customColor, setCustomColor] = useState<string>('#6366f1');
  const [hexInput, setHexInput] = useState<string>('6366F1');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress>({
    stage: 'rendering',
    progress: 0,
  });
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const background = useMemo(() => {
    // MP4 and GIF cannot be transparent
    if (format !== 'mov' && backgroundId === 'transparent') {
      return '#ffffff';
    }
    if (backgroundId === 'transparent') {
      return null;
    }
    if (backgroundId === 'custom') {
      return customColor;
    }
    return BACKGROUND_PRESETS.find((entry) => entry.id === backgroundId)?.value ?? '#ffffff';
  }, [format, backgroundId, customColor]);

  const totalFrames = icon.frames || 180;
  // Every export is padded with whole animation cycles to reach a minimum
  // duration, so the footer reflects the frames that are actually encoded.
  const plan = useMemo(() => planLoop(totalFrames, fps, exportSpeed), [totalFrames, fps, exportSpeed]);

  // Object URLs must be revoked when replaced or when the modal unmounts.
  useEffect(() => {
    if (!result) return;
    const url = result.url;
    return () => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [result]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const resetResult = () => {
    setResult(null);
    setError(null);
    setProgress({ stage: 'rendering', progress: 0 });
  };

  const handleStart = async () => {
    if (isExporting) return;
    resetResult();
    setIsExporting(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const onProgress = (next: ExportProgress) => setProgress(next);

    try {
      const args = [icon, palette, resolution, resolution, fps, background, onProgress, controller.signal, exportSpeed] as const;
      const output =
        format === 'gif'
          ? await exportGIF(...args)
          : format === 'mp4'
          ? await exportMP4(...args)
          : await exportMOV(...args);
      setResult(output);
    } catch (err) {
      if (err instanceof ExportCancelledError) {
        setError('Export cancelled. No file was created.');
      } else {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'string' && err.trim().length > 0
            ? err
            : 'Export failed. Try a lower resolution.';
        setError(message);
      }
    } finally {
      abortRef.current = null;
      setIsExporting(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleClose = () => {
    if (isExporting) abortRef.current?.abort();
    onClose();
  };

  const handleFormatChange = (newFormat: ExportFormat) => {
    setFormat(newFormat);
    resetResult();
    if (newFormat !== 'mov' && backgroundId === 'transparent') {
      setBackgroundId('white');
    }
  };

  const handleHexChange = (val: string) => {
    const raw = val.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    setHexInput(raw.toUpperCase());
    if (raw.length === 6 || raw.length === 3) {
      const fullHex =
        raw.length === 3
          ? `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
          : `#${raw}`;
      setCustomColor(fullHex.toLowerCase());
      setBackgroundId('custom');
      resetResult();
    }
  };

  const handleColorPickerChange = (color: string) => {
    setCustomColor(color);
    setHexInput(color.replace(/^#/, '').toUpperCase());
    setBackgroundId('custom');
    resetResult();
  };

  const selectedFormat = FORMATS.find((entry) => entry.id === format)!;

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Export Animated Sticker"
      icon={
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ff6b35] font-bold text-white">
          <Film className="h-4 w-4" />
        </div>
      }
      maxWidth="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="hidden text-[10px] font-mono text-slate-500 sm:block">
            {plan.totalSeconds.toFixed(2)}s loop · {plan.frames.length} frames at {fps} fps (
            {exportSpeed}x · {plan.cycleCount} cycle{plan.cycleCount > 1 ? 's' : ''})
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-slate-600 transition hover:bg-slate-50"
            >
              Close
            </button>
            {isExporting ? (
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 font-semibold text-red-700 transition hover:bg-red-100"
              >
                Cancel export
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                className="flex items-center gap-1.5 rounded-xl bg-[#ff6b35] px-5 py-2 font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-[#e85926]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Render .{format.toUpperCase()}
              </button>
            )}
          </div>
        </div>
      }
    >
      <p id="export-note" className="mb-4 font-sans text-[11px] leading-relaxed text-slate-500">
        The render captures the full seamless loop without editor UI. Transparent alpha is only
        supported in MOV (ProRes 4444). MP4 and GIF require an opaque or custom background.
      </p>

      <div className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 block font-semibold text-slate-700">Animation format</legend>
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={format === entry.id}
                onClick={() => handleFormatChange(entry.id)}
                className={`rounded-xl border px-3 py-2 text-center font-bold uppercase transition ${
                  format === entry.id
                    ? 'border-[#ff6b35] bg-orange-50 text-orange-700 shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                .{entry.id}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{selectedFormat.detail}</p>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 block font-semibold text-slate-800">Output resolution</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {RESOLUTIONS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                aria-pressed={resolution === entry.value}
                onClick={() => {
                  setResolution(entry.value);
                  resetResult();
                }}
                className={`rounded-xl border py-2 text-center transition ${
                  resolution === entry.value
                    ? 'border-slate-900 bg-slate-900 font-bold text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="text-[11px] font-bold">{entry.label}px</div>
                <div className="text-[9px] opacity-75">{entry.hint}</div>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 block font-semibold text-slate-800">Frame rate</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {FPS_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={fps === value}
                onClick={() => {
                  setFps(value);
                  resetResult();
                }}
                className={`rounded-xl border py-2 transition ${
                  fps === value
                    ? 'border-slate-900 bg-slate-900 font-bold text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {value} fps
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 block font-semibold text-slate-800">Animation speed</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {SPEED_OPTIONS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                aria-pressed={exportSpeed === entry.value}
                onClick={() => {
                  setExportSpeed(entry.value);
                  resetResult();
                }}
                className={`rounded-xl border py-2 text-center transition ${
                  exportSpeed === entry.value
                    ? 'border-slate-900 bg-slate-900 font-bold text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="text-[11px] font-bold">{entry.label}</div>
                <div className="text-[9px] opacity-75">{entry.hint}</div>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <div className="mb-1.5 flex items-center justify-between">
            <legend className="font-semibold text-slate-800">Background</legend>
            {format !== 'mov' ? (
              <span className="text-[10px] font-medium text-amber-600">
                Transparent only available for MOV
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {/* Transparent option: only enabled when format is MOV */}
            <button
              type="button"
              disabled={format !== 'mov'}
              aria-pressed={backgroundId === 'transparent'}
              onClick={() => {
                setBackgroundId('transparent');
                resetResult();
              }}
              title={
                format !== 'mov'
                  ? 'Transparent background is only available for MOV (ProRes 4444)'
                  : 'Transparent background'
              }
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-[10px] transition ${
                format !== 'mov'
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100/70 text-slate-400 opacity-50'
                  : backgroundId === 'transparent'
                  ? 'border-[#ff6b35] bg-orange-50 font-bold text-orange-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="h-4 w-4 shrink-0 rounded border border-slate-300 bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%),linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%)] bg-[length:8px_8px] bg-[position:0_0,4px_4px]" />
              <span className="truncate">Transparent</span>
            </button>

            {/* Presets: White, Dark, Orange */}
            {BACKGROUND_PRESETS.filter((p) => p.id !== 'transparent').map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={backgroundId === entry.id}
                onClick={() => {
                  setBackgroundId(entry.id);
                  resetResult();
                }}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-[10px] transition ${
                  backgroundId === entry.id
                    ? 'border-[#ff6b35] bg-orange-50 font-bold text-orange-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className={`h-4 w-4 shrink-0 rounded border border-slate-300 ${entry.swatch}`} />
                <span className="truncate">{entry.label}</span>
              </button>
            ))}

            {/* Custom Option */}
            <button
              type="button"
              aria-pressed={backgroundId === 'custom'}
              onClick={() => {
                setBackgroundId('custom');
                resetResult();
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-[10px] transition ${
                backgroundId === 'custom'
                  ? 'border-[#ff6b35] bg-orange-50 font-bold text-orange-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span
                className="h-4 w-4 shrink-0 rounded border border-slate-300 shadow-xs"
                style={{ backgroundColor: customColor }}
              />
              <span className="truncate">Custom</span>
            </button>
          </div>

          {/* Custom color picker & hex input panel */}
          {backgroundId === 'custom' && (
            <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label
                    className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-slate-300 shadow-xs transition hover:scale-105"
                    style={{ backgroundColor: customColor }}
                    title="Click to open color picker"
                  >
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => handleColorPickerChange(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                  <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-[11px] text-slate-800 shadow-xs focus-within:border-[#ff6b35] focus-within:ring-1 focus-within:ring-[#ff6b35]">
                    <span className="text-slate-400">#</span>
                    <input
                      type="text"
                      maxLength={6}
                      value={hexInput}
                      onChange={(e) => handleHexChange(e.target.value)}
                      placeholder="6366F1"
                      className="w-16 uppercase outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {QUICK_COLORS.map((qc) => (
                    <button
                      key={qc.hex}
                      type="button"
                      title={qc.label}
                      onClick={() => handleColorPickerChange(qc.hex)}
                      style={{ backgroundColor: qc.hex }}
                      className={`h-5 w-5 rounded-full border transition hover:scale-110 ${
                        customColor.toLowerCase() === qc.hex.toLowerCase()
                          ? 'border-slate-900 ring-2 ring-slate-900/30'
                          : 'border-slate-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </fieldset>

        {isExporting && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex justify-between text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ff6b35]" />
                {stageLabel(progress.stage)}
              </span>
              <span aria-live="polite">{progress.progress}%</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.progress}
              aria-label="Export progress"
            >
              <div
                className="h-full bg-[#ff6b35] transition-all duration-150"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            <p className="truncate text-[10px] text-slate-500">{progress.detail ?? 'Preparing…'}</p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] leading-relaxed text-red-800"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="truncate">{result.filename}</span>
              </div>
              <a
                href={result.url}
                download={result.filename}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </div>
            {result.note ? (
              <p className="text-[10px] leading-relaxed text-emerald-800/80">{result.note}</p>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
};
