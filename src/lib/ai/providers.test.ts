import { describe, expect, it } from 'vitest';
import {
  CUSTOM_PROVIDER_ID,
  DEFAULT_PROVIDER_ID,
  PROVIDER_PRESETS,
  applyPreset,
  detectPresetId,
  findPreset,
} from './providers';

describe('provider presets', () => {
  it('has unique ids and includes a custom option', () => {
    const ids = PROVIDER_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(CUSTOM_PROVIDER_ID);
    expect(ids).toContain(DEFAULT_PROVIDER_ID);
  });

  it('only the custom preset has an empty base URL', () => {
    for (const preset of PROVIDER_PRESETS) {
      if (preset.id === CUSTOM_PROVIDER_ID) {
        expect(preset.baseUrl).toBe('');
        continue;
      }
      expect(preset.baseUrl).toMatch(/^https?:\/\//);
      expect(preset.defaultModel).not.toBe('');
      expect(preset.models).toContain(preset.defaultModel);
    }
  });

  it('keeps base URLs free of the appended /chat/completions path', () => {
    for (const preset of PROVIDER_PRESETS) {
      expect(preset.baseUrl.endsWith('/chat/completions')).toBe(false);
    }
  });

  it('marks local providers as key-optional', () => {
    const local = PROVIDER_PRESETS.filter((preset) => preset.kind === 'local');
    expect(local.length).toBeGreaterThan(0);
    for (const preset of local) {
      expect(preset.keyOptional).toBe(true);
    }
  });
});

describe('detectPresetId', () => {
  it('matches a preset by base URL ignoring trailing slashes and case', () => {
    expect(detectPresetId('https://api.openai.com/v1/')).toBe('openai');
    expect(detectPresetId('HTTPS://API.OPENAI.COM/V1')).toBe('openai');
    expect(detectPresetId('http://localhost:11434/v1')).toBe('ollama');
  });

  it('falls back to custom for unknown or empty URLs', () => {
    expect(detectPresetId('')).toBe(CUSTOM_PROVIDER_ID);
    expect(detectPresetId('https://my-gateway.internal/v1')).toBe(CUSTOM_PROVIDER_ID);
  });
});

describe('applyPreset', () => {
  it('prefills base URL and model when the form is empty', () => {
    const preset = findPreset('groq')!;
    expect(applyPreset(preset, '', '')).toEqual({
      baseUrl: preset.baseUrl,
      model: preset.defaultModel,
    });
  });

  it('overwrites a value that belonged to another preset', () => {
    const openai = findPreset('openai')!;
    const groq = findPreset('groq')!;
    expect(applyPreset(groq, openai.baseUrl, openai.defaultModel)).toEqual({
      baseUrl: groq.baseUrl,
      model: groq.defaultModel,
    });
  });

  it('keeps a hand-typed base URL and model', () => {
    const groq = findPreset('groq')!;
    expect(applyPreset(groq, 'https://my-proxy.example/v1', 'my-fine-tuned')).toEqual({
      baseUrl: 'https://my-proxy.example/v1',
      model: 'my-fine-tuned',
    });
  });

  it('leaves the form unchanged for the custom preset', () => {
    const custom = findPreset(CUSTOM_PROVIDER_ID)!;
    expect(applyPreset(custom, 'https://x.example/v1', 'm')).toEqual({
      baseUrl: 'https://x.example/v1',
      model: 'm',
    });
  });
});
