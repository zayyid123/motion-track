import { NextRequest, NextResponse } from 'next/server';
import {
  assertPublicResolution,
  assertSafeEndpoint,
  parseAllowlist,
  ProxyGuardError,
} from '@/lib/ai/proxyGuard';

const MAX_BODY_BYTES = 64 * 1024;
const UPSTREAM_TIMEOUT_MS = 30_000;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function checkRateLimit(key: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();

  if (rateBuckets.size > 5000) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
    }
  }

  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true };
  }
  if (bucket.count >= RATE_LIMIT) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}

function sanitize(message: string): string {
  return message
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***')
    .slice(0, 300);
}

function jsonError(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function POST(req: NextRequest) {
  const key = clientKey(req);
  const limit = checkRateLimit(key);
  if (!limit.ok) {
    return jsonError('Too many AI requests. Try again shortly.', 429, {
      'Retry-After': String(limit.retryAfter),
    });
  }

  const declaredLength = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonError('Request body is too large (64 KB limit).', 413);
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return jsonError('Could not read the request body.', 400);
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return jsonError('Request body is too large (64 KB limit).', 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError('Request body must be valid JSON.', 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonError('Request body must be a JSON object.', 400);
  }

  const { endpoint, apiKey, payload } = body as {
    endpoint?: unknown;
    apiKey?: unknown;
    payload?: unknown;
  };

  if (typeof endpoint !== 'string' || !endpoint.trim()) {
    return jsonError('An absolute endpoint URL is required.', 400);
  }
  if (apiKey !== undefined && typeof apiKey !== 'string') {
    return jsonError('apiKey must be a string when provided.', 400);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return jsonError('payload must be a JSON object.', 400);
  }

  const messages = (payload as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError('payload.messages must be a non-empty array.', 400);
  }
  if (messages.length > 50) {
    return jsonError('payload.messages is limited to 50 entries.', 400);
  }

  const rawAllowlist = process.env.AI_PROXY_ALLOWED_HOSTS;
  const allowlist = parseAllowlist(rawAllowlist);
  // HTTP is opt-in and only meaningful with an explicit host list. `*` does not
  // enable it; assertSafeEndpoint rejects a null allowlist for HTTP.
  const allowHttp = process.env.AI_PROXY_ALLOW_HTTP === '1' && Boolean(rawAllowlist?.trim());
  let url: URL;
  try {
    url = assertSafeEndpoint(endpoint, allowlist, { allowHttp });
    await assertPublicResolution(url);
  } catch (error) {
    if (error instanceof ProxyGuardError) {
      return jsonError(error.message, error.status);
    }
    return jsonError('Endpoint validation failed.', 400);
  }

  const streaming = Boolean((payload as { stream?: unknown }).stream);
  const controller = new AbortController();
  const timer = streaming ? null : setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const onClientAbort = () => controller.abort();
  req.signal.addEventListener('abort', onClientAbort, { once: true });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof apiKey === 'string' && apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      redirect: 'error',
      signal: controller.signal,
    });

    const contentType = upstream.headers.get('content-type') ?? 'application/json';

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      let message = `Upstream provider responded with HTTP ${upstream.status}.`;
      try {
        const parsed = JSON.parse(text) as { error?: unknown };
        const upstreamMessage =
          typeof parsed.error === 'string'
            ? parsed.error
            : parsed.error && typeof parsed.error === 'object' && 'message' in parsed.error
            ? String((parsed.error as { message?: unknown }).message ?? '')
            : '';
        if (upstreamMessage) message = sanitize(upstreamMessage);
      } catch {
        if (text) message = sanitize(text);
      }
      return jsonError(message, upstream.status >= 500 ? 502 : upstream.status);
    }

    if (contentType.includes('text/event-stream')) {
      return new Response(upstream.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    if (contentType.includes('application/json')) {
      const data = (await upstream.json()) as unknown;
      return NextResponse.json(data);
    }

    const text = await upstream.text();
    return new NextResponse(text, {
      status: 200,
      headers: { 'Content-Type': contentType },
    });
  } catch (error) {
    if (controller.signal.aborted) {
      if (req.signal.aborted) return jsonError('Request cancelled by the client.', 499);
      return jsonError('The AI provider did not respond within 30 seconds.', 504);
    }
    const message = error instanceof Error ? error.message : 'Unknown relay error';
    // Never log request headers or the API key.
    console.error('[ai-proxy] upstream request failed:', sanitize(message));
    return jsonError('Failed to reach the AI provider.', 502);
  } finally {
    if (timer) clearTimeout(timer);
    req.signal.removeEventListener('abort', onClientAbort);
  }
}

export function GET() {
  return jsonError('Use POST for AI relay requests.', 405);
}
