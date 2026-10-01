import { brw, flashButton, isFirefox, createFileButton } from './utils.js';
import { extractEntities, renderProfilerResults } from './textProfiler.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MEDIA_KIND = {
  1: 'photo',
  2: 'video',
  3: 'file',
  4: 'sticker',
  5: 'voice',
  6: 'audio',
  8: 'contact',
  9: 'gif'
};
const KIND_LABELS = {
  photo: 'Photo',
  video: 'Video',
  file: 'File',
  sticker: 'Sticker',
  voice: 'Voice',
  audio: 'Audio',
  contact: 'Contact',
  gif: 'GIF',
  media: 'Media'
};
const STOPWORDS = new Set([
  'that', 'this', 'with', 'from', 'have', 'were', 'they', 'them', 'your', 'what',
  'when', 'where', 'which', 'will', 'would', 'there', 'their', 'about', 'into',
  'just', 'like', 'some', 'more', 'also', 'than', 'then', 'only', 'been',
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her',
  'was', 'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may', 'who',
  'של', 'על', 'את', 'זה', 'זו', 'לא', 'אם', 'או', 'כי', 'עם', 'יש', 'אין'
]);

let charts = [];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
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

function asText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join('');
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (Array.isArray(value.text)) return asText(value.text);
    if (Array.isArray(value.text_entities)) return asText(value.text_entities);
  }
  return '';
}

function parseTime(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return n < 1e12 ? n * 1000 : n;
  }
  const iso = Date.parse(raw);
  if (!Number.isNaN(iso)) return iso;
  const parts = raw.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!parts) return null;
  const date = new Date(
    Number(parts[3]),
    Number(parts[2]) - 1,
    Number(parts[1]),
    Number(parts[4]),
    Number(parts[5]),
    Number(parts[6] || 0)
  );
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function usernameOf(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const fromUrl = raw.match(/t\.me\/([A-Za-z0-9_]+)/i);
  if (fromUrl) return fromUrl[1];
  return raw.replace(/^@/, '').replace(/\s+/g, '');
}

function kindFrom(msg, media) {
  if (msg.photo || media?.photo) return 'photo';
  if (msg.contact_information || media?.contact) return 'contact';
  const mime = String(msg.mime_type || media?.document?.mime_type || '');
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (msg.file || media?.document) return 'file';
  const code = msg.mediaKind ?? msg.media_kind ?? msg.media_type ?? msg.mediaType;
  if (typeof code === 'number' && MEDIA_KIND[code]) return MEDIA_KIND[code];
  if (typeof code === 'string' && KIND_LABELS[code.toLowerCase()]) return code.toLowerCase();
  if (media) return 'media';
  return '';
}

function telegramLink(chatId, tag, messageId) {
  if (tag && messageId) return `https://t.me/${tag}/${messageId}`;
  if (tag) return `https://t.me/${tag}`;
  const id = String(chatId ?? '');
  const channel = id.replace(/^-100/, '');
  if (id.startsWith('-100') && channel && messageId) return `https://t.me/c/${channel}/${messageId}`;
  if (id.startsWith('-100') && channel) return `https://t.me/c/${channel}`;
  return '';
}

function normalizeMessage(raw, chat = {}) {
  const media = raw.media && typeof raw.media === 'object' ? raw.media : null;
  const chatId = raw.chatid ?? raw.chat_id ?? raw.chatId ?? chat.id ?? chat.chatid ?? '';
  const tag = usernameOf(
    raw.chatTag || raw.chat_tag || raw.username || chat.username || chat.tag || ''
  );
  const title =
    raw.chatTitle ||
    raw.chat_title ||
    raw.title ||
    chat.title ||
    chat.name ||
    (chatId ? `Chat ${chatId}` : 'Unknown chat');
  const text = asText(raw.text) || asText(raw.message) || asText(raw.text_entities);
  const id = raw.messageid ?? raw.message_id ?? raw.id ?? raw.msg_id ?? null;
  const date = parseTime(
    raw.date_unixtime || raw.dateUnix || raw.unixtime || raw.timestamp || raw.date
  );
  const from =
    asText(raw.from_name) ||
    asText(raw.from) ||
    asText(raw.sender) ||
    [raw.first_name, raw.last_name].filter(Boolean).join(' ') ||
    '';

  return {
    id,
    chatId: String(chatId),
    chatTitle: String(title),
    chatTag: tag,
    date,
    text,
    from,
    fromId: raw.from_id ?? raw.fromId ?? raw.user_id ?? '',
    kind: kindFrom(raw, media),
    replyTo: raw.reply_to_message_id ?? raw.reply_to ?? raw.replyTo ?? null,
    hasMedia: Boolean(
      media ||
      raw.photo ||
      raw.file ||
      raw.contact_information ||
      raw.mediaKind ||
      raw.media_kind
    )
  };
}

function metaFrom(raw) {
  const user = raw.user || raw.target || raw.about || {};
  const name = [user.first_name || raw.first_name, user.last_name || raw.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  const username = usernameOf(user.username || raw.username || '');
  const id = user.id ?? raw.user_id ?? raw.id ?? '';
  const names = raw.names || raw.name_history || user.names || [];
  const usernames = raw.usernames || raw.username_history || user.usernames || [];
  return {
    name: name || asText(raw.name) || '',
    username,
    id: id && typeof id !== 'object' ? String(id) : '',
    names: Array.isArray(names) ? names.map(asText).filter(Boolean) : [],
    usernames: Array.isArray(usernames) ? usernames.map(usernameOf).filter(Boolean) : []
  };
}

function flattenReport(raw) {
  if (Array.isArray(raw)) return { messages: raw.map((item) => normalizeMessage(item)), meta: {} };

  if (raw.chats?.list && Array.isArray(raw.chats.list)) {
    const messages = [];
    raw.chats.list.forEach((chat) => {
      (chat.messages || []).forEach((msg) => messages.push(normalizeMessage(msg, chat)));
    });
    return { messages, meta: metaFrom(raw) };
  }

  if (Array.isArray(raw.chats) && raw.chats.some((chat) => Array.isArray(chat.messages))) {
    const messages = [];
    raw.chats.forEach((chat) => {
      (chat.messages || []).forEach((msg) => messages.push(normalizeMessage(msg, chat)));
    });
    return { messages, meta: metaFrom(raw) };
  }

  const bag = raw.messages || raw.data || raw.result || raw.items;
  if (Array.isArray(bag) && bag.length) {
    return { messages: bag.map((item) => normalizeMessage(item)), meta: metaFrom(raw) };
  }

  throw new Error('No messages found. Upload a Funstat JSON report.');
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

function collectStats(messages) {
  const perChat = new Map();
  const hours = new Array(24).fill(0);
  const weekdays = new Array(7).fill(0);
  const buckets = new Map();
  const domains = new Map();
  let first = null;
  let last = null;
  let withMedia = 0;
  let replies = 0;
  let withText = 0;

  messages.forEach((msg) => {
    let chat = perChat.get(msg.chatId);
    if (!chat) {
      chat = {
        id: msg.chatId,
        title: msg.chatTitle,
        tag: msg.chatTag,
        count: 0,
        media: 0,
        first: null,
        last: null
      };
      perChat.set(msg.chatId, chat);
    }
    chat.count += 1;
    if (msg.chatTag && !chat.tag) chat.tag = msg.chatTag;
    if (msg.hasMedia || msg.kind) {
      chat.media += 1;
      withMedia += 1;
    }
    if (msg.replyTo) replies += 1;
    if (msg.text) withText += 1;

    if (msg.date) {
      const date = new Date(msg.date);
      hours[date.getHours()] += 1;
      weekdays[date.getDay()] += 1;
      if (first == null || msg.date < first) first = msg.date;
      if (last == null || msg.date > last) last = msg.date;
      if (chat.first == null || msg.date < chat.first) chat.first = msg.date;
      if (chat.last == null || msg.date > chat.last) chat.last = msg.date;
    }

    (msg.text.match(/https?:\/\/[^\s"'<>)]+/gi) || []).forEach((raw) => {
      try {
        const host = new URL(raw).hostname.replace(/^www\./, '').toLowerCase();
        domains.set(host, (domains.get(host) || 0) + 1);
      } catch {
        /* ignore */
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
    perChat: [...perChat.values()].sort((a, b) => b.count - a.count),
    hours,
    weekdays,
    buckets: [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    granularity,
    domains: [...domains.entries()].sort((a, b) => b[1] - a[1]),
    first,
    last,
    spanDays,
    withMedia,
    replies,
    withText
  };
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
    accentSoft: 'rgba(110, 168, 255, 0.28)'
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

export function paintFunstat(panel) {
  destroyCharts();

  let report = null;
  let filtered = [];
  let page = 1;

  const pickBtn = createFileButton('Choose JSON file');
  const input = el('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.hidden = true;

  const drop = el('div', 'ws-tg-drop');
  drop.append(el('span', '', 'Drop a Funstat JSON report here'), pickBtn);

  const status = el('p', 'ws-image-status', '');
  const results = el('div', 'ws-tg-results');
  results.hidden = true;

  panel.append(
    el(
      'p',
      'ws-image-note',
      'Reads a Funstat JSON dump locally. Nothing is uploaded from this workspace.'
    ),
    drop,
    input,
    status,
    results
  );

  const help = el('details', 'ws-tg-help');
  help.append(el('summary', '', 'Where this file comes from'));
  const steps = el('ol');
  [
    'In Telegram, open the Funstat bot and request a JSON report for a user or group.',
    'Save the .json file it sends (or copy the download from funstat.link).',
    'Choose the file below. Nothing is uploaded from this workspace.'
  ].forEach((step) => steps.append(el('li', '', step)));
  const botItem = el('li', '');
  const botLink = el('a', '', 'Open Funstat');
  botLink.href = 'https://funstat.link/';
  botLink.target = '_blank';
  botLink.rel = 'noopener noreferrer';
  botItem.append(botLink);
  steps.append(botItem);
  help.append(steps);
  panel.insertBefore(help, drop);

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
    if (!file.name.toLowerCase().endsWith('.json')) {
      setStatus('That is not a .json file.', 'is-bad');
      return;
    }
    load(file);
  });

  function setStatus(text, tone = '') {
    status.textContent = text;
    status.className = `ws-image-status${tone ? ` ${tone}` : ''}`;
  }

  async function load(file) {
    destroyCharts();
    results.hidden = true;
    results.replaceChildren();
    setStatus('Reading report…');
    try {
      const raw = JSON.parse(await file.text());
      const parsed = flattenReport(raw);
      if (!parsed.messages.length) throw new Error('The file contained no readable messages.');
      report = parsed;
      setStatus(`${parsed.messages.length.toLocaleString()} messages parsed.`, 'is-ok');
      renderReport();
    } catch (err) {
      console.error('[Funstat]', err);
      setStatus(err.message || 'Could not read this JSON file.', 'is-bad');
    }
  }

  function renderReport() {
    const stats = collectStats(report.messages);
    results.replaceChildren();
    results.hidden = false;

    const head = el('div', 'ws-tg-head');
    const titleBox = el('div');
    const headline = report.meta.username
      ? `@${report.meta.username}`
      : report.meta.name || 'Funstat report';
    titleBox.append(el('strong', '', headline));
    const bits = [];
    if (report.meta.name && report.meta.username) bits.push(report.meta.name);
    if (report.meta.id) bits.push(`ID ${report.meta.id}`);
    bits.push(`${formatDate(stats.first)} → ${formatDate(stats.last)}`);
    bits.push(`${stats.spanDays.toLocaleString()} days`);
    titleBox.append(el('span', '', bits.join(' · ')));

    const headActions = el('div', 'ws-image-actions');
    const csvBtn = el('button', 'ws-btn ws-btn-ghost', 'Export CSV');
    const jsonBtn = el('button', 'ws-btn ws-btn-ghost', 'Export JSON');
    csvBtn.type = jsonBtn.type = 'button';
    csvBtn.addEventListener('click', async () => {
      const rows = [['Date', 'Chat', 'Chat ID', 'Sender', 'Text', 'Media', 'Link']];
      filtered.forEach((msg) => {
        rows.push([
          msg.date ? new Date(msg.date).toISOString() : '',
          msg.chatTitle,
          msg.chatId,
          msg.from,
          msg.text,
          msg.kind ? KIND_LABELS[msg.kind] : '',
          telegramLink(msg.chatId, msg.chatTag, msg.id)
        ]);
      });
      await download(toCsv(rows), 'funstat_report.csv', 'text/csv');
      flashButton(csvBtn, 'Exported');
    });
    jsonBtn.addEventListener('click', async () => {
      await download(
        JSON.stringify({ meta: report.meta, messages: filtered }, null, 2),
        'funstat_report.json',
        'application/json'
      );
      flashButton(jsonBtn, 'Exported');
    });
    headActions.append(csvBtn, jsonBtn);
    head.append(titleBox, headActions);
    results.append(head);

    const grid = el('div', 'ws-tg-stats');
    grid.append(statCard(report.messages.length.toLocaleString(), 'Messages'));
    grid.append(statCard(String(stats.perChat.length), 'Chats'));
    grid.append(
      statCard(Math.round(report.messages.length / stats.spanDays).toLocaleString(), 'Messages / day')
    );
    grid.append(statCard(stats.withMedia.toLocaleString(), 'With media'));
    grid.append(statCard(stats.replies.toLocaleString(), 'Replies'));
    grid.append(statCard(stats.withText.toLocaleString(), 'With text'));
    results.append(grid);

    if (report.meta.names.length || report.meta.usernames.length) {
      const history = el('section', 'ws-tg-section');
      history.append(el('h3', '', 'Name / username history'));
      const chips = el('div', 'ws-tg-chips');
      report.meta.usernames.forEach((name) => chips.append(el('span', 'ws-tg-chip', `@${name}`)));
      report.meta.names.forEach((name) => chips.append(el('span', 'ws-tg-chip', name)));
      history.append(chips);
      results.append(history);
    }

    renderCharts(stats);
    renderChats(stats);
    renderDomains(stats);
    renderIdentifiers();
    renderWords();
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
    const chats = chartCard('Top chats', 'messages');
    const hours = chartCard('Activity by hour', 'local time');
    const weekdays = chartCard('Activity by weekday');
    wrap.append(timeline.card, chats.card, hours.card, weekdays.card);
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

    const topChats = stats.perChat.slice(0, 12);
    charts.push(
      new Chart(chats.canvas, {
        type: 'bar',
        data: {
          labels: topChats.map((chat) =>
            chat.title.length > 22 ? `${chat.title.slice(0, 22)}…` : chat.title
          ),
          datasets: [
            {
              data: topChats.map((chat) => chat.count),
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

  function renderChats(stats) {
    const section = el('section', 'ws-tg-section');
    section.append(el('h3', '', 'Chats'));
    const wrap = el('div', 'ws-image-table-wrap ws-tg-scroll');
    const table = el('table', 'ws-tg-table');
    const header = table.createTHead().insertRow();
    ['Chat', 'Messages', 'Share', 'Media', 'First', 'Last', 'Open'].forEach((label) => {
      const cell = document.createElement('th');
      cell.textContent = label;
      header.appendChild(cell);
    });
    const body = table.createTBody();
    stats.perChat.forEach((chat) => {
      const row = body.insertRow();
      row.insertCell().textContent = chat.title;
      row.insertCell().textContent = chat.count.toLocaleString();
      row.insertCell().textContent = `${((chat.count / report.messages.length) * 100).toFixed(1)}%`;
      row.insertCell().textContent = chat.media.toLocaleString();
      row.insertCell().textContent = formatDate(chat.first);
      row.insertCell().textContent = formatDate(chat.last);
      const openCell = row.insertCell();
      const href = telegramLink(chat.id, chat.tag);
      if (href) {
        const link = el('a', '', chat.tag ? `@${chat.tag}` : 'Open');
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        openCell.append(link);
      } else {
        openCell.textContent = chat.id || '—';
      }
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
      chip.addEventListener('click', () => {
        brw.tabs.create({ url: `https://${domain}`, active: false });
      });
      list.append(chip);
    });
    section.append(list);
    results.append(section);
  }

  function renderIdentifiers() {
    const section = el('section', 'ws-tg-section');
    section.append(el('h3', '', 'Identifiers in messages'));
    const host = el('div', 'ws-profiler');
    section.append(host);
    results.append(section);
    const text = report.messages.map((msg) => msg.text).filter(Boolean).join('\n');
    renderProfilerResults(extractEntities(text), { host });
  }

  function renderWords() {
    const counts = new Map();
    report.messages.forEach((msg) => {
      String(msg.text || '')
        .toLowerCase()
        .split(/[^\p{L}\p{N}_]+/u)
        .forEach((word) => {
          if (word.length < 4 || STOPWORDS.has(word) || /^\d+$/.test(word)) return;
          counts.set(word, (counts.get(word) || 0) + 1);
        });
    });
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
    if (!top.length) return;
    const section = el('section', 'ws-tg-section');
    section.append(el('h3', '', 'Frequent words'));
    const list = el('div', 'ws-tg-chips');
    top.forEach(([word, count]) => {
      list.append(el('span', 'ws-tg-chip', `${word} · ${count}`));
    });
    section.append(list);
    results.append(section);
  }

  function renderExplorer(stats) {
    const section = el('section', 'ws-tg-section');
    section.append(el('h3', '', 'Message explorer'));

    const filters = el('div', 'ws-tg-filters');
    const chat = el('select');
    const allOption = el('option', '', 'All chats');
    allOption.value = 'all';
    chat.append(allOption);
    stats.perChat.forEach((item) => {
      const option = el('option', '', `${item.title} (${item.count})`);
      option.value = item.id;
      chat.append(option);
    });

    const kind = el('select');
    [
      ['all', 'All content'],
      ['text', 'Text only'],
      ['media', 'Media only'],
      ['link', 'Contains a link']
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
    const search = el('input', 'ws-osint-search');
    search.type = 'search';
    search.placeholder = 'Search message text…';
    const perPage = el('select');
    [50, 100, 200, 500].forEach((size) => {
      const option = el('option', '', `${size} per page`);
      option.value = String(size);
      if (size === 100) option.selected = true;
      perPage.append(option);
    });
    const resetBtn = el('button', 'ws-btn ws-btn-ghost', 'Reset');
    resetBtn.type = 'button';
    filters.append(chat, kind, from, to, search, perPage, resetBtn);

    const count = el('p', 'ws-image-status', '');
    const list = el('div', 'ws-tg-messages');
    const pager = el('div', 'ws-tg-pager');
    section.append(filters, count, list, pager);
    results.append(section);

    function apply() {
      page = 1;
      const query = search.value.trim().toLowerCase();
      const fromTime = from.value ? new Date(`${from.value}T00:00:00`).getTime() : null;
      const toTime = to.value ? new Date(`${to.value}T23:59:59`).getTime() : null;
      filtered = report.messages.filter((msg) => {
        if (chat.value !== 'all' && msg.chatId !== chat.value) return false;
        if (kind.value === 'text' && !msg.text) return false;
        if (kind.value === 'media' && !(msg.hasMedia || msg.kind)) return false;
        if (kind.value === 'link' && !/https?:\/\//i.test(msg.text)) return false;
        if (fromTime && (!msg.date || msg.date < fromTime)) return false;
        if (toTime && (!msg.date || msg.date > toTime)) return false;
        if (query && !msg.text.toLowerCase().includes(query)) return false;
        return true;
      });
      paint();
    }

    function paint() {
      const size = Number(perPage.value);
      const pages = Math.max(1, Math.ceil(filtered.length / size));
      page = Math.min(page, pages);
      count.textContent = `${filtered.length.toLocaleString()} of ${report.messages.length.toLocaleString()} messages`;
      list.replaceChildren();
      if (!filtered.length) {
        list.append(el('p', 'ws-image-note', 'Nothing matches these filters.'));
        pager.replaceChildren();
        return;
      }
      filtered.slice((page - 1) * size, page * size).forEach((msg) => list.append(messageRow(msg)));
      pager.replaceChildren();
      if (pages > 1) {
        const prev = el('button', 'ws-btn ws-btn-ghost', 'Previous');
        const next = el('button', 'ws-btn ws-btn-ghost', 'Next');
        prev.type = next.type = 'button';
        prev.disabled = page === 1;
        next.disabled = page === pages;
        prev.addEventListener('click', () => {
          page -= 1;
          paint();
        });
        next.addEventListener('click', () => {
          page += 1;
          paint();
        });
        pager.append(prev, el('span', '', `Page ${page} of ${pages}`), next);
      }
    }

    [chat, kind, from, to, perPage].forEach((control) => control.addEventListener('change', apply));
    let debounce = 0;
    search.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(apply, 220);
    });
    resetBtn.addEventListener('click', () => {
      chat.value = 'all';
      kind.value = 'all';
      from.value = '';
      to.value = '';
      search.value = '';
      apply();
    });
    apply();
  }

  function messageRow(msg) {
    const row = el('div', 'ws-tg-message');
    const meta = el('div', 'ws-tg-message-meta');
    meta.append(el('strong', '', msg.chatTitle), el('span', '', formatDateTime(msg.date)));
    row.append(meta);
    if (msg.from) row.append(el('div', 'ws-tg-tagline', msg.from));
    if (msg.kind) row.append(el('div', 'ws-tg-tagline', KIND_LABELS[msg.kind] || 'Media'));
    row.append(el('p', 'ws-tg-message-text', msg.text || `[${KIND_LABELS[msg.kind] || 'Empty message'}]`));
    const href = telegramLink(msg.chatId, msg.chatTag, msg.id);
    if (href) {
      const actions = el('div', 'ws-tg-message-actions');
      const link = el('a', 'ws-tg-chip', 'Open on Telegram');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      actions.append(link);
      row.append(actions);
    }
    return row;
  }
}
