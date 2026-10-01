import { initInvestigationGraph, state } from './modules/investigationGraph/js/main.js';
import { resizeCanvas, restoreGraphCamera } from './modules/investigationGraph/js/canvas.js';
import { typeLabels, editCard } from './modules/investigationGraph/js/ui.js';
import { renderInvestigationsList, openContextMenu } from './modules/investigationGraph/js/investigations.js';
import { askText, askAlert, askConfirm } from './modules/investigationGraph/js/dialogs.js';
import { loadToolsData, AWESOME_OSINT_REPO } from './modules/toolsCatalog.js';
import { renderImageTools } from './modules/workspaceImageTools.js';
import { renderFileTools } from './modules/workspaceFileTools.js';
import { renderUsernameTools } from './modules/workspaceUsernameTools.js';
import { renderEmailTools } from './modules/workspaceEmailTools.js';
import { renderWebTools } from './modules/workspaceWebTools.js';
import { renderCryptoTools } from './modules/workspaceCryptoTools.js';
import { renderDorkTools } from './modules/workspaceDorkTools.js';
import { renderExtraTools } from './modules/workspaceExtraTools.js';
import { renderOpsecWorkspace } from './modules/opsecHub/workspaceOpsec.js';
import { apiNote, apiCardLine, API_SOURCES, clearAllToolResults, clearToolResult } from './modules/workspaceToolResults.js';

const catalog = {
  overview: {
    title: 'Overview',
    hint: 'All desk tools, grouped the same way as the sidebar.',
    cards: [
      { name: 'Username Search', blurb: 'Username — check a handle on 150+ sites.', open: { category: 'username' }, api: [API_SOURCES.usernameHttp] },
      { name: 'Google ID', blurb: 'Email — connect Google and look up an email or Gaia ID.', open: { category: 'email', tool: 'gmail' }, api: [API_SOURCES.googlePeople] },
      { name: 'Breach lookup', blurb: 'Email — check XposedOrNot for known data breaches.', open: { category: 'email', tool: 'xon' }, api: [API_SOURCES.xon] },
      { name: 'Infostealer lookup', blurb: 'Email — Hudson Rock infostealer records for an email, username, or domain.', open: { category: 'email', tool: 'hudson' }, api: [API_SOURCES.hudsonRock] },
      { name: 'Gravatar lookup', blurb: 'Email — public Gravatar avatar and profile from an email hash.', open: { category: 'email', tool: 'gravatar' }, api: [API_SOURCES.gravatar] },
      { name: 'Reverse Image', blurb: 'Image — paste or upload a picture to search.', open: { category: 'image', tool: 'reverse' }, api: [API_SOURCES.catbox, API_SOURCES.imageEngines] },
      { name: 'Face Comparison', blurb: 'Image — compare two faces.', open: { category: 'image', tool: 'faces' } },
      { name: 'Image Metadata', blurb: 'Image — read EXIF and GPS from a picture.', open: { category: 'image', tool: 'meta' } },
      { name: 'Metadata Remover', blurb: 'Image / Files — strip EXIF and document metadata locally.', open: { category: 'files', tool: 'sanitize' } },
      { name: 'PDF Metadata', blurb: 'Files — read title, author, and dates from a PDF.', open: { category: 'files', tool: 'pdf' } },
      { name: 'Office Metadata', blurb: 'Files — read properties from Word, Excel, or PowerPoint.', open: { category: 'files', tool: 'office' } },
      { name: 'Document Tracker Remover', blurb: 'Files — strip canary pixels and remote trackers.', open: { category: 'files', tool: 'tracker' } },
      { name: 'File Hash & Integrity', blurb: 'Files — MD5 / SHA-1 / SHA-256 and compare two files.', open: { category: 'files', tool: 'hash' } },
      { name: 'Hash Identifier', blurb: 'Files — guess the type of a pasted hash.', open: { category: 'files', tool: 'identify' } },
      { name: 'Document Encryptor', blurb: 'Files — AES-256-GCM encrypt or decrypt any file.', open: { category: 'files', tool: 'encrypt' } },
      { name: 'Domain Lookup', blurb: 'Web — DNS records, IPs, WHOIS, and certificates.', open: { category: 'web', tool: 'domain' }, api: [API_SOURCES.doh, API_SOURCES.rdap] },
      { name: 'IP Lookup', blurb: 'Web — geolocation, ISP, ASN, and an AbuseIPDB page for the same IP.', open: { category: 'web', tool: 'ip' }, api: [API_SOURCES.ipApi, API_SOURCES.rdap, API_SOURCES.abuseipdb] },
      { name: 'Subdomains', blurb: 'Web — hostnames from public certificate and archive records.', open: { category: 'web', tool: 'subdomains' }, api: [API_SOURCES.crtsh, API_SOURCES.certspotter] },
      { name: 'Short Link Tracer', blurb: 'Web — expand a shortened link hop-by-hop to the final destination.', open: { category: 'web', tool: 'tracer' }, api: [API_SOURCES.targetHttp] },
      { name: 'VirusTotal Lookup', blurb: 'Web — URL, domain, IP, or local file hash on VirusTotal.', open: { category: 'web', tool: 'virustotal' }, api: [API_SOURCES.virusTotalGui] },
      { name: 'SSL Certificate Inspector', blurb: 'Web — inspect HTTPS certificate details.', open: { category: 'web', tool: 'ssl' }, api: [API_SOURCES.networkcalc, API_SOURCES.certspotter] },
      { name: 'Security Headers Analyzer', blurb: 'Web — audit CSP and response security headers.', open: { category: 'web', tool: 'headers' }, api: [API_SOURCES.targetHttp] },
      { name: 'DoH Leak Checker', blurb: 'Web — probe Secure DNS resolvers.', open: { category: 'web', tool: 'doh' }, api: [API_SOURCES.dohResolvers] },
      { name: 'Archives', blurb: 'Web — search a URL in web archives.', open: { category: 'web', tool: 'archives' }, api: [API_SOURCES.archivesWeb] },
      { name: 'Wallet Lookup', blurb: 'Crypto — Bitcoin and Ethereum balance, transfers, and charts.', open: { category: 'crypto', tool: 'wallet' }, api: [API_SOURCES.blockchain, API_SOURCES.ethplorer] },
      { name: 'Google Dorks', blurb: 'Build a focused Google query.', open: { category: 'dorks' }, api: [API_SOURCES.googleSearch] },
      { name: 'Text Profiler', blurb: 'Extra — extract identifiers from pasted text or HTML.', open: { category: 'extra', tool: 'text' } },
      { name: 'Social ID', blurb: 'Extra — open a profile from a username or ID.', open: { category: 'extra', tool: 'social' }, api: [API_SOURCES.profileSites] },
      { name: 'Telegram Profiler', blurb: 'Extra — look up a public Telegram account.', open: { category: 'extra', tool: 'telegram' }, api: [API_SOURCES.telegramWeb] },
      { name: 'Telegram Export Analyzer', blurb: 'Extra — analyze an exported Telegram chat archive.', open: { category: 'extra', tool: 'tg-export' } },
      { name: 'Funstat Report Analyzer', blurb: 'Extra — analyze a Funstat JSON dump of chats and messages.', open: { category: 'extra', tool: 'funstat' } },
      { name: 'OPSEC Protections', blurb: 'Turn security and privacy guards on or off.', open: { category: 'opsec', tool: 'protections' } },
      { name: 'OPSEC Guides', blurb: 'Secure DNS, Do Not Track, and cookie hardening.', open: { category: 'opsec', tool: 'guides' } }
    ]
  },
  osint: {
    title: 'Online Shortcuts',
    hint: 'External OSINT websites from the public catalog — open in new tabs.',
    live: 'osint'
  },
  username: {
    title: 'Username',
    hint: 'Check a handle across 150+ sites. Extra checks from user-scanner; hard platforms keep IntelHub checks.',
    live: 'username'
  },
  email: {
    title: 'Email',
    hint: 'Look up a Google ID, check breaches, infostealers, or a public Gravatar.',
    live: 'email'
  },
  image: {
    title: 'Image',
    hint: 'Search by picture, compare faces, or read EXIF. Strip metadata from Files.',
    live: 'image'
  },
  files: {
    title: 'Files',
    hint: 'Read or strip metadata, hash and encrypt files, or identify a hash type.',
    live: 'files'
  },
  web: {
    title: 'Web',
    hint: 'Domain lookup, IP geolocation, subdomains, link tracing, VirusTotal, SSL, headers, DoH, and archives.',
    live: 'web'
  },
  crypto: {
    title: 'Crypto',
    hint: 'Paste a Bitcoin or Ethereum address. Bitcoin: blockchain.info REST. Ethereum: Ethplorer REST (no signup).',
    live: 'crypto'
  },
  dorks: {
    title: 'Google Dorks',
    hint: 'Build a Google dork, then search or copy it.',
    live: 'dorks'
  },
  extra: {
    title: 'Extra tools',
    hint: 'Text, social IDs, Telegram, and phone lookups.',
    live: 'extra'
  },
  opsec: {
    title: 'OPSEC',
    hint: 'Protections and hardening guides.',
    live: 'opsec'
  }
};

const main = document.querySelector('.ws-main');
const toggleBtn = document.getElementById('toggleGraphBtn');
const fullscreenBtn = document.getElementById('fullscreenGraphBtn');
const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');
const graphHint = document.getElementById('graphHint');
const VIEW_KEY = 'wsViewState';
let restoringView = false;
let graphOpenPref = false;

function readViewState() {
  try {
    return JSON.parse(localStorage.getItem(VIEW_KEY) || '{}');
  } catch {
    return {};
  }
}

function pageScroller() {
  return document.scrollingElement || document.documentElement;
}

function readPageScroll() {
  const scroller = pageScroller();
  return {
    scrollX: window.scrollX || scroller.scrollLeft || document.body.scrollLeft || 0,
    scrollY: window.scrollY || scroller.scrollTop || document.body.scrollTop || 0,
    sidebarScroll: document.querySelector('.ws-sidebar')?.scrollTop || 0
  };
}

function writePageScroll(x, y) {
  window.scrollTo(x, y);
  document.documentElement.scrollLeft = x;
  document.documentElement.scrollTop = y;
  document.body.scrollLeft = x;
  document.body.scrollTop = y;
}

function resetCurrentTool(resultId = '') {
  if (resultId) clearToolResult(resultId);
  if (resultId === 'username') usernameQuery = '';
  if (String(resultId).startsWith('email:')) emailQuery = '';
  if (activeCategory === 'dorks') dorkValues = {};
  persistViewState();
  renderCategory(activeCategory);
}

function resetAllTools() {
  clearAllToolResults();
  usernameQuery = '';
  emailQuery = '';
  dorkValues = {};
  persistViewState();
  renderCategory(activeCategory);
}

function persistViewState() {
  if (restoringView) return;
  const fullscreen = document.body.classList.contains('is-graph-fullscreen');
  const live = readPageScroll();
  const scroll = restorePlaceOnce && restoreSnapshot ? restoreSnapshot : live;
  localStorage.setItem(VIEW_KEY, JSON.stringify({
    graphOpen: fullscreen ? graphOpenPref : main.classList.contains('is-graph-expanded'),
    fullscreen,
    summaryOpen: main.classList.contains('is-summary-expanded'),
    summaryMode,
    caseHidden: main.classList.contains('is-case-hidden'),
    sidebarCollapsed: document.body.classList.contains('is-sidebar-collapsed'),
    category: activeCategory,
    osintGroup,
    osintQuery,
    favActiveCat,
    imageTool,
    filesTool,
    usernameQuery,
    emailQuery,
    emailTool,
    webTool,
    cryptoTool,
    dorkValues,
    extraTool,
    opsecSection,
    guideTool,
    scrollX: scroll.scrollX,
    scrollY: scroll.scrollY,
    sidebarScroll: scroll.sidebarScroll
  }));
}

let activeCategory = 'overview';
let osintGroup = '';
let osintQuery = '';
let favActiveCat = '';
let imageTool = '';
let filesTool = '';
let usernameQuery = '';
let emailQuery = '';
let emailTool = '';
let webTool = '';
let cryptoTool = '';
let dorkValues = {};
let extraTool = '';
let opsecSection = '';
let guideTool = '';
let catalogRender = 0;
let restorePlaceOnce = false;
let restoreSnapshot = null;

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function restoreSavedPlace() {
  if (!restorePlaceOnce || !restoreSnapshot) return;
  const x = Number(restoreSnapshot.scrollX) || 0;
  const y = Number(restoreSnapshot.scrollY) || 0;
  writePageScroll(x, y);
  const sidebar = document.querySelector('.ws-sidebar');
  if (sidebar) sidebar.scrollTop = Number(restoreSnapshot.sidebarScroll) || 0;
  const scroller = pageScroller();
  const room = scroller.scrollHeight - scroller.clientHeight;
  if (!y || room >= y - 16) restorePlaceOnce = false;
}

function normalizeFavorites(raw) {
  const data = Array.isArray(raw)
    ? { __uncategorized__: raw }
    : (raw && typeof raw === 'object' ? { ...raw } : {});
  Object.keys(data).forEach((name) => {
    if (!Array.isArray(data[name])) delete data[name];
  });
  return data;
}

function loadFavorites() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ favorites: {} }, (data) => {
      resolve(normalizeFavorites(data.favorites));
    });
  });
}

function isFavorite(favorites, url) {
  return Object.values(favorites).some((list) => Array.isArray(list) && list.some((tool) => tool.url === url));
}

function isUnassignedCategory(name) {
  const folder = String(name || '').trim();
  return !folder || folder === '__uncategorized__' || folder === 'Unassigned';
}

function favoriteFolderName(name) {
  const folder = String(name || '').trim();
  if (isUnassignedCategory(folder)) return '__uncategorized__';
  return folder;
}

function favoriteCategoryNames(favorites) {
  return Object.keys(favorites)
    .filter((name) => name !== '__uncategorized__')
    .sort((a, b) => a.localeCompare(b));
}

function moveFavorite(tool, nextCategory) {
  const folder = favoriteFolderName(nextCategory);
  chrome.storage.local.get({ favorites: {} }, (data) => {
    const favorites = normalizeFavorites(data.favorites);
    let moved = null;
    for (const category of Object.keys(favorites)) {
      const index = (favorites[category] || []).findIndex((item) => item.url === tool.url);
      if (index > -1) {
        [moved] = favorites[category].splice(index, 1);
        break;
      }
    }
    if (!moved) {
      moved = {
        name: tool.name,
        url: tool.url,
        description: tool.description || ''
      };
    }
    moved.category = folder;
    if (!favorites[folder]) favorites[folder] = [];
    if (!favorites[folder].some((item) => item.url === moved.url)) {
      favorites[folder].push(moved);
    }
    chrome.storage.local.set({ favorites });
  });
}

function placePickerMenu(picker) {
  const button = picker.querySelector('.ws-osint-picker-btn');
  if (!button) return;
  if (picker.dataset.menuDirection === 'up') {
    picker.classList.add('opens-up');
    return;
  }
  const rect = button.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  picker.classList.toggle('opens-up', spaceBelow < 360 && spaceAbove > spaceBelow);
}

function bindPicker(picker) {
  const button = picker.querySelector('.ws-osint-picker-btn');
  if (!button) return;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    document.querySelectorAll('.ws-osint-picker.is-open').forEach((openPicker) => {
      if (openPicker !== picker) openPicker.classList.remove('is-open');
    });
    const willOpen = !picker.classList.contains('is-open');
    picker.classList.toggle('is-open', willOpen);
    if (willOpen) placePickerMenu(picker);
  });
}

function fillStyledMenu(menu, items, current, onPick) {
  menu.replaceChildren();
  items.forEach((item) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = `ws-osint-option${item.id === current ? ' is-active' : ''}`;
    option.textContent = item.label;
    option.addEventListener('click', (event) => {
      event.stopPropagation();
      onPick(item);
    });
    menu.appendChild(option);
  });
}

function toggleFavorite(tool, categoryName) {
  chrome.storage.local.get({ favorites: {} }, (data) => {
    const favorites = normalizeFavorites(data.favorites);
    let found = false;
    for (const category of Object.keys(favorites)) {
      const index = (favorites[category] || []).findIndex((item) => item.url === tool.url);
      if (index > -1) {
        favorites[category].splice(index, 1);
        found = true;
        break;
      }
    }
    if (!found) {
      if (!favorites.__uncategorized__) favorites.__uncategorized__ = [];
      favorites.__uncategorized__.push({
        name: tool.name,
        url: tool.url,
        description: tool.description || ''
      });
    }
    chrome.storage.local.set({ favorites });
  });
}

function addManualFavorite({ category, name, url, description }) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error('Enter a valid URL.'));
      return;
    }
    if (parsed.protocol !== 'https:') {
      reject(new Error('Only HTTPS links are allowed.'));
      return;
    }
    const folder = favoriteFolderName(category);
    chrome.storage.local.get({ favorites: {} }, (data) => {
      const favorites = normalizeFavorites(data.favorites);
      if (!favorites[folder]) favorites[folder] = [];
      if (favorites[folder].some((tool) => tool.url === parsed.href) || isFavorite(favorites, parsed.href)) {
        reject(new Error('That tool is already in favorites.'));
        return;
      }
      favorites[folder].push({
        name: name.trim(),
        url: parsed.href,
        description: (description || '').trim(),
        category: folder,
        isCustom: true
      });
      chrome.storage.local.set({ favorites }, () => resolve());
    });
  });
}

function toolMatches(tool, category, query) {
  if (!query) return true;
  const hay = [tool.name, tool.description, tool.url, category].join(' ').toLowerCase();
  return hay.includes(query.toLowerCase());
}

function openToolUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return;
    chrome.tabs.create({ url: parsed.href, active: false });
  } catch {
    /* ignore invalid URLs */
  }
}

function toolBlurb(tool) {
  if (tool.description) return tool.description;
  try {
    return new URL(tool.url).hostname;
  } catch {
    return '';
  }
}

function createLiveToolCard(tool, starred, categoryName) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `ws-tool-card has-star${starred ? ' is-fav' : ''}`;
  el.title = tool.description || tool.name;
  const folder = categoryName || tool.category || '';

  const title = document.createElement('strong');
  const blurb = document.createElement('span');
  title.textContent = tool.name;
  blurb.textContent = toolBlurb(tool);

  const star = document.createElement('span');
  star.className = 'ws-tool-star';
  star.textContent = starred ? '★' : '☆';
  star.title = starred ? 'Remove from favorites' : 'Add to favorites';
  star.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleFavorite(tool, folder);
  });

  el.append(title, blurb, star);
  el.addEventListener('click', () => openToolUrl(tool.url));
  return el;
}

function renameFavoriteCategory(from, to) {
  const next = favoriteFolderName(to);
  if (!from || !next || next === from) return Promise.resolve(from);
  return new Promise((resolve, reject) => {
    chrome.storage.local.get({ favorites: {} }, (data) => {
      const favorites = normalizeFavorites(data.favorites);
      if (!Object.prototype.hasOwnProperty.call(favorites, from)) {
        reject(new Error('Category not found.'));
        return;
      }
      const tools = favorites[from] || [];
      if (!favorites[next]) favorites[next] = [];
      tools.forEach((tool) => {
        if (!favorites[next].some((item) => item.url === tool.url)) {
          tool.category = next;
          favorites[next].push(tool);
        }
      });
      delete favorites[from];
      favActiveCat = next;
      persistViewState();
      chrome.storage.local.set({ favorites }, () => resolve(next));
    });
  });
}

function deleteFavoriteCategory(name) {
  const folder = favoriteFolderName(name);
  if (isUnassignedCategory(folder)) return Promise.reject(new Error('Cannot delete this category.'));
  return new Promise((resolve, reject) => {
    chrome.storage.local.get({ favorites: {} }, (data) => {
      const favorites = normalizeFavorites(data.favorites);
      if (!Object.prototype.hasOwnProperty.call(favorites, folder)) {
        reject(new Error('Category not found.'));
        return;
      }
      const tools = favorites[folder] || [];
      if (tools.length) {
        if (!favorites.__uncategorized__) favorites.__uncategorized__ = [];
        tools.forEach((tool) => {
          if (!favorites.__uncategorized__.some((item) => item.url === tool.url)) {
            tool.category = '';
            favorites.__uncategorized__.push(tool);
          }
        });
      }
      delete favorites[folder];
      if (favActiveCat === folder) favActiveCat = '';
      persistViewState();
      chrome.storage.local.set({ favorites }, () => resolve());
    });
  });
}

function upsertFavoriteTool({ originalUrl, name, url, description, category }) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error('Enter a valid URL.'));
      return;
    }
    if (parsed.protocol !== 'https:') {
      reject(new Error('Only HTTPS links are allowed.'));
      return;
    }
    const folder = favoriteFolderName(category);
    chrome.storage.local.get({ favorites: {} }, (data) => {
      const favorites = normalizeFavorites(data.favorites);
      if (originalUrl) {
        Object.keys(favorites).forEach((key) => {
          favorites[key] = (favorites[key] || []).filter((item) => item.url !== originalUrl);
        });
      }
      if (!originalUrl || originalUrl !== parsed.href) {
        if (isFavorite(favorites, parsed.href)) {
          reject(new Error('That tool is already in favorites.'));
          return;
        }
      }
      if (!favorites[folder]) favorites[folder] = [];
      favorites[folder].push({
        name: name.trim(),
        url: parsed.href,
        description: (description || '').trim(),
        category: folder,
        isCustom: true
      });
      favActiveCat = folder;
      persistViewState();
      chrome.storage.local.set({ favorites }, () => resolve(folder));
    });
  });
}

const favToolDialog = {
  bound: false,
  categories: [],
  originalUrl: '',
  category: '',
  isNew: false
};

function paintFavToolCategory(modal) {
  const menu = modal.querySelector('[data-fav-cat-menu]');
  const button = modal.querySelector('[data-fav-cat-btn]');
  const newInput = modal.querySelector('[data-fav-new-cat]');
  const selected = favToolDialog.isNew ? '__new__' : favToolDialog.category;
  const items = [
    { id: '', label: 'No category' },
    ...favToolDialog.categories.map((name) => ({ id: name, label: name })),
    { id: '__new__', label: '+ New category' }
  ];
  fillStyledMenu(menu, items, selected, (item) => {
    modal.querySelector('[data-fav-cat-picker]')?.classList.remove('is-open');
    favToolDialog.isNew = item.id === '__new__';
    favToolDialog.category = item.id === '__new__' ? '' : item.id;
    paintFavToolCategory(modal);
  });
  button.textContent = favToolDialog.isNew
    ? '+ New category'
    : (favToolDialog.category || 'No category');
  newInput.hidden = !favToolDialog.isNew;
}

function closeFavoriteToolDialog() {
  const modal = document.getElementById('favoriteToolModal');
  if (modal) modal.style.display = 'none';
}

function bindFavoriteToolDialog() {
  const modal = document.getElementById('favoriteToolModal');
  if (!modal || favToolDialog.bound) return modal;
  favToolDialog.bound = true;
  const picker = modal.querySelector('[data-fav-cat-picker]');
  if (picker) bindPicker(picker);
  modal.querySelector('[data-fav-cat-menu]')?.addEventListener('wheel', (event) => {
    event.stopPropagation();
  }, { passive: true });
  modal.querySelector('[data-fav-cancel]')?.addEventListener('click', closeFavoriteToolDialog);
  modal.querySelector('[data-fav-save]')?.addEventListener('click', submitFavoriteToolDialog);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeFavoriteToolDialog();
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeFavoriteToolDialog();
    if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') {
      event.preventDefault();
      submitFavoriteToolDialog();
    }
  });
  return modal;
}

function openFavoriteToolDialog({ title = 'New tool', tool, category = '', categories = [] } = {}) {
  const modal = bindFavoriteToolDialog();
  if (!modal) return;
  favToolDialog.categories = categories.slice();
  favToolDialog.originalUrl = tool?.url || '';
  favToolDialog.isNew = !tool && !categories.length;
  favToolDialog.category = isUnassignedCategory(category)
    ? ''
    : (category || (!tool && categories[0]) || '');
  modal.querySelector('[data-fav-title]').textContent = title;
  modal.querySelector('[data-fav-name]').value = tool?.name || '';
  modal.querySelector('[data-fav-url]').value = tool?.url || '';
  modal.querySelector('[data-fav-desc]').value = tool?.description || '';
  modal.querySelector('[data-fav-new-cat]').value = '';
  const error = modal.querySelector('[data-fav-error]');
  error.hidden = true;
  error.textContent = '';
  paintFavToolCategory(modal);
  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.querySelector('[data-fav-name]')?.focus());
}

async function submitFavoriteToolDialog() {
  const modal = document.getElementById('favoriteToolModal');
  if (!modal) return;
  const error = modal.querySelector('[data-fav-error]');
  const category = favToolDialog.isNew
    ? modal.querySelector('[data-fav-new-cat]').value
    : favToolDialog.category;
  try {
    await upsertFavoriteTool({
      originalUrl: favToolDialog.originalUrl,
      name: modal.querySelector('[data-fav-name]').value,
      url: modal.querySelector('[data-fav-url]').value,
      description: modal.querySelector('[data-fav-desc]').value,
      category
    });
    closeFavoriteToolDialog();
  } catch (err) {
    error.hidden = false;
    error.textContent = err.message;
  }
}

function createFavoriteCard(tool, categoryName, allNames) {
  const el = document.createElement('article');
  el.className = 'ws-tool-card has-star is-fav ws-fav-card';
  el.title = tool.description || tool.name;

  const title = document.createElement('strong');
  const blurb = document.createElement('span');
  title.textContent = tool.name;
  blurb.textContent = toolBlurb(tool);

  const star = document.createElement('span');
  star.className = 'ws-tool-star';
  star.textContent = '★';
  star.title = 'Remove from favorites';
  star.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleFavorite(tool, categoryName);
  });

  el.append(title, blurb, star);
  el.addEventListener('click', (event) => {
    if (event.target.closest('.ws-tool-star')) return;
    openToolUrl(tool.url);
  });
  el.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openContextMenu(event.clientX, event.clientY, [
      {
        label: 'Edit',
        onClick: () => openFavoriteToolDialog({
          title: 'Edit favorite',
          tool,
          category: isUnassignedCategory(categoryName) ? '' : categoryName,
          categories: allNames
        })
      },
      { separator: true },
      { label: 'Remove', onClick: () => toggleFavorite(tool, categoryName) }
    ]);
  });
  return el;
}

function addFavoriteCategory(name) {
  const raw = String(name || '').trim();
  if (isUnassignedCategory(raw) || raw === '__uncategorized__') return Promise.reject(new Error('Enter a category name.'));
  const folder = favoriteFolderName(raw);
  return new Promise((resolve) => {
    chrome.storage.local.get({ favorites: {} }, (data) => {
      const favorites = normalizeFavorites(data.favorites);
      if (!favorites[folder]) favorites[folder] = [];
      favActiveCat = folder;
      persistViewState();
      chrome.storage.local.set({ favorites }, () => resolve(folder));
    });
  });
}

function listFavoriteGroups(favorites) {
  const groups = [];
  if ((favorites.__uncategorized__ || []).length) {
    groups.push({ id: '__uncategorized__', title: 'Unassigned', tools: favorites.__uncategorized__ });
  }
  favoriteCategoryNames(favorites).forEach((name) => {
    groups.push({ id: name, title: name, tools: favorites[name] || [] });
  });
  return groups;
}

function exportFavorites() {
  chrome.storage.local.get({ favorites: {} }, (data) => {
    const favorites = normalizeFavorites(data.favorites);
    const hasTools = Object.values(favorites).some((list) => Array.isArray(list) && list.length);
    if (!hasTools) {
      askAlert('No favorites to export.');
      return;
    }
    const blob = new Blob([JSON.stringify(favorites, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: 'intelhub_favorites.json' }, () => {
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    });
  });
}

function importFavorites() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let imported = JSON.parse(String(reader.result || ''));
        if (Array.isArray(imported)) imported = { Imported: imported };
        if (!imported || typeof imported !== 'object') throw new Error('Invalid format.');
        chrome.storage.local.get({ favorites: {} }, (data) => {
          const existing = normalizeFavorites(data.favorites);
          const urls = new Set();
          Object.values(existing).forEach((list) => {
            (list || []).forEach((tool) => {
              if (tool?.url) urls.add(tool.url);
            });
          });
          Object.entries(imported).forEach(([category, tools]) => {
            if (!Array.isArray(tools)) return;
            const folder = favoriteFolderName(category);
            if (!existing[folder]) existing[folder] = [];
            tools.forEach((tool) => {
              if (tool?.url && !urls.has(tool.url)) {
                existing[folder].push(tool);
                urls.add(tool.url);
              }
            });
          });
          chrome.storage.local.set({ favorites: existing });
        });
      } catch {
        askAlert('Could not import that file.');
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

async function promptRenameCategory(currentName) {
  const name = await askText({
    title: 'Rename category',
    label: 'Category name',
    value: currentName,
    confirmLabel: 'Save'
  });
  if (!name || name === currentName) return;
  try {
    await renameFavoriteCategory(currentName, name);
  } catch {
    /* ignore */
  }
}

async function promptDeleteCategory(currentName) {
  const ok = await askConfirm(`Delete category "${currentName}"? Tools move to Unassigned.`);
  if (!ok) return;
  try {
    await deleteFavoriteCategory(currentName);
  } catch {
    /* ignore */
  }
}

function renderFavoritesDesk(parent, favorites, query, wrap) {
  const groups = listFavoriteGroups(favorites);
  const names = favoriteCategoryNames(favorites);

  parent.replaceChildren();
  const desk = document.createElement('div');
  desk.className = 'ws-fav-desk';

  const actions = document.createElement('div');
  actions.className = 'ws-fav-actions';
  const newCatBtn = document.createElement('button');
  newCatBtn.type = 'button';
  newCatBtn.className = 'ws-btn ws-btn-ghost';
  newCatBtn.textContent = 'New category';
  newCatBtn.addEventListener('click', async () => {
    const name = await askText({
      title: 'New category',
      label: 'Category name',
      confirmLabel: 'Create'
    });
    if (!name) return;
    try {
      await addFavoriteCategory(name);
    } catch {
      /* ignore */
    }
  });
  const newToolBtn = document.createElement('button');
  newToolBtn.type = 'button';
  newToolBtn.className = 'ws-btn';
  newToolBtn.textContent = 'New tool';
  newToolBtn.addEventListener('click', () => {
    openFavoriteToolDialog({
      title: 'New tool',
      category: names[0] || '',
      categories: names
    });
  });
  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'ws-btn ws-btn-ghost';
  exportBtn.textContent = 'Export';
  exportBtn.addEventListener('click', exportFavorites);
  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.className = 'ws-btn ws-btn-ghost';
  importBtn.textContent = 'Import';
  importBtn.addEventListener('click', importFavorites);
  if (favActiveCat && !groups.some((group) => group.id === favActiveCat)) favActiveCat = '';

  const filterPicker = document.createElement('div');
  filterPicker.className = 'ws-osint-picker ws-fav-filter';
  const filterBtn = document.createElement('button');
  filterBtn.type = 'button';
  filterBtn.className = 'ws-osint-picker-btn';
  const filterMenu = document.createElement('div');
  filterMenu.className = 'ws-osint-menu';
  filterPicker.append(filterBtn, filterMenu);
  bindPicker(filterPicker);
  const filterItems = [
    { id: '', label: 'All categories' },
    ...groups.map((group) => ({ id: group.id, label: `${group.title} (${group.tools.length})` }))
  ];
  fillStyledMenu(filterMenu, filterItems, favActiveCat, (item) => {
    filterPicker.classList.remove('is-open');
    favActiveCat = item.id;
    persistViewState();
    renderFavoritesDesk(parent, favorites, query, wrap);
  });
  filterBtn.textContent = filterItems.find((item) => item.id === favActiveCat)?.label || 'All categories';

  actions.append(newCatBtn, newToolBtn, exportBtn, importBtn, filterPicker);
  desk.appendChild(actions);

  const visible = groups
    .map((group) => ({
      ...group,
      tools: group.tools.filter((tool) => toolMatches(tool, group.title, query)).sort((a, b) => a.name.localeCompare(b.name))
    }))
    .filter((group) => (!query || group.tools.length) && (!favActiveCat || group.id === favActiveCat));

  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'ws-empty';
    empty.textContent = query
      ? 'No favorites match this search.'
      : 'No favorites yet. Star a catalog tool, or add a new tool.';
    desk.appendChild(empty);
    parent.appendChild(desk);
    return;
  }

  visible.forEach((group) => {
    const block = document.createElement('section');
    block.className = 'ws-osint-section';
    const head = document.createElement('div');
    head.className = 'ws-osint-section-head';
    const heading = document.createElement('h3');
    heading.textContent = `${group.title} (${group.tools.length})`;
    head.appendChild(heading);
    if (!isUnassignedCategory(group.id)) {
      const headActions = document.createElement('div');
      headActions.className = 'ws-osint-section-actions';
      const renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'ws-btn ws-btn-ghost';
      renameBtn.textContent = 'Rename';
      renameBtn.addEventListener('click', () => promptRenameCategory(group.title));
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'ws-btn ws-btn-ghost';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => promptDeleteCategory(group.title));
      headActions.append(renameBtn, deleteBtn);
      head.appendChild(headActions);
      head.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        openContextMenu(event.clientX, event.clientY, [
          { label: 'Rename', onClick: () => promptRenameCategory(group.title) },
          { label: 'Delete', onClick: () => promptDeleteCategory(group.title) }
        ]);
      });
    }
    block.appendChild(head);

    if (!group.tools.length) {
      const empty = document.createElement('p');
      empty.className = 'ws-empty';
      empty.textContent = 'No tools in this category yet.';
      block.appendChild(empty);
    } else {
      const cards = document.createElement('div');
      cards.className = 'ws-cards';
      group.tools.forEach((tool) => {
        cards.appendChild(createFavoriteCard(tool, group.id, names));
      });
      block.appendChild(cards);
    }
    desk.appendChild(block);
  });

  parent.appendChild(desk);
}

function favoriteGroups(favorites, query = '') {
  const names = Object.keys(favorites)
    .filter((name) => name !== '__uncategorized__')
    .sort((a, b) => a.localeCompare(b));
  if ((favorites.__uncategorized__ || []).length || Object.prototype.hasOwnProperty.call(favorites, '__uncategorized__')) {
    if ((favorites.__uncategorized__ || []).length) names.unshift('__uncategorized__');
  }

  return names.map((name) => {
    const title = name === '__uncategorized__' ? 'Unassigned' : name;
    return {
      id: name,
      title,
      tools: (favorites[name] || []).filter((tool) => toolMatches(tool, title, query))
    };
  }).filter((group) => group.tools.length || !query);
}

function stopDeskTools(wrap) {
  wrap?._imageAbort?.abort();
  wrap?._fileAbort?.abort();
  wrap?._peopleAbort?.abort();
  if (wrap) {
    wrap._imageAbort = null;
    wrap._fileAbort = null;
    wrap._peopleAbort = null;
  }
}

function renderDummyCards(wrap, cards) {
  stopDeskTools(wrap);
  wrap.dataset.osintReady = '';
  wrap.className = 'ws-cards';
  wrap.replaceChildren();
  cards.forEach((card) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'ws-tool-card';
    const title = document.createElement('strong');
    const blurb = document.createElement('span');
    title.textContent = card.name;
    blurb.textContent = card.blurb;
    el.append(title, blurb);
    const apiLine = apiCardLine(card.api);
    if (apiLine) el.appendChild(apiLine);
    if (card.open) {
      el.addEventListener('click', () => {
        if (card.open.category === 'image') imageTool = card.open.tool || '';
        if (card.open.category === 'files') filesTool = card.open.tool || '';
        if (card.open.category === 'email') emailTool = card.open.tool || '';
        if (card.open.category === 'web') webTool = card.open.tool || '';
        if (card.open.category === 'crypto') cryptoTool = card.open.tool || '';
        if (card.open.category === 'extra') extraTool = card.open.tool || '';
        if (card.open.category === 'opsec') {
          opsecSection = card.open.tool || '';
          if (opsecSection !== 'guides') guideTool = '';
        }
        renderCategory(card.open.category);
        persistViewState();
      });
    }
    wrap.appendChild(el);
  });
}

function ensureOsintShell(wrap) {
  if (wrap.dataset.osintReady === '1' && wrap.querySelector('.ws-osint-search')) return;
  wrap.className = 'ws-osint';
  wrap.replaceChildren();
  wrap.dataset.osintReady = '1';

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'ws-osint-search';
  search.placeholder = 'Search tools, categories, or URLs';
  search.addEventListener('input', () => {
    osintQuery = search.value;
    const tools = wrap._osintTools || {};
    const favorites = wrap._osintFavorites || {};
    paintOsint(wrap, tools, favorites);
  });

  const toolbar = document.createElement('div');
  toolbar.className = 'ws-osint-toolbar';

  const picker = document.createElement('div');
  picker.className = 'ws-osint-picker';
  picker.dataset.menuDirection = 'up';
  const pickerBtn = document.createElement('button');
  pickerBtn.type = 'button';
  pickerBtn.className = 'ws-osint-picker-btn';
  pickerBtn.textContent = 'Choose a category';
  const menu = document.createElement('div');
  menu.className = 'ws-osint-menu';
  picker.append(pickerBtn, menu);
  bindPicker(picker);

  if (!document.body.dataset.osintPickerBound) {
    document.body.dataset.osintPickerBound = '1';
    document.addEventListener('click', (event) => {
      document.querySelectorAll('.ws-osint-picker.is-open').forEach((openPicker) => {
        if (!openPicker.contains(event.target)) openPicker.classList.remove('is-open');
      });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        document.querySelectorAll('.ws-osint-picker.is-open').forEach((openPicker) => {
          openPicker.classList.remove('is-open');
        });
      }
    });
  }

  toolbar.append(search, picker);

  const credit = document.createElement('p');
  credit.className = 'ws-osint-credit';
  credit.append(document.createTextNode('Online shortcuts catalog from '));
  const creditLink = document.createElement('a');
  creditLink.href = AWESOME_OSINT_REPO;
  creditLink.target = '_blank';
  creditLink.rel = 'noopener';
  creditLink.textContent = 'jivoi/awesome-osint';
  credit.append(creditLink, document.createTextNode(' (CC BY-SA 4.0). These open external sites — star a tool, or add one under Favorites.'));

  const body = document.createElement('div');
  body.className = 'ws-osint-body';

  wrap.append(toolbar, apiNote([API_SOURCES.githubRaw]), credit, body);
}

function renderToolCards(section) {
  const cards = document.createElement('div');
  cards.className = 'ws-cards';
  section.tools.forEach((tool) => {
    const starred = section.starred === true || isFavorite(section.favorites || {}, tool.url);
    cards.appendChild(createLiveToolCard(tool, starred, section.title));
  });
  return cards;
}

function renderToolSections(parent, sections, { showTitle = true } = {}) {
  parent.replaceChildren();
  if (!sections.length) return false;
  if (!showTitle) {
    sections.forEach((section) => parent.appendChild(renderToolCards(section)));
    return true;
  }
  sections.forEach((section) => {
    const block = document.createElement('section');
    block.className = 'ws-osint-section';
    const heading = document.createElement('h3');
    heading.textContent = `${section.title} (${section.tools.length})`;
    block.append(heading, renderToolCards(section));
    parent.appendChild(block);
  });
  return true;
}

function paintOsint(wrap, tools, favorites) {
  ensureOsintShell(wrap);
  wrap._osintTools = tools;
  wrap._osintFavorites = favorites;
  queueMicrotask(restoreSavedPlace);

  const search = wrap.querySelector('.ws-osint-search');
  const picker = wrap.querySelector('.ws-osint-toolbar > .ws-osint-picker');
  const pickerBtn = picker?.querySelector('.ws-osint-picker-btn');
  const menu = picker?.querySelector('.ws-osint-menu');
  const body = wrap.querySelector('.ws-osint-body');
  const query = osintQuery.trim();
  if (search && search.value !== osintQuery) search.value = osintQuery;

  const categories = Object.keys(tools)
    .filter((name) => tools[name]?.length)
    .sort((a, b) => a.localeCompare(b));
  const favGroups = favoriteGroups(favorites, query);
  const favCount = favGroups.reduce((sum, group) => sum + group.tools.length, 0);
  const known = new Set(['favorites', ...categories]);
  if (osintGroup && !known.has(osintGroup)) osintGroup = '';

  const countFor = (id) => {
    if (id === 'favorites') return favCount;
    return (tools[id] || []).filter((tool) => toolMatches(tool, id, query)).length;
  };

  const pickerOptions = [];
  const addOption = (id, label) => {
    const count = countFor(id);
    if (query && !count && id) return;
    pickerOptions.push({ id, label: id ? `${label} (${count})` : label });
  };
  addOption('', query ? 'All matching categories' : 'Choose a category');
  addOption('favorites', 'Favorites');
  categories.forEach((name) => addOption(name, name));
  if (!known.has(osintGroup)) osintGroup = '';
  if (search) {
    search.placeholder = osintGroup === 'favorites'
      ? 'Search favorites'
      : 'Search tools, categories, or URLs';
  }
  if (!menu || !body) return;

  menu.replaceChildren();
  pickerOptions.forEach((item) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = `ws-osint-option${item.id === osintGroup ? ' is-active' : ''}`;
    option.textContent = item.label;
    option.addEventListener('click', (event) => {
      event.stopPropagation();
      osintGroup = item.id;
      picker.classList.remove('is-open');
      persistViewState();
      paintOsint(wrap, tools, favorites);
    });
    menu.appendChild(option);
  });
  if (pickerBtn) {
    pickerBtn.textContent = pickerOptions.find((item) => item.id === osintGroup)?.label || 'Choose a category';
  }

  if (!osintGroup && !query) {
    body.replaceChildren();
    const empty = document.createElement('p');
    empty.className = 'ws-empty';
    empty.textContent = 'Search or choose a category to see its tools.';
    body.appendChild(empty);
    return;
  }

  if (osintGroup === 'favorites') {
    renderFavoritesDesk(body, favorites, query, wrap);
    return;
  }

  if (osintGroup) {
    const listTools = (tools[osintGroup] || [])
      .filter((tool) => toolMatches(tool, osintGroup, query))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!renderToolSections(body, listTools.length ? [{ title: osintGroup, tools: listTools, favorites }] : [])) {
      const empty = document.createElement('p');
      empty.className = 'ws-empty';
      empty.textContent = 'No tools match this search.';
      body.replaceChildren(empty);
    }
    return;
  }

  const sections = [];
  favGroups.forEach((group) => {
    sections.push({ title: `Favorites · ${group.title}`, tools: group.tools, starred: true });
  });
  categories.forEach((name) => {
    const listTools = (tools[name] || [])
      .filter((tool) => toolMatches(tool, name, query))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (listTools.length) sections.push({ title: name, tools: listTools, favorites });
  });

  if (!renderToolSections(body, sections)) {
    const empty = document.createElement('p');
    empty.className = 'ws-empty';
    empty.textContent = 'No tools match this search.';
    body.replaceChildren(empty);
  }
}

async function renderOsintCategory(wrap) {
  stopDeskTools(wrap);
  const token = ++catalogRender;
  wrap.dataset.osintReady = '';
  wrap.className = 'ws-osint';
  wrap.replaceChildren();
  const loading = document.createElement('p');
  loading.className = 'ws-empty';
  loading.textContent = 'Loading OSINT tools...';
  wrap.appendChild(loading);

  const [tools, favorites] = await Promise.all([loadToolsData(), loadFavorites()]);
  if (token !== catalogRender || activeCategory !== 'osint') return;
  if (!tools) {
    wrap.replaceChildren();
    const empty = document.createElement('p');
    empty.className = 'ws-empty';
    empty.textContent = 'Could not load OSINT tools.';
    wrap.appendChild(empty);
    return;
  }

  paintOsint(wrap, tools, favorites);
}

function renderCategory(id) {
  const data = catalog[id] || catalog.overview;
  activeCategory = catalog[id] ? id : 'overview';
  document.getElementById('categoryHint').textContent = data.hint;

  document.querySelectorAll('#categoryTabs [data-category]').forEach((btn) => {
    btn.classList.toggle('is-active-cat', btn.dataset.category === activeCategory);
  });

  const wrap = document.getElementById('toolCards');
  if (data.live === 'osint') {
    renderOsintCategory(wrap);
    return;
  }
  if (data.live === 'image') {
    renderImageCategory(wrap);
    return;
  }
  if (data.live === 'username') {
    renderUsernameCategory(wrap);
    return;
  }
  if (data.live === 'email') {
    renderEmailCategory(wrap);
    return;
  }
  if (data.live === 'files') {
    renderFilesCategory(wrap);
    return;
  }
  if (data.live === 'web') {
    renderWebCategory(wrap);
    return;
  }
  if (data.live === 'crypto') {
    renderCryptoCategory(wrap);
    return;
  }
  if (data.live === 'dorks') {
    renderDorksCategory(wrap);
    return;
  }
  if (data.live === 'extra') {
    renderExtraCategory(wrap);
    return;
  }
  if (data.live === 'opsec') {
    renderOpsecCategory(wrap);
    return;
  }
  catalogRender += 1;
  renderDummyCards(wrap, data.cards);
  queueMicrotask(restoreSavedPlace);
}

function renderImageCategory(wrap) {
  stopDeskTools(wrap);
  catalogRender += 1;
  renderImageTools(wrap, {
    tool: imageTool,
    onToolChange(next) {
      imageTool = next;
      persistViewState();
      if (activeCategory !== 'image') return;
      renderImageCategory(wrap);
    }
  });
  queueMicrotask(restoreSavedPlace);
}

function renderUsernameCategory(wrap) {
  stopDeskTools(wrap);
  catalogRender += 1;
  renderUsernameTools(wrap, {
    query: usernameQuery,
    onQueryChange(next) {
      usernameQuery = next;
      persistViewState();
    }
  });
  queueMicrotask(restoreSavedPlace);
}

function renderEmailCategory(wrap) {
  stopDeskTools(wrap);
  catalogRender += 1;
  renderEmailTools(wrap, {
    tool: emailTool,
    query: emailQuery,
    onQueryChange(next) {
      emailQuery = next;
      persistViewState();
    },
    onToolChange(next) {
      emailTool = next;
      persistViewState();
      if (activeCategory !== 'email') return;
      renderEmailCategory(wrap);
    }
  });
  queueMicrotask(restoreSavedPlace);
}

function renderFilesCategory(wrap) {
  stopDeskTools(wrap);
  catalogRender += 1;
  renderFileTools(wrap, {
    tool: filesTool,
    onToolChange(next) {
      filesTool = next;
      persistViewState();
      if (activeCategory !== 'files') return;
      renderFilesCategory(wrap);
    }
  });
  queueMicrotask(restoreSavedPlace);
}

function renderWebCategory(wrap) {
  stopDeskTools(wrap);
  catalogRender += 1;
  renderWebTools(wrap, {
    tool: webTool,
    onToolChange(next) {
      webTool = next;
      persistViewState();
      if (activeCategory !== 'web') return;
      renderWebCategory(wrap);
    }
  });
  queueMicrotask(restoreSavedPlace);
}

function renderCryptoCategory(wrap) {
  stopDeskTools(wrap);
  catalogRender += 1;
  renderCryptoTools(wrap, {
    tool: cryptoTool,
    onToolChange(next) {
      cryptoTool = next;
      persistViewState();
      if (activeCategory !== 'crypto') return;
      renderCryptoCategory(wrap);
    }
  });
  queueMicrotask(restoreSavedPlace);
}

function renderExtraCategory(wrap) {
  stopDeskTools(wrap);
  catalogRender += 1;
  renderExtraTools(wrap, {
    tool: extraTool,
    onToolChange(next) {
      extraTool = next;
      persistViewState();
      if (activeCategory !== 'extra') return;
      renderExtraCategory(wrap);
    }
  });
  queueMicrotask(restoreSavedPlace);
}

function renderOpsecCategory(wrap) {
  stopDeskTools(wrap);
  catalogRender += 1;
  renderOpsecWorkspace(wrap, {
    section: opsecSection,
    guide: guideTool,
    onSectionChange(next) {
      opsecSection = next;
      if (next !== 'guides') guideTool = '';
      persistViewState();
      if (activeCategory !== 'opsec') return;
      renderOpsecCategory(wrap);
    },
    onGuideChange(next) {
      guideTool = next;
      persistViewState();
      if (activeCategory !== 'opsec') return;
      renderOpsecCategory(wrap);
    }
  });
  queueMicrotask(restoreSavedPlace);
}

function renderDorksCategory(wrap) {
  stopDeskTools(wrap);
  catalogRender += 1;
  renderDorkTools(wrap, {
    values: dorkValues,
    onValuesChange(next) {
      dorkValues = next;
      persistViewState();
    }
  });
  queueMicrotask(restoreSavedPlace);
}

function formatCaseMeta(investigation) {
  const nodes = state.nodes.length;
  const sources = state.nodes.reduce((sum, node) => sum + (node.sources?.length || 0), 0);
  const when = investigation?.modified
    ? new Date(investigation.modified).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'not saved yet';
  return `${nodes} nodes · ${sources} sources · ${when}`;
}

function updateCaseChrome(investigation) {
  const title = investigation?.name || 'No investigation';
  document.getElementById('caseTitle').textContent = title;
  document.getElementById('caseMeta').textContent = investigation
    ? formatCaseMeta(investigation)
    : 'Create one from the sidebar.';
}

let summaryMode = null;

function currentSummaryMode() {
  if (summaryMode) return summaryMode;
  return state.connections.length ? 'tree' : 'cards';
}

function makeSummaryChip(node, { loop = false } = {}) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = loop ? 'ws-summary-node is-loop' : 'ws-summary-node';
  chip.dataset.nodeId = String(node.id);
  chip.title = 'Edit card';
  const kind = document.createElement('em');
  const title = document.createElement('strong');
  if (loop) {
    kind.textContent = 'Returns to';
    title.textContent = `↩ ${node.title || 'Untitled'}`;
  } else {
    kind.textContent = typeLabels[node.type] || 'Card';
    title.textContent = node.title || 'Untitled';
  }
  chip.append(kind, title);
  return chip;
}

function renderSummaryCards(body) {
  const expanded = main.classList.contains('is-summary-expanded');
  const maxVisible = expanded ? state.nodes.length : 8;
  const visible = state.nodes.slice(0, maxVisible);
  visible.forEach((node) => body.appendChild(makeSummaryChip(node)));
  const extra = state.nodes.length - visible.length;
  if (extra > 0) {
    const more = document.createElement('span');
    more.className = 'ws-summary-more';
    more.textContent = `+${extra} more`;
    body.appendChild(more);
  }
}

function connectionLabels(fromId, toId) {
  return state.connections
    .filter((conn) => {
      const from = conn.from?.id ?? conn.from;
      const to = conn.to?.id ?? conn.to;
      return from === fromId && to === toId && conn.label?.trim();
    })
    .map((conn) => conn.label.trim());
}

function renderSummaryTree(body) {
  const outgoing = new Map();
  const incoming = new Map();
  state.nodes.forEach((node) => {
    outgoing.set(node.id, []);
    incoming.set(node.id, 0);
  });
  state.connections.forEach((conn) => {
    const fromId = conn.from?.id ?? conn.from;
    const toId = conn.to?.id ?? conn.to;
    if (!outgoing.has(fromId) || !incoming.has(toId)) return;
    outgoing.get(fromId).push(toId);
    incoming.set(toId, incoming.get(toId) + 1);
  });

  const forest = document.createElement('div');
  forest.className = 'ws-summary-tree';
  const visited = new Set();

  const renderBranch = (id) => {
    const node = state.nodes.find((item) => item.id === id);
    if (!node) return null;

    if (visited.has(id)) {
      return makeSummaryChip(node, { loop: true });
    }
    visited.add(id);

    const branch = document.createElement('div');
    branch.className = 'ws-tree-branch';
    branch.appendChild(makeSummaryChip(node));

    const next = (outgoing.get(id) || []).filter((childId) => outgoing.has(childId));
    if (!next.length) return branch;

    const fork = document.createElement('div');
    fork.className = next.length > 1 ? 'ws-tree-fork is-many' : 'ws-tree-fork';
    next.forEach((childId) => {
      const link = document.createElement('div');
      link.className = 'ws-tree-link';
      const arrowWrap = document.createElement('span');
      arrowWrap.className = 'ws-tree-arrow-wrap';
      const arrow = document.createElement('span');
      arrow.className = 'ws-tree-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';
      arrowWrap.appendChild(arrow);
      const labels = connectionLabels(id, childId);
      if (labels.length) {
        const note = document.createElement('em');
        note.className = 'ws-tree-label';
        note.textContent = labels.join(', ');
        arrowWrap.appendChild(note);
      }
      link.appendChild(arrowWrap);
      const child = renderBranch(childId);
      if (child) link.appendChild(child);
      fork.appendChild(link);
    });
    branch.appendChild(fork);
    return branch;
  };

  const roots = state.nodes.filter((node) => incoming.get(node.id) === 0);
  (roots.length ? roots : state.nodes.slice(0, 1)).forEach((node) => {
    const branch = renderBranch(node.id);
    if (branch) forest.appendChild(branch);
  });
  state.nodes.forEach((node) => {
    if (visited.has(node.id)) return;
    const branch = renderBranch(node.id);
    if (branch) forest.appendChild(branch);
  });
  body.appendChild(forest);
}

function renderGraphSummary() {
  const body = document.getElementById('wsGraphSummaryBody');
  if (!body) return;
  body.replaceChildren();
  body.classList.toggle('is-tree', currentSummaryMode() === 'tree');

  const mode = currentSummaryMode();
  document.querySelectorAll('[data-summary-mode]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.summaryMode === mode);
  });

  if (!state.currentInvestigation) {
    const empty = document.createElement('span');
    empty.className = 'ws-summary-empty';
    empty.textContent = 'Create an investigation to see a preview.';
    body.appendChild(empty);
    return;
  }

  if (!state.nodes.length) {
    const empty = document.createElement('span');
    empty.className = 'ws-summary-empty';
    empty.textContent = 'No cards yet. Open the graph to add some.';
    body.appendChild(empty);
    return;
  }

  if (mode === 'tree') renderSummaryTree(body);
  else renderSummaryCards(body);
  fitSummaryToContent();
}

document.addEventListener('osint-investigation-changed', (event) => {
  updateCaseChrome(event.detail);
  renderGraphSummary();
  restoreGraphCamera();
});

let use12Hour = localStorage.getItem('wsClock12') === '1';

function tickClock() {
  const now = new Date();
  document.getElementById('wsTime').textContent = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: use12Hour
  });
  const dateEl = document.getElementById('wsDate');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
}

function openExtensionTab(url) {
  chrome.tabs.create({ url, active: true });
}

const HELP_GUIDES = {
  he: 'guide_he.md',
  es: 'guide_es.md',
  fr: 'guide_fr.md',
  de: 'guide_de.md',
  pt: 'guide_pt_br.md',
  pl: 'guide_pl.md'
};

document.getElementById('helpBtn')?.addEventListener('click', () => {
  const lang = (navigator.language || 'en').slice(0, 2).toLowerCase();
  const file = HELP_GUIDES[lang] || 'guide_en.md';
  openExtensionTab(`https://github.com/tomsec8/IntelHub/blob/main/help/${file}`);
});

document.getElementById('refreshToolsBtn')?.addEventListener('click', () => {
  resetAllTools();
});

document.getElementById('toolCards')?.addEventListener('ws-tool-reset', (event) => {
  resetCurrentTool(event.detail?.resultId || '');
});

document.getElementById('whatsNewBtn')?.addEventListener('click', () => {
  openExtensionTab('https://github.com/tomsec8/IntelHub/releases');
});

document.getElementById('wsTime').addEventListener('click', () => {
  use12Hour = !use12Hour;
  localStorage.setItem('wsClock12', use12Hour ? '1' : '0');
  tickClock();
});

function documentTop(el) {
  return el.getBoundingClientRect().top + (window.scrollY || pageScroller().scrollTop || 0);
}

function fitGraphToViewport() {
  if (!main.classList.contains('is-graph-expanded') || document.body.classList.contains('is-graph-fullscreen')) {
    return;
  }
  const host = document.querySelector('.ws-graph-host');
  if (!host) return;
  const top = documentTop(host);
  const height = Math.max(280, Math.min(
    Math.round(window.innerHeight - 48),
    Math.round(window.innerHeight - top)
  ));
  document.documentElement.style.setProperty('--graph-open-h', `${height}px`);
}

function refreshGraphSize() {
  requestAnimationFrame(() => {
    fitGraphToViewport();
    requestAnimationFrame(() => {
      fitGraphToViewport();
      resizeCanvas();
    });
  });
}

function setGraphFullscreen(on) {
  if (on) {
    const wasExpanded = main.classList.contains('is-graph-expanded');
    setGraphExpanded(true);
    if (!restoringView) graphOpenPref = wasExpanded;
    document.body.classList.add('is-graph-fullscreen');
    if (fullscreenBtn) fullscreenBtn.textContent = 'Exit full screen';
    if (!restoringView) {
      persistViewState();
      refreshGraphSize();
    }
    return;
  }

  document.body.classList.remove('is-graph-fullscreen');
  if (fullscreenBtn) fullscreenBtn.textContent = 'Full screen';
  setGraphExpanded(graphOpenPref);
}

function setGraphExpanded(expanded) {
  main.classList.toggle('is-graph-expanded', expanded);
  if (!expanded) document.body.classList.remove('is-graph-fullscreen');
  if (!document.body.classList.contains('is-graph-fullscreen')) {
    graphOpenPref = expanded;
  }
  toggleBtn.textContent = expanded ? 'Show summary' : 'Open graph';
  if (fullscreenBtn) fullscreenBtn.textContent = document.body.classList.contains('is-graph-fullscreen')
    ? 'Exit full screen'
    : 'Full screen';
  if (graphHint) {
    graphHint.textContent = expanded
      ? 'Graph is open. Scroll down to reach tools.'
      : 'Preview only. Open the graph to edit cards and connections.';
  }
  if (!expanded) {
    document.documentElement.style.removeProperty('--graph-open-h');
    renderGraphSummary();
  } else if (!restoringView) {
    refreshGraphSize();
  }
  if (!restoringView) persistViewState();
}

toggleBtn.addEventListener('click', () => {
  if (main.classList.contains('is-case-hidden')) setCaseHidden(false);
  setGraphExpanded(!main.classList.contains('is-graph-expanded'));
});

fullscreenBtn?.addEventListener('click', () => {
  if (main.classList.contains('is-case-hidden')) setCaseHidden(false);
  setGraphFullscreen(!document.body.classList.contains('is-graph-fullscreen'));
});

exitFullscreenBtn?.addEventListener('click', () => setGraphFullscreen(false));

window.addEventListener('resize', () => {
  if (main.classList.contains('is-graph-expanded')) refreshGraphSize();
  else fitSummaryToContent();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('is-graph-fullscreen')) {
    setGraphFullscreen(false);
  }
});

document.querySelector('.ws-summary-bar')?.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-summary-mode]');
  if (!btn) return;
  event.stopPropagation();
  summaryMode = btn.dataset.summaryMode;
  persistViewState();
  renderGraphSummary();
});

document.getElementById('wsGraphSummaryBody')?.addEventListener('click', (event) => {
  const chip = event.target.closest('.ws-summary-node');
  if (!chip) return;
  const node = state.nodes.find((item) => String(item.id) === chip.dataset.nodeId);
  if (!node) return;
  editCard(node);
});

const expandSummaryBtn = document.getElementById('expandSummaryBtn');

function fitSummaryToContent() {
  const summary = document.getElementById('wsGraphSummary');
  if (!summary || main.classList.contains('is-graph-expanded')) return;
  if (!main.classList.contains('is-summary-expanded')) {
    document.documentElement.style.removeProperty('--summary-open-h');
    return;
  }
  if (main.classList.contains('is-case-hidden')) return;
  const top = documentTop(summary);
  const max = Math.max(280, Math.min(
    Math.round(window.innerHeight - 48),
    Math.round(window.innerHeight - top)
  ));
  document.documentElement.style.setProperty('--summary-open-h', `${max}px`);
  requestAnimationFrame(() => {
    const needed = summary.scrollHeight;
    document.documentElement.style.setProperty('--summary-open-h', `${Math.min(needed, max)}px`);
  });
}

function setSummaryExpanded(expanded) {
  main.classList.toggle('is-summary-expanded', expanded);
  if (expandSummaryBtn) expandSummaryBtn.textContent = expanded ? 'Show less' : 'Expand preview';
  persistViewState();
  renderGraphSummary();
}

expandSummaryBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  setSummaryExpanded(!main.classList.contains('is-summary-expanded'));
});

const caseToggleBtn = document.getElementById('toggleCaseBtn');

function setCaseHidden(hidden) {
  main.classList.toggle('is-case-hidden', hidden);
  if (caseToggleBtn) caseToggleBtn.textContent = hidden ? 'Show panel' : 'Hide panel';
  if (hidden) {
    setGraphFullscreen(false);
    setGraphExpanded(false);
  } else {
    renderGraphSummary();
    fitSummaryToContent();
    refreshGraphSize();
  }
  persistViewState();
}

caseToggleBtn.addEventListener('click', () => {
  setCaseHidden(!main.classList.contains('is-case-hidden'));
});

document.getElementById('categoryTabs').addEventListener('click', (event) => {
  const catBtn = event.target.closest('[data-category]');
  if (!catBtn) return;
  if (catBtn.dataset.category === 'image' && activeCategory === 'image') {
    imageTool = '';
  }
  if (catBtn.dataset.category === 'files' && activeCategory === 'files') {
    filesTool = '';
  }
  if (catBtn.dataset.category === 'email' && activeCategory === 'email') {
    emailTool = '';
  }
  if (catBtn.dataset.category === 'web' && activeCategory === 'web') {
    webTool = '';
  }
  if (catBtn.dataset.category === 'crypto' && activeCategory === 'crypto') {
    cryptoTool = '';
  }
  if (catBtn.dataset.category === 'extra' && activeCategory === 'extra') {
    extraTool = '';
  }
  if (catBtn.dataset.category === 'opsec' && activeCategory === 'opsec') {
    opsecSection = '';
    guideTool = '';
  }
  renderCategory(catBtn.dataset.category);
  persistViewState();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (activeCategory !== 'osint') return;
  const wrap = document.getElementById('toolCards');
  if (changes.favorites && wrap?.dataset.osintReady === '1' && wrap._osintTools) {
    paintOsint(wrap, wrap._osintTools, normalizeFavorites(changes.favorites.newValue));
    return;
  }
  if (changes.toolsData || changes.favorites) {
    renderCategory('osint');
  }
});

const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');

document.getElementById('sidebarSearch')?.addEventListener('input', () => {
  renderInvestigationsList();
});

sidebarToggleBtn.addEventListener('click', () => {
  const collapsed = document.body.classList.toggle('is-sidebar-collapsed');
    sidebarToggleBtn.textContent = collapsed ? 'Show menu' : 'Hide menu';
    sidebarToggleBtn.title = collapsed ? 'Show menu' : 'Hide menu';
  persistViewState();
  refreshGraphSize();
});

const graphHost = document.querySelector('.ws-graph-host');
if (typeof ResizeObserver !== 'undefined' && graphHost) {
  new ResizeObserver(() => resizeCanvas()).observe(graphHost);
}

function restoreViewState() {
  const view = readViewState();
  restoreSnapshot = {
    scrollX: Number(view.scrollX) || 0,
    scrollY: Number(view.scrollY) || 0,
    sidebarScroll: Number(view.sidebarScroll) || 0
  };
  restoringView = true;
  if (view.summaryMode === 'cards' || view.summaryMode === 'tree') summaryMode = view.summaryMode;
  if (view.osintGroup) osintGroup = view.osintGroup;
  if (typeof view.osintQuery === 'string') osintQuery = view.osintQuery;
  if (view.favActiveCat) favActiveCat = view.favActiveCat;
  const fileTools = new Set(['pdf', 'office', 'tracker', 'sanitize', 'hash', 'identify', 'encrypt']);
  if (fileTools.has(view.filesTool)) {
    filesTool = view.filesTool;
  }
  if (view.imageTool === 'sanitize') {
    filesTool = 'sanitize';
    imageTool = '';
    if (view.category === 'image') view.category = 'files';
  } else if (view.imageTool === 'reverse' || view.imageTool === 'faces' || view.imageTool === 'meta') {
    imageTool = view.imageTool;
  }
  if (typeof view.usernameQuery === 'string') usernameQuery = view.usernameQuery;
  if (typeof view.emailQuery === 'string') emailQuery = view.emailQuery;
  if (view.emailTool === 'gmail' || view.emailTool === 'xon' || view.emailTool === 'hudson' || view.emailTool === 'gravatar') emailTool = view.emailTool;
  const webTools = new Set(['domain', 'ip', 'subdomains', 'tracer', 'virustotal', 'ssl', 'headers', 'doh', 'archives']);
  if (webTools.has(view.webTool) || view.webTool === 'virus' || view.webTool === 'unshorten') {
    webTool = view.webTool === 'virus' ? 'virustotal' : view.webTool === 'unshorten' ? 'tracer' : view.webTool;
  }
  if (view.cryptoTool === 'wallet') cryptoTool = 'wallet';
  if (view.dorkValues && typeof view.dorkValues === 'object') dorkValues = view.dorkValues;
  if (['text', 'social', 'telegram', 'phone', 'tg-export', 'funstat'].includes(view.extraTool)) {
    extraTool = view.extraTool;
  }
  if (view.guideTool === 'dns' || view.guideTool === 'dnt' || view.guideTool === 'cookies') {
    guideTool = view.guideTool;
  }
  if (view.opsecSection === 'protections' || view.opsecSection === 'guides') {
    opsecSection = view.opsecSection;
  } else if (view.opsecSection === 'tools') {
    opsecSection = '';
  } else if (view.category === 'protections') {
    opsecSection = 'protections';
  } else if (view.category === 'guides') {
    opsecSection = 'guides';
  } else if (view.category === 'opsecExtra') {
    opsecSection = '';
  }
  restorePlaceOnce = true;
  if (view.category === 'favorites') {
    osintGroup = view.osintGroup || 'favorites';
    renderCategory('osint');
  } else {
    const legacyOpsec = view.category === 'protections' || view.category === 'opsecExtra' || view.category === 'guides';
    const nextCategory = legacyOpsec ? 'opsec' : (catalog[view.category] ? view.category : 'overview');
    renderCategory(nextCategory);
  }
  if (view.sidebarCollapsed) {
    document.body.classList.add('is-sidebar-collapsed');
    sidebarToggleBtn.textContent = 'Show menu';
    sidebarToggleBtn.title = 'Show menu';
  }
  graphOpenPref = view.graphOpen === true;
  if (view.caseHidden === true) {
    setCaseHidden(true);
  } else if (view.fullscreen === true) {
    if (view.summaryOpen === true) setSummaryExpanded(true);
    setGraphFullscreen(true);
  } else {
    if (view.summaryOpen === true) setSummaryExpanded(true);
    if (view.graphOpen === true) setGraphExpanded(true);
  }
  restoringView = false;
  requestAnimationFrame(restoreSavedPlace);
  setTimeout(restoreSavedPlace, 250);
}

let scrollSaveTimer = 0;
const saveScrollSoon = () => {
  if (restoringView) return;
  clearTimeout(scrollSaveTimer);
  scrollSaveTimer = setTimeout(persistViewState, 120);
};
window.addEventListener('scroll', saveScrollSoon, { passive: true });
document.querySelector('.ws-sidebar')?.addEventListener('scroll', saveScrollSoon, { passive: true });

tickClock();
setInterval(tickClock, 1000);
await initInvestigationGraph();
restoreViewState();
renderGraphSummary();
if (main.classList.contains('is-graph-expanded')) refreshGraphSize();
else fitSummaryToContent();
restoreSavedPlace();
