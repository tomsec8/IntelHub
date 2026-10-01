import { brw, getCurrentTab, isFirefox, flashButton, createSection, saveViewState, resetViewState, insertToolResult } from './utils.js';
import { withPageAccess } from './opsecHub/js/optional-permissions.mjs';

let lastFingerprintData = null;
let resultOpen = false;

function sameAnalyzedSite(data, tabUrl) {
    if (!data || !tabUrl) return false;
    try {
        const host = new URL(tabUrl).hostname;
        return data.hostname === host || data.url === tabUrl || data.finalUrl === tabUrl;
    } catch {
        return false;
    }
}

const archiveEngines = [
    { name: "Wayback Machine", url: url => `https://web.archive.org/web/${encodeURIComponent(url)}` },
    { name: "WebCite", url: url => `http://www.webcitation.org/query?url=${encodeURIComponent(url)}` },
    { name: "Archive.today", url: url => `https://archive.today/?run=1&url=${encodeURIComponent(url)}` },
    { name: "Megalodon.jp", url: url => `https://megalodon.jp/?url=${encodeURIComponent(url)}` },
    { name: "Ghostarchive", url: url => `https://ghostarchive.org/search?term=${encodeURIComponent(url)}` }
];

function getRootDomain(hostname) {
    try {
        if (typeof psl !== 'undefined') {
            const parsed = psl.parse(hostname);
            return parsed.domain || hostname;
        }
        return hostname;
    } catch {
        return hostname;
    }
}

// Extracted internal core logic for non-UI usages (e.g., Copilot)
export async function analyzeDomainAPI(domain) {
    if (!domain) return { success: false, reason: "No domain provided." };

    domain = domain.replace(/^https?:\/\//, '').split('/')[0];
    domain = getRootDomain(domain);

    const result = {
        success: true,
        targetDomain: domain,
        ipAddresses: [],
        ipv6: [],
        mx: [],
        ns: [],
        txt: [],
        dnsRecords: [],
        externalAnalysisLinks: {
            whois: `https://www.whois.com/whois/${domain}`,
            techStack: `https://w3techs.com/sites/info/${domain}`,
            certificates: `https://crt.sh/?q=${encodeURIComponent(domain)}`
        }
    };

    async function records(type) {
        const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.Answer || []).map((row) => row.data).filter(Boolean);
    }

    try {
        const [a, aaaa, mx, ns, txt, rdap] = await Promise.all([
            records('A'),
            records('AAAA'),
            records('MX'),
            records('NS'),
            records('TXT'),
            fetchRdap(domain).catch(() => null)
        ]);
        result.ipAddresses = a;
        result.ipv6 = aaaa;
        result.mx = mx;
        result.ns = ns;
        result.txt = txt;
        result.rdap = rdap;
        result.dnsRecords = [
            ...a.map((data) => ({ type: 'A', data })),
            ...aaaa.map((data) => ({ type: 'AAAA', data })),
            ...mx.map((data) => ({ type: 'MX', data })),
            ...ns.map((data) => ({ type: 'NS', data })),
            ...txt.map((data) => ({ type: 'TXT', data }))
        ];
    } catch (e) {
        result.dnsError = e.message;
    }

    return result;
}

function showLoadingSpinner(message = "Saving page...") {
    let spinner = document.createElement("div");
    spinner.id = "loading-spinner";
    spinner.textContent = message;
    spinner.style.position = "fixed";
    spinner.style.top = "50%";
    spinner.style.left = "50%";
    spinner.style.transform = "translate(-50%, -50%)";
    spinner.style.background = "#111";
    spinner.style.color = "#fff";
    spinner.style.padding = "12px 20px";
    spinner.style.borderRadius = "8px";
    spinner.style.zIndex = "9999";
    spinner.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    document.body.appendChild(spinner);
}

function hideLoadingSpinner() {
    const spinner = document.getElementById("loading-spinner");
    if (spinner) spinner.remove();
}

const HEADER_KEYS = [
    'server', 'x-powered-by', 'via', 'cf-ray', 'x-cache', 'x-served-by',
    'content-type', 'strict-transport-security', 'x-frame-options',
    'x-content-type-options', 'referrer-policy', 'content-security-policy',
    'permissions-policy', 'x-vercel-id', 'x-nf-request-id', 'x-shopify-stage'
];

function collectWebsiteIdentity() {
    const abs = (href) => {
        try { return href ? new URL(href, location.href).href : ''; } catch { return ''; }
    };
    const hostOf = (href) => {
        try { return new URL(href, location.href).hostname; } catch { return ''; }
    };
    const meta = (sel) => document.querySelector(sel)?.getAttribute('content') || '';
    const tech = [];
    const mark = (name, yes) => { if (yes && name && !tech.includes(name)) tech.push(name); };

    const icon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
    const scripts = [...document.scripts].map((s) => s.src).filter(Boolean);
    const scriptHosts = [...new Set(scripts.map(hostOf).filter(Boolean))].sort();
    const pageHost = location.hostname;
    const thirdParty = scriptHosts.filter((h) => h !== pageHost && !h.endsWith(`.${pageHost}`));
    const cookieNames = document.cookie
        ? [...new Set(document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter(Boolean))].sort()
        : [];

    const paths = new Set();
    const addPath = (href) => {
        try {
            const url = new URL(href, location.href);
            if (url.hostname !== location.hostname) return;
            const path = (url.pathname || '/').replace(/\/+$/, '') || '/';
            if (path.length <= 180) paths.add(path);
        } catch { /* ignore bad hrefs */ }
    };
    addPath(location.href);
    document.querySelectorAll('a[href], form[action], link[href], script[src], img[src], source[src]').forEach((node) => {
        addPath(node.getAttribute('href') || node.getAttribute('action') || node.getAttribute('src'));
    });

    const html = document.documentElement.innerHTML.slice(0, 180000).toLowerCase();
    const scriptBlob = scripts.join(' ').toLowerCase();

    mark('WordPress', html.includes('wp-content') || html.includes('wp-includes') || html.includes('wp-json'));
    mark('Next.js', Boolean(window.__NEXT_DATA__) || html.includes('/_next/'));
    mark('Nuxt', Boolean(window.__NUXT__) || html.includes('/_nuxt/'));
    mark('Gatsby', Boolean(document.getElementById('___gatsby')));
    mark('Shopify', Boolean(window.Shopify) || html.includes('cdn.shopify.com'));
    mark('Drupal', html.includes('drupal.settings') || html.includes('/sites/default/files')
        || cookieNames.some((n) => /^SESS[a-f0-9]{20,}$/i.test(n)));
    mark('Joomla', html.includes('/media/jui/') || html.includes('option=com_'));
    mark('Wix', html.includes('static.wixstatic.com'));
    mark('Squarespace', html.includes('squarespace.com') || html.includes('static.squarespace'));
    mark('Webflow', html.includes('webflow'));
    mark('Magento', html.includes('mage/') || html.includes('magento'));
    mark('PrestaShop', html.includes('prestashop') || html.includes('/modules/ps_'));
    mark('Ghost', html.includes('ghost.org') || Boolean(document.querySelector('[data-ghost]')));
    mark('React', Boolean(document.querySelector('[data-reactroot], [data-reactid]')));
    mark('Vue', Boolean(window.__VUE__) || Boolean(document.querySelector('[data-v-app]')));
    mark('Angular', Boolean(document.querySelector('[ng-version]')));
    mark('jQuery', Boolean(window.jQuery) || scriptBlob.includes('jquery'));
    mark('Bootstrap', html.includes('bootstrap.min') || html.includes('bootstrap.bundle'));
    mark('PHP', cookieNames.includes('PHPSESSID'));
    mark('Laravel', cookieNames.includes('laravel_session'));
    mark('Django', cookieNames.includes('csrftoken') && Boolean(document.querySelector('[name="csrfmiddlewaretoken"]')));
    mark('Express', cookieNames.includes('connect.sid'));
    mark('ASP.NET', cookieNames.some((n) => /asp\.net|ASPSESSION/i.test(n)));
    mark('Java', cookieNames.includes('JSESSIONID'));
    mark('Cloudflare', cookieNames.some((n) => n.startsWith('__cf') || n === 'cf_clearance')
        || html.includes('cloudflareinsights') || html.includes('challenges.cloudflare.com'));
    mark('Google Tag Manager', html.includes('googletagmanager.com'));
    mark('Google Analytics', html.includes('google-analytics.com') || html.includes('gtag/js')
        || cookieNames.includes('_ga') || cookieNames.includes('_gid'));
    mark('Meta Pixel', html.includes('connect.facebook.net') || html.includes('fbevents.js') || cookieNames.includes('_fbp'));
    mark('Hotjar', html.includes('static.hotjar.com') || cookieNames.some((n) => n.startsWith('_hj')));
    mark('HubSpot', html.includes('js.hs-scripts.com') || html.includes('hs-analytics')
        || cookieNames.some((n) => n.startsWith('__hs') || n.startsWith('hubspot')));
    mark('Intercom', html.includes('widget.intercom.io') || Boolean(window.Intercom));
    mark('Segment', html.includes('cdn.segment.com'));
    mark('Stripe', html.includes('js.stripe.com'));
    mark('PayPal', html.includes('paypal.com/sdk') || html.includes('paypalobjects.com'));
    mark('reCAPTCHA', html.includes('recaptcha'));
    mark('Turnstile', html.includes('challenges.cloudflare.com') || html.includes('cf-turnstile'));
    mark('hCaptcha', html.includes('hcaptcha.com'));
    mark('Sentry', html.includes('sentry-cdn.com') || html.includes('sentry.io') || Boolean(window.Sentry));
    mark('Google Fonts', html.includes('fonts.googleapis.com') || html.includes('fonts.gstatic.com'));
    mark('Font Awesome', html.includes('font-awesome') || html.includes('fontawesome'));
    mark('Cloudflare Insights', html.includes('static.cloudflareinsights.com'));

    cookieNames.forEach((name) => {
        if (name.startsWith('wordpress_') || name.startsWith('wp-settings')) mark('WordPress', true);
        if (name.startsWith('_shopify')) mark('Shopify', true);
    });

    const hostHints = [
        ['googletagmanager.com', 'Google Tag Manager'],
        ['google-analytics.com', 'Google Analytics'],
        ['connect.facebook.net', 'Meta Pixel'],
        ['static.hotjar.com', 'Hotjar'],
        ['cdn.shopify.com', 'Shopify'],
        ['js.stripe.com', 'Stripe'],
        ['recaptcha.net', 'reCAPTCHA'],
        ['challenges.cloudflare.com', 'Turnstile'],
        ['hcaptcha.com', 'hCaptcha'],
        ['browser.sentry-cdn.com', 'Sentry'],
        ['js.hs-scripts.com', 'HubSpot'],
        ['js.hs-analytics.net', 'HubSpot'],
        ['widget.intercom.io', 'Intercom'],
        ['cdn.segment.com', 'Segment'],
        ['static.cloudflareinsights.com', 'Cloudflare Insights']
    ];
    scriptHosts.forEach((host) => {
        hostHints.forEach(([needle, name]) => {
            if (host === needle || host.endsWith(`.${needle}`)) mark(name, true);
        });
    });

    const emails = new Set();
    document.querySelectorAll('a[href^="mailto:"]').forEach((node) => {
        const addr = (node.getAttribute('href') || '').replace(/^mailto:/i, '').split('?')[0].trim();
        if (addr.includes('@') && addr.length < 80) emails.add(addr);
    });

    const socialHosts = {
        'facebook.com': 'Facebook', 'fb.com': 'Facebook', 'instagram.com': 'Instagram',
        'twitter.com': 'X', 'x.com': 'X', 'linkedin.com': 'LinkedIn',
        'youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'tiktok.com': 'TikTok',
        't.me': 'Telegram', 'telegram.me': 'Telegram', 'github.com': 'GitHub',
        'reddit.com': 'Reddit', 'medium.com': 'Medium', 'pinterest.com': 'Pinterest',
        'threads.net': 'Threads', 'bsky.app': 'Bluesky'
    };
    const socials = [];
    const seenSocial = new Set();
    document.querySelectorAll('a[href]').forEach((node) => {
        if (socials.length >= 15) return;
        const href = abs(node.getAttribute('href'));
        const host = hostOf(href).replace(/^www\./, '');
        const label = Object.entries(socialHosts).find(([key]) => host === key || host.endsWith(`.${key}`))?.[1];
        if (!label || !href || seenSocial.has(href)) return;
        seenSocial.add(href);
        socials.push({ label, href });
    });

    const jsonLd = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((node) => {
        try {
            const data = JSON.parse(node.textContent || 'null');
            (Array.isArray(data) ? data : [data]).forEach((item) => {
                if (!item) return;
                const types = item['@type'];
                (Array.isArray(types) ? types : [types]).forEach((type) => {
                    if (type && jsonLd.length < 12 && !jsonLd.includes(type)) jsonLd.push(String(type));
                });
                if (item.email && String(item.email).includes('@')) {
                    emails.add(String(item.email).replace(/^mailto:/i, ''));
                }
            });
        } catch { /* ignore broken JSON-LD */ }
    });

    return {
        url: location.href,
        hostname: pageHost,
        title: document.title || '',
        canonical: abs(document.querySelector('link[rel="canonical"]')?.getAttribute('href') || ''),
        lang: document.documentElement.lang || '',
        generator: meta('meta[name="generator"]'),
        siteName: meta('meta[property="og:site_name"]'),
        description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
        robots: meta('meta[name="robots"]'),
        favicon: abs(icon?.getAttribute('href') || '') || abs('/favicon.ico'),
        cookieNames,
        paths: [...paths].sort().slice(0, 80),
        scriptHosts,
        thirdParty,
        tech,
        emails: [...emails].slice(0, 15),
        socials,
        jsonLd
    };
}

async function sha256Hex(data) {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchOk(url, timeout = 7000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
        const res = await fetch(url, { cache: 'no-store', redirect: 'follow', signal: ctrl.signal });
        return res.ok ? res : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

function tidyDns(value) {
    return String(value || '').replace(/^"|"$/g, '').replace(/\.$/, '').trim();
}

async function queryDns(name, type) {
    if (!name) return [];
    const res = await fetchOk(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`);
    if (!res) return [];
    const json = await res.json().catch(() => ({}));
    return (json.Answer || []).map((row) => tidyDns(row.data)).filter(Boolean);
}

function parseRobots(text) {
    const disallow = [];
    const allow = [];
    const sitemaps = [];
    String(text || '').split(/\r?\n/).forEach((line) => {
        const clean = line.replace(/#.*$/, '').trim();
        if (!clean) return;
        const [key, ...rest] = clean.split(':');
        const value = rest.join(':').trim();
        if (!value) return;
        const name = key.toLowerCase();
        if (name === 'disallow') disallow.push(value);
        else if (name === 'allow') allow.push(value);
        else if (name === 'sitemap') sitemaps.push(value);
    });
    return {
        disallow: [...new Set(disallow)].slice(0, 40),
        allow: [...new Set(allow)].slice(0, 20),
        sitemaps: [...new Set(sitemaps)].slice(0, 8)
    };
}

function sitemapLocs(xml) {
    const locs = [];
    const re = /<loc>\s*([^<]+)\s*<\/loc>/gi;
    let match;
    while ((match = re.exec(xml)) && locs.length < 40) {
        const value = match[1].trim();
        if (value) locs.push(value);
    }
    return locs;
}

function addTech(list, name) {
    if (name && !list.includes(name)) list.push(name);
}

function inferHeaderTech(headers, tech) {
    const hay = `${headers.server || ''} ${headers.via || ''}`.toLowerCase();
    const map = [
        ['cloudflare', 'Cloudflare'], ['nginx', 'nginx'], ['apache', 'Apache'],
        ['microsoft-iis', 'IIS'], ['litespeed', 'LiteSpeed'], ['openresty', 'OpenResty'],
        ['caddy', 'Caddy'], ['vercel', 'Vercel'], ['netlify', 'Netlify'],
        ['cloudfront', 'CloudFront'], ['sucuri', 'Sucuri'], ['akamai', 'Akamai'],
        ['fastly', 'Fastly'], ['varnish', 'Varnish'], ['gws', 'Google Frontend']
    ];
    map.forEach(([needle, name]) => { if (hay.includes(needle)) addTech(tech, name); });
    if (headers['x-powered-by']) addTech(tech, headers['x-powered-by'].split(/[/\s]/)[0]);
    if (headers['cf-ray']) addTech(tech, 'Cloudflare');
    if (headers['x-vercel-id']) addTech(tech, 'Vercel');
    if (headers['x-nf-request-id']) addTech(tech, 'Netlify');
    if (headers['x-shopify-stage']) addTech(tech, 'Shopify');
}

function inferCnameTech(targets, tech) {
    (targets || []).forEach((target) => {
        const value = target.toLowerCase();
        if (value.includes('shopify')) addTech(tech, 'Shopify');
        if (value.includes('github.io')) addTech(tech, 'GitHub Pages');
        if (value.includes('vercel')) addTech(tech, 'Vercel');
        if (value.includes('netlify')) addTech(tech, 'Netlify');
        if (value.includes('cloudfront')) addTech(tech, 'CloudFront');
        if (value.includes('fastly')) addTech(tech, 'Fastly');
        if (value.includes('akamai')) addTech(tech, 'Akamai');
        if (value.includes('wordpress.com')) addTech(tech, 'WordPress.com');
        if (value.includes('webflow')) addTech(tech, 'Webflow');
        if (value.includes('hubspot')) addTech(tech, 'HubSpot');
        if (value.includes('squarespace')) addTech(tech, 'Squarespace');
    });
}

function vcardFields(entity) {
    const fields = { name: '', email: '', org: '', handle: entity?.handle || '', roles: entity?.roles || [] };
    (entity?.vcardArray?.[1] || []).forEach((row) => {
        if (!Array.isArray(row)) return;
        const key = row[0];
        const value = Array.isArray(row[3]) ? row[3][0] : row[3];
        if (!value) return;
        if (key === 'fn') fields.name = value;
        if (key === 'email') fields.email = value;
        if (key === 'org') fields.org = value;
    });
    return fields;
}

async function loadRdapJson(kind, query) {
    try {
        const reply = await brw.runtime.sendMessage({ action: 'rdapLookup', kind, query });
        if (reply?.success && reply.json) return { json: reply.json, url: reply.url || '' };
    } catch {
        /* background unavailable */
    }
    return null;
}

export async function fetchRdap(domain) {
    const hit = await loadRdapJson('domain', domain);
    if (!hit) return null;
    const json = hit.json;
    const events = {};
    (json.events || []).forEach((event) => {
        const action = String(event.eventAction || '').toLowerCase().replace(/\s+/g, '');
        if (action) events[action] = event.eventDate || '';
    });
    const registrarEnt = (json.entities || []).find((entity) => (entity.roles || []).includes('registrar'));
    const registrar = vcardFields(registrarEnt);
    return {
        registrar: registrar.name || registrar.handle || '',
        created: events.registration || events.created || '',
        updated: events.lastchanged || events.lastupdate || '',
        expires: events.expiration || '',
        status: (json.status || []).slice(0, 6),
        nameservers: (json.nameservers || []).map((ns) => ns.ldhName || ns.ldhname).filter(Boolean).slice(0, 8)
    };
}

function rdapCidrs(json) {
    const cidrs = (json.cidr0_cidrs || []).map((row) => {
        if (row.v4prefix) return `${row.v4prefix}/${row.length}`;
        if (row.v6prefix) return `${row.v6prefix}/${row.length}`;
        return '';
    }).filter(Boolean);
    if (cidrs.length) return cidrs;
    if (json.startAddress && json.endAddress) return [`${json.startAddress} – ${json.endAddress}`];
    return json.handle ? [json.handle] : [];
}

function rdapRir(json, sourceUrl) {
    const hay = `${sourceUrl || ''} ${json.port43 || ''}`.toLowerCase();
    if (hay.includes('arin')) return 'ARIN';
    if (hay.includes('ripe')) return 'RIPE';
    if (hay.includes('apnic')) return 'APNIC';
    if (hay.includes('lacnic')) return 'LACNIC';
    if (hay.includes('afrinic')) return 'AFRINIC';
    return '';
}

export async function fetchIpRdap(ip) {
    const query = String(ip || '').trim();
    if (!query) return null;
    const hit = await loadRdapJson('ip', query);
    if (!hit) return null;
    const json = hit.json;
    const entities = [];
    const walk = (list) => {
        (list || []).forEach((entity) => {
            entities.push(vcardFields(entity));
            if (entity.entities) walk(entity.entities);
        });
    };
    walk(json.entities);
    const abuse = entities.find((entity) => entity.roles.includes('abuse'));
    const registrant = entities.find((entity) => entity.roles.includes('registrant'))
        || entities.find((entity) => entity.org || entity.name);
    return {
        handle: json.handle || '',
        name: json.name || '',
        type: json.type || '',
        country: json.country || '',
        cidrs: rdapCidrs(json),
        range: json.startAddress && json.endAddress ? `${json.startAddress} – ${json.endAddress}` : '',
        status: (json.status || []).slice(0, 6),
        rir: rdapRir(json, hit.url),
        org: registrant?.org || registrant?.name || '',
        abuse: abuse?.email || '',
        abuseName: abuse?.name || ''
    };
}

async function fetchCert(domain) {
    const res = await fetchOk(`https://networkcalc.com/api/security/certificate/${encodeURIComponent(domain)}`);
    if (!res) return null;
    const json = await res.json().catch(() => null);
    const cert = json?.certificate;
    if (!cert) return null;
    const issuer = cert.issuer?.organization || cert.issuer?.common_name || '';
    const validFrom = cert.valid_from
        ? new Date(typeof cert.valid_from === 'number' ? cert.valid_from * 1000 : cert.valid_from)
        : null;
    const validTo = cert.valid_to
        ? new Date(typeof cert.valid_to === 'number' ? cert.valid_to * 1000 : cert.valid_to)
        : null;
    return {
        issuer,
        protocol: cert.protocol || '',
        validFrom: validFrom && !Number.isNaN(validFrom.getTime()) ? validFrom.toISOString().slice(0, 10) : '',
        validTo: validTo && !Number.isNaN(validTo.getTime()) ? validTo.toISOString().slice(0, 10) : ''
    };
}

function normalizeHost(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/^\*\./, '')
        .replace(/\.$/, '');
}

function isHostUnderDomain(name, domain) {
    const host = normalizeHost(name);
    if (!host || host.includes(' ') || host.includes('*') || !host.includes('.')) return false;
    return host === domain || host.endsWith(`.${domain}`);
}

function addHostNames(target, value, domain) {
    String(value || '')
        .split(/[\n,]+/)
        .forEach((part) => {
            const host = normalizeHost(part);
            if (isHostUnderDomain(host, domain)) target.add(host);
        });
}

function addHostFromUrl(target, value, domain) {
    const raw = String(value || '').trim();
    if (!raw) return;
    try {
        const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
        addHostNames(target, url.hostname, domain);
    } catch {
        addHostNames(target, raw, domain);
    }
}

async function fetchJson(url, timeout = 12000) {
    const res = await fetchOk(url, timeout);
    if (!res) return null;
    return res.json().catch(() => null);
}

async function fetchText(url, timeout = 12000) {
    const res = await fetchOk(url, timeout);
    if (!res) return '';
    return res.text().catch(() => '');
}

async function collectCtNames(domain) {
    const names = new Set();
    const urls = [
        `https://api.certspotter.com/v0/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true&expand=dns_names`,
        `https://api.certspotter.com/v0/certs?domain=${encodeURIComponent(domain)}&duplicate_filtering=true`
    ];
    for (const url of urls) {
        const json = await fetchJson(url, 12000);
        if (!Array.isArray(json) || !json.length) continue;
        json.forEach((row) => {
            (row.dns_names || []).forEach((name) => addHostNames(names, name, domain));
        });
        if (names.size) break;
    }
    return names;
}

async function fetchCtNames(domain) {
    return [...(await collectCtNames(domain))].sort().slice(0, 30);
}

async function fetchCrtShNames(domain) {
    const names = new Set();
    const queries = [domain, `%.${domain}`];
    await Promise.all(queries.map(async (query) => {
        const json = await fetchJson(`https://crt.sh/?q=${encodeURIComponent(query)}&output=json`, 18000);
        if (!Array.isArray(json)) return;
        json.forEach((row) => {
            addHostNames(names, row.name_value, domain);
            addHostNames(names, row.common_name, domain);
        });
    }));
    return names;
}

async function fetchWaybackNames(domain) {
    const names = new Set();
    const json = await fetchJson(
        `https://web.archive.org/cdx/search/cdx?url=*.${encodeURIComponent(domain)}/*&output=json&fl=original&collapse=urlkey&limit=2000`,
        16000
    );
    if (!Array.isArray(json)) return names;
    json.forEach((row, index) => {
        if (index === 0) return;
        const value = Array.isArray(row) ? row[0] : row;
        addHostFromUrl(names, value, domain);
    });
    return names;
}

async function fetchOtxNames(domain) {
    const names = new Set();
    const json = await fetchJson(
        `https://otx.alienvault.com/api/v1/indicators/domain/${encodeURIComponent(domain)}/passive_dns`,
        14000
    );
    const rows = json?.passive_dns;
    if (!Array.isArray(rows)) return names;
    rows.forEach((row) => addHostNames(names, row.hostname || row.address, domain));
    return names;
}

async function fetchAnubisNames(domain) {
    const names = new Set();
    const json = await fetchJson(`https://jldc.me/anubis/subdomains/${encodeURIComponent(domain)}`, 14000);
    if (!Array.isArray(json)) return names;
    json.forEach((name) => addHostNames(names, name, domain));
    return names;
}

async function fetchUrlscanNames(domain) {
    const names = new Set();
    const json = await fetchJson(
        `https://urlscan.io/api/v1/search/?q=domain:${encodeURIComponent(domain)}&size=100`,
        14000
    );
    const rows = json?.results;
    if (!Array.isArray(rows)) return names;
    rows.forEach((row) => {
        addHostNames(names, row.page?.domain, domain);
        addHostNames(names, row.page?.apexDomain, domain);
        addHostFromUrl(names, row.page?.url || row.task?.url, domain);
    });
    return names;
}

async function fetchHackerTargetHosts(domain) {
    const names = new Set();
    const ipsByHost = new Map();
    const text = await fetchText(`https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(domain)}`, 12000);
    if (!text || /error|limit|invalid/i.test(text.split('\n', 1)[0] || '')) return { names, ipsByHost };
    text.split(/\r?\n/).forEach((line) => {
        const [host, ip] = line.split(',').map((part) => part.trim());
        if (!host || !isHostUnderDomain(host, domain)) return;
        const clean = normalizeHost(host);
        names.add(clean);
        if (ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
            const current = ipsByHost.get(clean) || [];
            if (!current.includes(ip)) ipsByHost.set(clean, [...current, ip]);
        }
    });
    return { names, ipsByHost };
}

async function collectDnsRecordNames(domain) {
    const names = new Set();
    const [mx, ns, cname, txt] = await Promise.all([
        queryDns(domain, 'MX'),
        queryDns(domain, 'NS'),
        queryDns(domain, 'CNAME'),
        queryDns(domain, 'TXT')
    ]);
    [...mx, ...ns, ...cname].forEach((value) => {
        addHostNames(names, String(value).replace(/^\d+\s+/, ''), domain);
    });
    txt.forEach((row) => {
        const re = /\b(?:include|a|mx|ptr):([^\s]+)/gi;
        let match;
        while ((match = re.exec(String(row)))) addHostNames(names, match[1], domain);
    });
    return names;
}

async function mapPool(items, limit, worker) {
    const results = new Array(items.length);
    let index = 0;
    async function run() {
        while (index < items.length) {
            const current = index++;
            results[current] = await worker(items[current], current);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return results;
}

export async function findSubdomains(rawDomain, { resolveLimit = 80 } = {}) {
    const cleaned = String(rawDomain || '').replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
    const domain = getRootDomain(cleaned);
    if (!domain || !domain.includes('.')) {
        return { success: false, reason: 'Enter a valid domain.', domain: '', hosts: [] };
    }

    const byHost = new Map();
    const remember = (host, source, ips = []) => {
        if (!isHostUnderDomain(host, domain)) return;
        const key = normalizeHost(host);
        if (!byHost.has(key)) byHost.set(key, { host: key, sources: new Set(), ips: [] });
        const row = byHost.get(key);
        if (source) row.sources.add(source);
        ips.forEach((ip) => {
            if (ip && !row.ips.includes(ip)) row.ips.push(ip);
        });
    };

    const [
        certspotter,
        crtsh,
        wayback,
        otx,
        anubis,
        urlscan,
        hackerTarget,
        dnsNames
    ] = await Promise.all([
        collectCtNames(domain),
        fetchCrtShNames(domain),
        fetchWaybackNames(domain),
        fetchOtxNames(domain),
        fetchAnubisNames(domain),
        fetchUrlscanNames(domain),
        fetchHackerTargetHosts(domain),
        collectDnsRecordNames(domain)
    ]);

    remember(domain, 'dns');
    certspotter.forEach((name) => remember(name, 'ct'));
    crtsh.forEach((name) => remember(name, 'ct'));
    wayback.forEach((name) => remember(name, 'archive'));
    otx.forEach((name) => remember(name, 'otx'));
    anubis.forEach((name) => remember(name, 'otx'));
    urlscan.forEach((name) => remember(name, 'scan'));
    dnsNames.forEach((name) => remember(name, 'dns'));
    hackerTarget.names.forEach((name) => remember(name, 'otx', hackerTarget.ipsByHost.get(name) || []));

    const unresolved = [...byHost.values()].filter((row) => !row.ips.length).map((row) => row.host);
    await mapPool(unresolved.slice(0, resolveLimit), 6, async (host) => {
        const ips = [...await queryDns(host, 'A'), ...await queryDns(host, 'AAAA')];
        if (ips.length) remember(host, 'dns', [...new Set(ips)]);
    });

    const hosts = [...byHost.values()]
        .map((row) => ({
            host: row.host,
            ips: row.ips,
            live: row.ips.length > 0,
            source: [...row.sources][0] || 'ct'
        }))
        .sort((a, b) => a.host.localeCompare(b.host));

    return {
        success: true,
        domain,
        hosts: hosts.slice(0, 400),
        truncated: hosts.length > 400,
        liveCount: hosts.filter((row) => row.live).length,
        ctCount: hosts.length
    };
}

async function enrichWebsiteFingerprint(page, tabUrl) {
    const hostname = page.hostname || '';
    const root = getRootDomain(hostname);
    let origin = '';
    try { origin = new URL(tabUrl).origin; } catch { /* ignore */ }

    const headers = {};
    let status = '';
    let finalUrl = tabUrl;
    const tech = [...(page.tech || [])];
    const dns = { A: [], AAAA: [], CNAME: [], MX: [], NS: [], TXT: [], CAA: [] };
    let dmarc = [];
    let robots = { disallow: [], allow: [], sitemaps: [] };
    let sitemapPaths = [];
    let securityContacts = [];
    let faviconHash = '';

    const headerTask = (async () => {
        try {
            const res = await fetch(tabUrl, { method: 'GET', redirect: 'follow', cache: 'no-store' });
            status = String(res.status);
            finalUrl = res.url || tabUrl;
            res.headers.forEach((value, key) => {
                if (HEADER_KEYS.includes(key.toLowerCase())) headers[key.toLowerCase()] = value.slice(0, 220);
            });
        } catch {
            status = '';
        }
    })();

    const dnsTask = Promise.all([
        ...Object.keys(dns).map(async (type) => {
            const name = (type === 'A' || type === 'AAAA' || type === 'CNAME') ? hostname : root;
            dns[type] = await queryDns(name, type);
        }),
        queryDns(`_dmarc.${root}`, 'TXT').then((rows) => { dmarc = rows; })
    ]);

    const originTask = (async () => {
        if (!origin) return;
        const robotsRes = await fetchOk(`${origin}/robots.txt`);
        if (robotsRes) robots = parseRobots(await robotsRes.text());
        const sitemapUrl = robots.sitemaps[0] || `${origin}/sitemap.xml`;
        const sitemapRes = await fetchOk(sitemapUrl);
        if (sitemapRes) {
            let locs = sitemapLocs(await sitemapRes.text());
            if (locs[0] && /sitemap/i.test(locs[0]) && locs[0] !== sitemapUrl) {
                const nested = await fetchOk(locs[0]);
                if (nested) locs = sitemapLocs(await nested.text());
            }
            const pageHost = hostname || new URL(origin).hostname;
            sitemapPaths = locs.map((href) => {
                try {
                    const url = new URL(href, origin);
                    if (url.hostname !== pageHost) return '';
                    return (url.pathname || '/').replace(/\/+$/, '') || '/';
                } catch { return ''; }
            }).filter(Boolean);
        }
        const secRes = await fetchOk(`${origin}/.well-known/security.txt`);
        if (secRes) {
            securityContacts = (await secRes.text()).split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => /^contact:/i.test(line))
                .map((line) => line.replace(/^contact:\s*/i, ''))
                .slice(0, 6);
        }
    })();

    const iconTask = (async () => {
        if (!page.favicon) return;
        const iconRes = await fetchOk(page.favicon);
        if (iconRes) faviconHash = (await sha256Hex(await iconRes.arrayBuffer())).slice(0, 16);
    })();

    const [, , , rdap, cert, ctNames] = await Promise.all([
        headerTask,
        dnsTask,
        originTask,
        fetchRdap(root),
        fetchCert(hostname || root),
        fetchCtNames(root),
        iconTask
    ]);

    inferHeaderTech(headers, tech);
    inferCnameTech(dns.CNAME, tech);
    if (page.generator) {
        const hint = page.generator.split(/[\s/]/)[0];
        if (hint && hint.length > 2) addTech(tech, hint);
    }
    tech.sort((a, b) => a.localeCompare(b));

    const paths = [...new Set([
        ...(page.paths || []),
        ...robots.disallow,
        ...robots.allow,
        ...sitemapPaths
    ])].filter((path) => path && path.length <= 180).sort().slice(0, 80);

    const printSource = [
        hostname,
        page.generator,
        page.siteName,
        tech.join(','),
        (page.scriptHosts || []).join(','),
        (page.cookieNames || []).join(','),
        headers.server || '',
        headers['x-powered-by'] || '',
        faviconHash
    ].join('|');

    return {
        sitePrint: (await sha256Hex(printSource)).slice(0, 16),
        url: page.url,
        finalUrl,
        hostname,
        root,
        title: page.title,
        canonical: page.canonical,
        lang: page.lang,
        generator: page.generator,
        siteName: page.siteName,
        description: page.description || '',
        robotsMeta: page.robots || '',
        tech,
        ips: [...dns.A, ...dns.AAAA],
        dns,
        spf: (dns.TXT || []).filter((row) => /v=spf1/i.test(row)),
        dmarc,
        rdap,
        cert,
        ctNames: ctNames || [],
        emails: page.emails || [],
        socials: page.socials || [],
        jsonLd: page.jsonLd || [],
        paths,
        robots,
        securityContacts,
        status,
        server: headers.server || '',
        poweredBy: headers['x-powered-by'] || '',
        headers,
        cookieNames: page.cookieNames,
        thirdParty: page.thirdParty,
        favicon: page.favicon,
        faviconHash
    };
}

function reportLines(result) {
    const lines = [
        `Site print: ${result.sitePrint || ''}`,
        `URL: ${result.url || ''}`,
        `Host: ${result.hostname || ''}`,
        `Title: ${result.title || ''}`,
        `Generator: ${result.generator || ''}`,
        `Tech: ${(result.tech || []).join(', ')}`,
        `IPs: ${(result.ips || []).join(', ')}`,
        `CNAME: ${(result.dns?.CNAME || []).join(', ')}`,
        `MX: ${(result.dns?.MX || []).join(', ')}`,
        `NS: ${(result.dns?.NS || []).join(', ')}`,
        `TXT: ${(result.dns?.TXT || []).join(', ')}`,
        `CAA: ${(result.dns?.CAA || []).join(', ')}`,
        `SPF: ${(result.spf || []).join(', ')}`,
        `DMARC: ${(result.dmarc || []).join(', ')}`,
        `Registrar: ${result.rdap?.registrar || ''}`,
        `Created: ${result.rdap?.created || ''}`,
        `Expires: ${result.rdap?.expires || ''}`,
        `Certificate: ${result.cert?.issuer || ''} ${result.cert?.validTo || ''}`.trim(),
        `CT names: ${(result.ctNames || []).join(', ')}`,
        `Emails: ${(result.emails || []).join(', ')}`,
        `Social: ${(result.socials || []).map((item) => item.href || item).join(', ')}`,
        `JSON-LD: ${(result.jsonLd || []).join(', ')}`,
        `Paths: ${(result.paths || []).join(', ')}`,
        `Security contacts: ${(result.securityContacts || []).join(', ')}`,
        `Status: ${result.status || ''}`,
        `Server: ${result.server || ''}`,
        `Cookies: ${(result.cookieNames || []).join(', ')}`,
        `Third-party: ${(result.thirdParty || []).join(', ')}`,
        `Favicon SHA-256: ${result.faviconHash || ''}`
    ];
    Object.entries(result.headers || {}).forEach(([key, value]) => {
        lines.push(`${key}: ${value}`);
    });
    return lines.join('\n');
}

function addResultRow(table, key, value) {
    if (value == null || value === '') return;
    const row = document.createElement('tr');
    const label = document.createElement('td');
    label.textContent = key;
    const cell = document.createElement('td');
    cell.textContent = value;
    row.append(label, cell);
    table.appendChild(row);
}

function addSection(box, title) {
    const label = document.createElement('div');
    label.className = 'tool-result-section';
    label.textContent = title;
    box.appendChild(label);
    return label;
}

function createCloseButton() {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'tool-result-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => {
        const slot = document.getElementById('page-tool-slot');
        if (!slot) return;
        slot.replaceChildren();
        slot.dispatchEvent(new CustomEvent('page-tool-cleared'));
    });
    return close;
}

function addLink(wrap, href, label) {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = label;
    wrap.appendChild(a);
}

function renderFingerprintBox(result, anchor) {
    const hostBtn = anchor
        || document.querySelector('[data-tool="site-analyze"], [data-tool="website-fingerprint"]')
        || document.getElementById('categoryButtons');
    if (!hostBtn) return;

    const box = document.createElement('div');
    box.id = 'fingerprintResult';
    box.className = 'tool-result';

    const head = document.createElement('div');
    head.className = 'tool-result-head';
    const titleWrap = document.createElement('div');
    const kicker = document.createElement('div');
    kicker.className = 'tool-result-kicker';
    kicker.textContent = 'Site analysis';
    const hash = document.createElement('div');
    hash.className = 'tool-result-hash';
    hash.textContent = result.sitePrint || result.hostname || 'unavailable';
    titleWrap.append(kicker, hash);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'tool-result-copy';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(reportLines(result)).then(() => flashButton(copyBtn, 'Copied!'));
    });
    const headActions = document.createElement('div');
    headActions.className = 'tool-result-actions';
    headActions.append(copyBtn, createCloseButton());
    head.append(titleWrap, headActions);
    box.appendChild(head);

    const meta = document.createElement('p');
    meta.className = 'tool-result-meta';
    meta.textContent = [result.hostname, result.status && `HTTP ${result.status}`, (result.ips || []).join(', ')]
        .filter(Boolean)
        .join(' · ');
    box.appendChild(meta);

    if (result.tech?.length) {
        addSection(box, 'Technology');
        const chips = document.createElement('div');
        chips.className = 'tool-result-chips';
        result.tech.forEach((name) => {
            const chip = document.createElement('span');
            chip.className = 'tool-result-chip';
            chip.textContent = name;
            chips.appendChild(chip);
        });
        box.appendChild(chips);
    }

    if (result.rdap && (result.rdap.registrar || result.rdap.created || result.rdap.expires)) {
        addSection(box, 'Registration');
        const whoisTable = document.createElement('table');
        addResultRow(whoisTable, 'Registrar', result.rdap.registrar);
        addResultRow(whoisTable, 'Created', (result.rdap.created || '').slice(0, 10));
        addResultRow(whoisTable, 'Updated', (result.rdap.updated || '').slice(0, 10));
        addResultRow(whoisTable, 'Expires', (result.rdap.expires || '').slice(0, 10));
        addResultRow(whoisTable, 'Status', (result.rdap.status || []).join(', '));
        box.appendChild(whoisTable);
    }

    if (result.emails?.length || result.socials?.length || result.jsonLd?.length) {
        addSection(box, 'On-page identity');
        const idTable = document.createElement('table');
        addResultRow(idTable, 'Emails', (result.emails || []).join(', '));
        addResultRow(idTable, 'Schema', (result.jsonLd || []).join(', '));
        box.appendChild(idTable);
        if (result.socials?.length) {
            const chips = document.createElement('div');
            chips.className = 'tool-result-chips';
            result.socials.forEach((item) => {
                const chip = document.createElement('a');
                chip.className = 'tool-result-chip';
                chip.href = item.href;
                chip.target = '_blank';
                chip.rel = 'noopener';
                chip.textContent = item.label;
                chips.appendChild(chip);
            });
            box.appendChild(chips);
        }
    }

    addSection(box, 'DNS');
    const dnsTable = document.createElement('table');
    addResultRow(dnsTable, 'A / AAAA', (result.ips || []).join(', '));
    addResultRow(dnsTable, 'CNAME', (result.dns?.CNAME || []).join(', '));
    addResultRow(dnsTable, 'MX', (result.dns?.MX || []).join(', '));
    addResultRow(dnsTable, 'NS', (result.dns?.NS || []).join(', '));
    addResultRow(dnsTable, 'CAA', (result.dns?.CAA || []).join(', '));
    addResultRow(dnsTable, 'SPF', (result.spf || []).join(' '));
    addResultRow(dnsTable, 'DMARC', (result.dmarc || []).join(' '));
    addResultRow(dnsTable, 'TXT', (result.dns?.TXT || []).filter((row) => !/v=spf1/i.test(row)).join(' · '));
    box.appendChild(dnsTable);

    if (result.cert && (result.cert.issuer || result.cert.validTo)) {
        addSection(box, 'Certificate');
        const certTable = document.createElement('table');
        addResultRow(certTable, 'Issuer', result.cert.issuer);
        addResultRow(certTable, 'Valid', [result.cert.validFrom, result.cert.validTo].filter(Boolean).join(' → '));
        addResultRow(certTable, 'Protocol', result.cert.protocol);
        box.appendChild(certTable);
    }

    if (result.ctNames?.length) {
        addSection(box, `Hostnames in CT (${result.ctNames.length})`);
        const list = document.createElement('ul');
        list.className = 'tool-result-paths';
        result.ctNames.forEach((name) => {
            const item = document.createElement('li');
            item.textContent = name;
            list.appendChild(item);
        });
        box.appendChild(list);
    }

    if (result.paths?.length) {
        addSection(box, `Discovered paths (${result.paths.length})`);
        const list = document.createElement('ul');
        list.className = 'tool-result-paths';
        result.paths.forEach((path) => {
            const item = document.createElement('li');
            item.textContent = path;
            list.appendChild(item);
        });
        box.appendChild(list);
    }

    if (result.securityContacts?.length || result.robots?.sitemaps?.length) {
        addSection(box, 'Discovery files');
        const disc = document.createElement('table');
        addResultRow(disc, 'security.txt', (result.securityContacts || []).join(', '));
        addResultRow(disc, 'Sitemaps', (result.robots?.sitemaps || []).join(', '));
        box.appendChild(disc);
    }

    addSection(box, 'Headers');
    const table = document.createElement('table');
    addResultRow(table, 'Title', result.title);
    addResultRow(table, 'Generator', result.generator || result.siteName);
    addResultRow(table, 'Canonical', result.canonical);
    addResultRow(table, 'Robots', result.robotsMeta);
    addResultRow(table, 'Server', result.server);
    addResultRow(table, 'Powered by', result.poweredBy);
    addResultRow(table, 'Cookies', (result.cookieNames || []).join(', '));
    addResultRow(table, 'Third-party scripts', (result.thirdParty || []).join(', '));
    addResultRow(table, 'Favicon hash', result.faviconHash);
    Object.entries(result.headers || {}).forEach(([key, value]) => {
        if (key === 'server' || key === 'x-powered-by') return;
        addResultRow(table, key, value);
    });
    box.appendChild(table);

    const domain = result.root || getRootDomain(result.hostname || '');
    if (domain) {
        const links = document.createElement('div');
        links.className = 'tool-result-links';
        addLink(links, `https://www.whois.com/whois/${domain}`, 'WHOIS');
        addLink(links, `https://rdap.org/domain/${domain}`, 'RDAP');
        addLink(links, `https://dnschecker.org/all-dns-records-of-domain.php?query=${domain}&rtype=ALL&dns=google`, 'Full DNS');
        addLink(links, `https://w3techs.com/sites/info/${domain}`, 'W3Techs');
        addLink(links, `https://crt.sh/?q=${encodeURIComponent(domain)}`, 'Certificates');
        box.appendChild(links);
    }

    const slot = document.getElementById('page-tool-slot');
    if (slot) slot.replaceChildren(box);
    else insertToolResult(hostBtn, box);
}

export function restoreSiteAnalyzerView(container, state) {
    if (state.mainOpen) {
        const siteBtn = container.querySelector('[data-section="site-link-archive"]');
        if (siteBtn) {
            const siteWrapper = siteBtn.nextElementSibling;
            if (siteWrapper) {
                siteWrapper.classList.add("open");
                siteBtn.classList.add("is-open");
            }
        }
    }

    if (state.fingerprintData) lastFingerprintData = state.fingerprintData;
    resultOpen = Boolean(state.resultOpen && lastFingerprintData);
    if (state.mainOpen && resultOpen) {
        renderFingerprintBox(lastFingerprintData);
    }
}

export function initializeSiteAnalyzer(container) {
    function saveSiteAnalyzerState() {
        const isMainOpen = siteWrapper.classList.contains("open");
        saveViewState('siteAnalyzer', {
            mainOpen: isMainOpen,
            fingerprintData: lastFingerprintData,
            resultOpen: resultOpen && Boolean(lastFingerprintData)
        });
        if (!isMainOpen) resetViewState('siteAnalyzer');
    }

    const { wrapper: siteWrapper } = createSection(container, "This page", {
        id: 'site-link-archive',
        subtitle: 'Recon on the tab you are investigating',
        onToggle: (isOpen) => {
            if (!isOpen) {
                if (document.getElementById("fingerprintResult")) resultOpen = true;
                slot.replaceChildren();
            } else if (lastFingerprintData && resultOpen) {
                renderFingerprintBox(lastFingerprintData);
            }
            saveSiteAnalyzerState();
        }
    });

    const hostChip = document.createElement("p");
    hostChip.className = "page-host-chip";
    hostChip.textContent = "No webpage open";

    const actions = document.createElement("div");
    actions.className = "page-tool-grid";
    const slot = document.createElement("div");
    slot.id = "page-tool-slot";
    slot.className = "tool-result-slot";

    getCurrentTab().then((tab) => {
        if (tab?.url && /^https?:/i.test(tab.url)) hostChip.textContent = new URL(tab.url).hostname;
    }).catch(() => { /* keep placeholder */ });

    slot.addEventListener('page-tool-cleared', () => {
        resultOpen = false;
        saveSiteAnalyzerState();
    });

    function showBusy(label) {
        const box = document.createElement("div");
        box.className = "tool-result";
        const note = document.createElement("p");
        note.className = "tool-result-meta";
        note.style.margin = "0";
        note.textContent = label;
        box.appendChild(note);
        slot.replaceChildren(box);
        return box;
    }

    // ============================================================
    // 1. Site Analysis Tools
    // ============================================================

    const analyzeBtn = document.createElement("button");
    analyzeBtn.className = "sub-category-button";
    analyzeBtn.dataset.tool = "site-analyze";
    analyzeBtn.textContent = "Analyze page";
    analyzeBtn.addEventListener("click", async () => {
        try {
            const tab = await getCurrentTab();
            if (!tab?.id || !/^https?:/i.test(tab.url || '')) {
                flashButton(analyzeBtn, "Open a website", true);
                return;
            }

            if (sameAnalyzedSite(lastFingerprintData, tab.url)) {
                resultOpen = true;
                renderFingerprintBox(lastFingerprintData, analyzeBtn);
                saveSiteAnalyzerState();
                return;
            }

            analyzeBtn.disabled = true;
            analyzeBtn.textContent = "Analyzing…";
            showBusy(`Analyzing ${new URL(tab.url).hostname}…`);
            const results = await withPageAccess(tab.url, () => brw.scripting.executeScript({
                target: { tabId: tab.id },
                func: collectWebsiteIdentity
            }));
            const page = results?.[0]?.result;
            if (!page) {
                slot.replaceChildren();
                analyzeBtn.textContent = "Analyze page";
                flashButton(analyzeBtn, "Failed", true);
                return;
            }

            lastFingerprintData = await enrichWebsiteFingerprint(page, tab.url);
            resultOpen = true;
            renderFingerprintBox(lastFingerprintData, analyzeBtn);
            saveSiteAnalyzerState();
        } catch (error) {
            console.error("Site analysis failed:", error);
            slot.replaceChildren();
            analyzeBtn.textContent = "Analyze page";
            const label = error?.code === 'cancelled' ? 'Not now' : error?.code === 'denied' ? 'Blocked' : 'Error';
            flashButton(analyzeBtn, label, true);
        } finally {
            analyzeBtn.disabled = false;
            if (analyzeBtn.dataset.isFlashing !== "true") analyzeBtn.textContent = "Analyze page";
        }
    });
    actions.appendChild(analyzeBtn);

    const subdomainBtn = document.createElement("button");
    subdomainBtn.className = "sub-category-button";
    subdomainBtn.textContent = "Subdomains";
    subdomainBtn.addEventListener("click", async () => {
        let domain = '';
        try {
            const tab = await getCurrentTab();
            if (tab?.url && /^https?:/i.test(tab.url)) domain = getRootDomain(new URL(tab.url).hostname);
        } catch {
            /* handled below */
        }
        if (!domain || !domain.includes('.')) {
            flashButton(subdomainBtn, "Open a website", true);
            return;
        }

        subdomainBtn.disabled = true;
        subdomainBtn.textContent = "Finding…";
        showBusy(`Looking up ${domain}…`);

        try {
            const result = await findSubdomains(domain);
            const box = document.createElement("div");
            box.className = "tool-result";

            const head = document.createElement("div");
            head.className = "tool-result-head";
            const titleWrap = document.createElement("div");
            const kicker = document.createElement("div");
            kicker.className = "tool-result-kicker";
            kicker.textContent = "Subdomains";
            const summary = document.createElement("div");
            summary.className = "tool-result-meta";
            summary.style.margin = "2px 0 0";
            const hosts = result.success ? result.hosts : [];
            if (!result.success) {
                summary.textContent = result.reason || "Lookup failed.";
            } else {
                summary.textContent = hosts.length
                    ? `${domain} · ${hosts.length} hostname${hosts.length === 1 ? '' : 's'} · ${result.liveCount} resolved${result.truncated ? ' · capped at 400' : ''}`
                    : `${domain} · nothing in public records.`;
            }
            titleWrap.append(kicker, summary);

            const headActions = document.createElement("div");
            headActions.className = "tool-result-actions";
            const copyBtn = document.createElement("button");
            copyBtn.type = "button";
            copyBtn.className = "tool-result-copy";
            copyBtn.textContent = "Copy";
            copyBtn.disabled = !hosts.length;
            copyBtn.addEventListener("click", () => {
                const text = hosts.map((row) => (
                    row.ips.length ? `${row.host} ${row.ips.join(', ')}` : row.host
                )).join('\n');
                navigator.clipboard.writeText(text).then(() => flashButton(copyBtn, "Copied!"));
            });
            headActions.append(copyBtn, createCloseButton());
            head.append(titleWrap, headActions);
            box.appendChild(head);

            const note = document.createElement("p");
            note.className = "tool-result-meta";
            note.textContent = "Public records only: certificates, archives, passive DNS, urlscan.";
            box.appendChild(note);

            if (hosts.length) {
                const table = document.createElement("table");
                hosts.forEach((item) => {
                    const tr = document.createElement("tr");
                    const nameCell = document.createElement("td");
                    const link = document.createElement("a");
                    link.href = `https://${item.host}`;
                    link.target = "_blank";
                    link.rel = "noopener";
                    link.textContent = item.host;
                    nameCell.appendChild(link);
                    const ipCell = document.createElement("td");
                    ipCell.textContent = item.ips.join(", ") || "public record";
                    tr.append(nameCell, ipCell);
                    table.appendChild(tr);
                });
                const scroller = document.createElement("div");
                scroller.className = "tool-result-scroll";
                scroller.appendChild(table);
                box.appendChild(scroller);
            }

            slot.replaceChildren(box);
        } catch (err) {
            console.error("Subdomain lookup failed:", err);
            slot.replaceChildren();
            subdomainBtn.textContent = "Subdomains";
            flashButton(subdomainBtn, "Lookup failed", true);
        } finally {
            subdomainBtn.disabled = false;
            if (subdomainBtn.dataset.isFlashing !== "true") subdomainBtn.textContent = "Subdomains";
        }
    });
    actions.appendChild(subdomainBtn);

    const vtBtn = document.createElement("button");
    vtBtn.className = "sub-category-button";
    vtBtn.textContent = "VirusTotal";
    vtBtn.addEventListener("click", async () => {
        try {
            const tab = await getCurrentTab();
            if (!tab?.url || !/^https?:/i.test(tab.url)) {
                flashButton(vtBtn, "Open a website", true);
                return;
            }
            const host = new URL(tab.url).hostname;
            brw.tabs.create({
                url: `https://www.virustotal.com/gui/domain/${encodeURIComponent(host)}`,
                active: false
            });
        } catch {
            flashButton(vtBtn, "Open a website", true);
        }
    });
    actions.appendChild(vtBtn);

    const archiveBtn = document.createElement("button");
    archiveBtn.className = "sub-category-button";
    archiveBtn.textContent = "Archives";
    archiveBtn.addEventListener("click", async () => {
        try {
            const tab = await getCurrentTab();
            const url = tab?.url || '';
            if (!/^https?:/i.test(url)) {
                flashButton(archiveBtn, "Open a website", true);
                return;
            }
            const data = await brw.storage.local.get({ archiveEngines: ['Wayback Machine'] });
            const selected = archiveEngines.filter((engine) => (data.archiveEngines || []).includes(engine.name));
            const engines = selected.length ? selected : archiveEngines.filter((engine) => engine.name === 'Wayback Machine');
            engines.forEach((engine) => brw.tabs.create({ url: engine.url(url), active: false }));
        } catch {
            flashButton(archiveBtn, "Error", true);
        }
    });
    actions.appendChild(archiveBtn);

    const savePageBtn = document.createElement("button");
    savePageBtn.className = "sub-category-button page-tool-wide";
    savePageBtn.textContent = "Save offline";
    savePageBtn.addEventListener("click", async () => {
        if (isFirefox()) {
            flashButton(savePageBtn, "N/A Firefox", true);
            return;
        }

        showLoadingSpinner();
        try {
            const tab = await getCurrentTab();
            await brw.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["libs/single-file.js"]
            });
            const [{ result }] = await brw.scripting.executeScript({
                target: { tabId: tab.id },
                func: async () => {
                    const page = await singlefile.getPageData();
                    return { htmlContent: page.content, title: document.title };
                }
            });
            const blob = new Blob([result.htmlContent], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            brw.downloads.download({
                url: url,
                filename: `${result.title.replace(/[\\/:*?"<>|]/g, "_")}.html`,
                saveAs: true
            });
        } catch (e) {
            console.error("Failed to save page:", e);
            flashButton(savePageBtn, "Save Failed", true);
        } finally {
            hideLoadingSpinner();
        }
    });
    actions.appendChild(savePageBtn);
    siteWrapper.append(hostChip, actions, slot);
}