const BASE = 'https://cavalier.hudsonrock.com/api/json/v2/osint-tools';

function blank(value) {
  const text = String(value ?? '').trim();
  if (!text || /^not found$/i.test(text)) return '';
  return text;
}

function listOf(value) {
  if (Array.isArray(value)) return value.map((item) => blank(item)).filter(Boolean);
  const text = blank(value);
  return text ? [text] : [];
}

export function classifyHudsonQuery(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (value.includes('@')) return { kind: 'email', value };
  const host = value.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim();
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(host)) {
    return { kind: 'domain', value: host.toLowerCase() };
  }
  return { kind: 'username', value: value.replace(/^@/, '') };
}

function packStealer(row) {
  return {
    date: blank(row?.date_compromised),
    computer: blank(row?.computer_name),
    os: blank(row?.operating_system),
    malwarePath: blank(row?.malware_path),
    ip: blank(row?.ip),
    antiviruses: listOf(row?.antiviruses),
    passwords: listOf(row?.top_passwords),
    logins: listOf(row?.top_logins),
    corporate: Number(row?.total_corporate_services) || 0,
    userServices: Number(row?.total_user_services) || 0
  };
}

export async function lookupHudsonRock(raw) {
  const ident = classifyHudsonQuery(raw);
  if (!ident) return { ok: false, reason: 'Enter an email, username, or domain.' };

  const path = ident.kind === 'email'
    ? 'search-by-email'
    : ident.kind === 'domain'
      ? 'search-by-domain'
      : 'search-by-username';
  const param = ident.kind === 'email' ? 'email' : ident.kind === 'domain' ? 'domain' : 'username';
  const url = `${BASE}/${path}?${param}=${encodeURIComponent(ident.value)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res;
  try {
    res = await fetch(url, { cache: 'no-store', signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') return { ok: false, reason: 'Hudson Rock timed out.', ident };
    return { ok: false, reason: err.message || 'Could not reach Hudson Rock.', ident };
  }
  clearTimeout(timer);

  if (res.status === 429) {
    return { ok: false, reason: 'Hudson Rock rate limit (about 50 requests per 10 seconds). Wait and try again.', ident };
  }
  if (res.status === 400) {
    return { ok: false, reason: 'Hudson Rock rejected this query. Check the email, username, or domain.', ident };
  }
  if (!res.ok) {
    return { ok: false, reason: `Hudson Rock returned HTTP ${res.status}.`, ident };
  }

  const json = await res.json().catch(() => ({}));
  const stealers = Array.isArray(json.stealers) ? json.stealers.map(packStealer) : [];
  return {
    ok: true,
    found: stealers.length > 0,
    ident,
    query: ident.value,
    message: blank(json.message),
    stealers,
    corporate: Number(json.total_corporate_services) || 0,
    userServices: Number(json.total_user_services) || 0
  };
}
