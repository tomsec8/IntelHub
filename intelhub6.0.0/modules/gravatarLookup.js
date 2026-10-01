function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

async function sha256Hex(text) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function httpUrl(raw) {
  try {
    const parsed = new URL(String(raw || '').trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    return parsed.href;
  } catch {
    return '';
  }
}

function packEntry(entry, hash, email) {
  const accounts = (entry.accounts || [])
    .filter((row) => !row?.is_hidden)
    .map((row) => ({
      name: row.name || row.shortname || row.domain || 'Account',
      display: row.display || row.username || '',
      url: httpUrl(row.url),
      verified: !!row.verified
    }))
    .filter((row) => row.url);

  const urls = (entry.urls || [])
    .map((row) => ({
      title: row.title || row.value || 'Link',
      url: httpUrl(row.value || row.url)
    }))
    .filter((row) => row.url);

  const photos = (entry.photos || [])
    .map((row) => httpUrl(row.value))
    .filter(Boolean);

  const emails = (entry.emails || [])
    .map((row) => String(row.value || '').trim())
    .filter(Boolean);

  return {
    email,
    hash,
    displayName: entry.displayName || '',
    username: entry.preferredUsername || '',
    about: entry.aboutMe || '',
    location: entry.currentLocation || '',
    pronouns: entry.pronouns || '',
    job: entry.job_title || '',
    company: entry.company || '',
    profileUrl: httpUrl(entry.profileUrl) || `https://gravatar.com/${hash}`,
    thumbnail: httpUrl(entry.thumbnailUrl),
    photos,
    accounts,
    urls,
    emails
  };
}

export async function lookupGravatar(raw) {
  const email = normalizeEmail(raw);
  if (!email.includes('@')) {
    return { ok: false, reason: 'Enter an email address.' };
  }

  const hash = await sha256Hex(email);
  const profileUrl = `https://gravatar.com/${hash}.json`;
  const avatarUrl = `https://gravatar.com/avatar/${hash}?d=404&s=200`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  let profileRes;
  let avatarRes;
  try {
    [profileRes, avatarRes] = await Promise.all([
      fetch(profileUrl, { cache: 'no-store', signal: controller.signal }),
      fetch(avatarUrl, { cache: 'no-store', signal: controller.signal })
    ]);
  } catch (err) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') return { ok: false, reason: 'Gravatar timed out.', email, hash };
    return { ok: false, reason: err.message || 'Could not reach Gravatar.', email, hash };
  }
  clearTimeout(timer);

  if (profileRes.status === 429 || avatarRes.status === 429) {
    return { ok: false, reason: 'Gravatar rate limit reached. Wait and try again.', email, hash };
  }

  const hasAvatar = avatarRes.ok;
  if (profileRes.status === 404 && !hasAvatar) {
    return { ok: true, found: false, email, hash, avatarUrl };
  }
  if (!profileRes.ok && profileRes.status !== 404) {
    return { ok: false, reason: `Gravatar returned HTTP ${profileRes.status}.`, email, hash };
  }

  let profile = null;
  if (profileRes.ok) {
    const json = await profileRes.json().catch(() => ({}));
    const entry = Array.isArray(json.entry) ? json.entry[0] : null;
    if (entry) profile = packEntry(entry, hash, email);
  }

  return {
    ok: true,
    found: Boolean(profile || hasAvatar),
    email,
    hash,
    hasAvatar,
    avatarUrl: hasAvatar ? avatarUrl : '',
    profile
  };
}
