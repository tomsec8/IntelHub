/**
 * Shared allowlist for caller-supplied URLs fetched with the extension's
 * network context (header probe, DoH probe, redirect tracer).
 */

function parseIPv4(host) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
  const parts = host.split('.').map(Number);
  if (parts.some((n) => n > 255)) return null;
  return parts;
}

function isPrivateIPv4([a, b]) {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function isBlockedFetchHost(hostname) {
  const host = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
  if (!host) return true;
  if (host === 'localhost') return true;
  if (/\.(?:local|internal|localhost)$/.test(host)) return true;

  const v4 = parseIPv4(host);
  if (v4) return isPrivateIPv4(v4);

  const mapped = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) {
    const octets = parseIPv4(mapped[1]);
    return octets ? isPrivateIPv4(octets) : true;
  }

  if (host.includes(':')) {
    if (host === '::1') return true;
    if (/^fe80:/i.test(host)) return true;
    if (/^f[cd][0-9a-f]{2}:/i.test(host)) return true;
  }
  return false;
}

export function publicFetchUrl(raw) {
  let url;
  try {
    url = new URL(String(raw || ''));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  if (isBlockedFetchHost(url.hostname)) return null;
  return url.href;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function nextPublicUrl(current, location) {
  const loc = String(location || '').trim();
  if (!loc) return '';
  try {
    return publicFetchUrl(new URL(loc, current).href) || '';
  } catch {
    return '';
  }
}

// Follows redirects one hop at a time. A hop that is not public http(s) stops
// the request instead of being fetched with the extension's network access.
export async function fetchPublic(startUrl, { method = 'GET', headers, signal, maxHops = 8 } = {}) {
  let current = publicFetchUrl(startUrl);
  if (!current) return { ok: false, error: 'Unsupported URL' };
  const seen = new Set();

  for (let hop = 0; hop < maxHops; hop++) {
    if (seen.has(current)) return { ok: false, error: 'Redirect loop' };
    seen.add(current);

    let res;
    try {
      res = await fetch(current, {
        method,
        redirect: 'manual',
        cache: 'no-store',
        credentials: 'omit',
        headers,
        signal
      });
    } catch (err) {
      return { ok: false, error: err?.message || 'Fetch failed' };
    }

    if (res.type === 'opaqueredirect') {
      return { ok: false, error: 'Redirect target could not be verified' };
    }
    if (!REDIRECT_STATUSES.has(res.status)) {
      return { ok: true, response: res, url: current };
    }

    const next = nextPublicUrl(current, res.headers.get('Location'));
    if (!next) return { ok: false, error: 'Stopped — not a public http(s) address' };
    current = next;
  }

  return { ok: false, error: 'Too many redirects' };
}

// Manual redirects are often opaque, so Location cannot be checked hop by
// hop. Follow once, then keep the response only if the final URL is public.
export async function fetchPublicFinal(startUrl, { method = 'GET', headers, signal, maxHops = 8 } = {}) {
  const strict = await fetchPublic(startUrl, { method, headers, signal, maxHops });
  if (strict.ok || !/could not be verified/i.test(strict.error || '')) return strict;

  const start = publicFetchUrl(startUrl);
  if (!start) return { ok: false, error: 'Unsupported URL' };

  let res;
  try {
    res = await fetch(start, {
      method,
      redirect: 'follow',
      cache: 'no-store',
      credentials: 'omit',
      headers,
      signal
    });
  } catch (err) {
    return { ok: false, error: err?.message || 'Fetch failed' };
  }

  const landed = res.url || (res.type === 'basic' ? start : '');
  const finalUrl = publicFetchUrl(landed);
  if (!finalUrl) return { ok: false, error: 'Stopped — not a public http(s) address' };
  return { ok: true, response: res, url: finalUrl };
}
