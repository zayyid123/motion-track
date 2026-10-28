'use client';

import React, { useState } from 'react';
import { X, Film, Sparkles, Loader2, CheckCircle, Download } from 'lucide-react';
import { Icon, Palette } from '@/lib/funIsometric';
import { exportGIF, exportVideo, ExportProgress } from '@/lib/exporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  icon: Icon;
  palette: Palette;
}

type ExportFormat = 'gif' | 'mp4' | 'mov';

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  icon,
  palette,
}) => {
  const [format, setFormat] = useState<ExportFormat>('mp4');
  const [resolution, setResolution] = useState<number>(1080); // Default Full HD 1080p
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setIsExporting(true);
    setProgress({ stage: 'rendering', progress: 5 });
    setDownloadUrl(null);

    try {
      if (format === 'gif') {
        const gifBase64 = await exportGIF(icon, palette, resolution, resolution, (p) => {
          setProgress(p);
        });
        setDownloadUrl(gifBase64);
      } else {
        const videoBlob = await exportVideo(
          icon,
          palette,
          format,
          resolution,
          resolution,
          (p) => {
            setProgress(p);
          }
        );
        const url = URL.createObjectURL(videoBlob);
        setDownloadUrl(url);
      }
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor stiker animasi.');
    } finally {
      setIsExporting(false);
    }
  };

  const getFilename = () => {
    const cleanName = (icon.name || 'sticker').toLowerCase().replace(/\s+/g, '-');
    return `${cleanName}.${format}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden font-mono text-xs">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#ff6b35] text-white flex items-center justify-center font-bold">
              <Film className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-800">Export Animated Sticker</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-slate-500 text-[11px] font-sans leading-relaxed">
            Pilih format video animasi yang diinginkan. Hasil ekspor merender animasi loop stiker isometrik bersih tanpa elemen editor.
          </p>

          {/* Format Selection */}
          <div>
            <label className="text-slate-700 font-semibold mb-1.5 block">Format Animasi</label>
            <div className="grid grid-cols-3 gap-2">
              {(['gif', 'mp4', 'mov'] as ExportFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => {
                    setFormat(fmt);
                    setDownloadUrl(null);
                  }}
                  className={`py-2 px-3 rounded-xl border text-center font-bold uppercase transition ${
                    format === fmt
                      ? 'bg-orange-50 border-[#ff6b35] text-orange-700 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  .{fmt}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">
              {format === 'gif' && 'GIF: Animasi loop ringan dengan transparansi web.'}
              {format === 'mp4' && 'MP4: Kompatibilitas tinggi (H.264) untuk sosmed & web.'}
              {format === 'mov' && 'MOV: QuickTime format untuk software editing video pro.'}
            </div>
          </div>

          {/* Resolution Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-800 font-semibold block">Resolusi Kualitas Tinggi</label>
              <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded">
                Crisp 60 FPS Engine
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { res: 500, label: 'SD (500p)' },
                { res: 720, label: 'HD (720p)' },
                { res: 1080, label: 'FHD (1080p)' },
                { res: 1440, label: '2K QHD' },
              ].map(({ res, label }) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => setResolution(res)}
                  className={`py-2 px-1 rounded-xl border text-center transition ${
                    resolution === res
                      ? 'bg-slate-900 border-slate-900 text-white font-bold shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold text-[11px]">{res}px</div>
                  <div className="text-[9px] opacity-75">{label.split(' ')[0]}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Progress or Download CTA */}
          {isExporting && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff6b35]" />
                  {progress?.stage === 'rendering' ? 'Merender Frame...' : 'Mengompres Animasi...'}
                </span>
                <span>{progress?.progress || 0}%</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#ff6b35] h-full transition-all duration-150"
                  style={{ width: `${progress?.progress || 0}%` }}
                />
              </div>
            </div>
          )}

          {downloadUrl && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 text-[11px] font-semibold">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Animasi Siap Diunduh!</span>
              </div>
              <a
                href={downloadUrl}
                download={getFilename()}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 text-[11px] shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Tutup
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={handleStartExport}
              className="px-5 py-2 rounded-xl bg-[#ff6b35] hover:bg-[#e85926] text-white font-semibold flex items-center gap-1.5 shadow-sm shadow-orange-200 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Memproses...' : `Render .${format.toUpperCase()}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
