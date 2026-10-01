import { brw, flashButton } from './utils.js';
import { analyzeDomainAPI, findSubdomains, fetchIpRdap, fetchRdap } from './siteAnalyzer.js';
import { mountOpsecExtraTool } from './opsecHub/mountExtraTool.js';
import { bindToolBack, getToolResult, setToolResult, apiNote, fillToolCards, API_SOURCES, paintToolChrome } from './workspaceToolResults.js';

const ARCHIVE_ENGINES = [
  { name: 'Wayback Machine', url: (value) => `https://web.archive.org/web/${encodeURIComponent(value)}` },
  { name: 'Archive.today', url: (value) => `https://archive.today/?run=1&url=${encodeURIComponent(value)}` },
  { name: 'Megalodon.jp', url: (value) => `https://megalodon.jp/?url=${encodeURIComponent(value)}` },
  { name: 'Ghostarchive', url: (value) => `https://ghostarchive.org/search?term=${encodeURIComponent(value)}` }
];

const IP_API_FIELDS = [
  'status', 'message', 'query', 'continent', 'continentCode', 'country', 'countryCode',
  'region', 'regionName', 'city', 'district', 'zip', 'lat', 'lon', 'timezone', 'offset',
  'isp', 'org', 'as', 'asname', 'reverse', 'mobile', 'proxy', 'hosting'
].join(',');

const TOOLS = [
  {
    id: 'domain',
    name: 'Domain Lookup',
    blurb: 'DNS records, IPs, and links to WHOIS, certificates, and VirusTotal.',
    api: [API_SOURCES.doh, API_SOURCES.rdap]
  },
  {
    id: 'ip',
    name: 'IP Lookup',
    blurb: 'Geolocation, ISP, ASN, proxy flags, and an AbuseIPDB page for the same IP.',
    api: [API_SOURCES.ipApi, API_SOURCES.rdap, API_SOURCES.abuseipdb]
  },
  {
    id: 'subdomains',
    name: 'Subdomains',
    blurb: 'Hostnames already seen in public certificate logs, archives, and passive DNS.',
    api: [API_SOURCES.crtsh, API_SOURCES.certspotter, API_SOURCES.cdx, API_SOURCES.otx, API_SOURCES.anubis, API_SOURCES.hackertarget, API_SOURCES.urlscan, API_SOURCES.doh]
  },
  {
    id: 'tracer',
    name: 'Short Link Tracer',
    blurb: 'Expand a shortened link hop-by-hop until the final destination.',
    api: [API_SOURCES.targetHttp]
  },
  {
    id: 'virustotal',
    name: 'VirusTotal Lookup',
    blurb: 'Paste a URL, domain, IP, or hash — files are hashed locally, then VT opens.',
    api: [API_SOURCES.virusTotalGui]
  },
  {
    id: 'ssl',
    name: 'SSL Certificate Inspector',
    blurb: 'Inspect HTTPS certificate details for a domain.',
    api: [API_SOURCES.networkcalc, API_SOURCES.certspotter]
  },
  {
    id: 'headers',
    name: 'Security Headers Analyzer',
    blurb: 'Audit CSP, HSTS, and other response security headers.',
    api: [API_SOURCES.targetHttp]
  },
  {
    id: 'doh',
    name: 'DoH Leak Checker',
    blurb: 'Probe Secure DNS resolvers and check for DNS leaks.',
    api: [API_SOURCES.dohResolvers]
  },
  {
    id: 'archives',
    name: 'Archives',
    blurb: 'Search a URL in Wayback and other archives.',
    api: [API_SOURCES.archivesWeb]
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

function paintOpsecTool(wrap, title, panelId, onBack, apis) {
  const panel = toolChrome(wrap, title, onBack);
  panel.classList.add('opsec-tool-panel');
  mountOpsecExtraTool(panel, panelId)
    .then(() => {
      if (apis?.length) panel.prepend(apiNote(apis));
    })
    .catch((err) => {
      console.error('[OPSEC] tool mount failed:', err);
      panel.replaceChildren(el('p', 'ws-image-note', 'Could not open this tool. Reload the workspace and try again.'));
    });
}

function cleanIpQuery(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.includes('/')) {
    try {
      const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
      return url.hostname.replace(/^\[|\]$/g, '');
    } catch {
      /* fall through */
    }
  }
  return raw.replace(/^\[|\]$/g, '').split('%')[0].split('/')[0];
}

function formatUtcOffset(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '';
  const sign = seconds < 0 ? '-' : '+';
  const abs = Math.abs(seconds);
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  return `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function flagLabel(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '';
}

async function lookupIpApi(query) {
  const path = query ? `/${encodeURIComponent(query)}` : '/';
  const url = `http://ip-api.com/json${path}?fields=${IP_API_FIELDS}`;
  let res;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new Error('Could not reach ip-api. If Force HTTPS is on, reload the extension after this update.');
  }
  if (res.status === 429) throw new Error('ip-api rate limit (45 lookups per minute). Wait and try again.');
  if (!res.ok) throw new Error(`ip-api returned HTTP ${res.status}.`);
  const data = await res.json();
  if (data.status !== 'success') {
    const reason = data.message || 'Lookup failed.';
    if (String(reason).toLowerCase().includes('ssl')) {
      throw new Error('ip-api free lookups are HTTP-only. Turn Force HTTPS off for ip-api.com, or reload the extension.');
    }
    throw new Error(reason);
  }
  return data;
}

function cleanDomain(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
    let host = url.hostname.toLowerCase();
    if (typeof psl !== 'undefined') {
      const parsed = psl.parse(host);
      host = parsed.domain || host;
    }
    return host;
  } catch {
    return raw.replace(/^https?:\/\//i, '').split('/')[0];
  }
}

function paintCards(wrap, onToolChange) {
  fillToolCards(wrap, TOOLS, onToolChange);
}

function paintDomain(wrap, onToolChange) {
  const panel = toolChrome(wrap, 'Domain Lookup', onToolChange, 'web:domain');
  panel.appendChild(apiNote([API_SOURCES.doh, API_SOURCES.rdap]));
  panel.appendChild(el('p', 'ws-image-note', 'DNS via Google DoH. Registration dates and registrar come from RDAP. WHOIS, technology, and certificates open in a new tab.'));

  const row = el('div', 'ws-people-row');
  const input = el('input', 'ws-osint-search');
  input.type = 'text';
  input.placeholder = 'example.com';
  const lookupBtn = el('button', 'ws-btn', 'Look up');
  lookupBtn.type = 'button';
  row.append(input, lookupBtn);

  const status = el('p', 'ws-image-status', '');
  const out = el('div', 'ws-web-out');

  function addRow(table, key, value) {
    if (value == null || value === '') return;
    const rowEl = table.insertRow();
    rowEl.insertCell().textContent = key;
    rowEl.insertCell().textContent = Array.isArray(value) ? value.join(', ') : String(value);
  }

  function showDomainResult(data) {
    const domain = data.targetDomain || data.query;
    out.replaceChildren();
    status.textContent = '';
    const table = el('table', 'ws-image-table');
    addRow(table, 'Domain', domain);
    addRow(table, 'A', (data.ipAddresses || []).join(', ') || 'None found');
    addRow(table, 'AAAA', (data.ipv6 || []).join(', '));
    addRow(table, 'MX', (data.mx || []).join(', '));
    addRow(table, 'NS', (data.ns || []).join(', '));
    addRow(table, 'TXT', (data.txt || []).join('\n'));
    if (data.dnsError) addRow(table, 'DNS error', data.dnsError);
    const rdap = data.rdap;
    if (rdap && (rdap.registrar || rdap.created || rdap.expires || (rdap.status || []).length)) {
      addRow(table, 'Registrar', rdap.registrar);
      addRow(table, 'Created', (rdap.created || '').slice(0, 10));
      addRow(table, 'Updated', (rdap.updated || '').slice(0, 10));
      addRow(table, 'Expires', (rdap.expires || '').slice(0, 10));
      addRow(table, 'RDAP status', (rdap.status || []).join(', '));
    } else {
      addRow(table, 'RDAP', 'No registration record in this result. Run Look up again, or open the RDAP link.');
    }
    out.appendChild(table);

    const links = el('div', 'ws-email-links');
    [
      { href: `https://www.whois.com/whois/${domain}`, label: 'WHOIS' },
      { href: `https://rdap.org/domain/${domain}`, label: 'RDAP' },
      { href: `https://dnschecker.org/all-dns-records-of-domain.php?query=${domain}&rtype=ALL&dns=google`, label: 'All DNS records' },
      { href: `https://w3techs.com/sites/info/${domain}`, label: 'Technology' },
      { href: `https://www.virustotal.com/gui/domain/${encodeURIComponent(domain)}`, label: 'VirusTotal' },
      { href: `https://crt.sh/?q=${encodeURIComponent(domain)}`, label: 'Certificates' }
    ].forEach((item) => {
      const link = el('a', 'ws-btn ws-btn-ghost', item.label);
      link.href = item.href;
      link.target = '_blank';
      link.rel = 'noopener';
      links.appendChild(link);
    });
    out.appendChild(links);
  }

  async function run() {
    const domain = cleanDomain(input.value);
    if (!domain) {
      flashButton(lookupBtn, 'Enter a domain', true);
      return;
    }
    lookupBtn.disabled = true;
    status.textContent = `Looking up ${domain}…`;
    status.className = 'ws-image-status';
    out.replaceChildren();
    try {
      const data = await analyzeDomainAPI(domain);
      const saved = {
        query: domain,
        targetDomain: data.targetDomain || domain,
        ipAddresses: data.ipAddresses || [],
        ipv6: data.ipv6 || [],
        mx: data.mx || [],
        ns: data.ns || [],
        txt: data.txt || [],
        dnsError: data.dnsError || '',
        rdap: data.rdap || null
      };
      setToolResult('web:domain', saved);
      showDomainResult(saved);
    } catch (err) {
      status.textContent = err.message || 'Lookup failed.';
      status.className = 'ws-image-status is-bad';
    } finally {
      lookupBtn.disabled = false;
    }
  }

  lookupBtn.addEventListener('click', run);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') run();
  });
  panel.append(row, status, out);
  const saved = getToolResult('web:domain');
  if (saved?.targetDomain) {
    input.value = saved.query || saved.targetDomain;
    showDomainResult(saved);
    if (!saved.rdap) {
      fetchRdap(saved.targetDomain).then((rdap) => {
        if (!rdap) return;
        saved.rdap = rdap;
        setToolResult('web:domain', saved);
        showDomainResult(saved);
      });
    }
  }
}

function paintIp(wrap, onToolChange) {
  const panel = toolChrome(wrap, 'IP Lookup', onToolChange, 'web:ip');
  panel.appendChild(apiNote([API_SOURCES.ipApi, API_SOURCES.rdap, API_SOURCES.abuseipdb]));
  panel.appendChild(el(
    'p',
    'ws-image-note',
    'Geolocation from ip-api. Allocation from RDAP. AbuseIPDB opens their public check page in a tab — no API key. Check my IP returns this device\'s public address.'
  ));

  const row = el('div', 'ws-people-row');
  const input = el('input', 'ws-osint-search');
  input.type = 'text';
  input.placeholder = '1.1.1.1, 2001:4860::8888, or example.com';
  const lookupBtn = el('button', 'ws-btn', 'Look up');
  lookupBtn.type = 'button';
  const mineBtn = el('button', 'ws-btn', 'Check my IP');
  mineBtn.type = 'button';
  row.append(input, lookupBtn, mineBtn);

  const status = el('p', 'ws-image-status', '');
  const out = el('div', 'ws-web-out');

  function addRow(table, key, value) {
    if (value == null || value === '') return;
    const rowEl = table.insertRow();
    rowEl.insertCell().textContent = key;
    rowEl.insertCell().textContent = String(value);
  }

  function showResult(data, rdap) {
    out.replaceChildren();
    status.textContent = '';
    const table = el('table', 'ws-image-table');
    addRow(table, 'IP', data.query);
    addRow(table, 'Reverse DNS', data.reverse);
    addRow(table, 'Country', [data.country, data.countryCode].filter(Boolean).join(' · '));
    addRow(table, 'Continent', [data.continent, data.continentCode].filter(Boolean).join(' · '));
    addRow(table, 'Region', [data.regionName, data.region].filter(Boolean).join(' · '));
    addRow(table, 'City', [data.city, data.district].filter(Boolean).join(' · '));
    addRow(table, 'ZIP', data.zip);
    if (data.lat != null && data.lon != null) addRow(table, 'Coordinates', `${data.lat}, ${data.lon}`);
    addRow(table, 'Timezone', [data.timezone, formatUtcOffset(data.offset)].filter(Boolean).join(' · '));
    addRow(table, 'ISP', data.isp);
    addRow(table, 'Organization', data.org);
    addRow(table, 'ASN', data.as);
    addRow(table, 'AS name', data.asname);
    addRow(table, 'Proxy / VPN / Tor', flagLabel(data.proxy));
    addRow(table, 'Hosting / datacenter', flagLabel(data.hosting));
    addRow(table, 'Mobile', flagLabel(data.mobile));
    out.appendChild(table);

    const rdapTable = el('table', 'ws-image-table');
    if (rdap && (rdap.cidrs?.length || rdap.handle || rdap.rir || rdap.org || rdap.abuse || rdap.name)) {
      addRow(rdapTable, 'RDAP network', (rdap.cidrs || []).join(', '));
      addRow(rdapTable, 'Range', rdap.range);
      addRow(rdapTable, 'Block name', rdap.name);
      addRow(rdapTable, 'Type', rdap.type);
      addRow(rdapTable, 'RIR', rdap.rir);
      addRow(rdapTable, 'Allocated country', rdap.country);
      addRow(rdapTable, 'Holder', rdap.org);
      addRow(rdapTable, 'Abuse', [rdap.abuseName, rdap.abuse].filter(Boolean).join(' · '));
      addRow(rdapTable, 'RDAP status', (rdap.status || []).join(', '));
    } else {
      addRow(rdapTable, 'RDAP', 'No allocation record in this result. Run Look up again, or open the RDAP link.');
    }
    out.appendChild(rdapTable);

    const links = el('div', 'ws-email-links');
    const ip = encodeURIComponent(data.query || '');
    const items = [
      { href: `https://www.abuseipdb.com/check/${ip}`, label: 'AbuseIPDB' },
      { href: `https://rdap.org/ip/${ip}`, label: 'RDAP' },
      { href: `https://www.virustotal.com/gui/ip-address/${ip}`, label: 'VirusTotal' },
      { href: `https://bgp.he.net/ip/${ip}`, label: 'BGP (HE)' },
      { href: `https://ipinfo.io/${ip}`, label: 'ipinfo.io' }
    ];
    if (data.lat != null && data.lon != null) {
      items.unshift({
        href: `https://www.openstreetmap.org/?mlat=${data.lat}&mlon=${data.lon}#map=10/${data.lat}/${data.lon}`,
        label: 'OpenStreetMap'
      });
    }
    items.forEach((item) => {
      const link = el('a', 'ws-btn ws-btn-ghost', item.label);
      link.href = item.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      links.appendChild(link);
    });
    out.appendChild(links);
  }

  async function run(raw) {
    const query = cleanIpQuery(raw);
    lookupBtn.disabled = true;
    mineBtn.disabled = true;
    status.textContent = query ? `Looking up ${query}…` : 'Looking up this device\'s public IP…';
    status.className = 'ws-image-status';
    out.replaceChildren();
    try {
      const looksLikeIp = Boolean(query && (/^(\d{1,3}\.){3}\d{1,3}$/.test(query) || query.includes(':')));
      let data;
      let rdap = null;
      if (looksLikeIp) {
        [data, rdap] = await Promise.all([lookupIpApi(query), fetchIpRdap(query)]);
      } else {
        data = await lookupIpApi(query);
        rdap = data.query ? await fetchIpRdap(data.query) : null;
      }
      setToolResult('web:ip', { query: raw.trim(), result: data, rdap });
      if (!raw.trim() && data.query) input.value = data.query;
      showResult(data, rdap);
    } catch (err) {
      status.textContent = err.message || 'Lookup failed.';
      status.className = 'ws-image-status is-bad';
    } finally {
      lookupBtn.disabled = false;
      mineBtn.disabled = false;
    }
  }

  lookupBtn.addEventListener('click', () => run(input.value));
  mineBtn.addEventListener('click', () => {
    input.value = '';
    run('');
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') run(input.value);
  });
  panel.append(row, status, out);

  const saved = getToolResult('web:ip');
  if (saved?.result?.query) {
    input.value = saved.query || saved.result.query;
    showResult(saved.result, saved.rdap);
    if (!saved.rdap) {
      fetchIpRdap(saved.result.query).then((rdap) => {
        if (!rdap) return;
        saved.rdap = rdap;
        setToolResult('web:ip', saved);
        showResult(saved.result, rdap);
      });
    }
  }
}

function paintSubdomains(wrap, onToolChange) {
  const panel = toolChrome(wrap, 'Subdomains', onToolChange, 'web:subdomains');
  panel.appendChild(apiNote([
    API_SOURCES.crtsh,
    API_SOURCES.certspotter,
    API_SOURCES.cdx,
    API_SOURCES.otx,
    API_SOURCES.anubis,
    API_SOURCES.hackertarget,
    API_SOURCES.urlscan,
    API_SOURCES.doh
  ]));
  panel.appendChild(el('p', 'ws-image-note', 'Public records only: certificates, archives, passive DNS, and urlscan. No guessed wordlist.'));

  const row = el('div', 'ws-people-row');
  const input = el('input', 'ws-osint-search');
  input.type = 'text';
  input.placeholder = 'example.com';
  const findBtn = el('button', 'ws-btn', 'Find');
  findBtn.type = 'button';
  row.append(input, findBtn);

  const status = el('p', 'ws-image-status', '');
  const out = el('div', 'ws-web-out');

  function showHosts(data) {
    out.replaceChildren();
    status.textContent = '';
    const hosts = data.hosts || [];
    status.textContent = hosts.length
      ? `${data.domain} · ${hosts.length} hostname${hosts.length === 1 ? '' : 's'} · ${data.liveCount || 0} resolved`
      : `${data.domain} · nothing in public records.`;
    status.className = 'ws-image-status' + (hosts.length ? ' is-ok' : '');
    if (!hosts.length) return;
    const table = el('table', 'ws-image-table');
    hosts.forEach((item) => {
      const rowEl = table.insertRow();
      const nameCell = rowEl.insertCell();
      const link = document.createElement('a');
      link.href = `https://${item.host}`;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = item.host;
      nameCell.appendChild(link);
      rowEl.insertCell().textContent = (item.ips || []).join(', ') || 'public record';
    });
    out.appendChild(table);
  }

  async function run() {
    const domain = cleanDomain(input.value);
    if (!domain) {
      flashButton(findBtn, 'Enter a domain', true);
      return;
    }
    findBtn.disabled = true;
    status.textContent = `Looking up ${domain}…`;
    status.className = 'ws-image-status';
    out.replaceChildren();
    try {
      const result = await findSubdomains(domain);
      if (!result.success) {
        status.textContent = result.reason || 'Lookup failed.';
        status.className = 'ws-image-status is-bad';
        return;
      }
      const saved = {
        domain: result.domain || domain,
        hosts: result.hosts || [],
        liveCount: result.liveCount || 0
      };
      setToolResult('web:subdomains', saved);
      input.value = saved.domain;
      showHosts(saved);
    } catch (err) {
      status.textContent = err.message || 'Lookup failed.';
      status.className = 'ws-image-status is-bad';
    } finally {
      findBtn.disabled = false;
    }
  }

  findBtn.addEventListener('click', run);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') run();
  });
  panel.append(row, status, out);
  const saved = getToolResult('web:subdomains');
  if (saved?.domain) {
    input.value = saved.domain;
    showHosts(saved);
  }
}

function paintArchives(wrap, onToolChange) {
  const panel = toolChrome(wrap, 'Archives', onToolChange);
  panel.appendChild(apiNote([API_SOURCES.archivesWeb]));
  panel.appendChild(el('p', 'ws-image-note', 'Choose engines, then search a URL. Selected engines are saved.'));

  const engines = el('div', 'ws-image-engine-list');
  brw.storage.local.get({ archiveEngines: ['Wayback Machine'] }, (data) => {
    const saved = data.archiveEngines || [];
    ARCHIVE_ENGINES.forEach((engine) => {
      const label = el('label', 'ws-image-engine');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = saved.includes(engine.name);
      box.dataset.engine = engine.name;
      box.addEventListener('change', () => {
        const selected = [...engines.querySelectorAll('input:checked')].map((item) => item.dataset.engine);
        brw.storage.local.set({ archiveEngines: selected });
      });
      label.append(box, document.createTextNode(engine.name));
      engines.appendChild(label);
    });
  });

  const row = el('div', 'ws-people-row');
  const input = el('input', 'ws-osint-search');
  input.placeholder = 'https://example.com';
  const goBtn = el('button', 'ws-btn', 'Search archives');
  goBtn.type = 'button';
  row.append(input, goBtn);

  async function search(url, btn) {
    const stored = await brw.storage.local.get({ archiveEngines: ['Wayback Machine'] });
    const selected = ARCHIVE_ENGINES.filter((engine) => stored.archiveEngines.includes(engine.name));
    if (!selected.length) {
      flashButton(btn, 'Select an engine', true);
      return;
    }
    if (!url || !url.startsWith('http')) {
      flashButton(btn, 'Need a URL', true);
      return;
    }
    selected.forEach((engine) => brw.tabs.create({ url: engine.url(url), active: false }));
    flashButton(btn, 'Opened archives');
  }

  goBtn.addEventListener('click', () => search(input.value.trim(), goBtn));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') search(input.value.trim(), goBtn);
  });

  panel.append(engines, row);
}

export function renderWebTools(wrap, { tool, onToolChange }) {
  wrap.dataset.osintReady = '';
  if (tool === 'domain') paintDomain(wrap, bindToolBack(onToolChange, 'web:domain'));
  else if (tool === 'ip') paintIp(wrap, bindToolBack(onToolChange, 'web:ip'));
  else if (tool === 'subdomains') paintSubdomains(wrap, bindToolBack(onToolChange, 'web:subdomains'));
  else if (tool === 'tracer') paintOpsecTool(wrap, 'Short Link Tracer', 'opt-tool-link-tracer', onToolChange, [API_SOURCES.targetHttp]);
  else if (tool === 'virustotal') paintOpsecTool(wrap, 'VirusTotal Lookup', 'opt-tool-virustotal', onToolChange, [API_SOURCES.virusTotalGui]);
  else if (tool === 'ssl') paintOpsecTool(wrap, 'SSL Certificate Inspector', 'opt-tool-ssl-checker', onToolChange, [API_SOURCES.networkcalc, API_SOURCES.certspotter]);
  else if (tool === 'headers') paintOpsecTool(wrap, 'Security Headers Analyzer', 'opt-tool-header-analyzer', onToolChange, [API_SOURCES.targetHttp]);
  else if (tool === 'doh') paintOpsecTool(wrap, 'DoH Leak Checker', 'opt-tool-doh-checker', onToolChange, [API_SOURCES.dohResolvers]);
  else if (tool === 'archives') paintArchives(wrap, onToolChange);
  else paintCards(wrap, onToolChange);
}
