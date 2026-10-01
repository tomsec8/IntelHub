/**
 * OPSEC - Proxy Manager
 * Applies a user-chosen SOCKS5/HTTP proxy, or clears it.
 *
 * Firefox only proxies requests through proxy.onRequest, and that listener
 * has to be registered while the background script is first loading. A
 * listener added later is dropped when the event page suspends, so the
 * proxy silently stops. Chrome uses proxy.settings instead.
 */

const brw = typeof browser !== 'undefined' ? browser : chrome;
const useFirefoxProxy = typeof brw.proxy?.onRequest?.addListener === 'function';

let firefoxListening = false;
let firefoxErrorListening = false;
let cacheLoaded = false;
let cachedProxy = null;

function lastErrorMessage() {
    return brw.runtime.lastError?.message || '';
}

function proxyInfoFromConfig(config) {
    if (!config?.host) return null;
    const portNum = parseInt(config.port, 10);
    if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) return null;
    const info = {
        type: config.type === 'socks5' ? 'socks' : 'http',
        host: config.host,
        port: portNum
    };
    if (config.type === 'socks5') info.proxyDNS = true;
    return info;
}

function proxyInfoFromStored(data) {
    if (data?.moduleStates?.proxyManager !== true) return null;
    return proxyInfoFromConfig(data.activeProxy);
}

function bypassRequest(url) {
    try {
        const parsed = new URL(url);
        if (!/^(https?|wss?|ftp):$/i.test(parsed.protocol)) return true;
        const host = parsed.hostname.toLowerCase();
        return host === 'localhost' || host === '127.0.0.1' || host === '::1';
    } catch {
        return true;
    }
}

function direct() {
    return { type: 'direct' };
}

function firefoxProxyListener(details) {
    if (bypassRequest(details?.url)) return direct();
    if (cacheLoaded) return cachedProxy || direct();
    return brw.storage.local.get({ moduleStates: {}, activeProxy: null }).then((data) => {
        if (!cacheLoaded) {
            cachedProxy = proxyInfoFromStored(data);
            cacheLoaded = true;
        }
        return bypassRequest(details?.url) ? direct() : (cachedProxy || direct());
    });
}

function registerFirefoxProxy() {
    if (!useFirefoxProxy || firefoxListening) return firefoxListening;
    try {
        brw.proxy.onRequest.addListener(firefoxProxyListener, { urls: ['<all_urls>'] });
        firefoxListening = true;
        if (!firefoxErrorListening) {
            try {
                brw.proxy.onError?.addListener?.((error) => {
                    console.error('[OPSEC] Firefox proxy error:', error);
                });
                firefoxErrorListening = true;
            } catch {
                /* onError is optional */
            }
        }
    } catch (err) {
        console.warn('[OPSEC] Firefox proxy listener was not registered:', err);
    }
    return firefoxListening;
}

function rememberFirefoxProxy(info) {
    cachedProxy = info;
    cacheLoaded = true;
}

if (useFirefoxProxy) {
    registerFirefoxProxy();
    brw.storage.local.get({ moduleStates: {}, activeProxy: null }).then((data) => {
        if (cacheLoaded) return;
        cachedProxy = proxyInfoFromStored(data);
        cacheLoaded = true;
    }).catch(() => {});
}

export const proxyManagerModule = {
    setProxy(config) {
        if (!config || !config.host || !config.port) {
            return this.clearProxy();
        }

        if (typeof config.host !== 'string' || !/^[a-zA-Z0-9.\-:]+$/.test(config.host)) {
            console.warn('[OPSEC] Proxy host rejected (invalid characters):', config.host);
            return Promise.resolve(false);
        }
        const portNum = parseInt(config.port, 10);
        if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
            console.warn('[OPSEC] Proxy port rejected (out of range):', config.port);
            return Promise.resolve(false);
        }

        if (useFirefoxProxy) {
            const info = proxyInfoFromConfig({ ...config, port: portNum });
            if (!info) return Promise.resolve(false);
            rememberFirefoxProxy(info);
            const registered = registerFirefoxProxy();
            if (!registered) return Promise.resolve(false);
            console.log(`[OPSEC] Firefox Proxy activated: ${info.type}://${info.host}:${info.port}`);
            return Promise.resolve(true);
        }

        const scheme = config.type === 'socks5' ? 'socks5' : 'http';
        const proxyConfig = {
            mode: 'fixed_servers',
            rules: {
                singleProxy: {
                    scheme,
                    host: config.host,
                    port: portNum
                },
                bypassList: ['localhost', '127.0.0.1', '::1']
            }
        };

        return new Promise((resolve) => {
            brw.proxy.settings.set({ value: proxyConfig, scope: 'regular' }, () => {
                const err = lastErrorMessage();
                if (err) {
                    console.error('[OPSEC] Proxy Error:', err);
                    resolve(false);
                    return;
                }
                console.log(`[OPSEC] Proxy activated: ${scheme}://${config.host}:${config.port}`);
                resolve(true);
            });
        });
    },

    clearProxy() {
        brw.storage.local.remove(['cachedProxies', 'proxiesTimestamp']).catch(() => {});
        if (useFirefoxProxy) {
            rememberFirefoxProxy(null);
            if (firefoxListening) {
                try {
                    brw.proxy.onRequest.removeListener(firefoxProxyListener);
                } catch {
                    /* ignore */
                }
                firefoxListening = false;
            }
            console.log('[OPSEC] Firefox Proxy cleared. Using system default.');
            return Promise.resolve(true);
        }

        return new Promise((resolve) => {
            brw.proxy.settings.clear({ scope: 'regular' }, () => {
                const err = lastErrorMessage();
                if (err) {
                    console.error('[OPSEC] Proxy Error on clear:', err);
                    resolve(false);
                    return;
                }
                console.log('[OPSEC] Proxy cleared. Using system default.');
                resolve(true);
            });
        });
    }
};
