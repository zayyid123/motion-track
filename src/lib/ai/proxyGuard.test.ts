import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ALLOWED_HOSTS,
  assertSafeEndpoint,
  describeFetchFailure,
  isBlockedHostname,
  isHostAllowed,
  isPrivateAddress,
  parseAllowlist,
} from './proxyGuard';

describe('private address detection', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '0.0.0.0',
    '224.0.0.1',
  ])('blocks IPv4 %s', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34'])('allows public IPv4 %s', (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });

  it.each(['::1', '::', 'fd00::1', 'fe80::1', '::ffff:192.168.0.1'])(
    'blocks IPv6 %s',
    (address) => {
      expect(isPrivateAddress(address)).toBe(true);
    }
  );

  it.each(['2001:4860:4860::8888', '::ffff:8.8.8.8', '2606:4700:4700::1111'])(
    'allows public IPv6 %s',
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    }
  );

  it('treats garbage as unsafe', () => {
    expect(isPrivateAddress('not-an-ip')).toBe(true);
  });
});

describe('host rules', () => {
  it('blocks local hostnames and private suffixes', () => {
    expect(isBlockedHostname('localhost')).toBe(true);
    expect(isBlockedHostname('api.localhost')).toBe(true);
    expect(isBlockedHostname('printer.local')).toBe(true);
    expect(isBlockedHostname('metadata.internal')).toBe(true);
    expect(isBlockedHostname('api.openai.com')).toBe(false);
  });

  it('supports exact and wildcard allowlists', () => {
    expect(isHostAllowed('api.openai.com', ['api.openai.com'])).toBe(true);
    expect(isHostAllowed('api.openai.com', ['*.openai.com'])).toBe(true);
    expect(isHostAllowed('api.openai.com', ['api.example.com'])).toBe(false);
    expect(isHostAllowed('anything.example', null)).toBe(true);
  });

  it('parses env allowlists', () => {
    expect(parseAllowlist(undefined)).toBeNull();
    expect(parseAllowlist('')).toBeNull();
    expect(parseAllowlist('*')).toBeNull();
    expect(parseAllowlist('api.example.com, *.example.org')).toEqual([
      'api.example.com',
      '*.example.org',
    ]);
  });
});

describe('assertSafeEndpoint', () => {
  const allowlist = [...DEFAULT_ALLOWED_HOSTS];

  it('accepts an allowlisted HTTPS endpoint', () => {
    const url = assertSafeEndpoint('https://api.openai.com/v1/chat/completions', allowlist);
    expect(url.hostname).toBe('api.openai.com');
  });

  it('accepts any public or custom HTTPS endpoint when allowlist is null', () => {
    const url = assertSafeEndpoint('https://custom-ai.example.com/v1/chat/completions', null);
    expect(url.hostname).toBe('custom-ai.example.com');
  });

  it('allows plain HTTP by default', () => {
    expect(assertSafeEndpoint('http://api.openai.com/v1').protocol).toBe('http:');
    expect(assertSafeEndpoint('http://43.157.204.35:20128/v1').port).toBe('20128');
  });

  it('rejects plain HTTP when allowHttp is false', () => {
    expect(() =>
      assertSafeEndpoint('http://api.openai.com/v1', allowlist, { allowHttp: false })
    ).toThrow(/HTTPS/);
  });

  it('rejects credentials in the URL', () => {
    expect(() => assertSafeEndpoint('https://user:pass@api.openai.com/v1', allowlist)).toThrow(
      /credentials/
    );
  });

  it('allows localhost and private IP literals by default for local AI instances', () => {
    expect(assertSafeEndpoint('http://localhost:11434/v1').hostname).toBe('localhost');
    expect(assertSafeEndpoint('http://127.0.0.1:11434/v1').hostname).toBe('127.0.0.1');
    expect(assertSafeEndpoint('http://192.168.1.10:20128/v1').hostname).toBe('192.168.1.10');
  });

  it('rejects localhost and private IP literals when allowPrivate is false', () => {
    expect(() =>
      assertSafeEndpoint('https://localhost:8443/v1', null, { allowPrivate: false })
    ).toThrow(/not allowed/);
    expect(() =>
      assertSafeEndpoint('https://127.0.0.1/v1', null, { allowPrivate: false })
    ).toThrow(/private|reserved/);
    expect(() =>
      assertSafeEndpoint('https://[::1]/v1', null, { allowPrivate: false })
    ).toThrow(/private|reserved/);
  });

  it('rejects hosts outside the allowlist when an explicit allowlist is provided', () => {
    expect(() => assertSafeEndpoint('https://evil.example.com/v1', allowlist)).toThrow(
      /AI_PROXY_ALLOWED_HOSTS/
    );
  });

  it('rejects privileged non-HTTPS ports but allows high ports', () => {
    expect(() => assertSafeEndpoint('https://api.openai.com:80/v1', allowlist)).toThrow(/port/);
    expect(assertSafeEndpoint('https://api.openai.com:8443/v1', allowlist).port).toBe('8443');
  });

  it('rejects malformed URLs', () => {
    expect(() => assertSafeEndpoint('not a url', allowlist)).toThrow(/valid URL/);
  });
});

describe('describeFetchFailure', () => {
  const url = new URL('https://api.example.com/v1/chat/completions');

  const failure = (code: string) => Object.assign(new TypeError('fetch failed'), { cause: { code } });

  it('names a refused connection on a loopback endpoint as a local gateway problem', () => {
    const local = new URL('http://localhost:1234/v1/chat/completions');
    expect(describeFetchFailure(failure('ECONNREFUSED'), local)).toMatch(/nothing is listening at the configured address/);
  });

  it('names a refused connection on a remote endpoint generically', () => {
    expect(describeFetchFailure(failure('ECONNREFUSED'), url)).toMatch(/connection was refused/);
  });

  it('names DNS and timeout failures', () => {
    expect(describeFetchFailure(failure('ENOTFOUND'), url)).toMatch(/could not be resolved/);
    expect(describeFetchFailure(failure('EAI_AGAIN'), url)).toMatch(/could not be resolved/);
    expect(describeFetchFailure(failure('ETIMEDOUT'), url)).toMatch(/timed out/);
    expect(describeFetchFailure(failure('UND_ERR_CONNECT_TIMEOUT'), url)).toMatch(/timed out/);
  });

  it('names TLS certificate failures', () => {
    expect(describeFetchFailure(failure('CERT_HAS_EXPIRED'), url)).toMatch(/certificate was rejected/);
  });

  it('falls back to the underlying message for unknown causes', () => {
    const err = Object.assign(new TypeError('fetch failed'), { cause: { code: 'EAI_AGAIN' } });
    const out = describeFetchFailure(err, url);
    expect(out).toMatch(/^Failed to reach the AI provider/);
  });

  it('never leaks an API key from the underlying message', () => {
    const err = Object.assign(new TypeError('fetch failed'), {
      cause: { code: 'EHOSTUNREACH' },
      message: 'sk-abcdefghijklmnop rejected',
    });
    const out = describeFetchFailure(err, url);
    expect(out).not.toContain('sk-abcdefghijklmnop');
    expect(out).toContain('sk-***');
  });
});
