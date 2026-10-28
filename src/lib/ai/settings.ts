import { z } from 'zod';
import type { AISettings } from './types';

export const AI_SETTINGS_KEY = 'motion_track_ai_settings';

export const aiSettingsSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string(),
  model: z.string().min(1),
  transport: z.enum(['direct', 'relay']).default('direct'),
  relayConsent: z.boolean().default(false),
});

export const DEFAULT_AI_SETTINGS: AISettings = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  transport: 'direct',
  relayConsent: false,
};

/**
 * Reads AI settings from localStorage. Legacy settings (without transport fields)
 * are upgraded with safe defaults instead of being discarded.
 */
export function loadAISettings(): AISettings {
  if (typeof window === 'undefined') return DEFAULT_AI_SETTINGS;
  try {
    const raw = window.localStorage.getItem(AI_SETTINGS_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AISettings>;
    return aiSettingsSchema.parse({ ...DEFAULT_AI_SETTINGS, ...parsed });
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAISettings(settings: AISettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(aiSettingsSchema.parse(settings)));
  } catch {
    // Storage can be unavailable (private mode, quota). Settings stay in memory.
  }
}

/** Returns true when a relay request is allowed by the current consent state. */
export function canUseRelay(settings: AISettings): boolean {
  return settings.transport === 'relay' && settings.relayConsent;
}
