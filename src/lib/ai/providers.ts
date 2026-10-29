/**
 * Provider presets for the AI Settings form.
 *
 * Motion-Track talks to any OpenAI-compatible chat endpoint, so nothing here is
 * required — the Base URL, API key and model stay free-form. These presets exist
 * only to remove the most common setup mistake (a typo in the Base URL) and to
 * prefill a sensible model for the popular public and local providers.
 *
 * `baseUrl` values never include the appended `/chat/completions`; the client
 * adds that itself (see `chatEndpoint` in `transport.ts`).
 */

export type ProviderKind = 'public' | 'local' | 'custom';

export interface ProviderPreset {
  /** Stable identifier persisted by the settings form. */
  id: string;
  /** Label shown in the dropdown. */
  label: string;
  kind: ProviderKind;
  /** Base URL prefilled when the preset is chosen. Empty for `custom`. */
  baseUrl: string;
  /** Suggested model prefilled when the preset is chosen. Empty for `custom`. */
  defaultModel: string;
  /** Model ids offered as one-click suggestions (free-form input stays possible). */
  models: string[];
  /** Local gateways usually ignore the API key, so the field is optional. */
  keyOptional?: boolean;
  /** Documentation link for getting an API key or running the server. */
  docs?: string;
}

export const CUSTOM_PROVIDER_ID = 'custom';

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'public',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini'],
    docs: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    kind: 'public',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-latest',
    models: [
      'claude-3-5-haiku-latest',
      'claude-3-5-sonnet-latest',
      'claude-sonnet-4-0',
      'claude-opus-4-0',
    ],
    docs: 'https://docs.anthropic.com/en/api/openai-sdk',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    kind: 'public',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    docs: 'https://ai.google.dev/gemini-api/docs/openai',
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'public',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ],
    docs: 'https://console.groq.com/keys',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'public',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    docs: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'public',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    models: [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-flash-1.5',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    docs: 'https://openrouter.ai/keys',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    kind: 'public',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-2-latest',
    models: ['grok-2-latest', 'grok-2-1212', 'grok-beta'],
    docs: 'https://docs.x.ai/docs/overview',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    kind: 'public',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    models: ['mistral-small-latest', 'mistral-large-latest', 'open-mistral-nemo'],
    docs: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'together',
    label: 'Together AI',
    kind: 'public',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    models: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
    ],
    docs: 'https://api.together.ai/settings/api-keys',
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    kind: 'public',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    models: [
      'accounts/fireworks/models/llama-v3p3-70b-instruct',
      'accounts/fireworks/models/qwen2p5-72b-instruct',
    ],
    docs: 'https://fireworks.ai/account/api-keys',
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    kind: 'public',
    baseUrl: 'https://api.perplexity.ai',
    defaultModel: 'sonar',
    models: ['sonar', 'sonar-pro', 'sonar-reasoning'],
    docs: 'https://docs.perplexity.ai/guides/getting-started',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    kind: 'local',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'qwen2.5', 'mistral', 'gemma2'],
    keyOptional: true,
    docs: 'https://github.com/ollama/ollama/blob/main/docs/openai.md',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    kind: 'local',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    models: ['local-model'],
    keyOptional: true,
    docs: 'https://lmstudio.ai/docs/app/api',
  },
  {
    id: CUSTOM_PROVIDER_ID,
    label: 'Custom / other',
    kind: 'custom',
    baseUrl: '',
    defaultModel: '',
    models: [],
  },
];

export const DEFAULT_PROVIDER_ID = 'openai';

export function findPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((preset) => preset.id === id);
}

/**
 * Guesses which preset a stored configuration came from by matching its base
 * URL (trailing slashes ignored). Returns the custom id when nothing matches, so
 * hand-written endpoints keep showing as "Custom / other".
 */
export function detectPresetId(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '').toLowerCase();
  if (!normalized) return CUSTOM_PROVIDER_ID;
  const match = PROVIDER_PRESETS.find(
    (preset) => preset.baseUrl && preset.baseUrl.toLowerCase() === normalized
  );
  return match?.id ?? CUSTOM_PROVIDER_ID;
}

export interface ProviderSelection {
  baseUrl: string;
  model: string;
}

/**
 * Computes the Base URL and model to apply when a preset is picked.
 *
 * Prefills empty or preset-owned values so switching providers works in one
 * click, but never overwrites a value the user typed by hand (custom endpoints,
 * fine-tuned model ids). `previousBaseUrl` is the value currently in the form.
 */
export function applyPreset(
  preset: ProviderPreset,
  previousBaseUrl: string,
  currentModel: string
): ProviderSelection {
  if (preset.kind === 'custom') {
    return { baseUrl: previousBaseUrl, model: currentModel };
  }
  const previousPreset = findPreset(detectPresetId(previousBaseUrl));
  const baseUrlWasPresetOwned = !previousBaseUrl.trim() || Boolean(previousPreset?.baseUrl);
  const modelWasPresetOwned = !currentModel.trim() || Boolean(previousPreset?.models.includes(currentModel));
  return {
    baseUrl: baseUrlWasPresetOwned ? preset.baseUrl : previousBaseUrl,
    model: modelWasPresetOwned ? preset.defaultModel : currentModel,
  };
}
