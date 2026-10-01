import { brw, flashButton, createFileButton, createStyledSelect } from './utils.js';
import { profileText, renderProfilerResults } from './textProfiler.js';
import { profileUrlFor } from './socialIdExtractor.js';
import { TelegramScraper } from './telegramScraper.js';
import { paintTelegramExport } from './workspaceTelegramExport.js';
import { paintFunstat } from './workspaceFunstat.js';
import { bindToolBack, getToolResult, setToolResult, clearToolResult, apiNote, apiCardLine, API_SOURCES, paintToolChrome } from './workspaceToolResults.js';

const TOOLS = [
  { id: 'text', name: 'Text Profiler', blurb: 'Extract emails, phones, wallets, and profile links from pasted text or HTML.' },
  {
    id: 'social',
    name: 'Social ID',
    blurb: 'Open a Facebook, Instagram, X, TikTok, or LinkedIn profile from a username or ID.',
    api: [API_SOURCES.profileSites]
  },
  {
    id: 'telegram',
    name: 'Telegram Profiler',
    blurb: 'Look up a public Telegram user, group, or channel.',
    api: [API_SOURCES.telegramWeb]
  },
  {
    id: 'phone',
    name: 'Phone Lookup',
    blurb: 'Open a number on Telegram, WhatsApp, Truecaller, or Sync.me.',
    api: [API_SOURCES.phoneSites]
  },
  { id: 'tg-export', name: 'Telegram Export Analyzer', blurb: 'Analyze a zipped Telegram JSON or HTML export: activity, participants, media, and identifiers.' },
  { id: 'funstat', name: 'Funstat Report Analyzer', blurb: 'Analyze a Funstat JSON dump: chats, activity, identifiers, and message search.' }
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
  wrap.className = 'ws-cards';
  wrap.replaceChildren();
  TOOLS.forEach((tool) => {
    const card = el('button', 'ws-tool-card');
    card.type = 'button';
    card.append(el('strong', '', tool.name), el('span', '', tool.blurb));
    const apiLine = apiCardLine(tool.api);
    if (apiLine) card.appendChild(apiLine);
    card.addEventListener('click', () => {
      if (tool.open) {
        brw.tabs.create({ url: brw.runtime.getURL(tool.open), active: true });
        return;
      }
      onToolChange(tool.id);
    });
    wrap.appendChild(card);
  });
}

function paintText(wrap, onToolChange) {
  const panel = toolChrome(wrap, 'Text Profiler', onToolChange, 'extra:text');
  panel.appendChild(el('p', 'ws-image-note', 'Paste text or HTML, or upload a .txt / .json / .html file. Identifiers are grouped and filterable, same as in the popup. Stays on this device.'));

  const area = el('textarea', 'ws-dork-preview');
  area.rows = 8;
  area.placeholder = 'Paste text or HTML to analyze…';

  const actions = el('div', 'ws-image-actions');
  const analyzeBtn = el('button', 'ws-btn', 'Analyze');
  const uploadBtn = createFileButton('Choose file');
  analyzeBtn.type = 'button';

  const input = el('input');
  input.type = 'file';
  input.accept = '.txt,.json,.html,.htm,text/plain,application/json,text/html';
  input.hidden = true;
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    area.value = await file.text();
    showResults(profileText(area.value));
  });

  const resultHost = el('div', 'ws-profiler');

  function showResults(rows, persist = true) {
    if (persist) setToolResult('extra:text', { text: area.value, rows });
    renderProfilerResults(rows, {
      host: resultHost,
      onClear: () => setToolResult('extra:text', { text: area.value, rows: [] })
    });
  }

  analyzeBtn.addEventListener('click', () => showResults(profileText(area.value)));
  area.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      showResults(profileText(area.value));
    }
  });
  uploadBtn.addEventListener('click', () => input.click());

  actions.append(analyzeBtn, uploadBtn);
  panel.append(area, actions, input, resultHost);

  const saved = getToolResult('extra:text');
  if (saved?.text) area.value = saved.text;
  if (saved?.rows) showResults(saved.rows, false);
}

function paintSocial(wrap, onToolChange) {
  const panel = toolChrome(wrap, 'Social ID', onToolChange, 'extra:social');
  panel.appendChild(apiNote([API_SOURCES.profileSites]));
  panel.appendChild(el('p', 'ws-image-note', 'Paste a username or ID and open the profile. Instagram and TikTok need a username — numeric IDs will not open. Reading an ID from a live page is in the popup.'));

  const row = el('div', 'ws-people-row');
  const select = createStyledSelect({
    value: 'facebook',
    options: [
      { value: 'facebook', label: 'Facebook' },
      { value: 'instagram', label: 'Instagram' },
      { value: 'twitter', label: 'Twitter / X' },
      { value: 'tiktok', label: 'TikTok' },
      { value: 'linkedin', label: 'LinkedIn' }
    ],
    onChange: () => {
      idInput.placeholder = {
        facebook: 'Numeric ID or username',
        instagram: 'Username — not the numeric ID',
        twitter: 'Username or numeric ID',
        tiktok: 'Username — not the numeric ID',
        linkedin: 'Profile slug, or company ID'
      }[select.value] || 'Username';
    }
  });
  const idInput = el('input', 'ws-osint-search');
  idInput.placeholder = 'Numeric ID or username';
  const goBtn = el('button', 'ws-btn', 'Open');
  goBtn.type = 'button';

  function persist() {
    const value = idInput.value.trim();
    if (value) setToolResult('extra:social', { platform: select.value, input: value });
  }

  goBtn.addEventListener('click', () => {
    const value = idInput.value.trim();
    if (!value) {
      flashButton(goBtn, 'Enter a value', true);
      return;
    }
    const url = profileUrlFor(select.value, value);
    if (!url) {
      flashButton(goBtn, 'Needs username', true);
      return;
    }
    persist();
    brw.tabs.create({ url, active: true });
  });
  idInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') goBtn.click();
  });
  row.append(select, idInput, goBtn);
  panel.append(row);

  const saved = getToolResult('extra:social');
  if (saved?.platform) select.value = saved.platform;
  if (saved?.input) {
    idInput.value = saved.input;
    idInput.placeholder = {
      facebook: 'Numeric ID or username',
      instagram: 'Username — not the numeric ID',
      twitter: 'Username or numeric ID',
      tiktok: 'Username — not the numeric ID',
      linkedin: 'Profile slug, or company ID'
    }[select.value] || idInput.placeholder;
  }
}

function paintTelegram(wrap, onToolChange) {
  const panel = toolChrome(wrap, 'Telegram Profiler', onToolChange, 'extra:telegram');
  panel.appendChild(apiNote([API_SOURCES.telegramWeb]));
  panel.appendChild(el('p', 'ws-image-note', 'Uses public Telegram pages only. Enter a username or t.me link.'));

  const row = el('div', 'ws-people-row');
  const input = el('input', 'ws-osint-search');
  input.placeholder = '@username or https://t.me/…';
  const goBtn = el('button', 'ws-btn', 'Look up');
  goBtn.type = 'button';
  row.append(input, goBtn);
  const status = el('p', 'ws-image-status', '');
  const out = el('div', 'ws-web-out');

  async function run() {
    const target = input.value.trim();
    if (!target) {
      flashButton(goBtn, 'Enter a username', true);
      return;
    }
    goBtn.disabled = true;
    status.textContent = 'Fetching public data…';
    status.className = 'ws-image-status';
    out.replaceChildren();
    try {
      const result = await TelegramScraper.analyze(target);
      if (!result.success) {
        status.textContent = result.error || 'Lookup failed.';
        status.className = 'ws-image-status is-bad';
        return;
      }
      const data = result.data || {};
      status.textContent = '';
      const table = el('table', 'ws-image-table');
      [
        ['Title', data.title],
        ['Username', data.username ? `@${data.username}` : ''],
        ['Type', data.type],
        ['Stats', data.stats],
        ['Verified', data.verified ? 'Yes' : '']
      ].forEach(([key, value]) => {
        if (!value) return;
        const rowEl = table.insertRow();
        rowEl.insertCell().textContent = key;
        rowEl.insertCell().textContent = String(value);
      });
      out.appendChild(table);
      const openHref = telegramOpenHref(data);
      if (openHref) {
        const link = el('a', 'ws-btn ws-btn-ghost', 'Open on Telegram');
        link.href = openHref;
        link.target = '_blank';
        link.rel = 'noopener';
        out.appendChild(link);
      }
      setToolResult('extra:telegram', { query: target, data });
    } catch (err) {
      console.error(err);
      status.textContent = 'Unexpected error.';
      status.className = 'ws-image-status is-bad';
    } finally {
      goBtn.disabled = false;
    }
  }

  goBtn.addEventListener('click', run);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') run();
  });
  panel.append(row, status, out);

  const saved = getToolResult('extra:telegram');
  if (saved?.data) {
    input.value = saved.query || input.value;
    const data = saved.data;
    const table = el('table', 'ws-image-table');
    [
      ['Title', data.title],
      ['Username', data.username ? `@${data.username}` : ''],
      ['Type', data.type],
      ['Stats', data.stats],
      ['Verified', data.verified ? 'Yes' : '']
    ].forEach(([key, value]) => {
      if (!value) return;
      const rowEl = table.insertRow();
      rowEl.insertCell().textContent = key;
      rowEl.insertCell().textContent = String(value);
    });
    out.appendChild(table);
    const openHref = telegramOpenHref(data);
    if (openHref) {
      const link = el('a', 'ws-btn ws-btn-ghost', 'Open on Telegram');
      link.href = openHref;
      link.target = '_blank';
      link.rel = 'noopener';
      out.appendChild(link);
    }
  }
}

function telegramOpenHref(data) {
  const url = String(data?.url || '');
  if (/^https:\/\/t\.me\//i.test(url)) return url;
  const username = String(data?.username || '').replace(/^@/, '');
  if (!username) return '';
  return `https://t.me/${username}`;
}

function paintPhone(wrap, onToolChange) {
  const panel = toolChrome(wrap, 'Phone Lookup', onToolChange, 'extra:phone');
  panel.appendChild(apiNote([API_SOURCES.phoneSites]));
  panel.appendChild(el('p', 'ws-image-note', 'Opens the number on public lookup pages. Include the country code.'));

  const input = el('input', 'ws-osint-search');
  input.placeholder = '+44252…';
  const actions = el('div', 'ws-image-actions');

  const platforms = [
    { name: 'Telegram', url: (clean) => `https://web.telegram.org/k/#?tgaddr=${encodeURIComponent(`tg://resolve?phone=${clean}`)}` },
    { name: 'WhatsApp', url: (clean) => `https://wa.me/${clean}` },
    { name: 'Truecaller', url: (clean, plus) => `https://www.truecaller.com/search/global/${encodeURIComponent(plus)}` },
    { name: 'Sync.me', url: (clean, plus) => `https://sync.me/search/?number=${encodeURIComponent(plus)}` }
  ];

  platforms.forEach((platform) => {
    const btn = el('button', 'ws-btn ws-btn-ghost', platform.name);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      const clean = input.value.trim().replace(/[\s+\-]/g, '');
      if (!clean) {
        flashButton(btn, 'Enter a number', true);
        return;
      }
      const plus = `+${clean}`;
      brw.tabs.create({ url: platform.url(clean, plus), active: false });
    });
    actions.appendChild(btn);
  });

  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (query) setToolResult('extra:phone', { query });
    else clearToolResult('extra:phone');
  });
  const saved = getToolResult('extra:phone');
  if (saved?.query) input.value = saved.query;

  panel.append(input, actions);
}

export function renderExtraTools(wrap, { tool, onToolChange }) {
  wrap.dataset.osintReady = '';
  if (tool === 'text') paintText(wrap, bindToolBack(onToolChange, 'extra:text'));
  else if (tool === 'social') paintSocial(wrap, bindToolBack(onToolChange, 'extra:social'));
  else if (tool === 'telegram') paintTelegram(wrap, bindToolBack(onToolChange, 'extra:telegram'));
  else if (tool === 'phone') paintPhone(wrap, bindToolBack(onToolChange, 'extra:phone'));
  else if (tool === 'tg-export') {
    paintTelegramExport(toolChrome(wrap, 'Telegram Export Analyzer', onToolChange));
  } else if (tool === 'funstat') {
    paintFunstat(toolChrome(wrap, 'Funstat Report Analyzer', onToolChange));
  } else paintCards(wrap, onToolChange);
}
