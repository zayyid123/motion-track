# AI transport and relay

Motion-Track talks to any OpenAI-compatible chat endpoint. Two transports are
available, and the safe one is the default.

## Direct mode (default)

```text
browser ──HTTPS──► provider
```

- The API key is read from `localStorage` key `motion_track_ai_settings` and
  sent only to the provider host.
- The client appends `/chat/completions` to the configured base URL.
- The request has a 60 s timeout and supports user cancellation.
- The key never reaches this app's server.
- The trade-off is CORS: the provider must allow browser origins. If it does
  not, the UI suggests switching to relay.

## Relay mode (opt-in)

```text
browser ──► /api/ai-proxy ──HTTPS──► provider
```

Relay mode is only used when **both** conditions hold:

1. `transport === 'relay'` in settings.
2. `relayConsent === true`, granted by checking the consent box in AI Settings.

`canUseRelay()` enforces this in the client, and the settings form refuses to
save relay mode without consent. The consent text states plainly that the key is
forwarded through this app's server.

### Request shape

```json
{
  "endpoint": "https://api.openai.com/v1/chat/completions",
  "apiKey": "sk-...",
  "payload": {
    "model": "gpt-4o-mini",
    "messages": [],
    "temperature": 0.7,
    "stream": false
  }
}
```

The client explicitly asks for `stream: false`. If a gateway streams SSE anyway
(or mislabels it as JSON), `src/lib/ai/parseCompletion.ts` detects `data:` lines,
concatenates `delta.content` chunks, and stops at `[DONE]`. JSON, SSE, and plain
text bodies are all accepted.

`payload.messages` must be a non-empty array of at most 50 entries. The route
does not otherwise interpret the payload, which keeps it provider-agnostic.

## Project actions from chat

The assistant is not read-only. The system prompt asks for one JSON object:

```json
{
  "reply": "Rotated the body and switched to the matcha palette.",
  "actions": [
    { "type": "update_layer", "layerId": "body", "rotation": 15 },
    { "type": "set_palette", "paletteId": "matcha" }
  ]
}
```

- `reply` is rendered as the chat answer.
- `actions` are validated by `src/lib/ai/actions.ts` (zod discriminated union).
  Valid actions are grouped into one transactional history entry, so a single
  undo reverts the whole batch.
- Invalid actions, unknown layer ids, unknown palettes, and unknown motion
  presets are skipped and listed under the message. The rest of the batch still
  applies.
- Supported actions: `update_layer`, `add_layer`, `delete_layer`,
  `select_layer`, `set_palette`, `set_palette_color`, `set_outline`,
  `set_facing`, `rename_project`.
- Models that ignore the format and answer in prose keep working: the parser
  treats the text as a normal reply with no actions. It also accepts fenced
  JSON blocks and a bare array of action objects.
- The prompt instructs the model to emit actions only when the user explicitly
  asks for a change, so advice questions do not edit the project.

Relay mode and direct mode share this flow; the relay only forwards the request.

## Hardening

Implemented in `src/app/api/ai-proxy/route.ts` and the pure helpers in
`src/lib/ai/proxyGuard.ts`.

### Endpoint validation

- HTTPS by default. Plain HTTP is rejected unless the server explicitly opts in
  with `AI_PROXY_ALLOW_HTTP=1` **and** the host is in an explicit
  `AI_PROXY_ALLOWED_HOSTS` list (see below).
- No embedded credentials (`https://user:pass@host`).
- Port must be the protocol default (443/80) or ≥ 1024.
- Hostnames ending in `.local`, `.localhost`, `.internal`, `.home.arpa`, or
  `.lan` are rejected, as is `localhost`.
- IP literals and every resolved A/AAAA record are checked against private,
  loopback, link-local, carrier-grade NAT, multicast, and documentation ranges.
- DNS is resolved with `lookup(..., { all: true })`; if **any** record is
  private, the request is rejected. This blocks DNS rebinding to internal
  addresses.
- `redirect: 'error'` prevents an allowlisted host from redirecting to an
  internal target.
- An optional host allowlist is applied after the address checks.

### Host allowlist

`AI_PROXY_ALLOWED_HOSTS` is a comma-separated list. Wildcards are supported on
the left-most label.

```bash
# .env.local
AI_PROXY_ALLOWED_HOSTS="api.openai.com,api.groq.com,*.example.com"
```

- Unset or empty → a curated default list: OpenAI, Anthropic, OpenRouter, Groq,
  Together, Mistral, DeepSeek, xAI, Perplexity, Google Generative Language,
  Cohere, and Fireworks.
- `*` → disables the host allowlist. It does **not** disable HTTPS, port,
  hostname-suffix, or private-address checks.

### Plain HTTP (opt-in)

Some self-hosted OpenAI-compatible gateways only expose plain HTTP, and browsers
block them with CORS. The relay can forward to them, but only when both settings
are present:

```bash
AI_PROXY_ALLOWED_HOSTS="43.157.204.35"
AI_PROXY_ALLOW_HTTP=1
```

- `AI_PROXY_ALLOWED_HOSTS` must be explicit; `*` never enables HTTP.
- Private, loopback, link-local, and internal hostnames remain blocked.
- Credentials in the URL, invalid ports, and redirects remain blocked.
- The API key and response travel **unencrypted** between the server and that
  host. Use this only for a gateway you control, on a trusted network, and
  prefer HTTPS whenever the provider supports it.

Restart the dev/production server after changing either variable.

### Limits

| Limit | Value |
| --- | --- |
| Request body | 64 KB (declared and actual) |
| Messages per request | 50 |
| Upstream timeout | 30 s for non-streaming |
| Rate limit | 20 requests per minute per client IP |
| Payload shape | JSON object with a non-empty `messages` array |

Streaming responses (`text/event-stream`) are passed through unbuffered with
`Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no`, and are not
subject to the 30 s timer because the stream can legitimately run longer.

### Key handling

- The key is forwarded only in the `Authorization: Bearer` header.
- It is never logged. Upstream errors are sanitized: `sk-…` tokens and
  `Bearer …` values are redacted and messages are truncated to 300 characters.
- Browser console logs contain only the sanitized upstream failure reason.

## Deployment caveats

- **Rate limiting is per instance.** The bucket map lives in module memory, so
  serverless platforms with multiple instances effectively multiply the limit.
  For strict global limits, move the bucket to Redis/Upstash or an edge KV.
- **DNS checks require a Node runtime.** The route uses `node:dns/promises` and
  `node:net`. It was written for the Node.js runtime; edge runtimes do not
  provide those modules.
- **Resolution is time-of-check.** The fetch uses the hostname, so a determined
  attacker with control of DNS could still race the check. The allowlist is the
  primary control for production; keep it narrow rather than using `*`.
- **Cold starts** add latency to the first relayed request.
- **Streaming through proxies** requires the deployment platform to allow
  long-lived responses; some serverless tiers cap function duration.
- **Compliance.** Relaying a user's key means the deployment operator can, in
  principle, observe it. Only enable relay on deployments you control, and say
  so in your privacy notice.

## Testing

`src/lib/ai/proxyGuard.test.ts` covers private IPv4/IPv6 detection, hostname
suffix blocking, wildcard allowlists, protocol/port/credential rules, and
malformed URLs. The transport and prompt builders are covered by
`src/lib/ai/prompt.test.ts`; the route itself is exercised manually because it
requires a live upstream.
