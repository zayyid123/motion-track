'use client';

import React, { useState } from 'react';
import { X, Key, Globe, Cpu, Check } from 'lucide-react';
import { AISettings } from '@/types/sticker';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (newSettings: AISettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [form, setForm] = useState<AISettings>(settings);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden font-mono text-xs">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#ff6b35] text-white flex items-center justify-center font-bold">
              AI
            </div>
            <h3 className="font-bold text-sm text-slate-800">AI Connection Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-slate-700 text-xs font-sans leading-relaxed font-medium">
            Hubungkan AI kustom dengan memasukkan <strong>Base URL</strong> dan <strong>API Key</strong> (kompatibel dengan format OpenAI). Kunci hanya tersimpan di browser Anda (<code>localStorage</code>).
          </p>

          <div>
            <label className="flex items-center gap-1.5 text-slate-900 font-bold mb-1">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>AI Base URL</span>
            </label>
            <input
              type="url"
              required
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-slate-50 text-slate-900 font-semibold placeholder:text-slate-500"
            />
            <span className="text-[11px] text-slate-600 font-medium block mt-1">
              Contoh: https://api.openai.com/v1 atau proxy AI Anda.
            </span>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-slate-900 font-bold mb-1">
              <Key className="w-3.5 h-3.5 text-blue-600" />
              <span>API Key</span>
            </label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-proj-..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-slate-50 text-slate-900 font-semibold placeholder:text-slate-500"
            />
            <span className="text-[11px] text-slate-600 font-medium block mt-1">
              Disimpan aman secara lokal di browser perangkat Anda.
            </span>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-slate-900 font-bold mb-1">
              <Cpu className="w-3.5 h-3.5 text-blue-600" />
              <span>Model Name</span>
            </label>
            <input
              type="text"
              required
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="gpt-4o-mini"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#ff6b35] focus:outline-none bg-slate-50 text-slate-900 font-semibold placeholder:text-slate-500"
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-1.5 shadow-sm"
            >
              {savedNotice ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Tersimpan!
                </>
              ) : (
                'Simpan Pengaturan'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
