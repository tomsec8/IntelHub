const KEY = 'wsToolResults';

function readAll() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export function getToolResult(id) {
  return readAll()[id] ?? null;
}

export function setToolResult(id, data) {
  const all = readAll();
  if (data == null) delete all[id];
  else all[id] = data;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore quota errors */
  }
}

export function clearToolResult(id) {
  setToolResult(id, null);
}

export function clearAllToolResults() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore quota errors */
  }
}

export function paintToolChrome(wrap, title, { onBack, resultId, wrapClass = 'ws-image', panelClass = 'ws-image-panel' } = {}) {
  wrap.className = wrapClass;
  wrap.replaceChildren();
  const bar = document.createElement('div');
  bar.className = 'ws-image-bar';
  if (typeof onBack === 'function') {
    const back = document.createElement('button');
    back.className = 'ws-btn ws-btn-ghost';
    back.type = 'button';
    back.textContent = 'Back';
    back.addEventListener('click', () => onBack(''));
    bar.appendChild(back);
  }
  const heading = document.createElement('h2');
  heading.textContent = title;
  bar.appendChild(heading);
  const reset = document.createElement('button');
  reset.className = 'ws-btn ws-btn-ghost ws-tool-reset';
  reset.type = 'button';
  reset.textContent = 'Reset';
  reset.title = 'Clear this tool';
  reset.addEventListener('click', () => {
    wrap.dispatchEvent(new CustomEvent('ws-tool-reset', {
      bubbles: true,
      detail: { resultId: resultId || '' }
    }));
  });
  bar.appendChild(reset);
  wrap.appendChild(bar);
  const panel = document.createElement('div');
  panel.className = panelClass;
  wrap.appendChild(panel);
  return panel;
}

export function bindToolBack(onBack, id) {
  return (next) => {
    if (!next) clearToolResult(id);
    onBack(next);
  };
}

export const API_SOURCES = {
  blockchain: { name: 'blockchain.info', type: 'REST', detail: 'Blockchain Data API · Bitcoin · no key' },
  ethplorer: { name: 'Ethplorer', type: 'REST', detail: 'api.ethplorer.io · Ethereum · public freekey, no signup' },
  ipApi: { name: 'ip-api.com', type: 'HTTP JSON', detail: 'Geolocation · no key · 45/min' },
  rdap: { name: 'RDAP', type: 'RDAP REST', detail: 'rdap.org and the matching RIR · no key' },
  doh: { name: 'Google DoH', type: 'DNS-over-HTTPS JSON', detail: 'dns.google · no key' },
  crtsh: { name: 'crt.sh', type: 'REST', detail: 'Certificate Transparency · no key' },
  certspotter: { name: 'Cert Spotter', type: 'REST', detail: 'api.certspotter.com · no key' },
  cdx: { name: 'Wayback CDX', type: 'REST', detail: 'web.archive.org CDX API · no key' },
  otx: { name: 'AlienVault OTX', type: 'REST', detail: 'Passive DNS · no key' },
  anubis: { name: 'Anubis', type: 'REST', detail: 'jldc.me subdomain dataset · no key' },
  hackertarget: { name: 'HackerTarget', type: 'REST', detail: 'api.hackertarget.com · no key' },
  urlscan: { name: 'urlscan.io', type: 'REST', detail: 'Public search API · no key' },
  xon: { name: 'XposedOrNot', type: 'REST', detail: 'api.xposedornot.com · no signup · 100/day' },
  hudsonRock: { name: 'Hudson Rock', type: 'REST', detail: 'cavalier.hudsonrock.com OSINT tools · infostealers · no key' },
  gravatar: { name: 'Gravatar', type: 'REST', detail: 'gravatar.com profile JSON + avatar · SHA-256 of email · no key' },
  googlePeople: { name: 'Google', type: 'Session HTTP', detail: 'People / Maps / Calendar via the signed-in Google session' },
  catbox: { name: 'catbox.moe', type: 'HTTP upload', detail: 'Public file host so reverse-image engines can fetch a local photo' },
  networkcalc: { name: 'NetworkCalc', type: 'REST', detail: 'Live TLS certificate lookup · no key' },
  githubRaw: { name: 'GitHub raw', type: 'HTTP', detail: 'jivoi/awesome-osint README · no key' },
  usernameHttp: { name: 'Target sites', type: 'HTTP probes', detail: 'Direct checks to 150+ platforms · no username API' },
  dohResolvers: { name: 'Public DoH resolvers', type: 'DNS-over-HTTPS JSON', detail: 'Cloudflare, Quad9, Mullvad, and others · no key' },
  ethplorerFallback: { name: 'Blockscout', type: 'REST', detail: 'eth.blockscout.com · used only if Ethplorer fails' },
  targetHttp: { name: 'Target URL', type: 'Direct HTTP', detail: 'The extension fetches the address you paste · no third-party lookup API' },
  virusTotalGui: { name: 'VirusTotal', type: 'Website', detail: 'Opens the VT report in a tab · no VirusTotal API key' },
  abuseipdb: { name: 'AbuseIPDB', type: 'Website', detail: 'Opens the public IP check page · no API key' },
  archivesWeb: { name: 'Archive websites', type: 'Website', detail: 'Opens Wayback, archive.today, and others · no lookup API' },
  imageEngines: { name: 'Search engines', type: 'Website', detail: 'Opens Google Lens, Yandex, Bing, or TinEye with the image URL' },
  telegramWeb: { name: 'Telegram', type: 'HTTP', detail: 'Public t.me pages · no Bot API' },
  googleSearch: { name: 'Google Search', type: 'Website', detail: 'Opens a Google query in a tab · no Custom Search API' },
  profileSites: { name: 'Social sites', type: 'Website', detail: 'Opens Facebook, Instagram, X, TikTok, or LinkedIn · no API' },
  phoneSites: { name: 'Phone lookup sites', type: 'Website', detail: 'Opens Telegram, WhatsApp, Truecaller, or Sync.me · no API' }
};

export function apiNote(sources) {
  const list = (sources || []).filter(Boolean);
  const box = document.createElement('p');
  box.className = 'ws-api-note';
  const kicker = document.createElement('span');
  kicker.className = 'ws-api-kicker';
  kicker.textContent = list.length === 1 ? 'API' : 'APIs';
  box.appendChild(kicker);
  if (!list.length) {
    box.append(document.createTextNode(' Local only'));
    return box;
  }
  list.forEach((src, index) => {
    box.append(document.createTextNode(index ? ' · ' : ' '));
    const name = document.createElement('strong');
    name.textContent = src.name;
    if (src.detail) name.title = src.detail;
    box.append(name, document.createTextNode(` ${src.type}`));
  });
  return box;
}

export function apiCardLine(sources) {
  const list = (sources || []).filter(Boolean);
  if (!list.length) return null;
  const line = document.createElement('em');
  line.className = 'ws-api-card';
  line.textContent = `API · ${list.map((src) => `${src.name} (${src.type})`).join(' · ')}`;
  return line;
}

export function fillToolCards(wrap, tools, onToolChange) {
  wrap.className = 'ws-cards';
  wrap.replaceChildren();
  tools.forEach((tool) => {
    const card = document.createElement('button');
    card.className = 'ws-tool-card';
    card.type = 'button';
    const strong = document.createElement('strong');
    strong.textContent = tool.name;
    const blurb = document.createElement('span');
    blurb.textContent = tool.blurb;
    card.append(strong, blurb);
    const line = apiCardLine(tool.api);
    if (line) card.appendChild(line);
    card.addEventListener('click', () => onToolChange(tool.id));
    wrap.appendChild(card);
  });
}
