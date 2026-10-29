import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Hosts that are allowed to receive relayed requests when no env override is set. */
export const DEFAULT_ALLOWED_HOSTS = [
  'api.openai.com',
  'api.anthropic.com',
  'openrouter.ai',
  'api.groq.com',
  'api.together.xyz',
  'api.mistral.ai',
  'api.deepseek.com',
  'api.x.ai',
  'api.perplexity.ai',
  'generativelanguage.googleapis.com',
  'api.cohere.ai',
  'api.fireworks.ai',
] as const;

export class ProxyGuardError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ProxyGuardError';
    this.status = status;
  }
}

interface IPv4Range {
  start: number;
  end: number;
  label: string;
}

const BLOCKED_IPV4: IPv4Range[] = [
  { start: 0x00000000, end: 0x00ffffff, label: 'this network' },
  { start: 0x0a000000, end: 0x0affffff, label: 'private' },
  { start: 0x64400000, end: 0x647fffff, label: 'carrier-grade NAT' },
  { start: 0x7f000000, end: 0x7fffffff, label: 'loopback' },
  { start: 0xa9fe0000, end: 0xa9feffff, label: 'link-local' },
  { start: 0xac100000, end: 0xac1fffff, label: 'private' },
  { start: 0xc0000000, end: 0xc00000ff, label: 'IETF protocol' },
  { start: 0xc0000200, end: 0xc00002ff, label: 'documentation' },
  { start: 0xc0a80000, end: 0xc0a8ffff, label: 'private' },
  { start: 0xc6120000, end: 0xc613ffff, label: 'benchmarking' },
  { start: 0xc6336400, end: 0xc63364ff, label: 'documentation' },
  { start: 0xcb007100, end: 0xcb0071ff, label: 'documentation' },
  { start: 0xe0000000, end: 0xffffffff, label: 'multicast/reserved' },
];

function ipv4ToInt(address: string): number | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << 8) | octet;
  }
  return value >>> 0;
}

export function isPrivateIPv4(address: string): boolean {
  const value = ipv4ToInt(address);
  if (value === null) return true;
  return BLOCKED_IPV4.some((range) => value >= range.start && value <= range.end);
}

function expandIPv6(address: string): number[] | null {
  const raw = address.toLowerCase().split('%')[0];
  if (raw.includes('.')) {
    // IPv4-mapped form, e.g. ::ffff:127.0.0.1
    const tail = raw.slice(raw.lastIndexOf(':') + 1);
    const v4 = ipv4ToInt(tail);
    if (v4 === null) return null;
    const prefix = raw.slice(0, raw.lastIndexOf(':') + 1);
    const groups = expandIPv6(`${prefix}0:0`); // reserve room for the mapped pair
    if (!groups) return null;
    return [
      ...groups.slice(0, 6),
      (v4 >>> 16) & 0xffff,
      v4 & 0xffff,
    ];
  }

  const [left, right] = raw.includes('::') ? raw.split('::') : [raw, ''];
  const leftGroups = left ? left.split(':').filter(Boolean) : [];
  const rightGroups = right ? right.split(':').filter(Boolean) : [];
  if (!raw.includes('::') && leftGroups.length !== 8) return null;
  if (leftGroups.length + rightGroups.length > 8) return null;

  const groups = [
    ...leftGroups.map((group) => parseInt(group, 16)),
    ...Array.from({ length: 8 - leftGroups.length - rightGroups.length }, () => 0),
    ...rightGroups.map((group) => parseInt(group, 16)),
  ];

  return groups.some((group) => Number.isNaN(group) || group < 0 || group > 0xffff) ? null : groups;
}

export function isPrivateIPv6(address: string): boolean {
  const groups = expandIPv6(address);
  if (!groups) return true;

  const allZero = groups.every((group) => group === 0);
  if (allZero) return true;

  const loopback = groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1;
  if (loopback) return true;

  // IPv4-mapped (::ffff:0:0/96)
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    const v4 = ((groups[6] << 16) | groups[7]) >>> 0;
    return BLOCKED_IPV4.some((range) => v4 >= range.start && v4 <= range.end);
  }

  const first = groups[0];
  // fc00::/7 unique local
  if ((first & 0xfe00) === 0xfc00) return true;
  // fe80::/10 link local
  if ((first & 0xffc0) === 0xfe80) return true;
  // ff00::/8 multicast
  if ((first & 0xff00) === 0xff00) return true;
  // 2001:db8::/32 documentation
  if (first === 0x2001 && groups[1] === 0x0db8) return true;

  return false;
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIPv4(address);
  if (version === 6) return isPrivateIPv6(address);
  return true;
}

const BLOCKED_HOST_SUFFIXES = ['.local', '.localhost', '.internal', '.home.arpa', '.lan'];

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  return BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export interface AllowlistOptions {
  /** `*` allows every public HTTPS host. Any other value is a comma-separated allowlist. */
  raw?: string;
}

export function parseAllowlist(raw: string | undefined): string[] | null {
  if (raw === undefined || raw.trim() === '' || raw.trim() === '*') return null;
  const entries = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (entries.includes('*')) return null;
  return entries.length > 0 ? entries : null;
}

export function isHostAllowed(hostname: string, allowlist: string[] | null): boolean {
  if (!allowlist) return true;
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return allowlist.some((entry) => {
    if (entry.startsWith('*.')) return host.endsWith(entry.slice(1)) || host === entry.slice(2);
    return host === entry;
  });
}

export interface EndpointOptions {
  /**
   * If false, rejects plain HTTP. Defaults to true (HTTP is allowed).
   */
  allowHttp?: boolean;
  /**
   * If false, rejects private IPs and localhost. Defaults to true (local/private endpoints allowed).
   */
  allowPrivate?: boolean;
}

/**
 * Synchronous URL validation: protocol, credentials, port, hostname shape,
 * and optional allowlist.
 */
export function assertSafeEndpoint(
  endpoint: string,
  allowlist: string[] | null = null,
  options: EndpointOptions = {}
): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new ProxyGuardError('Endpoint must be a valid URL.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ProxyGuardError('Only HTTP and HTTPS AI endpoints are allowed through the relay.');
  }
  if (url.protocol === 'http:' && options.allowHttp === false) {
    throw new ProxyGuardError(
      'Only HTTPS AI endpoints are allowed through the relay when HTTP is disabled.'
    );
  }
  if (url.username || url.password) {
    throw new ProxyGuardError('Endpoint URLs must not contain credentials.');
  }

  const defaultPort = url.protocol === 'http:' ? 80 : 443;
  const port = url.port ? Number(url.port) : defaultPort;
  if (!Number.isInteger(port) || (port < 1024 && port !== defaultPort) || port > 65535) {
    throw new ProxyGuardError(
      `Only the default ${url.protocol === 'http:' ? 'HTTP' : 'HTTPS'} port or ports above 1023 are allowed.`
    );
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (!hostname) {
    throw new ProxyGuardError('Endpoint host is required.');
  }

  if (options.allowPrivate === false) {
    if (isBlockedHostname(hostname)) {
      throw new ProxyGuardError('Endpoint host is not allowed.');
    }
    if (isIP(hostname) && isPrivateAddress(hostname)) {
      throw new ProxyGuardError('Endpoint resolves to a private or reserved address.');
    }
  }

  if (allowlist && !isHostAllowed(hostname, allowlist)) {
    throw new ProxyGuardError(
      'Endpoint host is not in AI_PROXY_ALLOWED_HOSTS. Add it to the server allowlist or use direct mode.'
    );
  }

  return url;
}

/** Resolves every A/AAAA record and rejects the endpoint if any target is private. */
export async function assertPublicResolution(url: URL): Promise<void> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) return;

  let records: Array<{ address: string }>;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ProxyGuardError('Endpoint host could not be resolved.', 502);
  }

  if (!records.length) {
    throw new ProxyGuardError('Endpoint host could not be resolved.', 502);
  }
  for (const record of records) {
    if (isPrivateAddress(record.address)) {
      throw new ProxyGuardError('Endpoint resolves to a private or reserved address.');
    }
  }
}

/**
 * Maps a failed upstream `fetch` to an actionable, sanitized message.
 *
 * The relay used to collapse every network failure into "Failed to reach the AI
 * provider.", which left the operator guessing between a down gateway, a typo in
 * the Base URL, a DNS problem, or a TLS error. This keeps the generic wording for
 * logs but appends the underlying cause code and a short, non-leaky hint.
 *
 * Only the error's `code`/`name` and a trimmed message are ever surfaced — never
 * request headers or the API key.
 */
export function describeFetchFailure(error: unknown, url: URL): string {
  const err = error as { cause?: { code?: string }; code?: string; name?: string; message?: string };
  const code = err?.cause?.code ?? err?.code ?? '';
  const isLoopback =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1' || url.hostname === '[::1]';

  switch (code) {
    case 'ECONNREFUSED':
      return isLoopback
        ? 'Failed to reach the AI provider: nothing is listening at the configured address. Start your local AI server or fix the Base URL in Settings.'
        : 'Failed to reach the AI provider: the connection was refused. Check the Base URL and that the provider is running.';
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'Failed to reach the AI provider: the host name could not be resolved. Check the Base URL in Settings.';
    case 'ETIMEDOUT':
    case 'UND_ERR_CONNECT_TIMEOUT':
    case 'UND_ERR_HEADERS_TIMEOUT':
    case 'UND_ERR_BODY_TIMEOUT':
      return 'Failed to reach the AI provider: the connection timed out. Check the network, the host, or switch to direct mode.';
    case 'CERT_HAS_EXPIRED':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
      return 'Failed to reach the AI provider: the TLS certificate was rejected. Use a valid certificate or a trusted endpoint.';
    case 'ECONNRESET':
      return 'Failed to reach the AI provider: the connection was reset. Try again, or check the provider.';
    default:
      break;
  }

  const detail = typeof err?.message === 'string' ? err.message.trim() : '';
  const reason = detail && detail !== 'fetch failed' ? detail : code || err?.name || 'network error';
  const safe = reason.replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***').replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***').slice(0, 200);
  return `Failed to reach the AI provider (${safe}). Check the Base URL, the host, and your network.`;
}
