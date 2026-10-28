import { describe, expect, it } from 'vitest';
import { parseCompletion } from './parseCompletion';

const json = (body: unknown) => JSON.stringify(body);

describe('parseCompletion', () => {
  it('reads a non-streaming message', () => {
    const body = json({ choices: [{ message: { content: 'Hello there' } }] });
    expect(parseCompletion(body, 'application/json')).toBe('Hello there');
  });

  it('reads array content parts', () => {
    const body = json({
      choices: [{ message: { content: [{ type: 'text', text: 'Part A' }, { type: 'text', text: ' B' }] } }],
    });
    expect(parseCompletion(body, 'application/json')).toBe('Part A B');
  });

  it('concatenates SSE deltas', () => {
    const body = [
      'data: {"choices":[{"delta":{"role":"assistant"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":" world"}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    expect(parseCompletion(body, 'text/event-stream')).toBe('Hello world');
  });

  it('reads a single SSE event that already contains the full message', () => {
    const body = `data: {"choices":[{"message":{"content":"Complete"}}]}\n\ndata: [DONE]\n`;
    expect(parseCompletion(body, 'text/event-stream')).toBe('Complete');
  });

  it('detects SSE even when the provider mislabels it as JSON', () => {
    const body = 'data: {"choices":[{"message":{"content":"Still SSE"}}]}\n\ndata: [DONE]';
    expect(parseCompletion(body, 'application/json')).toBe('Still SSE');
  });

  it('accepts CRLF line endings and leading whitespace', () => {
    const body = '  data: {"choices":[{"message":{"content":"Windows"}}]}\r\n\r\ndata: [DONE]\r\n';
    expect(parseCompletion(body, 'text/event-stream')).toBe('Windows');
  });

  it('falls back to plain text', () => {
    expect(parseCompletion('Plain answer', 'text/plain')).toBe('Plain answer');
  });

  it('reports provider errors', () => {
    expect(() =>
      parseCompletion(json({ error: { message: 'Invalid API key' } }), 'application/json')
    ).toThrow('Invalid API key');
    expect(() => parseCompletion(json({ error: 'Rate limited' }), 'application/json')).toThrow(
      'Rate limited'
    );
    expect(() =>
      parseCompletion('data: {"error":{"message":"SSE failed"}}', 'text/event-stream')
    ).toThrow('SSE failed');
  });

  it('rejects empty responses and HTML pages', () => {
    expect(() => parseCompletion('', 'application/json')).toThrow(/empty response/);
    expect(() => parseCompletion('<!doctype html><html></html>', 'text/html')).toThrow(/HTML page/);
  });

  it('returns a placeholder when a 2xx body has no content', () => {
    expect(parseCompletion(json({ choices: [] }), 'application/json')).toMatch(/No response/);
    expect(parseCompletion('data: [DONE]', 'text/event-stream')).toMatch(/No response/);
  });
});
