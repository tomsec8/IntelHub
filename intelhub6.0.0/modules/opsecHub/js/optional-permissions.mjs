/**
 * Optional permissions for non-AdBlocker tools.
 * Requested at enable-time with an explanation dialog first.
 */

const brw = typeof browser !== 'undefined' ? browser : chrome;

function isFirefox() {
    return typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox');
}

/** Permissions Firefox does not implement. Requesting them fails the whole grant, including host access. */
const FIREFOX_UNSUPPORTED_PERMISSIONS = new Set(['contentSettings', 'sidePanel']);

/** @typedef {{ permissions?: string[], origins?: string[], title: string, reason: string }} PermSpec */

/** @type {Record<string, PermSpec>} */
export const MODULE_OPTIONAL_PERMISSIONS = {
    webrtcBlock: {
        permissions: ['privacy'],
        origins: ['<all_urls>'],
        title: 'WebRTC Leak Block',
        reason:
            'Needs the browser privacy setting so WebRTC cannot expose your real IP. ' +
            'Without it, this protection cannot be applied.'
    },
    locationBlock: {
        origins: ['<all_urls>'],
        title: 'Location Guard',
        reason:
            'Needs access to pages so location requests can be blocked in the page itself.'
    },
    mediaBlock: {
        origins: ['<all_urls>'],
        title: 'Camera & Mic Block',
        reason:
            'Needs access to pages so camera and microphone access can be blocked in the page itself.'
    },
    clipboardGuard: {
        origins: ['<all_urls>'],
        title: 'Clipboard Protection',
        reason:
            'Needs access to pages so silent clipboard reads can be blocked in the page context.'
    },
    forceHttps: {
        origins: ['<all_urls>'],
        title: 'Force HTTPS',
        reason:
            'Needs permission to upgrade HTTP requests to HTTPS across websites you visit.'
    },
    privacyHeaders: {
        origins: ['<all_urls>'],
        title: 'Privacy Headers',
        reason:
            'Needs permission to inject Do Not Track and Global Privacy Control headers on web requests.'
    },
    googleTelemetry: {
        origins: ['<all_urls>'],
        title: 'Google Telemetry',
        reason:
            'Needs permission to strip Chrome client identification headers from web requests.'
    },
    // Note: chrome.proxy cannot be optional in Chrome — it stays a required
    // manifest permission. Firefox still needs a host-permission grant at enable time.
    cookieGuard: {
        permissions: ['browsingData'],
        title: 'Cookie & Storage Guard',
        reason:
            'Needs permission to delete cookies and site storage when you close the last tab for a site.'
    }
};

/** One-shot tools / actions (not module toggles). */
export const FEATURE_OPTIONAL_PERMISSIONS = {
    browsingDataTools: {
        permissions: ['browsingData'],
        title: 'Clear browsing data',
        reason:
            'Needs permission to clear history, cache, cookies, or site data when you use a wipe action.'
    },
    linkTracer: {
        origins: ['<all_urls>'],
        title: 'Short Link Tracer',
        reason:
            'Needs permission to request the short link and read each Location hop (301/302) without opening it in a tab.'
    }
};

function normalizeSpec(spec) {
    let permissions = [...(spec.permissions || [])];
    if (isFirefox()) {
        permissions = permissions.filter((name) => !FIREFOX_UNSUPPORTED_PERMISSIONS.has(name));
    }
    return {
        permissions,
        origins: [...(spec.origins || [])]
    };
}

export function getModulePermSpec(moduleId) {
    if (isFirefox() && moduleId === 'proxyManager') {
        return {
            origins: ['<all_urls>'],
            title: 'Proxy Manager',
            reason: 'Needs permission to send browser traffic through the proxy you choose.'
        };
    }
    const spec = MODULE_OPTIONAL_PERMISSIONS[moduleId] || null;
    if (!spec) return null;
    if (isFirefox() && moduleId === 'cookieGuard') {
        return {
            permissions: ['browsingData', 'cookies'],
            origins: ['<all_urls>'],
            title: spec.title,
            reason:
                'Needs permission to delete cookies and site storage when you close the last tab for a site, including access to those sites.'
        };
    }
    return spec;
}

export function getFeaturePermSpec(featureId) {
    return FEATURE_OPTIONAL_PERMISSIONS[featureId] || null;
}

export async function permissionsGranted(spec) {
    if (!spec) return true;
    const want = normalizeSpec(spec);
    if (!want.permissions.length && !want.origins.length) return true;
    try {
        return await brw.permissions.contains(want);
    } catch {
        return false;
    }
}

export async function hasModuleOptionalPermissions(moduleId) {
    const spec = getModulePermSpec(moduleId);
    if (!spec) return true;
    return permissionsGranted(spec);
}

export async function requestPermissions(spec) {
    if (!spec) return true;
    const want = normalizeSpec(spec);
    if (!want.permissions.length && !want.origins.length) return true;
    try {
        return await brw.permissions.request(want);
    } catch (err) {
        console.warn('[OPSECHub] permissions.request failed:', err);
        return false;
    }
}

/**
 * Pre-prompt explaining why, then Chrome’s permission dialog.
 * Chrome requires permissions.request() inside a user-gesture handler, so the
 * actual request runs from the dialog’s Continue button click.
 * @returns {Promise<{ granted: boolean, cancelled?: boolean, denied?: boolean }>}
 */
export async function explainAndRequest(spec, { explainFn } = {}) {
    if (!spec) return { granted: true };
    if (await permissionsGranted(spec)) return { granted: true };

    if (explainFn) {
        const accepted = await explainFn(spec);
        if (!accepted) return { granted: false, cancelled: true };
        const granted = await requestPermissions(spec);
        return granted ? { granted: true } : { granted: false, denied: true };
    }

    return explainThenRequestDialog(spec);
}

export async function ensureModulePermissions(moduleId, opts = {}) {
    const spec = getModulePermSpec(moduleId);
    if (!spec) return { granted: true };
    return explainAndRequest(spec, opts);
}

export async function ensureFeaturePermissions(featureId, opts = {}) {
    const spec = getFeaturePermSpec(featureId);
    if (!spec) return { granted: true };
    return explainAndRequest(spec, opts);
}

export function pageOriginPattern(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return `${parsed.origin}/*`;
    } catch {
        return null;
    }
}

export async function canReadPage(url) {
    const pattern = pageOriginPattern(url);
    if (!pattern) return false;
    if (await permissionsGranted({ origins: ['<all_urls>'] })) return true;
    return permissionsGranted({ origins: [pattern] });
}

export async function ensurePageAccess(url) {
    const pattern = pageOriginPattern(url);
    if (!pattern) return { granted: false };
    if (await canReadPage(url)) return { granted: true };
    let host = 'this site';
    try { host = new URL(url).host; } catch { /* keep fallback */ }
    return explainAndRequest({
        origins: [pattern],
        title: 'Read this page',
        reason: `Needs permission to read ${host} in the open tab. The page is not uploaded.`
    });
}

function missingHostPermission(err) {
    return /host permission|cannot access contents|must request permission to access|access this host/i.test(String(err?.message || err || ''));
}

function deniedAccess(access) {
    const error = new Error(access.cancelled ? 'Permission cancelled' : 'Permission denied');
    error.code = access.cancelled ? 'cancelled' : 'denied';
    return error;
}

/** Firefox sidebar and workspace clicks do not grant activeTab, so ask for this site first. */
export async function withPageAccess(url, run) {
    if (isFirefox()) {
        const access = await ensurePageAccess(url);
        if (!access.granted) throw deniedAccess(access);
    }
    try {
        return await run();
    } catch (err) {
        if (isFirefox() || !missingHostPermission(err)) throw err;
        const access = await ensurePageAccess(url);
        if (!access.granted) throw deniedAccess(access);
        return run();
    }
}

/** Modules that should auto-disable if the user revokes optional perms. */
export function modulesNeedingPermission(permission) {
    const hit = [];
    for (const [id, spec] of Object.entries(MODULE_OPTIONAL_PERMISSIONS)) {
        if ((spec.permissions || []).includes(permission)) hit.push(id);
    }
    return hit;
}

function explainThenRequestDialog(spec) {
    return new Promise((resolve) => {
        const existing = document.getElementById('opsec-perm-modal');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'opsec-perm-modal';
        overlay.className = 'opsec-perm-overlay';
        overlay.innerHTML = `
            <div class="opsec-perm-dialog" role="dialog" aria-modal="true" aria-labelledby="opsec-perm-title">
                <h3 id="opsec-perm-title">Allow “${escapeHtml(spec.title)}”?</h3>
                <p class="opsec-perm-reason">${escapeHtml(spec.reason)}</p>
                <p class="opsec-perm-note">The browser will show a short confirmation next. If you decline, this tool stays off — you can turn it on again anytime.</p>
                <div class="opsec-perm-actions">
                    <button type="button" class="opsec-perm-btn secondary" data-act="cancel">Not now</button>
                    <button type="button" class="opsec-perm-btn primary" data-act="allow">Continue</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => overlay.remove();

        overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => {
            close();
            resolve({ granted: false, cancelled: true });
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                close();
                resolve({ granted: false, cancelled: true });
            }
        });
        // Must call permissions.request from this click to keep the user gesture.
        overlay.querySelector('[data-act="allow"]').addEventListener('click', () => {
            const want = normalizeSpec(spec);
            Promise.resolve(brw.permissions.request(want))
                .then((granted) => {
                    close();
                    resolve(granted ? { granted: true } : { granted: false, denied: true });
                })
                .catch((err) => {
                    console.warn('[OPSECHub] permissions.request failed:', err);
                    close();
                    resolve({ granted: false, denied: true });
                });
        });
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Brief status toast (popup / options). */
export function showPermToast(message, { isError = false } = {}) {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('opsec-perm-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'opsec-perm-toast';
        el.className = 'opsec-perm-toast';
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.toggle('is-error', !!isError);
    el.classList.add('show');
    clearTimeout(showPermToast._t);
    showPermToast._t = setTimeout(() => el.classList.remove('show'), 3200);
}
