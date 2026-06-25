import { flashButton, createSection, saveViewState, resetViewState } from './utils.js';

let lastScanData = null;

// Extracted internal core logic for non-UI usages (e.g., Copilot)
export async function scanEmailTarget(email) {
    if (!email) return { success: false, reason: "No email provided." };
    
    function gmailNetworkSniffer(targetEmail) {
        return new Promise((resolve) => {
            let found = false;

            function processContent(content) {
                if (found) return;
                if (content && typeof content === 'string' && content.includes(targetEmail)) {
                    // 1. Strict Context-Aware Extraction
                    // Look for JSON array structure: ["123456789012345678901", ..., "targetEmail"]
                    const strictRegex = new RegExp(`"\(\\d{21}\)"[^\\[\\]]*?"${targetEmail}"`, 'i');
                    const match = strictRegex.exec(content);
                    if (match && match[1]) {
                        found = true;
                        resolve({ success: true, id: match[1], confidence: "High (Context Validated)" });
                        return;
                    }

                    // 2. Fallback Proximity Guess (if JSON structure changed)
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
                if (typeof url === 'string' && (url.includes('google.com') || url.includes('googleapis.com') || url.startsWith('/'))) {
                    this.addEventListener('load', function () { processContent(this.responseText); });
                }
                originalOpen.apply(this, arguments);
            };

            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
                const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
                const response = await originalFetch(...args);
                if (url.includes('google.com') || url.includes('googleapis.com') || url.startsWith('/')) {
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

    const injectBlocker = async (tid) => {
        await chrome.scripting.executeScript({
            target: { tabId: tid },
            world: 'MAIN',
            func: () => {
                Object.defineProperty(window, 'onbeforeunload', {
                    configurable: false,
                    writeable: false,
                    value: null
                });
                window.addEventListener = new Proxy(window.addEventListener, {
                    apply: function (target, thisArg, args) {
                        if (args[0] === 'beforeunload') return;
                        return target.apply(thisArg, args);
                    }
                });
            },
            injectImmediately: true
        });
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
        chrome.tabs.remove(tab.id).catch(() => { });
        
        if (result && result.success) {
            const gaiaID = result.id;
            return {
                success: true,
                target: email,
                gaiaID: gaiaID,
                googleMapsLink: `https://www.google.com/maps/contrib/${gaiaID}`,
                googleCalendarLink: `https://calendar.google.com/calendar/u/0/embed?src=${encodeURIComponent(email)}`,
                googleArchiveLink: `https://web.archive.org/web/*/plus.google.com/${gaiaID}*`
            };
        } else {
            return { success: false, reason: result?.reason || "Could not find ID in this scan." };
        }
    } catch (e) {
        if (tab && tab.id) chrome.tabs.remove(tab.id).catch(() => {});
        return { success: false, reason: e.message };
    }
}

function injectStyles() {
    if (document.getElementById('email-scanner-styles')) return;
    const style = document.createElement('style');
    style.id = 'email-scanner-styles';
    style.innerHTML = `
        :root {
            --es-bg: #0f172a;
            --es-surface: #1e293b;
            --es-surface-hover: #334155;
            --es-border: #334155;
            --es-primary: #6366f1;
            --es-primary-hover: #4f46e5;
            --es-text: #f1f5f9;
            --es-text-muted: #94a3b8;
            --es-success: #10b981;
            --es-error: #ef4444;
            --es-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        @keyframes es-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes es-fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

        .es-container {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            color: var(--es-text);
            display: flex;
            flex-direction: column;
            gap: 16px;
            animation: es-fade-in 0.3s ease-out;
            padding: 4px;
        }

        .es-input-group {
            position: relative;
        }
        .es-input {
            width: 100%;
            padding: 12px 16px;
            border-radius: 12px;
            border: 1px solid var(--es-border);
            background-color: var(--es-surface);
            color: var(--es-text);
            font-size: 14px;
            outline: none;
            transition: all 0.2s ease;
            box-sizing: border-box;
        }
        .es-input:focus {
            border-color: var(--es-primary);
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
        }
        .es-input::placeholder { color: var(--es-text-muted); opacity: 0.6; }

        .es-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 10px 16px;
            border-radius: 10px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
            gap: 8px;
            user-select: none;
        }
        .es-btn-primary {
            background: linear-gradient(135deg, var(--es-primary) 0%, var(--es-primary-hover) 100%);
            color: white;
            box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
        }
        .es-btn-primary:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        }
        .es-btn-secondary {
            background-color: var(--es-surface);
            border: 1px solid var(--es-border);
            color: var(--es-text-muted);
        }
        .es-btn-secondary:hover:not(:disabled) {
            background-color: var(--es-surface-hover);
            color: var(--es-text);
            border-color: var(--es-text-muted);
        }
        .es-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none !important;
        }
        .es-btn-block { width: 100%; }
        .es-btn-sm { padding: 6px 12px; font-size: 12px; }

        .es-card {
            background-color: var(--es-surface);
            border: 1px solid var(--es-border);
            border-radius: 12px;
            padding: 16px;
            box-shadow: var(--es-shadow);
        }

        .es-cookie-section {
            background: rgba(30, 41, 59, 0.5);
            border: 1px dashed var(--es-border);
            border-radius: 12px;
            padding: 12px;
        }
        .es-cookie-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            cursor: pointer;
        }
        .es-cookie-title { font-size: 12px; font-weight: 600; color: var(--es-text-muted); display: flex; align-items: center; gap: 6px; }
        .es-cookie-status { width: 8px; height: 8px; border-radius: 50%; background-color: var(--es-border); }
        .es-cookie-status.active { background-color: var(--es-success); box-shadow: 0 0 8px rgba(16, 185, 129, 0.4); }

        .es-cookie-content { display: none; margin-top: 10px; animation: es-fade-in 0.2s; }
        .es-cookie-content.open { display: block; }
        
        .es-step-list { margin: 0; padding: 0 0 0 20px; color: var(--es-text-muted); font-size: 12px; line-height: 1.6; }
        .es-code-block {
            background: #000;
            padding: 8px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 11px;
            color: #a5b4fc;
            margin: 8px 0;
            word-break: break-all;
            border: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .es-result-area { display: none; margin-top: 8px; }
        .es-result-success { text-align: center; }
        .es-avatar { width: 64px; height: 64px; border-radius: 50%; background: var(--es-surface-hover); margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 2px solid var(--es-border); }
        .es-id-badge {
            background: rgba(99, 102, 241, 0.1);
            color: #818cf8;
            padding: 6px 12px;
            border-radius: 20px;
            font-family: monospace;
            font-size: 14px;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border: 1px solid rgba(99, 102, 241, 0.2);
            margin-bottom: 16px;
        }
        .es-id-value { user-select: all; }
        
        .es-links { display: grid; grid-template-columns: 1fr; gap: 8px; }
        .es-link-btn {
            text-decoration: none;
            background: var(--es-surface-hover);
            color: var(--es-text);
            padding: 10px;
            border-radius: 8px;
            font-size: 13px;
            display: flex;
            align-items: center;
            transition: all 0.2s;
            border: 1px solid transparent;
        }
        .es-link-btn:hover { border-color: var(--es-border); background: #3f4e66; }
        .es-link-icon { margin-right: 10px; font-size: 16px; width: 20px; text-align: center; }

        .es-spinner {
            width: 24px; height: 24px;
            border: 3px solid rgba(255,255,255,0.1);
            border-top-color: var(--es-primary);
            border-radius: 50%;
            animation: es-spin 1s linear infinite;
            margin: 20px auto;
        }
        .es-loading-text { text-align: center; color: var(--es-text-muted); font-size: 13px; margin-bottom: 20px; }

        .es-error-box { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #fca5a5; padding: 12px; border-radius: 8px; text-align: center; font-size: 13px; }
        .es-hidden-textarea { width: 1px; height: 1px; opacity: 0; position: absolute; }
    `;
    document.head.appendChild(style);
}

function renderResult(resultArea, data, targetEmail) {
    resultArea.style.display = "block";

    if (data.success) {
        const gaiaID = data.id;
        const mapsLink = `https://www.google.com/maps/contrib/${gaiaID}`;
        const calendarLink = `https://calendar.google.com/calendar/u/0/embed?src=${encodeURIComponent(targetEmail)}`;
        const archiveLink = `https://web.archive.org/web/*/plus.google.com/${gaiaID}*`;

        // Helper to create element
        const el = (tag, cls, txt) => {
            const e = document.createElement(tag);
            if (cls) e.className = cls;
            if (txt) e.textContent = txt;
            return e;
        };

        const card = el('div', 'es-card');
        const successDiv = el('div', 'es-result-success');

        const avatar = el('div', 'es-avatar', '👤');
        const title = el('div', '', 'Target Found');
        title.style.cssText = 'font-weight: 600; margin-bottom: 4px; font-size: 15px;';

        const emailDiv = el('div', '', targetEmail);
        emailDiv.style.cssText = 'color: var(--es-text-muted); font-size: 13px; margin-bottom: 12px;';

        const idBadge = el('div', 'es-id-badge');
        const idValue = el('span', 'es-id-value', gaiaID);
        
        // Add Confidence Score
        const confidenceValue = data.confidence || "Unknown";
        const confidenceBadge = el('span', '', ` [Confidence: ${confidenceValue}]`);
        confidenceBadge.style.cssText = `font-size: 10px; margin-left: 8px; font-weight: normal; color: ${confidenceValue.includes('High') ? '#10b981' : '#fca5a5'}`;

        const copyBtn = el('button', 'es-btn es-btn-sm es-btn-secondary', 'Copy');
        copyBtn.style.cssText = 'padding: 2px 6px; height: 20px;';
        copyBtn.id = 'copy-id-btn';

        copyBtn.onclick = () => {
            navigator.clipboard.writeText(gaiaID).then(() => {
                copyBtn.textContent = '✓';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
            });
        };

        idBadge.appendChild(idValue);
        idBadge.appendChild(confidenceBadge);
        idBadge.appendChild(copyBtn);

        const linksDiv = el('div', 'es-links');

        const createLink = (href, icon, text) => {
            const a = document.createElement('a');
            a.href = href;
            a.target = '_blank';
            a.className = 'es-link-btn';
            const sp = el('span', 'es-link-icon', icon);
            a.appendChild(sp);
            a.appendChild(document.createTextNode(' ' + text));
            return a;
        };

        linksDiv.appendChild(createLink(mapsLink, '📍', 'Google Maps'));
        linksDiv.appendChild(createLink(calendarLink, '📅', 'Calendar'));
        linksDiv.appendChild(createLink(archiveLink, '🏛️', 'Archive'));

        successDiv.append(avatar, title, emailDiv, idBadge, linksDiv);
        card.appendChild(successDiv);

        resultArea.textContent = '';
        resultArea.appendChild(card);
    } else {
        resultArea.textContent = '';
        const failBox = document.createElement('div');
        failBox.className = 'es-result-failure es-error-box';

        const failTitle = document.createElement('div');
        failTitle.style.cssText = 'font-weight: bold; margin-bottom: 4px;';
        failTitle.textContent = 'Search Failed';

        const failReason = document.createElement('div');
        failReason.textContent = data.reason;

        failBox.append(failTitle, failReason);
        resultArea.appendChild(failBox);
    }
}

function showLoading(resultArea, method) {
    resultArea.style.display = "block";
    const methodText = method === 'gmail' ? 'Gmail scraping' : 'People API';
    resultArea.textContent = '';

    const spinner = document.createElement('div');
    spinner.className = 'es-spinner';

    const txt = document.createElement('div');
    txt.className = 'es-loading-text';
    txt.textContent = `Scanning via ${methodText}...`;

    resultArea.append(spinner, txt);
}

export function restoreEmailScanner(container, state) {
    if (state.isOpen) {
        const scanBtn = Array.from(container.querySelectorAll('.category-button')).find(btn => btn.textContent.includes("Google ID Scanner"));
        if (scanBtn) scanBtn.nextElementSibling?.classList.add("open");
    }

    if (state.email) {
        const input = container.querySelector('.es-input-group input');
        if (input) input.value = state.email;
    }

    if (state.result) {
        lastScanData = state.result;
        const scanBtn = Array.from(container.querySelectorAll('.category-button')).find(btn => btn.textContent.includes("Google ID Scanner"));
        if (scanBtn) {
            const wrapper = scanBtn.nextElementSibling;
            const resultArea = wrapper.querySelector('.es-result-area');
            if (resultArea) renderResult(resultArea, lastScanData, state.email);
        }
    }
}

export function initializeEmailScanner(container) {
    injectStyles();

    const { wrapper: scanWrapper } = createSection(container, "Google ID Scanner", {
        onToggle: () => saveState()
    });

    const saveState = () => {
        const isOpen = scanWrapper.classList.contains("open");
        const emailVal = emailInput.value;
        if (!isOpen && !emailVal && !lastScanData) {
            resetViewState();
            return;
        }
        saveViewState('emailScanner', {
            isOpen: isOpen,
            email: emailVal,
            result: lastScanData
        });
    };

    const mainContainer = document.createElement("div");
    mainContainer.className = "es-container";

    const inputGroup = document.createElement("div");
    inputGroup.className = "es-input-group";
    const emailInput = document.createElement("input");
    emailInput.type = "text";
    emailInput.className = "es-input";
    emailInput.placeholder = "Enter target email (e.g. name@gmail.com)...";
    emailInput.addEventListener('input', saveState);
    inputGroup.appendChild(emailInput);

    const disclaimer = document.createElement("div");
    disclaimer.style.cssText = "font-size: 11px; color: var(--es-text-muted); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;";
    disclaimer.innerHTML = `<span style="color: #fbbf24;">⚠️</span> You must be logged into Gmail in this browser.`;

    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.flexDirection = "column";
    btnGroup.style.gap = "8px";

    const scrapeBtn = document.createElement("button");
    scrapeBtn.className = "es-btn es-btn-primary es-btn-block";
    scrapeBtn.textContent = "Scan via Gmail";

    btnGroup.appendChild(scrapeBtn);

    const resultArea = document.createElement("div");
    resultArea.className = "es-result-area";

    let tabIdToRemove = null;

    function gmailNetworkSniffer(targetEmail) {
        return new Promise((resolve) => {
            let found = false;
            try { window.onbeforeunload = null; } catch (e) { }

            function processContent(content) {
                if (found) return;
                if (content && typeof content === 'string' && content.includes(targetEmail)) {
                    // 1. Strict Context-Aware Extraction
                    const strictRegex = new RegExp(`"(\\d{21})"[^\\[\\]]*?"${targetEmail}"`, 'i');
                    const match = strictRegex.exec(content);
                    if (match && match[1]) {
                        found = true;
                        resolve({ success: true, id: match[1], confidence: "High (Context Validated)" });
                        return;
                    }

                    // 2. Fallback Proximity Guess
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
                if (typeof url === 'string' && (url.includes('google.com') || url.includes('googleapis.com') || url.startsWith('/'))) {
                    this.addEventListener('load', function () { processContent(this.responseText); });
                }
                originalOpen.apply(this, arguments);
            };

            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
                const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
                const response = await originalFetch(...args);
                if (url.includes('google.com') || url.includes('googleapis.com') || url.startsWith('/')) {
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

    async function tryGmailMethod(email) {
        showLoading(resultArea, 'gmail');

        let tab = await chrome.tabs.create({
            url: `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeURIComponent(email)}`,
            active: false
        });
        tabIdToRemove = tab.id;

        await new Promise((resolve, reject) => {
            const listener = (tid, changeInfo, t) => {
                if (tid === tab.id && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
            setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }, 10000);
        });

        try {
            const injectionResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: gmailNetworkSniffer,
                args: [email]
            });

            if (injectionResults?.[0]?.result) {
                return injectionResults[0].result;
            }
            return { success: false, reason: "No result returned from targeted sniffer." };
        } catch (err) {
            return { success: false, reason: err.message };
        }
    }

    scrapeBtn.addEventListener("click", async () => {
        const email = emailInput.value.trim();
        if (!email.includes("@")) { flashButton(scrapeBtn, "Invalid Email", true); return; }

        scrapeBtn.disabled = true;

        try {
            const result = await tryGmailMethod(email);
            lastScanData = result;
            renderResult(resultArea, result, email);
            saveState();
        } catch (e) {
            renderResult(resultArea, { success: false, reason: e.message }, email);
        } finally {
            if (tabIdToRemove) chrome.tabs.remove(tabIdToRemove).catch(() => { });
            scrapeBtn.disabled = false;
        }
    });

    mainContainer.appendChild(inputGroup);
    mainContainer.appendChild(disclaimer);
    mainContainer.appendChild(btnGroup);
    mainContainer.appendChild(resultArea);

    scanWrapper.appendChild(mainContainer);

}

async function sha1(str) {
    const buffer = new TextEncoder("utf-8").encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
