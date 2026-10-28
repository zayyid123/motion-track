import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ALLOWED_HOSTS,
  assertSafeEndpoint,
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
    expect(parseAllowlist(undefined)).toEqual([...DEFAULT_ALLOWED_HOSTS]);
    expect(parseAllowlist('')).toEqual([...DEFAULT_ALLOWED_HOSTS]);
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

  it('rejects plain HTTP', () => {
    expect(() => assertSafeEndpoint('http://api.openai.com/v1', allowlist)).toThrow(/HTTPS/);
  });

  it('rejects credentials in the URL', () => {
    expect(() => assertSafeEndpoint('https://user:pass@api.openai.com/v1', allowlist)).toThrow(
      /credentials/
    );
  });

  it('rejects localhost and private IP literals', () => {
    expect(() => assertSafeEndpoint('https://localhost:8443/v1', null)).toThrow(/not allowed/);
    expect(() => assertSafeEndpoint('https://127.0.0.1/v1', null)).toThrow(/private|reserved/);
    expect(() => assertSafeEndpoint('https://[::1]/v1', null)).toThrow(/private|reserved/);
  });

  it('rejects hosts outside the allowlist', () => {
    expect(() => assertSafeEndpoint('https://evil.example.com/v1', allowlist)).toThrow(
      /AI_PROXY_ALLOWED_HOSTS/
    );
  });

  it('rejects privileged non-HTTPS ports but allows high ports', () => {
    expect(() => assertSafeEndpoint('https://api.openai.com:80/v1', allowlist)).toThrow(/port/);
    expect(assertSafeEndpoint('https://api.openai.com:8443/v1', allowlist).port).toBe('8443');
  });

  it('allows plain HTTP only as an explicit opt-in for an allowlisted host', () => {
    const privateGateway = ['43.157.204.35'];
    const endpoint = 'http://43.157.204.35:20128/v1/chat/completions';

    expect(() => assertSafeEndpoint(endpoint, privateGateway)).toThrow(/HTTPS/);
    expect(assertSafeEndpoint(endpoint, privateGateway, { allowHttp: true }).port).toBe('20128');
    expect(
      assertSafeEndpoint('http://api.example.com/v1', ['api.example.com'], { allowHttp: true }).protocol
    ).toBe('http:');
  });

  it('never enables plain HTTP through a wildcard allowlist', () => {
    expect(() =>
      assertSafeEndpoint('http://api.example.com/v1', null, { allowHttp: true })
    ).toThrow(/explicit host allowlist/);
  });

  it('still blocks private HTTP hosts even when HTTP is enabled', () => {
    expect(() =>
      assertSafeEndpoint('http://192.168.1.10:20128/v1', ['192.168.1.10'], { allowHttp: true })
    ).toThrow(/private|reserved/);
    expect(() =>
      assertSafeEndpoint('http://localhost:20128/v1', ['localhost'], { allowHttp: true })
    ).toThrow(/not allowed/);
  });

  it('rejects malformed URLs', () => {
    expect(() => assertSafeEndpoint('not a url', allowlist)).toThrow(/valid URL/);
  });
});
