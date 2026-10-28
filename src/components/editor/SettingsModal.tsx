'use client';

import React, { useState } from 'react';
import { Cpu, Globe, Key, ShieldCheck } from 'lucide-react';
import type { AISettings, AITransport } from '@/lib/ai/types';
import { Modal } from '@/components/ui/Modal';

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

  const relayBlocked = form.transport === 'relay' && !form.relayConsent;
  const insecureBaseUrl = /^http:\/\//i.test(form.baseUrl.trim());

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (relayBlocked) return;
    onSave({
      ...form,
      baseUrl: form.baseUrl.trim().replace(/\/+$/, ''),
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
    });
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="AI Connection Settings"
      icon={
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ff6b35] font-bold text-white">
          AI
        </div>
      }
      maxWidth="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="ai-settings-form"
            disabled={relayBlocked}
            className="rounded-xl bg-slate-900 px-5 py-2 font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save settings
          </button>
        </div>
      }
    >
      <form id="ai-settings-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="font-sans text-xs font-medium leading-relaxed text-slate-700">
          Connect any OpenAI-compatible chat endpoint. Direct mode keeps your key in this browser.
          Relay mode sends the key through this app&apos;s server and requires explicit consent.
        </p>

        <div>
          <label htmlFor="ai-base-url" className="mb-1 flex items-center gap-1.5 font-bold text-slate-900">
            <Globe className="h-3.5 w-3.5 text-blue-600" />
            <span>Base URL</span>
          </label>
          <input
            id="ai-base-url"
            type="url"
            required
            value={form.baseUrl}
            onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
            placeholder="https://api.openai.com/v1"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-semibold text-slate-900 placeholder:text-slate-500 focus:border-[#ff6b35] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b35]/30"
          />
          <span className="mt-1 block text-[11px] font-medium text-slate-500">
            The client appends <code>/chat/completions</code>. Example: https://api.openai.com/v1
          </span>
          {insecureBaseUrl ? (
            <span
              role="alert"
              className="mt-1.5 block rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-900"
            >
              This endpoint uses plain HTTP. Browsers usually block it through CORS, and the relay
              only accepts it when the server sets <code>AI_PROXY_ALLOW_HTTP=1</code> plus an
              explicit <code>AI_PROXY_ALLOWED_HOSTS</code> entry. The API key would travel
              unencrypted.
            </span>
          ) : null}
        </div>

        <div>
          <label htmlFor="ai-api-key" className="mb-1 flex items-center gap-1.5 font-bold text-slate-900">
            <Key className="h-3.5 w-3.5 text-blue-600" />
            <span>API key</span>
          </label>
          <input
            id="ai-api-key"
            type="password"
            autoComplete="off"
            value={form.apiKey}
            onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
            placeholder="sk-proj-..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-semibold text-slate-900 placeholder:text-slate-500 focus:border-[#ff6b35] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b35]/30"
          />
          <span className="mt-1 block text-[11px] font-medium text-slate-500">
            Stored in <code>localStorage</code> on this device only.
          </span>
        </div>

        <div>
          <label htmlFor="ai-model" className="mb-1 flex items-center gap-1.5 font-bold text-slate-900">
            <Cpu className="h-3.5 w-3.5 text-blue-600" />
            <span>Model</span>
          </label>
          <input
            id="ai-model"
            type="text"
            required
            value={form.model}
            onChange={(event) => setForm({ ...form, model: event.target.value })}
            placeholder="gpt-4o-mini"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-semibold text-slate-900 placeholder:text-slate-500 focus:border-[#ff6b35] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b35]/30"
          />
        </div>

        <fieldset>
          <legend className="mb-1.5 flex items-center gap-1.5 font-bold text-slate-900">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
            <span>Transport</span>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'direct', title: 'Direct', detail: 'Browser → provider' },
                { id: 'relay', title: 'Server relay', detail: 'Browser → this app → provider' },
              ] as Array<{ id: AITransport; title: string; detail: string }>
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={form.transport === option.id}
                onClick={() => setForm({ ...form, transport: option.id })}
                className={`rounded-xl border p-2.5 text-left transition ${
                  form.transport === option.id
                    ? 'border-[#ff6b35] bg-orange-50 text-orange-900'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="text-[11px] font-bold">{option.title}</div>
                <div className="text-[10px] leading-tight opacity-75">{option.detail}</div>
              </button>
            ))}
          </div>

          <label
            className={`mt-2 flex items-start gap-2 rounded-xl border p-2.5 text-[11px] leading-relaxed transition ${
              form.transport === 'relay'
                ? 'border-amber-300 bg-amber-50 text-amber-950'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            <input
              type="checkbox"
              checked={form.relayConsent}
              disabled={form.transport !== 'relay'}
              onChange={(event) => setForm({ ...form, relayConsent: event.target.checked })}
              className="mt-0.5 h-3.5 w-3.5 accent-[#ff6b35] disabled:opacity-40"
            />
            <span>
              I allow this app&apos;s server to forward my API key to the selected provider host.
              The relay only accepts HTTPS hosts on the server allowlist.
            </span>
          </label>
          {relayBlocked ? (
            <p role="alert" className="mt-1.5 text-[11px] font-semibold text-red-700">
              Grant consent or switch to direct mode to save.
            </p>
          ) : null}
        </fieldset>
      </form>
    </Modal>
  );
};
