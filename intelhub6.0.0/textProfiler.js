import { brw, getCurrentTab, isFirefox, flashButton, createSection, saveViewState, resetViewState } from './utils.js';
import { withPageAccess } from './opsecHub/js/optional-permissions.mjs';

let profilerLastResults = [];

const RESULT_LIMIT = 400;

const TYPE_ORDER = [
  'Email',
  'Phone',
  'WhatsApp',
  'Telegram',
  'Facebook Profile',
  'Instagram Profile',
  'Twitter Profile',
  'TikTok Profile',
  'Threads Profile',
  'LinkedIn Profile',
  'LinkedIn Company',
  'YouTube Channel',
  'Reddit Profile',
  'Subreddit',
  'GitHub Profile',
  'VK Profile',
  'Pinterest Profile',
  'Snapchat Profile',
  'Tumblr Profile',
  'Discord Invite',
  'IP Address',
  'BTC Wallet',
  'ETH Wallet',
  'URL'
];

const SKIP_PATH = /\/(?:sharer|share\.php|dialog|plugins|intent|search|explore|login|signup|privacy|terms)(?:\/|$|\?)/i;
const FILE_EXT = /^(?:png|jpe?g|gif|svg|webp|avif|bmp|ico|css|js|mjs|cjs|json|xml|html?|php|aspx?|jsp|woff2?|ttf|otf|eot|mp[34]|m4a|webm|mov|wav|pdf|docx?|xlsx?|zip|gz|rar|map|txt|csv)$/i;
const URL_TOKEN = /(?:https?:\/\/|mailto:|tel:)[^\s"'<>()]+|(?:www\.)?(?:facebook|instagram|twitter|linkedin|tiktok|reddit|github|youtube|pinterest|snapchat|threads|vk)\.[a-z]{2,6}\/[^\s"'<>()]+|(?:t\.me|wa\.me|youtu\.be|discord\.gg|x\.com)\/[^\s"'<>()]+/gi;
const EMAIL_TOKEN = /[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,24}/g;
const PHONE_TOKEN = /(?<![\w/@.-])[+(]?\d[\d\s().-]{7,18}\d(?!\w)/g;
const BTC_LEGACY = /(?<![A-Za-z0-9])[13][a-km-zA-HJ-NP-Z1-9]{25,34}(?![A-Za-z0-9])/g;
const BTC_BECH32 = /(?<![A-Za-z0-9])bc1[ac-hj-np-z02-9]{11,71}(?![A-Za-z0-9])/g;
const ETH_TOKEN = /(?<![A-Za-z0-9])0x[a-fA-F0-9]{40}(?![A-Za-z0-9])/g;
const IPV4_TOKEN = /(?<![.\w])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![.\w])/g;
const DATE_LIKE = /^\d{1,4}[.\-]\d{1,2}[.\-]\d{1,4}$/;

function addHit(results, found, type, value) {
  const val = String(value || '').trim().replace(/[.,;:)\]>]+$/g, '');
  if (!val) return;
  const key = `${type}::${val.toLowerCase()}`;
  if (found.has(key)) return;
  found.add(key);
  results.push({ type, value: val });
}

function parseUrl(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    return new URL(/^[a-z]+:/i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
}

function hostOf(url) {
  return String(url.hostname || '').replace(/^www\./, '').toLowerCase();
}

function firstSeg(path) {
  return String(path || '').split('/').filter(Boolean)[0] || '';
}

function classifyHttpUrl(raw) {
  const url = parseUrl(raw);
  if (!url || !/^https?:$/i.test(url.protocol)) return null;
  if (SKIP_PATH.test(url.pathname)) return null;

  const host = hostOf(url);
  const path = url.pathname;
  const seg = firstSeg(path);
  const skipSeg = /^(p|reel|reels|stories|ar|tv|live|watch|shorts|clip|status|i|intent|share|hashtag|tags|t|privacy|help|about|home|feed)$/i;

  if (host === 'facebook.com' || host.endsWith('.facebook.com')) {
    const id = url.searchParams.get('id');
    if (/profile\.php$/i.test(path) && id) return { type: 'Facebook Profile', value: id };
    if (seg && !skipSeg.test(seg) && !/^(pages|groups|events|watch|marketplace|photo)/i.test(seg)) {
      return { type: 'Facebook Profile', value: seg };
    }
    return null;
  }
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
    if (seg && !skipSeg.test(seg)) return { type: 'Instagram Profile', value: seg.replace(/^@/, '') };
    return null;
  }
  if (host === 'x.com' || host === 'twitter.com' || host.endsWith('.x.com') || host.endsWith('.twitter.com')) {
    if (seg && !skipSeg.test(seg)) return { type: 'Twitter Profile', value: seg.replace(/^@/, '') };
    return null;
  }
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
    const parts = path.split('/').filter(Boolean);
    if ((parts[0] === 'in' || parts[0] === 'company') && parts[1]) {
      return { type: parts[0] === 'company' ? 'LinkedIn Company' : 'LinkedIn Profile', value: parts[1] };
    }
    return null;
  }
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    if (seg.startsWith('@')) return { type: 'TikTok Profile', value: seg.slice(1) };
    return null;
  }
  if (host === 'reddit.com' || host.endsWith('.reddit.com')) {
    const parts = path.split('/').filter(Boolean);
    if ((parts[0] === 'user' || parts[0] === 'u') && parts[1]) return { type: 'Reddit Profile', value: parts[1] };
    if (parts[0] === 'r' && parts[1]) return { type: 'Subreddit', value: `r/${parts[1]}` };
    return null;
  }
  if (host === 'threads.net' || host.endsWith('.threads.net')) {
    if (seg.startsWith('@')) return { type: 'Threads Profile', value: seg.slice(1) };
    return null;
  }
  if (host === 't.me' || host === 'telegram.me') {
    const name = seg === 's' ? firstSeg(path.replace(/^\/s/, '')) : seg;
    if (name && !/^(joinchat|addstickers|proxy|share)$/i.test(name)) {
      return { type: 'Telegram', value: name.replace(/^@/, '') };
    }
    return null;
  }
  if (host === 'wa.me' || host === 'api.whatsapp.com' || host === 'whatsapp.com') {
    const num = (url.searchParams.get('phone') || seg || '').replace(/\D/g, '');
    if (num.length >= 8) return { type: 'WhatsApp', value: `+${num}` };
    return null;
  }
  if (host === 'github.com') {
    if (seg && !/^(topics|features|login|signup|orgs|settings|marketplace|about|pricing|sponsors|collections)$/i.test(seg)) {
      return { type: 'GitHub Profile', value: seg };
    }
    return null;
  }
  if (host === 'youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')) {
    const parts = path.split('/').filter(Boolean);
    if (parts[0]?.startsWith('@')) return { type: 'YouTube Channel', value: parts[0].slice(1) };
    if ((parts[0] === 'channel' || parts[0] === 'c' || parts[0] === 'user') && parts[1]) {
      return { type: 'YouTube Channel', value: parts[1] };
    }
    return null;
  }
  if (host === 'snapchat.com') {
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'add' && parts[1]) return { type: 'Snapchat Profile', value: parts[1] };
    return null;
  }
  if (host.endsWith('.tumblr.com')) {
    return { type: 'Tumblr Profile', value: host.split('.')[0] };
  }
  if (host === 'pinterest.com' || host.endsWith('.pinterest.com')) {
    if (seg && !skipSeg.test(seg) && !/^(pin|search|ideas)$/i.test(seg)) return { type: 'Pinterest Profile', value: seg };
    return null;
  }
  if (host === 'discord.gg') {
    if (seg) return { type: 'Discord Invite', value: seg };
    return null;
  }
  if (host === 'vk.com' || host.endsWith('.vk.com')) {
    if (seg && !/^(feed|im|video|music|clips|login|search)$/i.test(seg)) return { type: 'VK Profile', value: seg };
    return null;
  }

  return { type: 'URL', value: `${url.origin}${url.pathname}`.replace(/\/$/, '') || url.href };
}

function isRealEmail(value) {
  const at = value.lastIndexOf('@');
  if (at < 1) return false;
  const domain = value.slice(at + 1).toLowerCase();
  if (domain.includes('..') || domain.startsWith('-')) return false;
  const tld = domain.split('.').pop() || '';
  if (!/^[a-z]{2,24}$/.test(tld) || FILE_EXT.test(tld)) return false;
  // srcset / sprite artefacts such as logo@2x.png or icon@3x
  return !/^\d+x$/.test(domain.split('.')[0]);
}

function normalizePhone(raw) {
  const trimmed = String(raw).trim().replace(/[\s.\-()]+$/, '');
  if (DATE_LIKE.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  const hasPlus = trimmed.startsWith('+');
  const separators = (trimmed.match(/[\s.\-()]/g) || []).length;
  // A bare run of digits is far more often an id, price, or timestamp than a number.
  if (!hasPlus && separators === 0) return null;
  return trimmed;
}

function looksLikeWallet(value) {
  return /[a-z]/.test(value) && /[A-Z]/.test(value);
}

function deobfuscate(text) {
  return text
    .replace(/\s*[[({<]\s*(?:at|@)\s*[\])}>]\s*/gi, '@')
    .replace(/\s*[[({<]\s*(?:dot|punkt|\.)\s*[\])}>]\s*/gi, '.');
}

function sortResults(results) {
  return results.sort((a, b) => {
    const rankA = TYPE_ORDER.indexOf(a.type);
    const rankB = TYPE_ORDER.indexOf(b.type);
    if (rankA !== rankB) return (rankA < 0 ? 999 : rankA) - (rankB < 0 ? 999 : rankB);
    return a.value.localeCompare(b.value);
  });
}

/**
 * `links` carries hrefs harvested from a page. They only feed URL classification,
 * so navigation chrome cannot leak into the email/phone/wallet matches.
 */
export function extractEntities(text, options = {}) {
  const blob = String(text || '');
  const links = Array.isArray(options.links) ? options.links : [];
  const skipGenericUrls = Boolean(options.skipGenericUrls);
  const results = [];
  const found = new Set();

  const urlTokens = [...links, ...(blob.match(URL_TOKEN) || [])];
  urlTokens.forEach((raw) => {
    const token = String(raw || '').replace(/[),.;]+$/g, '');
    const lower = token.toLowerCase();
    if (lower.startsWith('mailto:')) {
      const address = decodeURIComponent(token.slice(7).split('?')[0]).trim();
      if (isRealEmail(address)) addHit(results, found, 'Email', address.toLowerCase());
      return;
    }
    if (lower.startsWith('tel:')) {
      const digits = decodeURIComponent(token.slice(4)).replace(/[^\d+]/g, '');
      if (digits.replace(/\D/g, '').length >= 8) addHit(results, found, 'Phone', digits);
      return;
    }
    const classified = classifyHttpUrl(token);
    if (!classified) return;
    if (skipGenericUrls && classified.type === 'URL') return;
    addHit(results, found, classified.type, classified.value);
  });

  const plain = deobfuscate(blob);

  (plain.match(EMAIL_TOKEN) || []).forEach((email) => {
    if (isRealEmail(email)) addHit(results, found, 'Email', email.toLowerCase());
  });

  (plain.match(PHONE_TOKEN) || []).forEach((candidate) => {
    const phone = normalizePhone(candidate);
    if (phone) addHit(results, found, 'Phone', phone);
  });

  (plain.match(BTC_LEGACY) || []).forEach((wallet) => {
    if (looksLikeWallet(wallet)) addHit(results, found, 'BTC Wallet', wallet);
  });
  (plain.match(BTC_BECH32) || []).forEach((wallet) => {
    addHit(results, found, 'BTC Wallet', wallet);
  });
  (plain.match(ETH_TOKEN) || []).forEach((wallet) => {
    addHit(results, found, 'ETH Wallet', wallet);
  });
  (plain.match(IPV4_TOKEN) || []).forEach((ip) => {
    const octets = ip.split('.').map(Number);
    // All-single-digit dotted numbers are almost always version strings.
    if (octets.every((part) => part < 10) || octets[0] === 127) return;
    addHit(results, found, 'IP Address', ip);
  });

  return sortResults(results).slice(0, RESULT_LIMIT);
}

function looksLikeHtml(text) {
  const head = String(text || '').slice(0, 12000);
  return /<(?:html|head|body|div|article|section|table|ul|ol|nav|main|a)\b/i.test(head);
}

function decodeBasicEntities(text) {
  return String(text || '')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const code = parseInt(n, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&amp;/gi, '&');
}

function isTagBoundary(ch) {
  return !ch || ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === '/' || ch === '>';
}

function skipTagBlock(source, tagName) {
  const lower = source.toLowerCase();
  const open = `<${tagName}`;
  const close = `</${tagName}`;
  let out = '';
  let i = 0;
  while (i < source.length) {
    const start = lower.indexOf(open, i);
    if (start < 0) {
      out += source.slice(i);
      break;
    }
    if (!isTagBoundary(source.charAt(start + open.length))) {
      out += source.slice(i, start + open.length);
      i = start + open.length;
      continue;
    }
    out += source.slice(i, start);
    const openEnd = lower.indexOf('>', start);
    const end = openEnd < 0 ? -1 : lower.indexOf(close, openEnd);
    if (end < 0) break;
    const closeEnd = lower.indexOf('>', end);
    i = closeEnd < 0 ? source.length : closeEnd + 1;
    out += ' ';
  }
  return out;
}

function stripTags(source) {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const start = source.indexOf('<', i);
    if (start < 0) {
      out += source.slice(i);
      break;
    }
    out += `${source.slice(i, start)} `;
    const end = source.indexOf('>', start + 1);
    if (end < 0) break;
    i = end + 1;
  }
  return out;
}

export function harvestPageSignals(html) {
  const source = String(html || '').slice(0, 300000);
  const seen = new Set();
  const hrefRe = /<(?:a|area)\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match;
  while ((match = hrefRe.exec(source)) && seen.size < 3000) {
    const raw = decodeBasicEntities(match[1] || match[2] || match[3] || '').trim();
    try {
      const url = new URL(raw, 'https://example.invalid');
      if (url.protocol === 'http:' || url.protocol === 'https:') seen.add(url.href);
    } catch {
      /* skip non-urls */
    }
  }
  const title = decodeBasicEntities((source.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const meta = [];
  const metaRe = /<meta\b[^>]*(?:name|property)\s*=\s*["'](?:description|og:description)["'][^>]*>/gi;
  let metaTag;
  while ((metaTag = metaRe.exec(source))) {
    const content = (metaTag[0].match(/\bcontent\s*=\s*"([^"]*)"/i) || metaTag[0].match(/\bcontent\s*=\s*'([^']*)'/i) || [])[1];
    if (content) meta.push(decodeBasicEntities(content));
  }
  const body = decodeBasicEntities(stripTags(skipTagBlock(skipTagBlock(source, 'script'), 'style')));
  return {
    text: [title, ...meta, body].join('\n').replace(/[ \t]+\n/g, '\n').slice(0, 300000),
    links: [...seen]
  };
}

/** Same extraction as the popup: harvest hrefs from HTML, then classify identifiers. */
export function profileText(source) {
  const blob = String(source || '');
  if (!looksLikeHtml(blob)) return extractEntities(blob);
  const { text, links } = harvestPageSignals(blob);
  return extractEntities(text.trim() ? text : blob, {
    links,
    skipGenericUrls: true
  });
}

export async function readPageContent(tab) {
  if (!tab?.id) throw new Error('No tab');
  if (!/^https?:/i.test(tab.url || '')) throw new Error('restricted');
  const [{ result }] = await brw.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const seen = new Set();
      document.querySelectorAll('a[href], area[href]').forEach((node) => {
        const href = node.href || node.getAttribute('href') || '';
        if (href && seen.size < 3000) seen.add(href);
      });
      const meta = [...document.querySelectorAll('meta[name="description"], meta[property="og:description"]')]
        .map((node) => node.getAttribute('content') || '')
        .filter(Boolean);
      const body = (document.body && document.body.innerText) || document.documentElement.innerText || '';
      return {
        text: [document.title, ...meta, body].join('\n').slice(0, 300000),
        links: [...seen]
      };
    }
  });
  return { text: String(result?.text || ''), links: result?.links || [] };
}

export function renderProfilerResults(results, options = {}) {
  profilerLastResults = Array.isArray(results) ? results : [];
  const resultArea = options.host || document.getElementById('profiler-result-area');
  if (!resultArea) return;

  const box = document.createElement('div');
  box.className = 'tool-result';

  const head = document.createElement('div');
  head.className = 'tool-result-head';
  const summary = document.createElement('div');
  const kicker = document.createElement('div');
  kicker.className = 'tool-result-kicker';
  kicker.textContent = 'Identifiers';
  const count = document.createElement('div');
  count.className = 'tool-result-meta';
  count.style.margin = '2px 0 0';
  count.textContent = profilerLastResults.length
    ? `${profilerLastResults.length} found${options.pageContext ? ' on this page' : ''}`
    : (options.pageContext ? 'Nothing identifiable on this page.' : 'Nothing identifiable found.');
  summary.append(kicker, count);
  if (options.hint) {
    const hint = document.createElement('div');
    hint.className = 'tool-result-meta';
    hint.textContent = options.hint;
    summary.append(hint);
  }

  const headActions = document.createElement('div');
  headActions.className = 'tool-result-actions';
  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'tool-result-copy';
  exportBtn.textContent = 'CSV';
  exportBtn.disabled = !profilerLastResults.length;
  exportBtn.addEventListener('click', exportProfilerCsv);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'tool-result-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    profilerLastResults = [];
    resultArea.replaceChildren();
    resultArea.dispatchEvent(new CustomEvent('profiler-cleared', { bubbles: true }));
    if (typeof options.onClear === 'function') options.onClear();
  });
  headActions.append(exportBtn, closeBtn);
  head.append(summary, headActions);
  box.appendChild(head);

  if (!profilerLastResults.length) {
    resultArea.replaceChildren(box);
    return;
  }

  const grouped = new Map();
  profilerLastResults.forEach((row) => {
    if (!grouped.has(row.type)) grouped.set(row.type, []);
    grouped.get(row.type).push(row.value);
  });

  const active = new Set(grouped.keys());
  const chips = document.createElement('div');
  chips.className = 'tool-result-chips';
  const list = document.createElement('div');
  list.className = 'profiler-groups';
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'osint-filter';
  search.placeholder = 'Filter…';

  function paint() {
    const query = search.value.trim().toLowerCase();
    list.replaceChildren();
    let shown = 0;

    grouped.forEach((values, type) => {
      if (!active.has(type)) return;
      const matches = query
        ? values.filter((value) => value.toLowerCase().includes(query) || type.toLowerCase().includes(query))
        : values;
      if (!matches.length) return;
      shown += matches.length;

      const group = document.createElement('div');
      group.className = 'profiler-group';
      const label = document.createElement('div');
      label.className = 'profiler-group-label';
      label.textContent = `${type} · ${matches.length}`;
      group.appendChild(label);

      matches.forEach((value) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'profiler-item';
        item.title = typeof options.onPick === 'function' ? 'Show messages that contain this' : 'Click to copy';
        item.textContent = value;
        item.addEventListener('click', () => {
          if (typeof options.onPick === 'function') {
            options.onPick(value);
            return;
          }
          navigator.clipboard.writeText(value);
          item.classList.add('is-copied');
          item.textContent = 'Copied';
          setTimeout(() => {
            item.textContent = value;
            item.classList.remove('is-copied');
          }, 800);
        });
        group.appendChild(item);
      });
      list.appendChild(group);
    });

    if (!shown) {
      const empty = document.createElement('p');
      empty.className = 'osint-empty';
      empty.textContent = 'Nothing matches that filter.';
      list.appendChild(empty);
    }
  }

  grouped.forEach((values, type) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tool-result-chip is-on';
    chip.textContent = `${type} ${values.length}`;
    chip.addEventListener('click', () => {
      if (active.has(type) && active.size > 1) active.delete(type);
      else active.add(type);
      chip.classList.toggle('is-on', active.has(type));
      paint();
    });
    chips.appendChild(chip);
  });

  search.addEventListener('input', paint);
  box.append(chips, search, list);
  resultArea.replaceChildren(box);
  paint();
}

function exportProfilerCsv() {
  if (!profilerLastResults.length) return;
  const csvRows = [['Type', 'Value'], ...profilerLastResults.map((row) => [
    `"${row.type.replace(/"/g, '""')}"`,
    `"${row.value.replace(/"/g, '""')}"`
  ])];
  const csvContent = csvRows.map((line) => line.join(',')).join('\n');
  if (isFirefox()) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted_entities.csv';
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  brw.downloads.download({
    url: `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`,
    filename: 'extracted_entities.csv',
    saveAs: true
  }).catch((err) => console.error('Download failed:', err));
}

export function restoreTextProfilerView(container, state) {
  const profilerBtn = container.querySelector('[data-section="text-profiler"]');
  if (!profilerBtn) return;
  const profilerWrapper = profilerBtn.nextElementSibling;
  if (state.mainOpen && profilerWrapper) {
    profilerWrapper.classList.add('open');
    profilerBtn.classList.add('is-open');
  }
  if (Array.isArray(state.results) && state.results.length) {
    renderProfilerResults(state.results, { pageContext: true });
  }
}

export function initializeTextProfiler(container) {
  function saveProfilerState() {
    if (!profilerWrapper.classList.contains('open')) {
      resetViewState('textProfiler');
      return;
    }
    saveViewState('textProfiler', {
      mainOpen: true,
      results: profilerLastResults
    });
  }

  const { wrapper: profilerWrapper } = createSection(container, 'Identifiers', {
    id: 'text-profiler',
    subtitle: 'Emails, phones, profiles, and wallets on this page',
    onToggle: () => saveProfilerState()
  });

  const analyzePageBtn = document.createElement('button');
  analyzePageBtn.className = 'sub-category-button tool-action';
  analyzePageBtn.textContent = 'Scan this page';
  analyzePageBtn.addEventListener('click', async () => {
    const tab = await getCurrentTab();
    if (!tab?.url || !/^https?:/i.test(tab.url)) {
      flashButton(analyzePageBtn, 'Open a website', true);
      return;
    }
    analyzePageBtn.disabled = true;
    analyzePageBtn.textContent = 'Scanning…';
    try {
      const { text, links } = await withPageAccess(tab.url, () => readPageContent(tab));
      if (!text.trim() && !links.length) {
        analyzePageBtn.textContent = 'Scan this page';
        flashButton(analyzePageBtn, 'No text', true);
        return;
      }
      renderProfilerResults(extractEntities(text, { links, skipGenericUrls: true }), { pageContext: true });
      saveProfilerState();
    } catch (err) {
      console.error('Error analyzing page:', err);
      analyzePageBtn.textContent = 'Scan this page';
      flashButton(analyzePageBtn, err?.code === 'cancelled' ? 'Not now' : err?.code === 'denied' ? 'Blocked' : 'Could not read page', true);
    } finally {
      analyzePageBtn.disabled = false;
      if (analyzePageBtn.dataset.isFlashing !== 'true') analyzePageBtn.textContent = 'Scan this page';
    }
  });

  const resultArea = document.createElement('div');
  resultArea.id = 'profiler-result-area';
  resultArea.className = 'tool-result-slot';
  resultArea.addEventListener('profiler-cleared', () => saveProfilerState());

  profilerWrapper.append(analyzePageBtn, resultArea);
}
