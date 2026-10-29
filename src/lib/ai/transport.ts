import type { Icon, Palette } from '@/lib/funIsometric/fun';
import { buildChatPayload } from './prompt';
import type { AIContext } from './prompt';
import { errorMessage, parseCompletion } from './parseCompletion';
import type { CompletionResponse } from './parseCompletion';
import { canUseRelay } from './settings';
import type { AISettings, ChatMessage } from './types';

const JOIN_TIMEOUT_MS = 60_000;

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
      throw new Error(
        'Could not reach the AI endpoint. Check the Base URL, CORS policy, or switch to server relay in Settings.'
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export type { AIContext };
export type { Icon, Palette };
