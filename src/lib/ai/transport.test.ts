import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatEndpoint, testConnection } from './transport';
import { DEFAULT_AI_SETTINGS } from './settings';
import type { AISettings } from './types';

const baseSettings: AISettings = {
  ...DEFAULT_AI_SETTINGS,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  transport: 'direct',
};

const completion = (content: string) =>
  JSON.stringify({ choices: [{ message: { content } }] });

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(impl(typeof input === 'string' ? input : input.toString(), init))
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chatEndpoint', () => {
  it('appends /chat/completions and trims trailing slashes', () => {
    expect(chatEndpoint('https://api.openai.com/v1/')).toBe(
      'https://api.openai.com/v1/chat/completions'
    );
  });
});

describe('testConnection', () => {
  it('reports success with latency and the model reply', async () => {
    const fetchMock = mockFetch(() =>
      new Response(completion('OK'), { status: 200, headers: { 'content-type': 'application/json' } })
    );

    const result = await testConnection(baseSettings);

    expect(result.ok).toBe(true);
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.detail).toContain('OK');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(String(init?.body));
    expect(body.max_tokens).toBe(8);
    expect(body.stream).toBe(false);
  });

  it('validates required fields before calling fetch', async () => {
    const fetchMock = mockFetch(() => new Response(completion('OK')));

    expect((await testConnection({ ...baseSettings, baseUrl: '' })).error).toMatch(/Base URL/);
    expect((await testConnection({ ...baseSettings, model: '' })).error).toMatch(/model/);
    expect((await testConnection({ ...baseSettings, apiKey: '' })).error).toMatch(/API key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires some key value even for a local gateway', async () => {
    const fetchMock = mockFetch(() => new Response(completion('OK'), { status: 200 }));
    const result = await testConnection({
      ...baseSettings,
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/API key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts any placeholder key value for a local gateway', async () => {
    mockFetch(() => new Response(completion('OK'), { status: 200 }));
    const result = await testConnection({
      ...baseSettings,
      apiKey: 'local',
      baseUrl: 'http://localhost:11434/v1',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects relay mode without consent', async () => {
    const fetchMock = mockFetch(() => new Response(completion('OK')));
    const result = await testConnection({
      ...baseSettings,
      transport: 'relay',
      relayConsent: false,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/consent/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a 401 to an authentication hint', async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 })
    );
    const result = await testConnection(baseSettings);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toMatch(/Authentication failed/);
    expect(result.error).toContain('Invalid API key');
  });

  it('maps a 404 to a Base URL / model hint', async () => {
    mockFetch(() => new Response('{}', { status: 404 }));
    const result = await testConnection(baseSettings);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
  });

  it('explains a browser-level network failure', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    const result = await testConnection(baseSettings);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Could not reach the endpoint/);
  });

  it('sends relayed requests through the app proxy without exposing the key in headers', async () => {
    const fetchMock = mockFetch(() => new Response(completion('OK'), { status: 200 }));
    const result = await testConnection({
      ...baseSettings,
      transport: 'relay',
      relayConsent: true,
    });
    expect(result.ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai-proxy');
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
    const body = JSON.parse(String(init?.body));
    expect(body.apiKey).toBe('sk-test');
    expect(body.endpoint).toBe('https://api.openai.com/v1/chat/completions');
  });
});
