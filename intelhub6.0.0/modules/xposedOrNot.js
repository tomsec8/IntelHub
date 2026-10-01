const STORAGE_KEY = 'xonDailyQuota';
const DAILY_LIMIT = 100;
const ANALYTICS_URL = 'https://api.xposedornot.com/v1/breach-analytics';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function withLimit(record) {
  return {
    date: record?.date || todayKey(),
    used: Number(record?.used) || 0,
    limit: DAILY_LIMIT
  };
}

export async function getXonQuota() {
  const data = await chrome.storage.local.get({ [STORAGE_KEY]: null });
  const rec = data[STORAGE_KEY];
  if (!rec || rec.date !== todayKey()) return withLimit({ date: todayKey(), used: 0 });
  return withLimit(rec);
}

async function markUsed() {
  const current = await getXonQuota();
  const next = { date: current.date, used: current.used + 1 };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return withLimit(next);
}

function collectBreaches(json) {
  const details = json?.ExposedBreaches?.breaches_details;
  if (Array.isArray(details) && details.length) {
    return details.map((row) => ({
      name: row.breach || row.domain || 'Unknown',
      year: row.xposed_date || '',
      domain: row.domain || '',
      data: row.xposed_data || '',
      records: row.xposed_records || '',
      risk: row.password_risk || ''
    }));
  }
  const sites = String(json?.BreachesSummary?.site || '')
    .split(';')
    .map((name) => name.trim())
    .filter(Boolean);
  return sites.map((name) => ({ name, year: '', domain: '', data: '', records: '', risk: '' }));
}

export async function checkXonEmail(email) {
  const quota = await getXonQuota();
  if (quota.used >= quota.limit) {
    return { ok: false, reason: 'quota', quota };
  }

  const url = `${ANALYTICS_URL}?email=${encodeURIComponent(email)}`;
  let res;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch (err) {
    return { ok: false, reason: err.message || 'Network error', quota };
  }

  const nextQuota = await markUsed();

  if (res.status === 429) {
    return { ok: false, reason: 'api-limit', quota: nextQuota };
  }
  if (!res.ok) {
    return { ok: false, reason: `HTTP ${res.status}`, quota: nextQuota };
  }

  const json = await res.json().catch(() => ({}));
  if (json.Error === 'Not found') {
    return { ok: true, found: false, email, breaches: [], risk: '', quota: nextQuota };
  }

  const breaches = collectBreaches(json);
  const risk = json?.BreachMetrics?.risk?.[0] || {};
  return {
    ok: true,
    found: breaches.length > 0,
    email: json.email || email,
    breaches,
    riskLabel: risk.risk_label || '',
    riskScore: risk.risk_score ?? '',
    pastes: Number(json?.PastesSummary?.cnt) || 0,
    quota: nextQuota
  };
}
