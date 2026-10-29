import type { Icon, Palette } from '@/lib/funIsometric/fun';
import { buildChatPayload } from './prompt';
import type { AIContext } from './prompt';
import { errorMessage, parseCompletion } from './parseCompletion';
import type { CompletionResponse } from './parseCompletion';
import { canUseRelay } from './settings';
import type { AISettings, ChatMessage } from './types';

const JOIN_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 20_000;

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/, '');

export const chatEndpoint = (baseUrl: string): string => `${normalizeBaseUrl(baseUrl)}/chat/completions`;

async function readError(response: Response): Promise<string> {
  const body = await response.text().catch(() => '');
  if (!body) return `Provider responded with HTTP ${response.status}.`;
  try {
    const parsed = JSON.parse(body) as CompletionResponse;
    const message = errorMessage(parsed);
    if (message) return message;
  } catch {
    // Fall through to the truncated body.
  }
  return body.slice(0, 240);
}

/**
 * Sends one chat turn.
 *
 * Direct mode calls the provider straight from the browser and keeps the key in
 * this tab. Relay mode is opt-in and requires explicit consent because it sends
 * the key through this app's server.
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  userPrompt: string,
  settings: AISettings,
  context?: AIContext,
  signal?: AbortSignal,
  userImage?: string
): Promise<string> {
  if (!settings.apiKey.trim()) {
    throw new Error('Add an API key in Settings before using the assistant.');
  }
  if (settings.transport === 'relay' && !canUseRelay(settings)) {
    throw new Error(
      'Server relay is selected but consent is not granted. Enable "Allow relay" in Settings or switch to direct mode.'
    );
  }

  const endpoint = chatEndpoint(settings.baseUrl);
  const payload = buildChatPayload(settings.model, messages, userPrompt, context, userImage);
  const relay = settings.transport === 'relay';

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), JOIN_TIMEOUT_MS);
  const abort = () => timeout.abort();
  signal?.addEventListener('abort', abort, { once: true });

  try {
    const response = await fetch(relay ? '/api/ai-proxy' : endpoint, {
      method: 'POST',
      headers: relay
        ? { 'Content-Type': 'application/json' }
        : {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.apiKey.trim()}`,
          },
      body: JSON.stringify(
        relay ? { endpoint, apiKey: settings.apiKey.trim(), payload } : payload
      ),
      signal: timeout.signal,
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${await readError(response)}`);
    }

    const raw = await response.text();
    return parseCompletion(raw, response.headers.get('content-type') ?? '');
  } catch (error) {
    if (timeout.signal.aborted) {
      throw new Error(
        signal?.aborted ? 'Request cancelled.' : 'The AI request timed out after 60 seconds.'
      );
    }
    if (error instanceof TypeError) {
      // Browsers hide the real cause of a network failure, so point at the usual
      // ones: a wrong Base URL, CORS on the provider, or an http:// gateway being
      // blocked by mixed content when the studio is served over https.
      throw new Error(
        'Could not reach the AI endpoint. Check the Base URL, the provider CORS policy, or use the server relay in Settings. If you are on an https:// page and your endpoint is http:// (a local gateway), the browser blocks it — switch to relay mode.'
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export interface ConnectionTestResult {
  ok: boolean;
  /** Round-trip time in milliseconds for the test request. */
  latencyMs: number;
  /** Model echoed back by the provider, when it does. */
  model?: string;
  /** Short confirmation or the model's reply. */
  detail?: string;
  /** Human-readable reason on failure. */
  error?: string;
  /** HTTP status when the provider answered with a non-2xx. */
  status?: number;
}

/** Test prompt is tiny so the request is cheap and fast on every provider. */
const TEST_PROMPT = 'Reply with the single word: OK';

/**
 * Sends one minimal chat request to verify the configured endpoint, key and
 * model. It never throws: the outcome is always a {@link ConnectionTestResult}
 * so the settings UI can render a clear pass/fail panel.
 *
 * Mirrors `sendChatMessage`'s transport handling, but with a shorter timeout and
 * a cheaper payload (small `max_tokens`, no system prompt, no history).
 */
export async function testConnection(
  settings: AISettings,
  signal?: AbortSignal
): Promise<ConnectionTestResult> {
  const baseUrl = settings.baseUrl.trim();
  const apiKey = settings.apiKey.trim();
  const model = settings.model.trim();

  if (!baseUrl) {
    return { ok: false, latencyMs: 0, error: 'Add a Base URL before testing.' };
  }
  if (!model) {
    return { ok: false, latencyMs: 0, error: 'Add a model name before testing.' };
  }

  const relay = settings.transport === 'relay';
  if (relay && !canUseRelay(settings)) {
    return {
      ok: false,
      latencyMs: 0,
      error: 'Server relay is selected but consent is not granted. Enable "Allow relay" or switch to direct mode.',
    };
  }
  if (!relay && !apiKey) {
    return {
      ok: false,
      latencyMs: 0,
      error: 'Add an API key before testing (local gateways often accept any value).',
    };
  }

  const endpoint = chatEndpoint(baseUrl);
  const payload = {
    model,
    messages: [{ role: 'user', content: TEST_PROMPT }],
    max_tokens: 8,
    temperature: 0,
    stream: false,
  };

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TEST_TIMEOUT_MS);
  const abort = () => timeout.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const startedAt = Date.now();

  try {
    const response = await fetch(relay ? '/api/ai-proxy' : endpoint, {
      method: 'POST',
      headers: relay
        ? { 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(relay ? { endpoint, apiKey, payload } : payload),
      signal: timeout.signal,
    });

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        ok: false,
        latencyMs,
        status: response.status,
        error: `${describeStatus(response.status)} (HTTP ${response.status}). ${await readError(response)}`.trim(),
      };
    }

    const raw = await response.text();
    const text = parseCompletion(raw, response.headers.get('content-type') ?? '');
    return {
      ok: true,
      latencyMs,
      model,
      detail: text.trim().slice(0, 80) || 'Connected, but the model returned an empty reply.',
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    if (timeout.signal.aborted) {
      return {
        ok: false,
        latencyMs,
        error: signal?.aborted
          ? 'Test cancelled.'
          : `No response within ${TEST_TIMEOUT_MS / 1000} seconds. The endpoint may be unreachable or the model is still loading.`,
      };
    }
    if (error instanceof TypeError) {
      return {
        ok: false,
        latencyMs,
        error:
          'Could not reach the endpoint. Check the Base URL, the provider CORS policy, or use the server relay. An http:// gateway is blocked from an https:// page (mixed content) — switch to relay mode.',
      };
    }
    return { ok: false, latencyMs, error: error instanceof Error ? error.message : 'Unknown error.' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

/** Maps a failed test status to a short, actionable label. */
function describeStatus(status: number): string {
  if (status === 401 || status === 403) return 'Authentication failed — check the API key.';
  if (status === 404) return 'Endpoint or model not found — check the Base URL and model name.';
  if (status === 429) return 'Rate limited — the key is valid but is being throttled.';
  if (status >= 500) return 'The provider had a server error.';
  return 'The provider rejected the request.';
}

export type { AIContext };
export type { Icon, Palette };
