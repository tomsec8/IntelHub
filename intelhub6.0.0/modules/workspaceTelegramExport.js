import { brw, flashButton, isFirefox, createFileButton } from './utils.js';
import { extractEntities } from './textProfiler.js';

const MEDIA_FOLDERS = {
  'photos/': 'photo',
  'video_files/': 'video',
  'round_video_messages/': 'video',
  'voice_messages/': 'voice',
  'audio_files/': 'audio',
  'stickers/': 'sticker',
  'files/': 'file'
};

const KIND_LABELS = {
  photo: 'Photo',
  video: 'Video',
  voice: 'Voice',
  audio: 'Audio',
  sticker: 'Sticker',
  file: 'File',
  media: 'Media'
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DATE_SEPARATOR = /^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/;

const SENDER_COLORS = [
  '#5b9dff', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185',
  '#22d3ee', '#f97316', '#84cc16', '#e879f9', '#38bdf8', '#facc15'
];

function personKey(msg) {
  return msg?.fromId || `name:${msg?.from || 'Unknown'}`;
}

function senderColor(key) {
  let hash = 0;
  const value = String(key || 'Unknown');
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return SENDER_COLORS[hash % SENDER_COLORS.length];
}

function isImageFile(path) {
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(path || '');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

let charts = [];
let sessionCache = null;
let detachExportWatch = () => {};

const EXPORT_DB = 'intelhub-telegram-export';
const EXPORT_STORE = 'session';

function openExportDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(EXPORT_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(EXPORT_STORE)) {
        request.result.createObjectStore(EXPORT_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest(mode, run) {
  return openExportDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(EXPORT_STORE, mode);
    const request = run(tx.objectStore(EXPORT_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

function readHeldScroll() {
  try {
    const view = JSON.parse(localStorage.getItem('wsViewState') || '{}');
    return { x: Number(view.scrollX) || 0, y: Number(view.scrollY) || 0 };
  } catch {
    return { x: 0, y: 0 };
  }
}

function destroyCharts() {
  charts.forEach((chart) => {
    try {
      chart.destroy();
    } catch {
      /* already gone */
    }
  });
  charts = [];
}

function kindFromPath(path) {
  const value = String(path || '');
  const folder = Object.keys(MEDIA_FOLDERS).find((prefix) => value.startsWith(prefix));
  return folder ? MEDIA_FOLDERS[folder] : '';
}

function kindFromClasses(node) {
  if (node.querySelector('.sticker_wrap, .media_sticker')) return 'sticker';
  if (node.querySelector('.media_voice_message')) return 'voice';
  if (node.querySelector('.media_video, .video_file_wrap, .animated_wrap')) return 'video';
  if (node.querySelector('.media_audio_file')) return 'audio';
  if (node.querySelector('.photo_wrap, .media_photo')) return 'photo';
  if (node.querySelector('.media_file')) return 'file';
  if (node.querySelector('.media_wrap')) return 'media';
  return '';
}

function textFromExport(value) {
  if (typeof value === 'string') return value.trim();
  if (!Array.isArray(value)) return '';
  return value.map((part) => {
    if (typeof part === 'string') return part;
    if (!part || typeof part !== 'object') return '';
    const visible = String(part.text || '');
    const href = String(part.href || '');
    if (href && href !== visible) return `${visible} ${href}`;
    return visible;
  }).join('').trim();
}

function messageTime(item) {
  const unix = Number(item?.date_unixtime);
  if (Number.isFinite(unix) && unix > 0) return unix * 1000;
  const parsed = Date.parse(item?.date || '');
  return Number.isNaN(parsed) ? null : parsed;
}

function exportMedia(item) {
  const candidates = [item.photo, item.file, item.thumbnail]
    .filter((value) => typeof value === 'string' && value && !value.startsWith('('))
    .map((value) => value.replace(/\\/g, '/'));
  const mediaPath = candidates.find((value) => !/^https?:/i.test(value)) || '';
  const mediaType = String(item.media_type || '');
  let kind = kindFromPath(mediaPath);
  if (!kind) {
    if (mediaType === 'voice_message') kind = 'voice';
    else if (mediaType === 'video_message' || mediaType === 'video_file' || mediaType === 'animation') kind = 'video';
    else if (mediaType === 'audio_file') kind = 'audio';
    else if (mediaType === 'sticker') kind = 'sticker';
    else if (typeof item.photo === 'string' && item.photo && !item.photo.startsWith('(')) kind = 'photo';
    else if (mediaPath) kind = 'file';
  }
  return {
    kind,
    mediaPath,
    mediaTitle: item.file_name || item.sticker_emoji || ''
  };
}

function serviceText(item) {
  const action = String(item.action || 'service').replace(/_/g, ' ');
  const actor = item.actor || '';
  const members = Array.isArray(item.members) ? item.members.filter(Boolean).join(', ') : '';
  const title = item.title || textFromExport(item.text);
  return [actor, action, members || title].filter(Boolean).join(' · ');
}

function parseTelegramJson(payload) {
  const list = payload?.messages;
  if (!payload || typeof payload !== 'object' || !Array.isArray(list)) {
    throw new Error('This JSON is not a Telegram chat export.');
  }
  const messages = [];
  const events = [];
  list.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    if (item.type === 'service') {
      const text = serviceText(item);
      if (text) events.push(text);
      return;
    }
    if (item.type && item.type !== 'message') return;
    const media = exportMedia(item);
    const id = Number(item.id);
    const contact = item.contact_information && typeof item.contact_information === 'object'
      ? {
        name: [item.contact_information.first_name, item.contact_information.last_name].filter(Boolean).join(' '),
        phone: item.contact_information.phone_number || ''
      }
      : null;
    const place = item.location_information && typeof item.location_information === 'object'
      ? {
        lat: item.location_information.latitude,
        lon: item.location_information.longitude,
        label: item.place_name || item.location_information.place_name || item.address || ''
      }
      : null;
    messages.push({
      id: Number.isFinite(id) ? id : messages.length + 1,
      from: item.from || item.actor || item.from_id || 'Unknown',
      fromId: item.from_id || '',
      date: messageTime(item),
      text: textFromExport(item.text),
      replyTo: Number.isFinite(Number(item.reply_to_message_id)) ? Number(item.reply_to_message_id) : null,
      forwardedFrom: item.forwarded_from || '',
      forwardedFromId: item.forwarded_from_id || '',
      viaBot: item.via_bot || '',
      edited: item.edited || '',
      contact,
      location: place,
      mime: item.mime_type || '',
      kind: media.kind,
      mediaPath: media.mediaPath,
      mediaTitle: media.mediaTitle
    });
  });
  return {
    chatTitle: payload.name || 'Telegram chat',
    messages,
    events
  };
}

function parseExportDate(title) {
  const parts = String(title || '').match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!parts) return null;
  const date = new Date(
    Number(parts[3]),
    Number(parts[2]) - 1,
    Number(parts[1]),
    Number(parts[4]),
    Number(parts[5]),
    Number(parts[6])
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Telegram omits `.from_name` on consecutive messages from the same sender
 * (`message default joined`), so the sender carries over between elements.
 */
function parseHistory(doc, state) {
  const history = doc.querySelector('.history');
  if (!history) return;

  Array.from(history.children).forEach((node) => {
    if (!node.classList?.contains('message')) return;

    if (node.classList.contains('service')) {
      const text = node.querySelector('.body.details')?.textContent.trim() || '';
      if (!text || DATE_SEPARATOR.test(text)) return;
      state.events.push(text);
      return;
    }

    const body = node.querySelector(':scope > .body');
    if (!body) return;

    const id = Number.parseInt(String(node.id || '').replace('message', ''), 10);
    const rawName = body.querySelector(':scope > .from_name')?.textContent.trim();
    const from = rawName || state.lastSender || 'Unknown';
    if (rawName) state.lastSender = rawName;

    const date = parseExportDate(
      body.querySelector(':scope > .pull_right.date.details')?.getAttribute('title')
    );

    const forwardedBody = body.querySelector(':scope > .forwarded.body');
    const forwardedFrom = forwardedBody
      ? (forwardedBody.querySelector(':scope > .from_name')?.childNodes[0]?.textContent || '').trim()
      : '';

    const textEl = forwardedBody
      ? forwardedBody.querySelector(':scope > .text')
      : body.querySelector(':scope > .text');
    const text = textEl ? textEl.textContent.trim() : '';

    const replyHref = node.querySelector('.reply_to a[href]')?.getAttribute('href') || '';
    const replyTo = Number.parseInt(replyHref.replace('#go_to_message', ''), 10);

    const mediaLink = node.querySelector('.media_wrap a[href], a.photo_wrap[href]');
    const mediaPath = mediaLink ? decodeURI(mediaLink.getAttribute('href') || '') : '';
    const mediaTitle = node.querySelector('.media_wrap .title.bold')?.textContent.trim() || '';
    const kind = kindFromPath(mediaPath) || kindFromClasses(node);

    state.messages.push({
      id: Number.isNaN(id) ? state.messages.length + 1 : id,
      from,
      fromId: '',
      date: date ? date.getTime() : null,
      text,
      replyTo: Number.isNaN(replyTo) ? null : replyTo,
      forwardedFrom,
      forwardedFromId: '',
      viaBot: '',
      edited: '',
      contact: null,
      location: null,
      mime: '',
      kind,
      mediaPath: mediaPath && !/^https?:/i.test(mediaPath) ? mediaPath : '',
      mediaTitle
    });
  });
}

function collectStats(messages) {
  const perUser = new Map();
  const hours = new Array(24).fill(0);
  const weekdays = new Array(7).fill(0);
  const buckets = new Map();
  const domains = new Map();
  const kinds = new Map();

  let first = null;
  let last = null;
  let withMedia = 0;
  let replies = 0;
  let forwards = 0;

  messages.forEach((msg) => {
    let stat = perUser.get(personKey(msg));
    if (!stat) {
      stat = {
        key: personKey(msg),
        name: msg.from,
        id: msg.fromId || '',
        count: 0,
        media: 0,
        chars: 0,
        first: null,
        last: null
      };
      perUser.set(stat.key, stat);
    }
    if (msg.fromId && !stat.id) stat.id = msg.fromId;
    stat.count += 1;
    stat.chars += msg.text.length;
    if (msg.kind) stat.media += 1;

    if (msg.kind) {
      withMedia += 1;
      kinds.set(msg.kind, (kinds.get(msg.kind) || 0) + 1);
    }
    if (msg.replyTo) replies += 1;
    if (msg.forwardedFrom) forwards += 1;

    if (msg.date) {
      const date = new Date(msg.date);
      hours[date.getHours()] += 1;
      weekdays[date.getDay()] += 1;
      if (first == null || msg.date < first) first = msg.date;
      if (last == null || msg.date > last) last = msg.date;
      if (stat.first == null || msg.date < stat.first) stat.first = msg.date;
      if (stat.last == null || msg.date > stat.last) stat.last = msg.date;
    }

    (msg.text.match(/https?:\/\/[^\s"'<>)]+/gi) || []).forEach((raw) => {
      try {
        const host = new URL(raw).hostname.replace(/^www\./, '').toLowerCase();
        domains.set(host, (domains.get(host) || 0) + 1);
      } catch {
        /* malformed link */
      }
    });
  });

  const spanDays = first != null && last != null
    ? Math.max(1, Math.round((last - first) / 86400000) + 1)
    : 1;

  const granularity = spanDays > 730 ? 'month' : spanDays > 120 ? 'week' : 'day';
  messages.forEach((msg) => {
    if (!msg.date) return;
    const key = bucketKey(msg.date, granularity);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });

  return {
    perUser: [...perUser.values()].sort((a, b) => b.count - a.count),
    hours,
    weekdays,
    buckets: [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    granularity,
    domains: [...domains.entries()].sort((a, b) => b[1] - a[1]),
    kinds,
    first,
    last,
    spanDays,
    withMedia,
    replies,
    forwards
  };
}

function bucketKey(time, granularity) {
  const date = new Date(time);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  if (granularity === 'month') return `${year}-${month}`;
  if (granularity === 'week') {
    const monday = new Date(date);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  }
  return `${year}-${month}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(time) {
  if (!time) return '—';
  return new Date(time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(time) {
  if (!time) return 'No date';
  return new Date(time).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function chartTheme() {
  const styles = getComputedStyle(document.documentElement);
  return {
    text: styles.getPropertyValue('--muted').trim() || '#a8b0c2',
    grid: 'rgba(255, 255, 255, 0.08)',
    accent: '#6ea8ff',
    accentSoft: 'rgba(110, 168, 255, 0.28)',
    palette: ['#6ea8ff', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#38bdf8', '#fb923c', '#4ade80']
  };
}

function baseChartOptions(theme) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(8, 12, 20, 0.92)',
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        padding: 10
      }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: theme.grid }, ticks: { color: theme.text } },
      x: { grid: { display: false }, ticks: { color: theme.text, maxRotation: 0, autoSkip: true } }
    }
  };
}

function chartCard(title, subtitle) {
  const card = el('div', 'ws-tg-chart');
  const head = el('div', 'ws-tg-chart-head');
  head.append(el('strong', '', title));
  if (subtitle) head.append(el('span', '', subtitle));
  const canvas = document.createElement('canvas');
  card.append(head, canvas);
  return { card, canvas };
}

function statCard(value, label) {
  const card = el('div', 'ws-tg-stat');
  card.append(el('strong', '', value), el('span', '', label));
  return card;
}

function toCsv(rows) {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return rows.map((row) => row.map(escape).join(',')).join('\n');
}

async function download(content, filename, mime) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  if (isFirefox()) {
    const link = el('a');
    link.href = url;
    link.download = filename;
    link.click();
  } else {
    await brw.downloads.download({ url, filename, saveAs: true }).catch(() => {});
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function paintTelegramExport(panel) {
  destroyCharts();

  let data = null;
  let filtered = [];
  let page = 1;
  let readingRtl = false;
  let identifierNeedles = [];
  let focusPerson = () => {};
  let findText = () => {};
  let pendingView = null;
  let restoringSession = false;
  let restorePageScroll = false;
  let explorerUi = null;
  let viewTimer = 0;
  let activeName = '';
  const heldPageScroll = readHeldScroll();
  const previewUrls = new Map();

  function revokePreviews() {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.clear();
  }

  panel.append(
    el(
      'p',
      'ws-image-note',
      'Reads a zipped Telegram Desktop export. JSON (result.json) and HTML (messages.html) both work. Nothing is uploaded.'
    )
  );

  const help = el('details', 'ws-tg-help');
  help.append(el('summary', '', 'How to create the export'));
  const steps = el('ol');
  [
    'Telegram Desktop → open the chat → ⋮ → Export chat history.',
    'Format can be JSON or HTML. Tick Photos, Videos, Files and Voice messages if you want previews.',
    'Zip the whole exported folder (right-click the folder → Compress / Send to compressed folder).',
    'Choose that .zip below. The picker accepts a .zip only.'
  ].forEach((step) => steps.append(el('li', '', step)));
  help.append(steps);
  panel.append(help);

  const drop = el('div', 'ws-tg-drop');
  const pickBtn = createFileButton('Choose .zip file');
  const clearBtn = el('button', 'ws-btn ws-btn-ghost', 'Clear');
  clearBtn.type = 'button';
  clearBtn.hidden = true;
  const actions = el('div', 'ws-tg-drop-actions');
  actions.append(pickBtn, clearBtn);
  const input = el('input');
  input.type = 'file';
  input.accept = '.zip,application/zip';
  input.hidden = true;
  drop.append(el('span', '', 'Drop the zipped chat export'), actions, input);

  const status = el('p', 'ws-image-status', '');
  const results = el('div', 'ws-tg-results');
  results.hidden = true;

  panel.append(drop, input, status, results);

  const modal = el('div', 'ws-tg-modal');
  const modalInner = el('div', 'ws-tg-modal-box');
  const modalClose = el('button', 'ws-tg-modal-close', '×');
  modalClose.type = 'button';
  const modalBody = el('div', 'ws-tg-modal-body');
  modalInner.append(modalClose, modalBody);
  modal.append(modalInner);
  modal.hidden = true;
  panel.append(modal);

  function closeModal() {
    modal.hidden = true;
    modalBody.replaceChildren();
  }
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  pickBtn.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (file) load(file);
  });

  ['dragover', 'dragenter'].forEach((type) => {
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.add('is-over');
    });
  });
  ['dragleave', 'drop'].forEach((type) => {
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.remove('is-over');
    });
  });
  drop.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setStatus('Choose the .zip of the exported folder.', 'is-bad');
      return;
    }
    load(file);
  });

  function setStatus(text, tone = '') {
    status.textContent = text;
    status.className = `ws-image-status${tone ? ` ${tone}` : ''}`;
  }

  function snapshotView() {
    if (!explorerUi) return null;
    return {
      page,
      rtl: readingRtl,
      search: explorerUi.search.value,
      id: explorerUi.idFilter.value,
      sender: explorerUi.sender.value,
      kind: explorerUi.kind.value,
      from: explorerUi.from.value,
      to: explorerUi.to.value,
      perPage: explorerUi.perPage.value,
      listScroll: explorerUi.list.scrollTop
    };
  }

  function scheduleSaveView() {
    if (restoringSession || !data || !explorerUi) return;
    clearTimeout(viewTimer);
    viewTimer = setTimeout(() => {
      const view = snapshotView();
      if (!view) return;
      if (sessionCache) sessionCache.view = view;
      idbRequest('readwrite', (store) => store.put(view, 'view')).catch((err) => {
        console.error('[Telegram export] view', err);
      });
    }, 160);
  }

  function placeScroll(listScroll) {
    const place = () => {
      if (explorerUi?.list && listScroll != null) explorerUi.list.scrollTop = listScroll;
      if (!restorePageScroll) return;
      window.scrollTo(heldPageScroll.x, heldPageScroll.y);
      document.documentElement.scrollTop = heldPageScroll.y;
      document.body.scrollTop = heldPageScroll.y;
    };
    requestAnimationFrame(place);
    setTimeout(place, 80);
    setTimeout(place, 350);
    setTimeout(place, 900);
    setTimeout(place, 1600);
  }

  async function clearSaved() {
    detachExportWatch();
    destroyCharts();
    revokePreviews();
    data = null;
    filtered = [];
    sessionCache = null;
    pendingView = null;
    results.hidden = true;
    results.replaceChildren();
    clearBtn.hidden = true;
    setStatus('Saved export cleared.');
    try {
      await idbRequest('readwrite', (store) => store.delete('archive'));
      await idbRequest('readwrite', (store) => store.delete('view'));
    } catch (err) {
      console.error('[Telegram export] clear', err);
    }
  }

  clearBtn.addEventListener('click', () => {
    clearSaved();
  });

  function finishLoad(parsed, media, fileName) {
    if (!parsed.messages.length) throw new Error('The export contained no readable messages.');
    const byId = new Map();
    parsed.messages.forEach((msg) => byId.set(msg.id, msg));
    data = {
      chatTitle: parsed.chatTitle,
      media,
      messages: parsed.messages,
      events: parsed.events,
      byId
    };
    sessionCache = {
      data,
      name: fileName || sessionCache?.name || 'export.zip',
      view: pendingView
    };
    clearBtn.hidden = false;
    setStatus(`${parsed.messages.length.toLocaleString()} messages parsed.`, 'is-ok');
    renderReport();
  }

  function mediaBeside(zip, jsonPath) {
    const base = jsonPath.includes('/') ? jsonPath.slice(0, jsonPath.lastIndexOf('/') + 1) : '';
    const media = new Map();
    zip.forEach((path, entry) => {
      if (entry.dir || !path.startsWith(base)) return;
      const relative = path.slice(base.length).replace(/\\/g, '/');
      if (relative && kindFromPath(relative)) media.set(relative, entry);
    });
    return media;
  }

  function findResultJson(zip) {
    const hits = [];
    zip.forEach((path, entry) => {
      if (entry.dir) return;
      if (/^result\.json$/i.test(path.split('/').pop())) hits.push({ path, entry });
    });
    hits.sort((a, b) => a.path.split('/').length - b.path.split('/').length);
    return hits[0] || null;
  }

  async function loadHtmlZip(zip) {
    const htmlEntries = [];
    zip.forEach((path, entry) => {
      if (!entry.dir && /(?:^|\/)messages\d*\.html$/i.test(path)) htmlEntries.push({ path, entry });
    });
    htmlEntries.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    if (!htmlEntries.length) {
      throw new Error('No Telegram export found. Zip a JSON export (result.json) or an HTML export (messages.html).');
    }

    const media = mediaBeside(zip, htmlEntries[0].path);
    const parser = new DOMParser();
    const state = { messages: [], events: [], lastSender: '' };
    let chatTitle = 'Telegram chat';

    for (let i = 0; i < htmlEntries.length; i++) {
      setStatus(`Parsing HTML file ${i + 1} of ${htmlEntries.length}…`);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const html = await htmlEntries[i].entry.async('string');
      const doc = parser.parseFromString(html, 'text/html');
      if (i === 0) {
        chatTitle = doc.querySelector('.page_header .text.bold')?.textContent.trim() || chatTitle;
      }
      parseHistory(doc, state);
    }

    finishLoad({ chatTitle, messages: state.messages, events: state.events }, media, activeName);
  }

  async function load(file, options = {}) {
    const restoring = Boolean(options.restore);
    if (!restoring) {
      pendingView = null;
      restorePageScroll = false;
      restoringSession = true;
    }
    activeName = file.name || activeName || 'export.zip';
    destroyCharts();
    revokePreviews();
    results.hidden = true;
    results.replaceChildren();
    try {
      if (!activeName.toLowerCase().endsWith('.zip')) {
        restoringSession = false;
        setStatus('Choose the .zip of the exported folder.', 'is-bad');
        return;
      }

      if (typeof JSZip === 'undefined') {
        restoringSession = false;
        setStatus('Zip support failed to load. Reload the workspace.', 'is-bad');
        return;
      }

      setStatus(restoring ? 'Restoring saved export…' : 'Reading archive…');
      const bytes = options.bytes || await file.arrayBuffer();
      const zip = await JSZip.loadAsync(bytes.slice(0));
      const jsonHit = findResultJson(zip);
      if (jsonHit) {
        setStatus('Parsing result.json…');
        await new Promise((resolve) => setTimeout(resolve, 0));
        const parsed = parseTelegramJson(JSON.parse(await jsonHit.entry.async('string')));
        finishLoad(parsed, mediaBeside(zip, jsonHit.path), activeName);
      } else {
        await loadHtmlZip(zip);
      }

      if (!restoring) {
        try {
          await idbRequest('readwrite', (store) => store.put({ name: activeName, bytes }, 'archive'));
          await idbRequest('readwrite', (store) => store.delete('view'));
          if (sessionCache) sessionCache.view = null;
          restoringSession = false;
          scheduleSaveView();
          setStatus(
            `${data.messages.length.toLocaleString()} messages parsed. Kept until you clear it or load another file.`,
            'is-ok'
          );
        } catch (err) {
          console.error('[Telegram export] save', err);
          restoringSession = false;
          setStatus('Parsed, but this export could not be kept after a refresh.', 'is-bad');
        }
      } else {
        setStatus(`Restored ${data.messages.length.toLocaleString()} messages from ${activeName}.`, 'is-ok');
      }
    } catch (err) {
      console.error('[Telegram export]', err);
      const message = err instanceof SyntaxError
        ? 'This JSON is not a Telegram chat export.'
        : (err.message || 'Could not read this archive.');
      setStatus(message, 'is-bad');
      restoringSession = false;
      if (restoring) clearBtn.hidden = false;
    }
  }

  function renderReport() {
    const stats = collectStats(data.messages);
    results.replaceChildren();
    results.hidden = false;

    const head = el('div', 'ws-tg-head');
    const titleBox = el('div');
    titleBox.append(el('strong', '', data.chatTitle));
    titleBox.append(
      el(
        'span',
        '',
        `${formatDate(stats.first)} → ${formatDate(stats.last)} · ${stats.spanDays.toLocaleString()} days`
      )
    );
    const headActions = el('div', 'ws-image-actions');
    const csvBtn = el('button', 'ws-btn ws-btn-ghost', 'Export CSV');
    const jsonBtn = el('button', 'ws-btn ws-btn-ghost', 'Export JSON');
    csvBtn.type = jsonBtn.type = 'button';
    csvBtn.addEventListener('click', async () => {
      const rows = [['Date', 'Sender', 'Telegram ID', 'Text', 'Media', 'Forwarded from', 'Reply to']];
      filtered.forEach((msg) => {
        rows.push([
          msg.date ? new Date(msg.date).toISOString() : '',
          msg.from,
          msg.fromId || '',
          msg.text,
          msg.mediaPath || (msg.kind ? KIND_LABELS[msg.kind] : ''),
          msg.forwardedFrom,
          msg.replyTo || ''
        ]);
      });
      await download(toCsv(rows), 'telegram_export.csv', 'text/csv');
      flashButton(csvBtn, 'Exported');
    });
    jsonBtn.addEventListener('click', async () => {
      await download(
        JSON.stringify({ chat: data.chatTitle, messages: filtered }, null, 2),
        'telegram_export.json',
        'application/json'
      );
      flashButton(jsonBtn, 'Exported');
    });
    headActions.append(csvBtn, jsonBtn);
    head.append(titleBox, headActions);
    results.append(head);

    const grid = el('div', 'ws-tg-stats');
    grid.append(statCard(data.messages.length.toLocaleString(), 'Messages'));
    grid.append(statCard(String(stats.perUser.length), 'Participants'));
    grid.append(
      statCard(Math.round(data.messages.length / stats.spanDays).toLocaleString(), 'Messages / day')
    );
    grid.append(statCard(stats.withMedia.toLocaleString(), 'With media'));
    grid.append(statCard(stats.replies.toLocaleString(), 'Replies'));
    grid.append(statCard(stats.forwards.toLocaleString(), 'Forwarded'));
    if (data.events.length) grid.append(statCard(data.events.length.toLocaleString(), 'Group events'));
    results.append(grid);

    renderCharts(stats);
    renderParticipants(stats);
    renderDomains(stats);
    renderExplorer(stats);
  }

  function renderCharts(stats) {
    if (typeof Chart === 'undefined') {
      results.append(el('p', 'ws-image-note', 'Charts unavailable — reload the workspace to load Chart.js.'));
      return;
    }
    const theme = chartTheme();
    const wrap = el('div', 'ws-tg-charts');

    const timeline = chartCard('Activity over time', `per ${stats.granularity}`);
    const senders = chartCard('Top senders', 'messages');
    const hours = chartCard('Activity by hour', 'local time');
    const weekdays = chartCard('Activity by weekday');
    wrap.append(timeline.card, senders.card, hours.card, weekdays.card);
    results.append(wrap);

    charts.push(
      new Chart(timeline.canvas, {
        type: 'line',
        data: {
          labels: stats.buckets.map(([key]) => key),
          datasets: [
            {
              data: stats.buckets.map(([, count]) => count),
              borderColor: theme.accent,
              backgroundColor: theme.accentSoft,
              fill: true,
              tension: 0.3,
              pointRadius: stats.buckets.length > 60 ? 0 : 3
            }
          ]
        },
        options: baseChartOptions(theme)
      })
    );

    const topSenders = stats.perUser.slice(0, 12);
    charts.push(
      new Chart(senders.canvas, {
        type: 'bar',
        data: {
          labels: topSenders.map((user) => (user.name.length > 22 ? `${user.name.slice(0, 22)}…` : user.name)),
          datasets: [
            {
              data: topSenders.map((user) => user.count),
              backgroundColor: theme.accentSoft,
              borderColor: theme.accent,
              borderWidth: 1,
              borderRadius: 6
            }
          ]
        },
        options: {
          ...baseChartOptions(theme),
          indexAxis: 'y',
          scales: {
            x: { beginAtZero: true, grid: { color: theme.grid }, ticks: { color: theme.text } },
            y: { grid: { display: false }, ticks: { color: theme.text } }
          }
        }
      })
    );

    charts.push(
      new Chart(hours.canvas, {
        type: 'bar',
        data: {
          labels: stats.hours.map((_, hour) => `${String(hour).padStart(2, '0')}`),
          datasets: [
            {
              data: stats.hours,
              backgroundColor: 'rgba(52, 211, 153, 0.32)',
              borderColor: '#34d399',
              borderWidth: 1,
              borderRadius: 5
            }
          ]
        },
        options: baseChartOptions(theme)
      })
    );

    charts.push(
      new Chart(weekdays.canvas, {
        type: 'bar',
        data: {
          labels: WEEKDAYS.map((day) => day.slice(0, 3)),
          datasets: [
            {
              data: stats.weekdays,
              backgroundColor: 'rgba(251, 191, 36, 0.3)',
              borderColor: '#fbbf24',
              borderWidth: 1,
              borderRadius: 5
            }
          ]
        },
        options: baseChartOptions(theme)
      })
    );
  }

  function renderParticipants(stats) {
    const section = el('section', 'ws-tg-section');
    section.append(el('h3', '', 'Participants'));
    section.append(el('p', 'ws-image-note', 'Each person keeps one color. Click a row to show only their messages.'));
    const wrap = el('div', 'ws-image-table-wrap ws-tg-scroll');
    const table = el('table', 'ws-tg-table');
    const header = table.createTHead().insertRow();
    ['', 'Name', 'Telegram ID', 'Messages', 'Share', 'Media', 'First seen', 'Last seen'].forEach((label) => {
      const cell = document.createElement('th');
      cell.textContent = label;
      header.appendChild(cell);
    });
    const body = table.createTBody();
    stats.perUser.forEach((user) => {
      const row = body.insertRow();
      row.className = 'ws-tg-person';
      const swatchCell = row.insertCell();
      const swatch = el('span', 'ws-tg-swatch');
      swatch.style.background = senderColor(user.key);
      swatchCell.append(swatch);
      row.insertCell().textContent = user.name;
      row.insertCell().textContent = user.id || '—';
      row.insertCell().textContent = user.count.toLocaleString();
      row.insertCell().textContent = `${((user.count / data.messages.length) * 100).toFixed(1)}%`;
      row.insertCell().textContent = user.media.toLocaleString();
      row.insertCell().textContent = formatDate(user.first);
      row.insertCell().textContent = formatDate(user.last);
      row.addEventListener('click', () => focusPerson(user.key));
    });
    wrap.append(table);
    section.append(wrap);
    results.append(section);
  }

  function renderDomains(stats) {
    if (!stats.domains.length) return;
    const section = el('section', 'ws-tg-section');
    section.append(el('h3', '', 'Shared domains'));
    const list = el('div', 'ws-tg-chips');
    stats.domains.slice(0, 40).forEach(([domain, count]) => {
      const chip = el('button', 'ws-tg-chip', `${domain} · ${count}`);
      chip.type = 'button';
      chip.title = `Open ${domain}`;
      chip.addEventListener('click', () => {
        brw.tabs.create({ url: `https://${domain}`, active: false });
      });
      list.append(chip);
    });
    section.append(list);
    results.append(section);
  }

  function collectNeedles() {
    const text = data.messages
      .map((msg) => [msg.text, msg.mediaTitle, msg.contact?.phone, msg.contact?.name].filter(Boolean).join('\n'))
      .join('\n');
    return extractEntities(text)
      .map((hit) => ({ type: hit.type, value: hit.value, lower: hit.value.toLowerCase() }))
      .filter((hit) => hit.lower.length >= 4)
      .sort((a, b) => b.lower.length - a.lower.length);
  }

  function renderExplorer(stats) {
    const section = el('section', 'ws-tg-section');
    section.append(el('h3', '', 'Message explorer'));

    const filters = el('div', 'ws-tg-filters');
    const sender = el('select');
    const allOption = el('option', '', 'All senders');
    allOption.value = 'all';
    sender.append(allOption);
    stats.perUser.forEach((user) => {
      const option = el('option', '', user.id ? `${user.name} · ${user.id} (${user.count})` : `${user.name} (${user.count})`);
      option.value = user.key;
      sender.append(option);
    });

    const kind = el('select');
    [
      ['all', 'All content'],
      ['text', 'Text only'],
      ['media', 'Any media'],
      ['photo', 'Photos'],
      ['video', 'Videos'],
      ['voice', 'Voice'],
      ['file', 'Files'],
      ['sticker', 'Stickers'],
      ['link', 'Contains a link'],
      ['forward', 'Forwarded'],
      ['reply', 'Replies']
    ].forEach(([value, label]) => {
      const option = el('option', '', label);
      option.value = value;
      kind.append(option);
    });

    const from = el('input');
    from.type = 'date';
    from.title = 'From date';
    const to = el('input');
    to.type = 'date';
    to.title = 'To date';

    const idFilter = el('input', 'ws-osint-search');
    idFilter.type = 'search';
    idFilter.placeholder = 'Telegram ID…';

    const search = el('input', 'ws-osint-search ws-tg-free-search');
    search.type = 'search';
    search.placeholder = 'Free search across the whole export…';
    search.setAttribute('aria-label', 'Free search across the whole export');

    const perPage = el('select');
    [50, 100, 200, 500].forEach((size) => {
      const option = el('option', '', `${size} per page`);
      option.value = String(size);
      if (size === 100) option.selected = true;
      perPage.append(option);
    });

    const resetBtn = el('button', 'ws-btn ws-btn-ghost', 'Reset');
    resetBtn.type = 'button';

    const searchRow = el('div', 'ws-tg-search-row');
    const dir = el('div', 'ws-tg-dir');
    const ltrBtn = el('button', 'ws-btn ws-btn-ghost is-on', 'LTR');
    const rtlBtn = el('button', 'ws-btn ws-btn-ghost', 'RTL');
    ltrBtn.type = rtlBtn.type = 'button';
    ltrBtn.title = 'Left to right';
    rtlBtn.title = 'Right to left';
    dir.append(ltrBtn, rtlBtn);
    searchRow.append(search, dir);

    filters.append(sender, kind, from, to, idFilter, perPage, resetBtn);

    identifierNeedles = collectNeedles();
    const idBox = el('div', 'ws-tg-ids');
    if (identifierNeedles.length) {
      const grouped = new Map();
      identifierNeedles.forEach((hit) => {
        if (!grouped.has(hit.type)) grouped.set(hit.type, []);
        grouped.get(hit.type).push(hit);
      });
      grouped.forEach((hits, type) => {
        const group = el('div', 'ws-tg-id-group');
        group.append(el('span', 'ws-tg-id-label', type));
        hits.forEach((hit) => {
          const chip = el('button', 'ws-tg-chip', hit.value);
          chip.type = 'button';
          chip.title = `Search every message for this ${type}`;
          chip.addEventListener('click', () => findText(hit.value));
          group.append(chip);
        });
        idBox.append(group);
      });
    }

    const count = el('p', 'ws-image-status', '');
    const list = el('div', 'ws-tg-messages');
    list.dir = 'ltr';
    const pager = el('div', 'ws-tg-pager');
    section.append(searchRow, idBox, filters, count, list, pager);
    results.append(section);

    function apply() {
      page = 1;
      const query = search.value.trim().toLowerCase();
      const fromTime = from.value ? new Date(`${from.value}T00:00:00`).getTime() : null;
      const toTime = to.value ? new Date(`${to.value}T23:59:59`).getTime() : null;

      filtered = data.messages.filter((msg) => {
        if (sender.value !== 'all' && personKey(msg) !== sender.value) return false;
        if (kind.value === 'text' && (msg.kind || !msg.text)) return false;
        if (kind.value === 'media' && !msg.kind) return false;
        if (kind.value === 'link' && !/https?:\/\//i.test(msg.text)) return false;
        if (kind.value === 'forward' && !msg.forwardedFrom) return false;
        if (kind.value === 'reply' && !msg.replyTo) return false;
        if (['photo', 'video', 'voice', 'file', 'sticker'].includes(kind.value) && msg.kind !== kind.value) {
          return false;
        }
        if (fromTime && (!msg.date || msg.date < fromTime)) return false;
        if (toTime && (!msg.date || msg.date > toTime)) return false;
        const idQuery = idFilter.value.trim().toLowerCase();
        if (idQuery) {
          const haystack = `${msg.fromId} ${msg.forwardedFromId}`.toLowerCase();
          if (!haystack.includes(idQuery)) return false;
        }
        if (query) {
          const blob = `${msg.text} ${msg.mediaTitle || ''} ${msg.from} ${msg.fromId} ${msg.forwardedFrom} ${msg.contact?.phone || ''} ${msg.contact?.name || ''}`.toLowerCase();
          if (!blob.includes(query)) return false;
        }
        return true;
      });

      paint();
      scheduleSaveView();
    }

    function paint() {
      const size = Number(perPage.value);
      const pages = Math.max(1, Math.ceil(filtered.length / size));
      page = Math.min(page, pages);
      count.textContent = pages > 1
        ? `${filtered.length.toLocaleString()} matches in the whole export · page ${page} of ${pages}`
        : `${filtered.length.toLocaleString()} matches in the whole export`;
      list.replaceChildren();

      if (!filtered.length) {
        list.append(el('p', 'ws-image-note', 'Nothing matches these filters.'));
        pager.replaceChildren();
        return;
      }

      filtered.slice((page - 1) * size, page * size).forEach((msg) => {
        list.append(messageRow(msg));
      });

      pager.replaceChildren();
      const prev = el('button', 'ws-btn ws-btn-ghost', 'Previous');
      const next = el('button', 'ws-btn ws-btn-ghost', 'Next');
      prev.type = next.type = 'button';
      prev.disabled = page <= 1;
      next.disabled = page >= pages;
      prev.addEventListener('click', () => {
        page -= 1;
        paint();
        list.scrollTop = 0;
        scheduleSaveView();
      });
      next.addEventListener('click', () => {
        page += 1;
        paint();
        list.scrollTop = 0;
        scheduleSaveView();
      });
      const jump = el('input', 'ws-tg-page');
      jump.type = 'number';
      jump.min = '1';
      jump.max = String(pages);
      jump.value = String(page);
      jump.title = 'Page';
      jump.addEventListener('change', () => {
        const nextPage = Number(jump.value);
        if (!Number.isFinite(nextPage)) return;
        page = Math.min(pages, Math.max(1, nextPage));
        paint();
        list.scrollTop = 0;
        scheduleSaveView();
      });
      pager.append(prev, el('span', '', `Page ${page} of ${pages}`), jump, next);
    }

    [sender, kind, from, to, perPage].forEach((control) => control.addEventListener('change', apply));
    let debounce = 0;
    const onType = () => {
      clearTimeout(debounce);
      debounce = setTimeout(apply, 220);
    };
    search.addEventListener('input', onType);
    idFilter.addEventListener('input', onType);
    const setDir = (rtl) => {
      readingRtl = rtl;
      ltrBtn.classList.toggle('is-on', !rtl);
      rtlBtn.classList.toggle('is-on', rtl);
      list.dir = rtl ? 'rtl' : 'ltr';
      paint();
      scheduleSaveView();
    };
    ltrBtn.addEventListener('click', () => setDir(false));
    rtlBtn.addEventListener('click', () => setDir(true));
    resetBtn.addEventListener('click', () => {
      sender.value = 'all';
      kind.value = 'all';
      from.value = '';
      to.value = '';
      idFilter.value = '';
      search.value = '';
      apply();
    });
    focusPerson = (key) => {
      sender.value = key;
      apply();
      section.scrollIntoView({ block: 'start' });
    };
    findText = (value) => {
      sender.value = 'all';
      kind.value = 'all';
      from.value = '';
      to.value = '';
      idFilter.value = '';
      search.value = value;
      apply();
      section.scrollIntoView({ block: 'start' });
    };

    explorerUi = { search, idFilter, sender, kind, from, to, perPage, list };
    detachExportWatch();
    const onExplorerScroll = () => scheduleSaveView();
    list.addEventListener('scroll', onExplorerScroll, { passive: true });
    window.addEventListener('scroll', onExplorerScroll, { passive: true });
    detachExportWatch = () => {
      list.removeEventListener('scroll', onExplorerScroll);
      window.removeEventListener('scroll', onExplorerScroll);
      clearTimeout(viewTimer);
    };

    if (pendingView || restorePageScroll) applySavedView(pendingView || {});
    else apply();

    function applySavedView(view) {
      restoringSession = true;
      if (view.sender && [...sender.options].some((option) => option.value === view.sender)) {
        sender.value = view.sender;
      }
      if (view.kind) kind.value = view.kind;
      from.value = view.from || '';
      to.value = view.to || '';
      idFilter.value = view.id || '';
      search.value = view.search || '';
      if (view.perPage) perPage.value = String(view.perPage);
      readingRtl = Boolean(view.rtl);
      ltrBtn.classList.toggle('is-on', !readingRtl);
      rtlBtn.classList.toggle('is-on', readingRtl);
      list.dir = readingRtl ? 'rtl' : 'ltr';
      page = Math.max(1, Number(view.page) || 1);
      const query = search.value.trim().toLowerCase();
      const fromTime = from.value ? new Date(`${from.value}T00:00:00`).getTime() : null;
      const toTime = to.value ? new Date(`${to.value}T23:59:59`).getTime() : null;
      filtered = data.messages.filter((msg) => {
        if (sender.value !== 'all' && personKey(msg) !== sender.value) return false;
        if (kind.value === 'text' && (msg.kind || !msg.text)) return false;
        if (kind.value === 'media' && !msg.kind) return false;
        if (kind.value === 'link' && !/https?:\/\//i.test(msg.text)) return false;
        if (kind.value === 'forward' && !msg.forwardedFrom) return false;
        if (kind.value === 'reply' && !msg.replyTo) return false;
        if (['photo', 'video', 'voice', 'file', 'sticker'].includes(kind.value) && msg.kind !== kind.value) {
          return false;
        }
        if (fromTime && (!msg.date || msg.date < fromTime)) return false;
        if (toTime && (!msg.date || msg.date > toTime)) return false;
        const idQuery = idFilter.value.trim().toLowerCase();
        if (idQuery) {
          const haystack = `${msg.fromId} ${msg.forwardedFromId}`.toLowerCase();
          if (!haystack.includes(idQuery)) return false;
        }
        if (query) {
          const blob = `${msg.text} ${msg.mediaTitle || ''} ${msg.from} ${msg.fromId} ${msg.forwardedFrom} ${msg.contact?.phone || ''} ${msg.contact?.name || ''}`.toLowerCase();
          if (!blob.includes(query)) return false;
        }
        return true;
      });
      paint();
      placeScroll(Number(view.listScroll) || 0);
      setTimeout(() => {
        restoringSession = false;
      }, 1000);
    }
  }

  function highlightText(text) {
    const node = el('p', 'ws-tg-message-text');
    const ranges = [];
    const lower = text.toLowerCase();
    identifierNeedles.forEach((hit) => {
      let from = 0;
      while (from <= lower.length - hit.lower.length) {
        const at = lower.indexOf(hit.lower, from);
        if (at < 0) break;
        const before = at > 0 ? lower[at - 1] : '';
        const after = lower[at + hit.lower.length] || '';
        const boundary = (ch) => !ch || !/[a-z0-9]/i.test(ch);
        if (boundary(before) && boundary(after)) {
          ranges.push({ start: at, end: at + hit.value.length, type: hit.type, value: hit.value });
        }
        from = at + hit.lower.length;
      }
    });
    ranges.sort((a, b) => a.start - b.start || b.end - a.end);
    let pos = 0;
    let cursor = 0;
    ranges.forEach((range) => {
      if (range.start < cursor) return;
      if (range.start > pos) node.append(document.createTextNode(text.slice(pos, range.start)));
      const mark = el('button', 'ws-tg-hit', text.slice(range.start, range.end));
      mark.type = 'button';
      mark.title = `${range.type}. Click to search the whole export.`;
      mark.addEventListener('click', () => findText(range.value));
      node.append(mark);
      pos = range.end;
      cursor = range.end;
    });
    if (pos < text.length) node.append(document.createTextNode(text.slice(pos)));
    if (!node.childNodes.length) node.textContent = text;
    return node;
  }

  function messageDetails(msg) {
    const bits = [`#${msg.id}`];
    if (msg.fromId) bits.push(msg.fromId);
    if (msg.forwardedFromId) bits.push(`fwd ${msg.forwardedFromId}`);
    if (msg.viaBot) bits.push(`via ${msg.viaBot}`);
    if (msg.edited) bits.push('edited');
    if (msg.contact?.name) bits.push(msg.contact.name);
    if (msg.contact?.phone) bits.push(msg.contact.phone);
    if (msg.location && Number.isFinite(Number(msg.location.lat)) && Number.isFinite(Number(msg.location.lon))) {
      bits.push(msg.location.label || `${msg.location.lat}, ${msg.location.lon}`);
    }
    if (msg.mime) bits.push(msg.mime);
    return bits.join(' · ');
  }

  function attachThumb(row, msg) {
    if (!isImageFile(msg.mediaPath) || !data.media.has(msg.mediaPath)) return;
    const img = el('img', 'ws-tg-thumb');
    img.alt = msg.mediaTitle || 'Photo';
    img.addEventListener('click', () => openMedia(msg.mediaPath));
    row.append(img);
    const cached = previewUrls.get(msg.mediaPath);
    if (cached) {
      img.src = cached;
      return;
    }
    data.media.get(msg.mediaPath).async('blob').then((blob) => {
      if (!previewUrls.has(msg.mediaPath)) previewUrls.set(msg.mediaPath, URL.createObjectURL(blob));
      img.src = previewUrls.get(msg.mediaPath);
    }).catch(() => {
      img.remove();
    });
  }

  function messageRow(msg) {
    const color = senderColor(personKey(msg));
    const row = el('div', 'ws-tg-message');
    if (readingRtl) row.classList.add('is-rtl');
    row.style.setProperty('--ws-sender', color);
    row.style.background = `color-mix(in srgb, ${color} 12%, transparent)`;
    const meta = el('div', 'ws-tg-message-meta');
    const who = el('strong', '', msg.from);
    who.style.color = color;
    meta.append(who, el('span', '', formatDateTime(msg.date)));
    row.append(meta);
    row.append(el('div', 'ws-tg-message-id', messageDetails(msg)));

    if (msg.forwardedFrom) {
      const fwd = msg.forwardedFromId ? `${msg.forwardedFrom} (${msg.forwardedFromId})` : msg.forwardedFrom;
      row.append(el('div', 'ws-tg-tagline', `Forwarded from ${fwd}`));
    }

    if (msg.replyTo) {
      const target = data.byId.get(msg.replyTo);
      const preview = target
        ? `Reply to ${target.from}: ${target.text.slice(0, 90) || `[${KIND_LABELS[target.kind] || 'media'}]`}`
        : `Reply to message ${msg.replyTo}`;
      const quote = el('button', 'ws-tg-quote', preview);
      quote.type = 'button';
      quote.addEventListener('click', () => {
        if (!target) return;
        modalBody.replaceChildren();
        modalBody.append(messageRow(target));
        modal.hidden = false;
      });
      row.append(quote);
    }

    if (msg.text) row.append(highlightText(msg.text));
    attachThumb(row, msg);

    if (msg.kind) {
      const actions = el('div', 'ws-tg-message-actions');
      const label = `${KIND_LABELS[msg.kind] || 'Media'}${msg.mediaTitle ? ` · ${msg.mediaTitle}` : ''}`;
      const available = msg.mediaPath && data.media.has(msg.mediaPath);
      const btn = el('button', 'ws-tg-chip', available ? label : `${label} (not in export)`);
      btn.type = 'button';
      btn.disabled = !available;
      btn.addEventListener('click', () => openMedia(msg.mediaPath));
      actions.append(btn);
      row.append(actions);
    }

    return row;
  }

  async function openMedia(path) {
    const entry = data.media.get(path);
    if (!entry) return;
    modalBody.replaceChildren(el('p', 'ws-image-note', 'Loading…'));
    modal.hidden = false;

    try {
      const blob = await entry.async('blob');
      const extension = path.split('.').pop().toLowerCase();
      const url = URL.createObjectURL(blob);
      modalBody.replaceChildren();

      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension)) {
        const img = el('img', 'ws-tg-media');
        img.src = url;
        img.alt = path;
        modalBody.append(img);
      } else if (['mp4', 'webm', 'mov', 'mkv'].includes(extension)) {
        const video = el('video', 'ws-tg-media');
        video.src = url;
        video.controls = true;
        modalBody.append(video);
      } else if (['ogg', 'oga', 'mp3', 'm4a', 'wav'].includes(extension)) {
        const audio = document.createElement('audio');
        audio.src = url;
        audio.controls = true;
        modalBody.append(audio);
      } else {
        modalBody.append(el('p', 'ws-image-note', 'No preview for this file type.'));
      }

      const save = el('a', 'ws-btn ws-btn-ghost', 'Download');
      save.href = url;
      save.download = path.split('/').pop();
      modalBody.append(save);
    } catch (err) {
      console.error('[Telegram export] media', err);
      modalBody.replaceChildren(el('p', 'ws-image-status is-bad', 'Could not read this file from the archive.'));
    }
  }

  if (sessionCache?.data) {
    data = sessionCache.data;
    activeName = sessionCache.name || 'export.zip';
    pendingView = sessionCache.view || null;
    restorePageScroll = true;
    clearBtn.hidden = false;
    setStatus(`Kept ${data.messages.length.toLocaleString()} messages from ${activeName}.`, 'is-ok');
    renderReport();
  } else {
    restoreArchive();
  }

  async function restoreArchive() {
    let saved = null;
    try {
      saved = await idbRequest('readonly', (store) => store.get('archive'));
    } catch (err) {
      console.error('[Telegram export] restore', err);
      return;
    }
    if (!saved?.bytes) return;
    let view = null;
    try {
      view = await idbRequest('readonly', (store) => store.get('view'));
    } catch {
      view = null;
    }
    pendingView = view || null;
    restorePageScroll = true;
    const file = new File([saved.bytes], saved.name || 'export.zip', { type: 'application/zip' });
    await load(file, { restore: true, bytes: saved.bytes });
  }
}
