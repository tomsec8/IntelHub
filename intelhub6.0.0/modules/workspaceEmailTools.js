import { brw, flashButton } from './utils.js';
import { connectGoogleSession, hasGoogleSession, lookupGoogleId } from './googleIdLookup.js';
import { checkXonEmail, getXonQuota } from './xposedOrNot.js';
import { lookupHudsonRock, classifyHudsonQuery } from './hudsonRock.js';
import { lookupGravatar } from './gravatarLookup.js';
import { bindToolBack, getToolResult, setToolResult, apiNote, fillToolCards, API_SOURCES, paintToolChrome } from './workspaceToolResults.js';

const TOOLS = [
  {
    id: 'gmail',
    name: 'Google ID',
    blurb: 'Connect your Google session, then pull the full public Google footprint for an email or Gaia ID.',
    api: [API_SOURCES.googlePeople]
  },
  {
    id: 'xon',
    name: 'Breach lookup',
    blurb: 'Check known data breaches for an email via XposedOrNot.',
    api: [API_SOURCES.xon]
  },
  {
    id: 'hudson',
    name: 'Infostealer lookup',
    blurb: 'Check Hudson Rock for computers infected by infostealers, by email, username, or domain.',
    api: [API_SOURCES.hudsonRock]
  },
  {
    id: 'gravatar',
    name: 'Gravatar lookup',
    blurb: 'Public Gravatar avatar and profile for an email. SHA-256 locally, no key.',
    api: [API_SOURCES.gravatar]
  }
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function toolChrome(wrap, title, onBack, resultId) {
  return paintToolChrome(wrap, title, { onBack, resultId });
}

function paintCards(wrap, onToolChange) {
  fillToolCards(wrap, TOOLS, onToolChange);
}

function addKv(table, key, value) {
  if (value == null || value === '') return;
  const row = table.insertRow();
  row.insertCell().textContent = key;
  row.insertCell().textContent = String(value);
}

function section(title) {
  const block = el('section', 'ws-email-section');
  block.appendChild(el('h3', '', title));
  return block;
}

function renderSuccess(host, data, email) {
  host.replaceChildren();
  const report = el('div', 'ws-email-report');

  const card = el('div', 'ws-email-result');
  const photos = el('div', 'ws-email-photos');
  if (data.photo) {
    const img = el('img', 'ws-email-photo');
    img.src = data.photo;
    img.alt = data.photoDefault ? 'Default profile photo' : 'Profile photo';
    photos.appendChild(img);
  }
  if (data.cover) {
    const cover = el('img', 'ws-email-cover');
    cover.src = data.cover;
    cover.alt = 'Cover photo';
    photos.appendChild(cover);
  }
  if (photos.childNodes.length) card.appendChild(photos);
  card.append(
    el('strong', '', data.name || 'Google account found'),
    el('p', 'ws-image-note', data.email || email || '')
  );

  const idRow = el('div', 'ws-email-id');
  idRow.appendChild(el('code', '', data.gaiaID));
  if (data.confidence) {
    idRow.appendChild(el('span', data.confidence.includes('High') ? 'is-ok' : '', data.confidence));
  }
  const copyBtn = el('button', 'ws-btn ws-btn-ghost', 'Copy ID');
  copyBtn.type = 'button';
  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(data.gaiaID);
    flashButton(copyBtn, 'Copied');
  });
  idRow.appendChild(copyBtn);
  card.appendChild(idRow);

  const links = el('div', 'ws-email-links');
  [
    { href: data.googleMapsLink, label: 'Google Maps' },
    data.email ? { href: data.googleCalendarLink, label: 'Calendar' } : null,
    { href: data.googleArchiveLink, label: 'Google+ archive' }
  ].filter(Boolean).forEach((item) => {
    const link = el('a', 'ws-btn ws-btn-ghost', item.label);
    link.href = item.href;
    link.target = '_blank';
    link.rel = 'noopener';
    links.appendChild(link);
  });
  const exportBtn = el('button', 'ws-btn ws-btn-ghost', 'Export JSON');
  exportBtn.type = 'button';
  exportBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    flashButton(exportBtn, 'Copied');
  });
  links.appendChild(exportBtn);
  card.appendChild(links);
  report.appendChild(card);

  const profile = section('Account');
  const table = el('table', 'ws-image-table');
  addKv(table, 'Gaia ID', data.gaiaID);
  addKv(table, 'Email', data.email || email);
  addKv(table, 'Name', data.name);
  addKv(table, 'Last profile edit', data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : '');
  addKv(table, 'Profile photo', data.photo ? (data.photoDefault ? 'Default' : 'Custom') : '');
  addKv(table, 'Cover photo', data.cover ? (data.coverDefault ? 'Default' : 'Custom') : '');
  addKv(table, 'Containers', (data.containers || []).join(', '));
  addKv(table, 'Enterprise user', data.gplus?.enterpriseUser ? 'Yes' : 'No');
  addKv(table, 'Chat entity', data.chat?.entityType);
  addKv(table, 'Customer ID', data.chat?.customerId);
  profile.appendChild(table);
  if (data.userTypes?.length) {
    data.userTypes.forEach((type) => {
      profile.appendChild(el('p', 'ws-image-note', `${type.id}: ${type.label}`));
    });
  }
  report.appendChild(profile);

  const services = section('Activated services');
  if (data.apps?.length) {
    const list = el('ul', 'ws-email-apps');
    data.apps.forEach((app) => list.appendChild(el('li', '', app)));
    services.appendChild(list);
  } else {
    services.appendChild(el('p', 'ws-image-note', 'No in-app services listed.'));
  }
  report.appendChild(services);

  const maps = section('Google Maps');
  const mapsStatus = data.maps?.status;
  if (mapsStatus === 'blocked') {
    maps.appendChild(el('p', 'ws-image-note', 'Maps request was blocked. Try again later.'));
  } else if (mapsStatus === 'empty' || !data.maps) {
    maps.appendChild(el('p', 'ws-image-note', 'No public reviews, ratings, or photos.'));
  } else if (mapsStatus === 'private') {
    maps.appendChild(el('p', 'ws-image-note', 'Maps activity exists, but reviews look private.'));
  }
  if (data.maps?.stats && Object.keys(data.maps.stats).length) {
    const statsTable = el('table', 'ws-image-table');
    Object.entries(data.maps.stats).forEach(([key, value]) => addKv(statsTable, key, value));
    maps.appendChild(statsTable);
  }
  (data.maps?.reviews || []).forEach((review) => {
    const item = el('div', 'ws-xon-breach');
    item.appendChild(el('strong', '', review.place + (review.rating ? ` · ${review.rating}★` : '')));
    if (review.address) item.appendChild(el('p', '', review.address));
    if (review.comment) item.appendChild(el('p', '', review.comment));
    maps.appendChild(item);
  });
  report.appendChild(maps);

  const cal = section('Google Calendar');
  if (!data.calendar?.found) {
    cal.appendChild(el('p', 'ws-image-note', 'No public Google Calendar.'));
  } else {
    const calTable = el('table', 'ws-image-table');
    addKv(calTable, 'Calendar ID', data.calendar.id);
    addKv(calTable, 'Summary', data.calendar.summary);
    addKv(calTable, 'Timezone', data.calendar.timeZone);
    cal.appendChild(calTable);
    if (data.calendar.ics) {
      const ics = el('a', 'ws-btn ws-btn-ghost', 'Download ICS');
      ics.href = data.calendar.ics;
      ics.target = '_blank';
      ics.rel = 'noopener';
      cal.appendChild(ics);
    }
    (data.calendar.events || []).forEach((event) => {
      const item = el('div', 'ws-xon-breach');
      item.appendChild(el('strong', '', event.title));
      item.appendChild(el('p', '', event.start ? new Date(event.start).toLocaleString() : 'No date'));
      cal.appendChild(item);
    });
  }
  report.appendChild(cal);

  const games = section('Play Games');
  games.appendChild(el('p', 'ws-image-note', data.playGames?.note || 'Play Games details are not available from a browser session.'));
  report.appendChild(games);

  host.appendChild(report);
}

function paintGmail(wrap, { query, onQueryChange, onToolChange }) {
  const panel = toolChrome(wrap, 'Google ID', onToolChange, 'email:gmail');
  panel.appendChild(apiNote([API_SOURCES.googlePeople]));
  const note = el('p', 'ws-image-note', '');
  note.append(
    document.createTextNode('Connect the Google account signed in on this browser, then look up an address. Inspired by '),
  );
  const credit = el('a', '', 'GHunt');
  credit.href = 'https://github.com/mxrch/ghunt';
  credit.target = '_blank';
  credit.rel = 'noopener';
  note.append(credit, document.createTextNode('. Cookies stay in this browser and are only sent to Google.'));
  panel.appendChild(note);

  const sessionRow = el('div', 'ws-people-row');
  const connectBtn = el('button', 'ws-btn ws-btn-ghost', 'Connect Google');
  connectBtn.type = 'button';
  const sessionStatus = el('p', 'ws-image-status', 'Not connected.');
  sessionRow.append(connectBtn);

  const row = el('div', 'ws-people-row');
  const input = el('input', 'ws-osint-search');
  input.type = 'text';
  input.placeholder = 'name@gmail.com or 21-digit Gaia ID';
  input.value = query || '';
  input.addEventListener('input', () => onQueryChange(input.value));
  const scanBtn = el('button', 'ws-btn', 'Look up');
  scanBtn.type = 'button';
  row.append(input, scanBtn);

  const status = el('p', 'ws-image-status', '');
  const result = el('div');

  function setSessionUi(connected, message) {
    sessionStatus.textContent = message || (connected ? 'Google session connected.' : 'Not connected.');
    sessionStatus.className = connected ? 'ws-image-status is-ok' : 'ws-image-status';
    connectBtn.textContent = connected ? 'Reconnect' : 'Connect Google';
  }

  async function refreshSession() {
    setSessionUi(await hasGoogleSession());
  }

  connectBtn.addEventListener('click', async () => {
    connectBtn.disabled = true;
    try {
      const session = await connectGoogleSession();
      if (session.ok) {
        setSessionUi(true);
        flashButton(connectBtn, 'Connected');
      } else {
        setSessionUi(false, session.reason);
        if (session.needSignIn) brw.tabs.create({ url: 'https://accounts.google.com/', active: true });
        flashButton(connectBtn, 'Sign in first', true);
      }
    } finally {
      connectBtn.disabled = false;
    }
  });

  function saveResult(email, data) {
    if (data.success) {
      setToolResult('email:gmail', { ...data, email: data.email || email });
      return;
    }
    setToolResult('email:gmail', { success: false, email, reason: data.reason || status.textContent });
  }

  async function runScan() {
    const email = input.value.trim();
    if (!email.includes('@') && !/^\d{21}$/.test(email)) {
      flashButton(scanBtn, 'Need email or Gaia ID', true);
      return;
    }
    scanBtn.disabled = true;
    result.replaceChildren();
    status.textContent = 'Looking up via Google session…';
    status.className = 'ws-image-status';
    try {
      const data = await lookupGoogleId(email, {
        onProgress(message) { status.textContent = message; }
      });
      if (data.success) {
        status.textContent = '';
        renderSuccess(result, data, email);
        saveResult(email, data);
      } else {
        status.textContent = data.reason || 'Could not find a Google ID.';
        status.className = 'ws-image-status is-bad';
        if (data.needSignIn) brw.tabs.create({ url: 'https://accounts.google.com/', active: true });
        saveResult(email, data);
      }
    } catch (err) {
      status.textContent = err.message || 'Scan failed.';
      status.className = 'ws-image-status is-bad';
    } finally {
      scanBtn.disabled = false;
    }
  }

  scanBtn.addEventListener('click', runScan);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runScan();
  });
  panel.append(sessionRow, sessionStatus, row, status, result);
  refreshSession();

  const saved = getToolResult('email:gmail');
  if (saved?.success) {
    input.value = saved.email || input.value;
    renderSuccess(result, saved, saved.email);
  } else if (saved?.reason) {
    input.value = saved.email || input.value;
    status.textContent = saved.reason;
    status.className = 'ws-image-status is-bad';
  }
}

function formatExposed(value) {
  return String(value || '')
    .split(/[;|]/)
    .map((part) => part.replace(/^data_/i, '').replace(/_/g, ' ').trim())
    .filter(Boolean)
    .join(', ');
}

function paintXonResult(host, data) {
  host.replaceChildren();
  const summary = el('div', 'ws-email-result');
  if (!data.found) {
    summary.append(
      el('strong', 'is-ok', 'No breaches found'),
      el('p', 'ws-image-note', data.email || '')
    );
    host.appendChild(summary);
    return;
  }

  const count = data.breaches.length;
  summary.append(
    el('strong', '', `${count} breach${count === 1 ? '' : 'es'} found`),
    el('p', 'ws-image-note', data.email || '')
  );
  if (data.riskLabel) {
    const risk = el('p', 'ws-xon-risk');
    risk.textContent = data.riskScore !== ''
      ? `Risk: ${data.riskLabel} (${data.riskScore})`
      : `Risk: ${data.riskLabel}`;
    summary.appendChild(risk);
  }
  if (data.pastes) {
    summary.appendChild(el('p', 'ws-image-note', `Also seen in ${data.pastes} public paste${data.pastes === 1 ? '' : 's'}.`));
  }
  host.appendChild(summary);

  const list = el('div', 'ws-xon-list');
  data.breaches.forEach((breach) => {
    const card = el('div', 'ws-xon-breach');
    card.appendChild(el('strong', '', breach.name || 'Unknown breach'));
    const when = [breach.year, breach.domain].filter(Boolean).join(' · ');
    if (when) card.appendChild(el('p', '', when));
    const exposed = formatExposed(breach.data);
    if (exposed) card.appendChild(el('p', 'ws-xon-exposed', `Exposed: ${exposed}`));
    if (breach.records) {
      const records = Number(breach.records);
      card.appendChild(el('p', 'ws-image-note', `Records in breach: ${Number.isFinite(records) ? records.toLocaleString() : breach.records}`));
    }
    list.appendChild(card);
  });
  host.appendChild(list);
}

function paintQuota(node, quota) {
  if (!node || !quota) return;
  const left = Math.max(0, quota.limit - quota.used);
  node.className = 'ws-quota';
  if (left <= 0) node.classList.add('is-out');
  else if (left <= 15) node.classList.add('is-low');
  node.replaceChildren();
  const label = el('span', '', `${quota.used} / ${quota.limit} lookups today`);
  const track = el('div', 'ws-quota-bar');
  const fill = el('div', 'ws-quota-fill');
  fill.style.width = `${Math.min(100, (quota.used / quota.limit) * 100)}%`;
  track.appendChild(fill);
  node.append(label, track);
}

function paintXon(wrap, { query, onQueryChange, onToolChange }) {
  const panel = toolChrome(wrap, 'Breach lookup', onToolChange, 'email:xon');
  panel.appendChild(apiNote([API_SOURCES.xon]));
  panel.appendChild(el('p', 'ws-image-note', 'Checks XposedOrNot for known breaches and paste dumps. The free API allows 100 lookups per IP per day.'));

  const quotaBox = el('div', 'ws-quota');
  getXonQuota().then((quota) => paintQuota(quotaBox, quota));

  const row = el('div', 'ws-people-row');
  const input = el('input', 'ws-osint-search');
  input.type = 'email';
  input.placeholder = 'name@example.com';
  input.value = query || '';
  input.addEventListener('input', () => onQueryChange(input.value));
  const checkBtn = el('button', 'ws-btn', 'Check breaches');
  checkBtn.type = 'button';
  row.append(input, checkBtn);

  const status = el('p', 'ws-image-status', '');
  const out = el('div', 'ws-web-out');

  const credit = el('p', 'ws-osint-credit');
  credit.append(document.createTextNode('Breach data from '));
  const link = el('a', '', 'XposedOrNot');
  link.href = 'https://xposedornot.com/';
  link.target = '_blank';
  link.rel = 'noopener';
  credit.append(link, document.createTextNode(' — free community API. No signup. Results are not stored by IntelHub.'));

  async function run() {
    const email = input.value.trim();
    if (!email.includes('@')) {
      flashButton(checkBtn, 'Invalid email', true);
      return;
    }
    checkBtn.disabled = true;
    out.replaceChildren();
    status.textContent = 'Checking XposedOrNot…';
    status.className = 'ws-image-status';
    try {
      const data = await checkXonEmail(email);
      paintQuota(quotaBox, data.quota);
      if (!data.ok) {
        if (data.reason === 'quota') {
          status.textContent = 'Daily IntelHub quota reached (100). Try again tomorrow.';
        } else if (data.reason === 'api-limit') {
          status.textContent = 'XposedOrNot rate limit reached (25/hour or 100/day per IP). Wait and try again.';
        } else {
          status.textContent = data.reason || 'Lookup failed.';
        }
        status.className = 'ws-image-status is-bad';
        setToolResult('email:xon', { ok: false, email, reason: status.textContent });
        return;
      }
      status.textContent = '';
      paintXonResult(out, data);
      setToolResult('email:xon', {
        ok: true,
        found: data.found,
        email: data.email,
        breaches: data.breaches,
        riskLabel: data.riskLabel,
        riskScore: data.riskScore,
        pastes: data.pastes
      });
    } catch (err) {
      status.textContent = err.message || 'Lookup failed.';
      status.className = 'ws-image-status is-bad';
    } finally {
      checkBtn.disabled = false;
    }
  }

  checkBtn.addEventListener('click', run);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') run();
  });
  panel.append(quotaBox, row, status, out, credit);

  const saved = getToolResult('email:xon');
  if (saved?.ok) {
    input.value = saved.email || input.value;
    paintXonResult(out, saved);
  } else if (saved?.reason) {
    input.value = saved.email || input.value;
    status.textContent = saved.reason;
    status.className = 'ws-image-status is-bad';
  }
}

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function paintHudsonResult(host, data) {
  host.replaceChildren();
  const summary = el('div', 'ws-email-result');
  const kind = data.ident?.kind || 'query';
  if (!data.found) {
    summary.append(
      el('strong', 'is-ok', 'No infostealer record'),
      el('p', 'ws-image-note', data.query || '')
    );
    host.appendChild(summary);
    return;
  }

  const count = data.stealers.length;
  summary.append(
    el('strong', '', `${count} infected computer${count === 1 ? '' : 's'}`),
    el('p', 'ws-image-note', `${kind}: ${data.query || ''}`)
  );
  if (data.corporate || data.userServices) {
    summary.appendChild(el('p', 'ws-xon-risk', `Services seen: ${data.corporate} corporate · ${data.userServices} user`));
  }
  host.appendChild(summary);

  const list = el('div', 'ws-xon-list');
  data.stealers.forEach((row) => {
    const card = el('div', 'ws-xon-breach');
    card.appendChild(el('strong', '', row.computer || row.os || 'Infected computer'));
    const when = formatWhen(row.date);
    if (when) card.appendChild(el('p', '', when));
    if (row.os) card.appendChild(el('p', '', row.os));
    if (row.ip) card.appendChild(el('p', '', `IP: ${row.ip}`));
    if (row.antiviruses?.length) card.appendChild(el('p', '', `AV: ${row.antiviruses.join(', ')}`));
    if (row.malwarePath) card.appendChild(el('p', 'ws-image-note', row.malwarePath));
    if (row.logins?.length) card.appendChild(el('p', 'ws-xon-exposed', `Logins: ${row.logins.join(', ')}`));
    if (row.passwords?.length) card.appendChild(el('p', 'ws-xon-exposed', `Passwords (masked): ${row.passwords.join(', ')}`));
    list.appendChild(card);
  });
  host.appendChild(list);
}

function paintHudson(wrap, { query, onQueryChange, onToolChange }) {
  const panel = toolChrome(wrap, 'Infostealer lookup', onToolChange, 'email:hudson');
  panel.appendChild(apiNote([API_SOURCES.hudsonRock]));
  panel.appendChild(el('p', 'ws-image-note', 'Free Hudson Rock Cavalier API. No key. Paste an email, username, or domain. Rate limit is about 50 requests per 10 seconds. Passwords in the result are already masked by Hudson Rock.'));

  const row = el('div', 'ws-people-row');
  const input = el('input', 'ws-osint-search');
  input.type = 'text';
  input.placeholder = 'name@example.com, username, or example.com';
  input.value = query || '';
  input.addEventListener('input', () => onQueryChange(input.value));
  const checkBtn = el('button', 'ws-btn', 'Look up');
  checkBtn.type = 'button';
  row.append(input, checkBtn);

  const status = el('p', 'ws-image-status', '');
  const out = el('div', 'ws-web-out');
  const credit = el('p', 'ws-osint-credit');
  credit.append(document.createTextNode('Infostealer data from '));
  const link = el('a', '', 'Hudson Rock');
  link.href = 'https://www.hudsonrock.com/free-tools';
  link.target = '_blank';
  link.rel = 'noopener';
  credit.append(link, document.createTextNode(' — complimentary OSINT API. Results are not stored by IntelHub except in this workspace tab.'));

  async function run() {
    const ident = classifyHudsonQuery(input.value);
    if (!ident) {
      flashButton(checkBtn, 'Enter a target', true);
      return;
    }
    checkBtn.disabled = true;
    out.replaceChildren();
    status.textContent = `Checking Hudson Rock (${ident.kind})…`;
    status.className = 'ws-image-status';
    try {
      const data = await lookupHudsonRock(input.value);
      if (!data.ok) {
        status.textContent = data.reason || 'Lookup failed.';
        status.className = 'ws-image-status is-bad';
        setToolResult('email:hudson', { ok: false, query: ident.value, ident, reason: status.textContent });
        return;
      }
      status.textContent = '';
      paintHudsonResult(out, data);
      setToolResult('email:hudson', data);
    } catch (err) {
      status.textContent = err.message || 'Lookup failed.';
      status.className = 'ws-image-status is-bad';
    } finally {
      checkBtn.disabled = false;
    }
  }

  checkBtn.addEventListener('click', run);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') run();
  });
  panel.append(row, status, out, credit);

  const saved = getToolResult('email:hudson');
  if (saved?.ok) {
    input.value = saved.query || input.value;
    paintHudsonResult(out, saved);
  } else if (saved?.reason) {
    input.value = saved.query || input.value;
    status.textContent = saved.reason;
    status.className = 'ws-image-status is-bad';
  }
}

function addHttpLink(host, href, label) {
  if (!href) return;
  const link = el('a', 'ws-btn ws-btn-ghost', label);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener';
  host.appendChild(link);
}

function paintGravatarResult(host, data) {
  host.replaceChildren();
  const summary = el('div', 'ws-email-result');
  if (!data.found) {
    summary.append(
      el('strong', 'is-ok', 'No public Gravatar'),
      el('p', 'ws-image-note', data.email || '')
    );
    host.appendChild(summary);
    return;
  }

  const profile = data.profile || {};
  const photos = el('div', 'ws-email-photos');
  const photoSrc = profile.thumbnail || data.avatarUrl;
  if (photoSrc) {
    const img = el('img', 'ws-email-photo');
    img.src = photoSrc;
    img.alt = profile.displayName || 'Gravatar';
    photos.appendChild(img);
  }
  if (photos.childNodes.length) summary.appendChild(photos);
  summary.append(
    el('strong', '', profile.displayName || profile.username || 'Public Gravatar found'),
    el('p', 'ws-image-note', data.email || '')
  );
  host.appendChild(summary);

  const table = el('table', 'ws-image-table');
  addKv(table, 'Display name', profile.displayName);
  addKv(table, 'Username', profile.username);
  addKv(table, 'Pronouns', profile.pronouns);
  addKv(table, 'Location', profile.location);
  addKv(table, 'Job', [profile.job, profile.company].filter(Boolean).join(' · '));
  addKv(table, 'About', profile.about);
  addKv(table, 'SHA-256', data.hash);
  if (profile.emails?.length) addKv(table, 'Public emails', profile.emails.join(', '));
  host.appendChild(table);

  const links = el('div', 'ws-email-links');
  addHttpLink(links, profile.profileUrl, 'Open profile');
  (profile.accounts || []).forEach((account) => {
    addHttpLink(links, account.url, account.verified ? `${account.name} ✓` : account.name);
  });
  (profile.urls || []).forEach((item) => addHttpLink(links, item.url, item.title));
  if (links.childNodes.length) host.appendChild(links);
}

function paintGravatar(wrap, { query, onQueryChange, onToolChange }) {
  const panel = toolChrome(wrap, 'Gravatar lookup', onToolChange, 'email:gravatar');
  panel.appendChild(apiNote([API_SOURCES.gravatar]));
  panel.appendChild(el('p', 'ws-image-note', 'Hashes the email locally with SHA-256, then fetches the public Gravatar profile and avatar. No API key. A photo can exist without a public profile.'));

  const row = el('div', 'ws-people-row');
  const input = el('input', 'ws-osint-search');
  input.type = 'email';
  input.placeholder = 'name@example.com';
  input.value = query || '';
  input.addEventListener('input', () => onQueryChange(input.value));
  const checkBtn = el('button', 'ws-btn', 'Look up');
  checkBtn.type = 'button';
  row.append(input, checkBtn);

  const status = el('p', 'ws-image-status', '');
  const out = el('div', 'ws-web-out');
  const credit = el('p', 'ws-osint-credit');
  credit.append(document.createTextNode('Profile data from '));
  const link = el('a', '', 'Gravatar');
  link.href = 'https://gravatar.com/';
  link.target = '_blank';
  link.rel = 'noopener';
  credit.append(link, document.createTextNode('. Only public profiles are returned.'));

  async function run() {
    const email = input.value.trim();
    if (!email.includes('@')) {
      flashButton(checkBtn, 'Invalid email', true);
      return;
    }
    checkBtn.disabled = true;
    out.replaceChildren();
    status.textContent = 'Checking Gravatar…';
    status.className = 'ws-image-status';
    try {
      const data = await lookupGravatar(email);
      if (!data.ok) {
        status.textContent = data.reason || 'Lookup failed.';
        status.className = 'ws-image-status is-bad';
        setToolResult('email:gravatar', { ok: false, email, reason: status.textContent });
        return;
      }
      status.textContent = '';
      paintGravatarResult(out, data);
      setToolResult('email:gravatar', data);
    } catch (err) {
      status.textContent = err.message || 'Lookup failed.';
      status.className = 'ws-image-status is-bad';
    } finally {
      checkBtn.disabled = false;
    }
  }

  checkBtn.addEventListener('click', run);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') run();
  });
  panel.append(row, status, out, credit);

  const saved = getToolResult('email:gravatar');
  if (saved?.ok) {
    input.value = saved.email || input.value;
    paintGravatarResult(out, saved);
  } else if (saved?.reason) {
    input.value = saved.email || input.value;
    status.textContent = saved.reason;
    status.className = 'ws-image-status is-bad';
  }
}

export function renderEmailTools(wrap, { tool, query, onQueryChange, onToolChange }) {
  wrap.dataset.osintReady = '';
  wrap._peopleAbort?.abort();
  if (tool === 'gmail') {
    paintGmail(wrap, { query, onQueryChange, onToolChange: bindToolBack(onToolChange, 'email:gmail') });
    return;
  }
  if (tool === 'xon') {
    paintXon(wrap, { query, onQueryChange, onToolChange: bindToolBack(onToolChange, 'email:xon') });
    return;
  }
  if (tool === 'hudson') {
    paintHudson(wrap, { query, onQueryChange, onToolChange: bindToolBack(onToolChange, 'email:hudson') });
    return;
  }
  if (tool === 'gravatar') {
    paintGravatar(wrap, { query, onQueryChange, onToolChange: bindToolBack(onToolChange, 'email:gravatar') });
    return;
  }
  paintCards(wrap, onToolChange);
}
