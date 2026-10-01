import { brw } from './utils.js';

const PHOTOS_KEY = 'AIzaSyAa2odBewW-sPJu3jMORr0aNedh3YlkiQc';
const PHOTOS_ORIGIN = 'https://photos.google.com';
const CALENDAR_KEY = 'AIzaSyBNlYH01_9Hc5S1J9vuFmu2nUqBZJNAXxs';
const CALENDAR_ORIGIN = 'https://calendar.google.com';
const PEOPLE_HOST = 'https://people-pa.clients6.google.com';
const CALENDAR_HOST = 'https://clients6.google.com';
const SESSION_ORIGINS = [
  'https://*.google.com/*',
  'https://people-pa.clients6.google.com/*',
  'https://clients6.google.com/*'
];

const USER_TYPES = {
  USER_TYPE_UNKNOWN: 'The user type is not known.',
  GOOGLE_USER: 'The user is a Google user.',
  GPLUS_USER: 'The user is a Currents user.',
  GOOGLE_APPS_USER: 'The user is a Google Workspace user.',
  OWNER_USER_TYPE_UNKNOWN: 'The user type is not known.',
  GPLUS_DISABLED_BY_ADMIN: 'This user\'s Currents account has been disabled by an admin.',
  GOOGLE_FAMILY_USER: 'The user is a Google Family user.',
  GOOGLE_FAMILY_CHILD_USER: 'The user is a Google Family child user.',
  GOOGLE_APPS_ADMIN_DISABLED: 'This Google Workspace admin has been disabled.',
  GOOGLE_ONE_USER: 'The user is a Google One user.',
  GOOGLE_FAMILY_CONVERTED_CHILD_USER: 'This Google Family user was converted to a child user.'
};

const MAPS_STATS_PB = '!1s{}!2m3!1sYE3rYc2rEsqOlwSHx534DA!7e81!15i14416!6m2!4b1!7b1!9m0!16m4!1i100!4b1!5b1!6BQ0FFU0JrVm5TVWxEenc9PQ!17m28!1m6!1m2!1i0!2i0!2m2!1i458!2i736!1m6!1m2!1i1868!2i0!2m2!1i1918!2i736!1m6!1m2!1i0!2i0!2m2!1i1918!2i20!1m6!1m2!1i0!2i716!2m2!1i1918!2i736!18m12!1m3!1d806313.5865720833!2d150.19484835!3d-34.53825215!2m3!1f0!2f0!3f0!3m2!1i1918!2i736!4f13.1';
const MAPS_REVIEWS_PB = '!1s{}!2m3!1s_2zAZ5CJDouBi-gPpJ7biAg!7e81!15i14416!6m2!4b1!7b1!9m0!17m28!1m6!1m2!1i0!2i0!2m2!1i530!2i1279!1m6!1m2!1i3390!2i0!2m2!1i3440!2i1279!1m6!1m2!1i0!2i0!2m2!1i3440!2i20!1m6!1m2!1i0!2i1259!2m2!1i3440!2i1279!18m15!1m3!1d2834470.167608874!2d150.05636185!3d-33.57307085!2m3!1f0!2f0!3f0!3m2!1i3440!2i1279!4f13.1!6m2!1f0!2f0!41m15!1i20!2m9!2b1!3b1!5b1!7b1!12m4!1b1!2b1!4m1!1e1!3sCAESA0VnQQ%3D%3D!7m2!1m1!1e1';

const PEOPLE_FIELDS = [
  'person.metadata.best_display_name',
  'person.photo',
  'person.cover_photo',
  'person.interaction_settings',
  'person.legacy_fields',
  'person.metadata',
  'person.in_app_reachability',
  'person.name',
  'person.read_only_profile_info',
  'person.sort_keys',
  'person.email'
];

const PEOPLE_CONTAINERS = [
  'AFFINITY', 'PROFILE', 'DOMAIN_PROFILE', 'ACCOUNT', 'EXTERNAL_ACCOUNT',
  'CIRCLE', 'DOMAIN_CONTACT', 'DEVICE_CONTACT', 'GOOGLE_GROUP', 'CONTACT'
];

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashSapisid(value, origin, timestamp) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${timestamp} ${value} ${origin}`));
  return `${timestamp}_${toHex(digest)}`;
}

async function readSessionCookies() {
  const names = ['SAPISID', '__Secure-1PAPISID', '__Secure-3PAPISID'];
  const found = {};
  for (const name of names) {
    found[name] = await getGoogleCookie(name);
  }
  return found;
}

async function getGoogleCookie(name) {
  try {
    const all = await callApi(brw.cookies.getAll.bind(brw.cookies), [{ name }]);
    const list = Array.isArray(all) ? all : [];
    const preferred = list.find((cookie) => cookie?.value && /(^|\.)google\.com$/i.test(String(cookie.domain || '').replace(/^\./, '')));
    if (preferred?.value) return preferred.value;
    if (list[0]?.value) return list[0].value;
  } catch {
    /* cookies.get is the fallback when getAll is unavailable */
  }
  return getCookie(`${PHOTOS_ORIGIN}/`, name);
}

async function authorizationHeader(origin) {
  const cookies = await readSessionCookies();
  const sapisid = cookies.SAPISID || cookies['__Secure-1PAPISID'] || cookies['__Secure-3PAPISID'];
  if (!sapisid) return '';
  const timestamp = Math.floor(Date.now() / 1000);
  const primary = await hashSapisid(sapisid, origin, timestamp);
  const one = await hashSapisid(cookies['__Secure-1PAPISID'] || sapisid, origin, timestamp);
  const three = await hashSapisid(cookies['__Secure-3PAPISID'] || sapisid, origin, timestamp);
  return `SAPISIDHASH ${primary} SAPISID1PHASH ${one} SAPISID3PHASH ${three}`;
}

function callApi(fn, args) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value, error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(value);
    };
    const maybe = fn(...args, (result) => {
      const err = brw.runtime?.lastError;
      finish(result, err ? new Error(err.message) : null);
    });
    if (maybe && typeof maybe.then === 'function') {
      maybe.then((value) => finish(value), (err) => finish(null, err));
    }
  });
}

function requestPermissions() {
  return callApi(brw.permissions.request.bind(brw.permissions), [{
    permissions: ['cookies'],
    origins: SESSION_ORIGINS
  }]).then(Boolean);
}

function getCookie(url, name) {
  return callApi(brw.cookies.get.bind(brw.cookies), [{ url, name }])
    .then((cookie) => cookie?.value || '')
    .catch(() => '');
}

export async function getGoogleSapisid() {
  const cookies = await readSessionCookies();
  return cookies.SAPISID || cookies['__Secure-1PAPISID'] || cookies['__Secure-3PAPISID'] || '';
}

export async function connectGoogleSession() {
  const granted = await requestPermissions();
  if (!granted) return { ok: false, reason: 'Permission denied. Allow cookies for Google to connect.' };
  const sapisid = await getGoogleSapisid();
  if (!sapisid) {
    return {
      ok: false,
      reason: 'No Google session found. Sign in to Google in this browser, then connect again.',
      needSignIn: true
    };
  }
  return { ok: true };
}

export async function hasGoogleSession() {
  try {
    const hasCookies = await callApi(brw.permissions.contains.bind(brw.permissions), [{
      permissions: ['cookies'],
      origins: SESSION_ORIGINS
    }]);
    if (!hasCookies) return false;
    return !!(await getGoogleSapisid());
  } catch {
    return false;
  }
}

async function googleFetch(url, { origin, key } = {}) {
  const authOrigin = origin || PHOTOS_ORIGIN;
  const authorization = await authorizationHeader(authOrigin);
  if (!authorization) throw new Error('No Google session.');
  const headers = {
    Authorization: authorization,
    Origin: authOrigin,
    Referer: `${authOrigin}/`,
    'X-Goog-AuthUser': '0'
  };
  if (key) headers['X-Goog-Api-Key'] = key;
  const res = await fetch(url, { method: 'GET', credentials: 'include', headers });
  return res;
}

function parseXssi(text) {
  return JSON.parse(String(text || '').replace(/^\)\]\}'\s*/, ''));
}

function firstPerson(payload) {
  if (payload?.people && typeof payload.people === 'object') return Object.values(payload.people)[0] || null;
  return payload?.personResponse?.[0]?.person || null;
}

function extractGaiaId(person) {
  if (!person || typeof person !== 'object') return '';
  const candidates = [
    person.personId,
    person.metadata?.id,
    person.metadata?.identityInfo?.sourceIds?.[0]?.id
  ].flatMap((value) => (Array.isArray(value) ? value : [value]));
  for (const value of candidates) {
    const match = String(value || '').match(/\d{21}/);
    if (match) return match[0];
  }
  const match = JSON.stringify(person).match(/"(\d{21})"/);
  return match?.[1] || '';
}

function itemIn(list, container = 'PROFILE') {
  if (!Array.isArray(list)) return null;
  return list.find((item) => item?.metadata?.container === container) || list[0] || null;
}

function photoUrl(photo, cover = false) {
  if (!photo) return '';
  const raw = cover ? (photo.imageUrl || photo.url || '') : (photo.url || '');
  if (!raw) return '';
  return cover && raw.includes('=') ? raw.split('=').slice(0, -1).join('=') : raw;
}

function parsePerson(person, fallbackEmail) {
  const profile = itemIn(person?.name) || {};
  const emailItem = itemIn(person?.email);
  const photo = itemIn(person?.photo);
  const cover = itemIn(person?.coverPhoto);
  const profileInfo = itemIn(person?.readOnlyProfileInfo);
  const source = (person?.metadata?.identityInfo?.sourceIds || []).find((item) => item.container === 'PROFILE')
    || person?.metadata?.identityInfo?.sourceIds?.[0];
  const lastMicros = source?.lastUpdatedMicros;
  const apps = (person?.inAppReachability || [])
    .filter((app) => app?.metadata?.container === 'PROFILE' || !app?.metadata?.container)
    .map((app) => String(app.appType || '').replace(/_/g, ' ').toLowerCase())
    .filter(Boolean);
  const uniqueApps = [...new Set(apps.map((app) => app.replace(/\b\w/g, (ch) => ch.toUpperCase())))];
  const dynamite = person?.extendedData?.dynamiteExtendedData || {};
  const gplus = person?.extendedData?.gplusExtendedData || {};
  const customerId = dynamite.organizationInfo?.customerInfo?.customerId?.customerId || '';
  const userTypes = (profileInfo?.ownerUserType || []).map((type) => ({
    id: type,
    label: USER_TYPES[type] || type
  }));
  const containers = (person?.metadata?.identityInfo?.sourceIds || [])
    .map((item) => item.container)
    .filter(Boolean);

  return {
    gaiaID: extractGaiaId(person),
    name: person?.metadata?.bestDisplayName?.displayName || profile.displayName || '',
    email: emailItem?.value || fallbackEmail || '',
    photo: photoUrl(photo),
    photoDefault: !!photo?.isDefault,
    cover: photoUrl(cover, true),
    coverDefault: cover?.isDefault !== false && !cover?.imageUrl ? true : !!cover?.isDefault,
    lastUpdated: lastMicros ? new Date(Number(String(lastMicros).slice(0, 10)) * 1000).toISOString() : '',
    userTypes,
    containers,
    apps: uniqueApps,
    chat: {
      entityType: dynamite.entityType || '',
      customerId,
      presence: dynamite.presence || ''
    },
    gplus: {
      enterpriseUser: !!gplus.isEnterpriseUser,
      contentRestriction: gplus.contentRestriction || ''
    }
  };
}

function peopleParams(extra) {
  const params = new URLSearchParams(extra);
  params.append('extension_set.extension_names', 'DYNAMITE_ADDITIONAL_DATA');
  params.append('extension_set.extension_names', 'DYNAMITE_ORGANIZATION_INFO');
  PEOPLE_FIELDS.forEach((field) => params.append('request_mask.include_field.paths', field));
  PEOPLE_CONTAINERS.forEach((name) => params.append('request_mask.include_container', name));
  params.set('core_id_params.enable_private_names', 'true');
  params.set('key', PHOTOS_KEY);
  return params;
}

async function fetchPersonByEmail(email) {
  const params = peopleParams({
    id: email,
    type: 'EMAIL',
    match_type: 'EXACT'
  });
  const res = await googleFetch(`${PEOPLE_HOST}/v2/people/lookup?${params}`, {
    origin: PHOTOS_ORIGIN,
    key: PHOTOS_KEY
  });
  return res;
}

async function fetchPersonByGaia(gaiaID) {
  const params = peopleParams({ person_id: gaiaID });
  const res = await googleFetch(`${PEOPLE_HOST}/v2/people?${params}`, {
    origin: PHOTOS_ORIGIN,
    key: PHOTOS_KEY
  });
  return res;
}

async function fetchMaps(gaiaID) {
  const empty = { status: 'empty', stats: {}, reviews: [] };
  try {
    const statsUrl = `https://www.google.com/locationhistory/preview/mas?authuser=0&hl=en&gl=us&pb=${MAPS_STATS_PB.replace('{}', encodeURIComponent(gaiaID))}`;
    const statsRes = await fetch(statsUrl, { credentials: 'include' });
    if (statsRes.status === 302 || statsRes.url.includes('/sorry/')) {
      return { status: 'blocked', stats: {}, reviews: [] };
    }
    if (!statsRes.ok) return empty;
    const data = parseXssi(await statsRes.text());
    const rows = data?.[16]?.[8]?.[0];
    const stats = {};
    if (Array.isArray(rows)) {
      rows.forEach((row) => {
        if (row?.[6] != null) stats[String(row[6])] = Number(row[7] || 0);
      });
    }
    const total = (stats.Reviews || 0) + (stats.Ratings || 0) + (stats.Photos || 0);
    if (!total) return { status: 'empty', stats, reviews: [] };

    let reviews = [];
    try {
      const reviewsUrl = `https://www.google.com/locationhistory/preview/mas?authuser=0&hl=en&gl=us&pb=${MAPS_REVIEWS_PB.replace('{}', encodeURIComponent(gaiaID))}`;
      const reviewsRes = await fetch(reviewsUrl, { credentials: 'include' });
      if (reviewsRes.ok && !reviewsRes.url.includes('/sorry/')) {
        const reviewData = parseXssi(await reviewsRes.text());
        const list = reviewData?.[45]?.[0];
        if (!list) return { status: 'private', stats, reviews: [] };
        if (Array.isArray(list)) {
          reviews = list.slice(0, 8).map((review) => ({
            place: review?.[4]?.[2] || '',
            address: review?.[4]?.[3] || '',
            rating: review?.[2]?.[2]?.[0]?.[0] ?? '',
            comment: review?.[2]?.[2]?.[15]?.[0]?.[0] || ''
          })).filter((item) => item.place);
        }
      }
    } catch {
      /* stats still useful */
    }
    return { status: 'ok', stats, reviews };
  } catch {
    return empty;
  }
}

async function fetchCalendar(email) {
  const empty = { found: false, events: [] };
  if (!email) return empty;
  try {
    const calRes = await googleFetch(`${CALENDAR_HOST}/calendar/v3/calendars/${encodeURIComponent(email)}?key=${encodeURIComponent(CALENDAR_KEY)}`, {
      origin: CALENDAR_ORIGIN,
      key: CALENDAR_KEY
    });
    if (!calRes.ok) return empty;
    const calendar = await calRes.json();
    if (calendar.error) return empty;
    const eventsRes = await googleFetch(
      `${CALENDAR_HOST}/calendar/v3/calendars/${encodeURIComponent(email)}/events?key=${encodeURIComponent(CALENDAR_KEY)}&singleEvents=true&maxAttendees=1&maxResults=12`,
      { origin: CALENDAR_ORIGIN, key: CALENDAR_KEY }
    );
    const eventsJson = eventsRes.ok ? await eventsRes.json() : {};
    const events = (eventsJson.items || []).slice(-8).map((event) => ({
      title: event.summary || 'Untitled',
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || ''
    }));
    return {
      found: true,
      id: calendar.id || email,
      summary: calendar.summary || '',
      timeZone: calendar.timeZone || '',
      ics: `https://calendar.google.com/calendar/ical/${encodeURIComponent(email)}/public/basic.ics`,
      events
    };
  } catch {
    return empty;
  }
}

export function googleLinksFor(email, gaiaID) {
  return {
    googleMapsLink: `https://www.google.com/maps/contrib/${gaiaID}`,
    googleCalendarLink: email
      ? `https://calendar.google.com/calendar/u/0/embed?src=${encodeURIComponent(email)}`
      : `https://www.google.com/maps/contrib/${gaiaID}`,
    googleArchiveLink: `https://web.archive.org/web/*/plus.google.com/${gaiaID}*`
  };
}

export function isGaiaId(value) {
  return /^\d{21}$/.test(String(value || '').trim());
}

export async function lookupGoogleId(query, { onProgress } = {}) {
  const target = String(query || '').trim();
  if (!target) return { success: false, reason: 'Enter an email or Gaia ID.' };
  const asGaia = isGaiaId(target);
  if (!asGaia && !target.includes('@')) return { success: false, reason: 'Enter a valid email or 21-digit Gaia ID.' };

  const session = await connectGoogleSession();
  if (!session.ok) return { success: false, reason: session.reason, needSignIn: session.needSignIn };

  onProgress?.('Looking up the Google account…');
  let res;
  try {
    res = asGaia ? await fetchPersonByGaia(target) : await fetchPersonByEmail(target);
  } catch (err) {
    return { success: false, reason: err.message || 'Lookup request failed.' };
  }

  if (res.status === 401 || res.status === 403) {
    return { success: false, reason: 'Google session expired. Sign in again, then reconnect.', needSignIn: true };
  }
  if (!res.ok) return { success: false, reason: `Google lookup failed (${res.status}).` };

  let payload;
  try {
    payload = await res.json();
  } catch {
    return { success: false, reason: 'Could not read the Google response.' };
  }

  const person = firstPerson(payload);
  const profile = parsePerson(person, asGaia ? '' : target);
  if (!profile.gaiaID) {
    return { success: false, reason: 'No public Google account matched this lookup.' };
  }

  const email = profile.email || (asGaia ? '' : target);
  onProgress?.('Checking Maps and Calendar…');
  const [maps, calendar] = await Promise.all([
    fetchMaps(profile.gaiaID),
    fetchCalendar(email)
  ]);

  const playGames = profile.apps.some((app) => /play\s*games|games/i.test(app));

  return {
    success: true,
    target,
    ...profile,
    email,
    confidence: 'High (People lookup)',
    maps,
    calendar,
    playGames: {
      active: playGames,
      note: playGames
        ? 'Play Games appears among activated services. Full game history needs GHunt CLI OAuth.'
        : 'No Play Games signal on this profile. Full game history needs GHunt CLI OAuth.'
    },
    ...googleLinksFor(email, profile.gaiaID)
  };
}
