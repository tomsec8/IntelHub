/**
 * OPSECHub - Cookie & Storage Guard Module
 * Auto-deletes cookies and storage for a specific origin when the last tab of that origin is closed.
 * Listeners stay registered from startup so a suspended Firefox event page still receives the close.
 */

const brw = typeof browser !== 'undefined' ? browser : chrome;
const ORIGIN_KEY = 'cookieGuardOrigins';

function pageOrigin(urlStr) {
    try {
        const url = new URL(urlStr);
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin;
    } catch {
        /* ignore */
    }
    return '';
}

function originStore() {
    return brw.storage.local;
}

function isFirefox() {
    return typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox');
}

function hostnamesFor(hostname) {
    const names = new Set([hostname]);
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length > 2) names.add(parts.slice(1).join('.'));
    return [...names];
}

async function readOrigins() {
    const data = await originStore().get({ [ORIGIN_KEY]: {} });
    return { ...(data[ORIGIN_KEY] || {}) };
}

async function writeOrigins(map) {
    await originStore().set({ [ORIGIN_KEY]: map });
}

async function guardEnabled() {
    const data = await brw.storage.local.get({ moduleStates: {} });
    return data.moduleStates?.cookieGuard === true;
}

async function rememberTab(tabId, urlStr) {
    if (!(await guardEnabled())) return;
    const map = await readOrigins();
    const origin = pageOrigin(urlStr);
    const key = String(tabId);
    if (origin) map[key] = origin;
    await writeOrigins(map);
}

async function snapshotOpenTabs() {
    const tabs = await brw.tabs.query({});
    const map = {};
    tabs.forEach((tab) => {
        const origin = pageOrigin(tab.url);
        if (tab.id != null && origin) map[String(tab.id)] = origin;
    });
    await writeOrigins(map);
}

function cookieUrl(cookie) {
    const host = String(cookie.domain || '').replace(/^\./, '');
    const protocol = cookie.secure ? 'https:' : 'http:';
    return `${protocol}//${host}${cookie.path || '/'}`;
}

async function removeCookies(origin, hostname) {
    if (!brw.cookies?.getAll || !brw.cookies?.remove) return;
    const queries = [{ url: `${origin}/` }, { domain: hostname }];
    hostnamesFor(hostname).forEach((name) => queries.push({ domain: name }));
    let stores = [{ id: '' }];
    try {
        if (brw.cookies.getAllCookieStores) stores = await brw.cookies.getAllCookieStores();
    } catch {
        stores = [{ id: '' }];
    }

    const listed = [];
    for (const store of stores) {
        for (const query of queries) {
            try {
                const found = await brw.cookies.getAll(store.id ? { ...query, storeId: store.id } : query);
                if (Array.isArray(found)) listed.push(...found);
            } catch (err) {
                console.warn('[OPSECHub:CookieGuard] Could not list cookies:', err?.message || err);
            }
        }
    }

    const seen = new Set();
    for (const cookie of listed) {
        const id = [
            cookie.storeId,
            cookie.name,
            cookie.domain,
            cookie.path,
            cookie.partitionKey?.topLevelSite || ''
        ].join('|');
        if (seen.has(id)) continue;
        seen.add(id);
        const details = { url: cookieUrl(cookie), name: cookie.name };
        if (cookie.storeId) details.storeId = cookie.storeId;
        if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;
        try {
            await brw.cookies.remove(details);
        } catch (err) {
            try {
                await brw.cookies.remove({ url: details.url, name: cookie.name, storeId: cookie.storeId });
            } catch (retryErr) {
                console.warn('[OPSECHub:CookieGuard] Cookie remove failed:', cookie.name, retryErr?.message || err?.message || err);
            }
        }
    }
}

async function browsingRemove(removal, dataType) {
    try {
        await brw.browsingData.remove(removal, dataType);
    } catch (err) {
        console.warn(
            '[OPSECHub:CookieGuard] browsingData failed for',
            Object.keys(dataType)[0],
            err?.message || err
        );
    }
}

async function wipeOrigin(origin) {
    const hostname = new URL(origin).hostname;
    const dataTypes = [
        { cookies: true },
        { localStorage: true },
        { indexedDB: true },
        { serviceWorkers: true }
    ];
    if (isFirefox()) {
        const hostnames = hostnamesFor(hostname);
        for (const dataType of dataTypes) {
            await browsingRemove({ hostnames }, dataType);
        }
        if (typeof brw.browsingData.removeCookies === 'function') {
            try {
                await brw.browsingData.removeCookies({ hostnames });
            } catch (err) {
                console.warn('[OPSECHub:CookieGuard] removeCookies failed:', err?.message || err);
            }
        }
    } else {
        for (const dataType of dataTypes) {
            await browsingRemove({ origins: [origin] }, dataType);
        }
    }
    await removeCookies(origin, hostname);
    console.log(`[OPSECHub:CookieGuard] Storage wiped for ${origin}.`);
}

async function onTabClosed(tabId) {
    const map = await readOrigins();
    const key = String(tabId);
    const origin = map[key] || '';
    delete map[key];
    await writeOrigins(map);
    if (!origin || !(await guardEnabled())) return;

    const tabs = await brw.tabs.query({});
    const stillOpen = tabs.some((tab) => tab.id !== tabId && pageOrigin(tab.url) === origin);
    if (stillOpen) return;

    console.log(`[OPSECHub:CookieGuard] Last tab for ${origin} closed. Wiping storage...`);
    await wipeOrigin(origin);
}

brw.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const urlStr = changeInfo.url || tab?.url;
    if (!urlStr) return;
    rememberTab(tabId, urlStr).catch((err) => {
        console.warn('[OPSECHub:CookieGuard] Could not track tab:', err?.message || err);
    });
});

brw.tabs.onRemoved.addListener((tabId) => {
    onTabClosed(tabId).catch((err) => {
        console.error('[OPSECHub:CookieGuard] Failed to wipe after tab close:', err);
    });
});

async function enable() {
    await snapshotOpenTabs();
    console.log('[OPSECHub] Cookie & Storage Guard ENABLED');
}

async function disable() {
    await writeOrigins({});
    console.log('[OPSECHub] Cookie & Storage Guard DISABLED');
}

export function noteOrigin(tabId, urlStr) {
    if (tabId == null || !urlStr) return;
    rememberTab(tabId, urlStr).catch((err) => {
        console.warn('[OPSECHub:CookieGuard] Could not track tab:', err?.message || err);
    });
}

export default {
    noteOrigin,
    toggle: (enabled) => (enabled ? enable() : disable())
};
