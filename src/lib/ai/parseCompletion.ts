/**
 * Parser for OpenAI-compatible completion responses.
 *
 * Some self-hosted gateways stream SSE (`data: {...}`) even when the request did
 * not ask for streaming, and a few mislabel the response as JSON. Keeping the
 * parser independent of fetch makes both behaviors testable.
 */

type ContentPart = string | Array<{ type?: string; text?: string }>;

interface CompletionChoice {
  message?: { content?: ContentPart };
  delta?: { content?: ContentPart };
  text?: string;
}

export interface CompletionResponse {
  choices?: CompletionChoice[];
  error?: { message?: string } | string;
}

const EMPTY = 'No response received from the AI model.';

function extractContent(value: ContentPart | undefined): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.map((part) => (part?.type === 'text' ? part.text ?? '' : '')).join('');
}

export function extractText(data: CompletionResponse): string {
  const choice = data.choices?.[0];
  return (
    extractContent(choice?.delta?.content) ||
    extractContent(choice?.message?.content) ||
    (typeof choice?.text === 'string' ? choice.text : '')
  );
}

export function errorMessage(data: CompletionResponse): string {
  if (typeof data.error === 'string') return data.error;
  return data.error?.message ?? '';
}

function parseSse(raw: string): string {
  let text = '';
  let lastError = '';

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('data:')) continue;

    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;

    let parsed: CompletionResponse;
    try {
      parsed = JSON.parse(payload) as CompletionResponse;
    } catch {
      // Ignore keep-alive comments and non-JSON events.
      continue;
    }

    const piece = extractText(parsed);
    if (piece) text += piece;

    const error = errorMessage(parsed);
    if (error) lastError = error;
  }

  if (text.trim()) return text.trim();
  if (lastError) throw new Error(lastError);
  return EMPTY;
}

/**
 * Parses a successful (2xx) completion body. Accepts plain JSON, SSE, and plain
 * text. Throws only when the provider reports an error or returns nothing.
 */
export function parseCompletion(raw: string, contentType = ''): string {
  const looksLikeSse =
    contentType.includes('text/event-stream') || /(^|\r?\n)\s*data:/.test(raw);
  if (looksLikeSse) return parseSse(raw);

  const trimmed = raw.trim();
  if (!trimmed) throw new Error('The AI provider returned an empty response.');

  try {
    const parsed = JSON.parse(trimmed) as CompletionResponse;
    const text = extractText(parsed).trim();
    if (text) return text;

    const error = errorMessage(parsed);
    if (error) throw new Error(error);
    return EMPTY;
  } catch (error) {
    if (error instanceof SyntaxError) {
      if (trimmed.startsWith('<')) {
        throw new Error(
          'The AI provider returned an HTML page instead of JSON. Check the Base URL and endpoint authentication.'
        );
      }
      // A few gateways reply with raw text; surface it rather than a parse error.
      return trimmed.slice(0, 4000);
    }
    throw error;
  }
}
