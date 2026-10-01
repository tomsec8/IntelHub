import { googleLinksFor } from './googleIdLookup.js';

// Injected into the Gmail tab (MAIN world). Must stay self-contained.
function gmailNetworkSniffer(targetEmail) {
    return new Promise((resolve) => {
        let found = false;
        try { window.onbeforeunload = null; } catch (e) { }

        function isTrustedGoogleUrl(url) {
            if (typeof url !== 'string' || !url) return false;
            if (url.startsWith('/')) return true;
            try {
                const parsed = new URL(url, location.href);
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
                const host = parsed.hostname.toLowerCase();
                return host === 'google.com' || host.endsWith('.google.com')
                    || host === 'googleapis.com' || host.endsWith('.googleapis.com');
            } catch {
                return false;
            }
        }

        function processContent(content) {
            if (found) return;
            if (content && typeof content === 'string' && content.includes(targetEmail)) {
                const escapedEmail = String(targetEmail).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const strictRegex = new RegExp(`"(\\d{21})"[^\\[\\]]*?"${escapedEmail}"`, 'i');
                const match = strictRegex.exec(content);
                if (match && match[1]) {
                    found = true;
                    resolve({ success: true, id: match[1], confidence: "High (Context Validated)" });
                    return;
                }

                const idx = content.indexOf(targetEmail);
                const snippet = content.substring(Math.max(0, idx - 400), idx + 400);
                const emailPos = idx - Math.max(0, idx - 400);

                const regex = /(\d{21})/g;
                let bMatch;
                let bestId = null;
                let minDistance = Infinity;

                while ((bMatch = regex.exec(snippet)) !== null) {
                    const distance = Math.abs(bMatch.index - emailPos);
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestId = bMatch[1];
                    }
                }

                if (bestId) {
                    found = true;
                    resolve({ success: true, id: bestId, confidence: "Low (Proximity Guess)" });
                }
            }
        }

        const originalOpen = window.XMLHttpRequest.prototype.open;
        window.XMLHttpRequest.prototype.open = function (method, url) {
            if (isTrustedGoogleUrl(url)) {
                this.addEventListener('load', function () { processContent(this.responseText); });
            }
            originalOpen.apply(this, arguments);
        };

        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
            const response = await originalFetch(...args);
            if (isTrustedGoogleUrl(url)) {
                const clone = response.clone();
                clone.text().then(text => processContent(text)).catch(() => { });
            }
            return response;
        };

        setTimeout(() => {
            if (!found) resolve({ success: false, reason: "Timeout: ID not found in targeted Gmail API responses." });
        }, 8000);
    });
}

// Extracted internal core logic for non-UI usages (e.g., Copilot)
export async function scanEmailTarget(email) {
    if (!email) return { success: false, reason: "No email provided." };

    const injectBlocker = async (tid) => {
        const details = {
            target: { tabId: tid },
            world: 'MAIN',
            func: () => {
                Object.defineProperty(window, 'onbeforeunload', {
                    configurable: false,
                    writable: false,
                    value: null
                });
                window.addEventListener = new Proxy(window.addEventListener, {
                    apply: function (target, thisArg, args) {
                        if (args[0] === 'beforeunload') return;
                        return target.apply(thisArg, args);
                    }
                });
            }
        };
        try {
            await chrome.scripting.executeScript({ ...details, injectImmediately: true });
        } catch (err) {
            const message = err?.message || '';
            if (!/injectImmediately|unexpected property/i.test(message)) throw err;
            await chrome.scripting.executeScript(details);
        }
    };

    let tab;
    try {
        tab = await chrome.tabs.create({
            url: `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeURIComponent(email)}`,
            active: false
        });

        await injectBlocker(tab.id);

        await new Promise((resolve, reject) => {
            const listener = (tid, changeInfo) => {
                if (tid === tab.id && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
            setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 3000);
        });

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            func: gmailNetworkSniffer,
            args: [email]
        });

        const result = results[0].result;
        try { await chrome.tabs.remove(tab.id); } catch { /* tab already closed */ }
        
        if (result && result.success) {
            const gaiaID = result.id;
            return {
                success: true,
                target: email,
                gaiaID,
                confidence: result.confidence,
                ...googleLinksFor(email, gaiaID)
            };
        } else {
            return { success: false, reason: result?.reason || "Could not find ID in this scan." };
        }
    } catch (e) {
        if (tab && tab.id) {
            try { await chrome.tabs.remove(tab.id); } catch { /* tab already closed */ }
        }
        return { success: false, reason: e.message };
    }
}

