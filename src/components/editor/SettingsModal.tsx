'use client';

import React, { useState } from 'react';
import { Cpu, Globe, Key, Loader2, PlugZap, ShieldCheck } from 'lucide-react';
import type { AISettings, AITransport } from '@/lib/ai/types';
import { testConnection } from '@/lib/ai/transport';
import type { ConnectionTestResult } from '@/lib/ai/transport';
import {
  CUSTOM_PROVIDER_ID,
  PROVIDER_PRESETS,
  applyPreset,
  detectPresetId,
  findPreset,
} from '@/lib/ai/providers';
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
  const [providerId, setProviderId] = useState<string>(detectPresetId(settings.baseUrl));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const relayBlocked = form.transport === 'relay' && !form.relayConsent;
  const insecureBaseUrl = /^http:\/\//i.test(form.baseUrl.trim());
  const preset = findPreset(providerId);
  const keyOptional = Boolean(preset?.keyOptional);

  /** Any manual edit means the form no longer matches a preset. */
  const updateForm = (patch: Partial<AISettings>) => {
    setForm((current) => ({ ...current, ...patch }));
    setTestResult(null);
  };

  const handleProviderChange = (id: string) => {
    setProviderId(id);
    const next = findPreset(id);
    if (!next) return;
    const { baseUrl, model } = applyPreset(next, form.baseUrl, form.model);
    updateForm({ baseUrl, model });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testConnection(form));
    } finally {
      setTesting(false);
    }
  };

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
          Connect any OpenAI-compatible chat endpoint. Pick a preset to fill the Base URL and model,
          or choose <strong>Custom / other</strong> and enter them yourself. Direct mode keeps your
          key in this browser; relay mode sends it through this app&apos;s server and requires consent.
        </p>

        <div>
          <label htmlFor="ai-provider" className="mb-1 flex items-center gap-1.5 font-bold text-slate-900">
            <PlugZap className="h-3.5 w-3.5 text-blue-600" />
            <span>Provider</span>
          </label>
          <select
            id="ai-provider"
            value={providerId}
            onChange={(event) => handleProviderChange(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-semibold text-slate-900 focus:border-[#ff6b35] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b35]/30"
          >
            {PROVIDER_PRESETS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="mt-1 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
            <span>
              {preset && preset.kind !== 'custom'
                ? 'Base URL and model prefill; you can still edit them.'
                : 'Enter any OpenAI-compatible Base URL, key and model.'}
            </span>
            {preset?.docs ? (
              <a
                href={preset.docs}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 font-semibold text-[#ff6b35] hover:underline"
              >
                Get a key
              </a>
            ) : null}
          </span>
        </div>

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
            onChange={(event) => {
              setProviderId((current) =>
                current === CUSTOM_PROVIDER_ID ? current : detectPresetId(event.target.value)
              );
              updateForm({ baseUrl: event.target.value });
            }}
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
              This endpoint uses plain HTTP. Browsers usually block direct requests through CORS;
              the relay can forward to it, but the API key travels unencrypted between server and host.
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
            onChange={(event) => updateForm({ apiKey: event.target.value })}
            placeholder={keyOptional ? 'not required for local gateways' : 'sk-proj-...'}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-semibold text-slate-900 placeholder:text-slate-500 focus:border-[#ff6b35] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b35]/30"
          />
          <span className="mt-1 block text-[11px] font-medium text-slate-500">
            {keyOptional
              ? 'This provider runs locally and usually ignores the key — any value works.'
              : 'Stored in localStorage on this device only.'}
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
            list="ai-model-suggestions"
            value={form.model}
            onChange={(event) => updateForm({ model: event.target.value })}
            placeholder="gpt-4o-mini"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-semibold text-slate-900 placeholder:text-slate-500 focus:border-[#ff6b35] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b35]/30"
          />
          <datalist id="ai-model-suggestions">
            {(preset?.models ?? []).map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
          {preset && preset.models.length > 1 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {preset.models.map((model) => (
                <button
                  key={model}
                  type="button"
                  onClick={() => updateForm({ model })}
                  className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition ${
                    form.model === model
                      ? 'border-[#ff6b35] bg-orange-50 text-orange-900'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {model}
                </button>
              ))}
            </div>
          ) : null}
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
                onClick={() => updateForm({ transport: option.id })}
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
              onChange={(event) => updateForm({ relayConsent: event.target.checked })}
              className="mt-0.5 h-3.5 w-3.5 accent-[#ff6b35] disabled:opacity-40"
            />
            <span>
              I allow this app&apos;s server to forward my API key to the selected provider host.
            </span>
          </label>
          {relayBlocked ? (
            <p role="alert" className="mt-1.5 text-[11px] font-semibold text-red-700">
              Grant consent or switch to direct mode to save.
            </p>
          ) : null}
        </fieldset>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-900">Diagnostics</span>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlugZap className="h-3.5 w-3.5" />
              )}
              {testing ? 'Testing…' : 'Test connection'}
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Sends one tiny request with the values above — before you save — and reports the result.
          </p>
          {testResult ? (
            <div
              role="status"
              className={`mt-2 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed ${
                testResult.ok
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-red-300 bg-red-50 text-red-900'
              }`}
            >
              {testResult.ok ? (
                <>
                  <strong>Connected</strong> in {testResult.latencyMs} ms
                  {testResult.model ? ` using ${testResult.model}` : ''}.
                  {testResult.detail ? (
                    <div className="mt-0.5 opacity-80">Reply: {testResult.detail}</div>
                  ) : null}
                </>
              ) : (
                <>
                  <strong>Failed</strong>
                  {testResult.status ? ` (HTTP ${testResult.status})` : ''}: {testResult.error}
                </>
              )}
            </div>
          ) : null}
        </div>
      </form>
    </Modal>
  );
};
