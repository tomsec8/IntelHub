import { brw, getCurrentTab, isFirefox, flashButton, createSection, saveViewState, resetViewState } from './utils.js';

let lastFingerprintData = null;

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
    
    // Clean domain
    domain = domain.replace(/^https?:\/\//, '').split('/')[0];
    domain = getRootDomain(domain);

    const result = {
        success: true,
        targetDomain: domain,
        dnsRecords: [],
        ipAddresses: [],
        externalAnalysisLinks: {
            whois: `https://www.whois.com/whois/${domain}`,
            techStack: `https://w3techs.com/sites/info/${domain}`,
            subdomains: `https://osint.sh/subdomain/`
        }
    };

    try {
        // Fetch DNS A Records via Google DoH
        const dnsRes = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
        if (dnsRes.ok) {
            const dnsData = await dnsRes.json();
            if (dnsData.Answer) {
                result.ipAddresses = dnsData.Answer.map(a => a.data);
                result.dnsRecords = dnsData.Answer;
            }
        }
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

function renderFingerprintBox(result) {
    const resultContainer = document.getElementById("categoryButtons");
    const existing = document.getElementById("fingerprintResult");
    if (existing) existing.remove();

    const box = document.createElement("div");
    box.id = "fingerprintResult";
    box.style.background = "#2c1e3f";
    box.style.color = "#ffcc99";
    box.style.padding = "12px";
    box.style.marginTop = "10px";
    box.style.borderRadius = "12px";
    box.style.fontSize = "13px";
    box.style.maxHeight = "300px";
    box.style.overflowY = "auto";

    const title = document.createElement("div");
    title.textContent = "Website Fingerprint";
    title.style.fontWeight = "bold";
    title.style.fontSize = "14px";
    title.style.marginBottom = "10px";
    title.style.textAlign = "center";
    box.appendChild(title);

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy All";
    copyBtn.style.marginBottom = "10px";
    copyBtn.className = "sub-category-button";
    copyBtn.addEventListener("click", () => {
        const lines = [];
        for (const key in result) { lines.push(`${key}: ${result[key]}`); }
        navigator.clipboard.writeText(lines.join("\n")).then(() => {
            flashButton(copyBtn, "Copied!");
        });
    });
    box.appendChild(copyBtn);

    const table = document.createElement("table");
    for (const key in result) {
        const row = document.createElement("tr");
        const cellKey = document.createElement("td");
        cellKey.textContent = key;
        cellKey.style.fontWeight = "bold";
        cellKey.style.padding = "6px";
        const cellVal = document.createElement("td");
        cellVal.textContent = result[key];
        cellVal.style.padding = "6px";
        cellVal.style.cursor = "pointer";
        cellVal.title = "Click to copy";
        cellVal.addEventListener("click", () => {
            navigator.clipboard.writeText(result[key]);
            cellVal.textContent = "Copied!";
            setTimeout(() => (cellVal.textContent = result[key]), 1000);
        });
        row.appendChild(cellKey);
        row.appendChild(cellVal);
        table.appendChild(row);
    }
    box.appendChild(table);
    resultContainer.appendChild(box);
}

export function restoreSiteAnalyzerView(container, state) {
    if (state.mainOpen) {
        const siteBtn = Array.from(container.querySelectorAll('.category-button')).find(btn => btn.textContent === "Site, Link & Archive");
        if (siteBtn) {
            const siteWrapper = siteBtn.nextElementSibling;
            if (siteWrapper) {
                siteWrapper.classList.add("open");
            }
        }
    }

    if (state.fingerprintData) {
        lastFingerprintData = state.fingerprintData;
        renderFingerprintBox(lastFingerprintData);
    }
}

export function initializeSiteAnalyzer(container) {
    function saveSiteAnalyzerState() {
        const isMainOpen = siteWrapper.classList.contains("open");
        if (!isMainOpen) {
            resetViewState();
            return;
        }
        saveViewState('siteAnalyzer', {
            mainOpen: isMainOpen,
            fingerprintData: lastFingerprintData
        });
    }

    const { wrapper: siteWrapper } = createSection(container, "Site, Link & Archive", {
        onToggle: (isOpen) => {
            if (!isOpen) {
                const existing = document.getElementById("fingerprintResult");
                if (existing) existing.remove();
                lastFingerprintData = null;
            }
            saveSiteAnalyzerState();
        }
    });

    // ============================================================
    // 1. Site Analysis Tools
    // ============================================================

    const fingerprintBtn = document.createElement("button");
    fingerprintBtn.className = "sub-category-button";
    fingerprintBtn.textContent = "Website Fingerprint";
    fingerprintBtn.addEventListener("click", async () => {
        try {
            const tab = await getCurrentTab();
            const results = await brw.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => ({
                    "User-Agent": navigator.userAgent,
                    "Platform": navigator.platform,
                    "Cookies": document.cookie
                })
            });
            const result = results?.[0]?.result;
            if (!result) {
                flashButton(fingerprintBtn, "Failed", true);
                return;
            }

            lastFingerprintData = result;
            renderFingerprintBox(result);
            saveSiteAnalyzerState();

        } catch (error) {
            console.error("Error executing script:", error);
            flashButton(fingerprintBtn, "Error", true);
        }
    });
    siteWrapper.appendChild(fingerprintBtn);

    const whoisBtn = document.createElement("button");
    whoisBtn.className = "sub-category-button";
    whoisBtn.textContent = "WHOIS & DNS Lookup";
    whoisBtn.addEventListener("click", async () => {
        try {
            const tab = await getCurrentTab();
            const domain = getRootDomain(new URL(tab.url).hostname);
            brw.tabs.create({ url: `https://www.whois.com/whois/${domain}` });
            brw.tabs.create({ url: `https://dnschecker.org/all-dns-records-of-domain.php?query=${domain}&rtype=ALL&dns=google` });
        } catch (e) { console.error("Failed to perform WHOIS lookup:", e); }
    });
    siteWrapper.appendChild(whoisBtn);

    const techBtn = document.createElement("button");
    techBtn.className = "sub-category-button";
    techBtn.textContent = "Technology Detection";
    techBtn.addEventListener("click", async () => {
        try {
            const tab = await getCurrentTab();
            const domain = getRootDomain(new URL(tab.url).hostname);
            brw.tabs.create({ url: `https://w3techs.com/sites/info/${domain}` });
        } catch (e) { console.error("Could not get current tab for tech detection:", e); }
    });
    siteWrapper.appendChild(techBtn);

    const subdomainBtn = document.createElement("button");
    subdomainBtn.className = "sub-category-button";
    subdomainBtn.textContent = "Subdomain Finder";
    subdomainBtn.addEventListener("click", () => {
        brw.tabs.create({ url: "https://osint.sh/subdomain/" });
    });
    siteWrapper.appendChild(subdomainBtn);

    const savePageBtn = document.createElement("button");
    savePageBtn.className = "sub-category-button";
    savePageBtn.textContent = "Save Page Offline";
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
    siteWrapper.appendChild(savePageBtn);

    // ============================================================
    // SEPARATOR: Link Tools
    // ============================================================
    const separator1 = document.createElement('div');
    separator1.textContent = "Link Analysis";
    separator1.style.color = "#aaa";
    separator1.style.fontSize = "11px";
    separator1.style.marginTop = "10px";
    separator1.style.marginBottom = "5px";
    separator1.style.borderBottom = "1px solid #444";
    siteWrapper.appendChild(separator1);

    // 1. Unshorten URL
    const shortenerBtn = document.createElement("button");
    shortenerBtn.className = "sub-category-button";
    shortenerBtn.textContent = "Unshorten URL";
    shortenerBtn.addEventListener("click", () => {
        const oldForm = siteWrapper.querySelector("#unshorten-form");
        if (oldForm) { oldForm.remove(); return; }

        const form = document.createElement("div");
        form.id = "unshorten-form";
        form.style.background = "#2c1e3f"; form.style.padding = "10px"; form.style.marginTop = "10px"; form.style.borderRadius = "8px";

        // Privacy Consent UI
        const consentContainer = document.createElement("div");
        consentContainer.style.margin = "0 0 10px 0";
        consentContainer.style.borderRadius = "8px";
        consentContainer.style.width = "100%";
        consentContainer.style.textAlign = "left";
        consentContainer.style.fontSize = "11px";
        consentContainer.style.transition = "all 0.3s ease";
        consentContainer.style.cursor = "pointer";
        
        const consentLabel = document.createElement("label");
        consentLabel.style.display = "flex";
        consentLabel.style.gap = "6px";
        consentLabel.style.cursor = "pointer";

        const consentCheckbox = document.createElement("input");
        consentCheckbox.type = "checkbox";
        consentCheckbox.id = "privacy-consent-unshorten";
        consentCheckbox.style.marginTop = "2px";
        
        const consentText = document.createElement("span");
        
        function setCompactMode(isCompact) {
            if (isCompact) {
                consentContainer.style.background = "rgba(186, 220, 88, 0.1)";
                consentContainer.style.border = "1px solid rgba(186, 220, 88, 0.4)";
                consentContainer.style.color = "#badc58";
                consentContainer.style.padding = "4px 8px";
                consentLabel.style.alignItems = "center";
                consentCheckbox.style.display = "none";
                consentText.innerHTML = "✓ Privacy Terms Accepted <span style='font-size:9px; color:#888;'>(Click to expand)</span>";
            } else {
                consentContainer.style.background = "rgba(255, 107, 107, 0.1)";
                consentContainer.style.border = "1px dashed rgba(255, 107, 107, 0.4)";
                consentContainer.style.color = "#ffcc99";
                consentContainer.style.padding = "8px";
                consentLabel.style.alignItems = "flex-start";
                consentCheckbox.style.display = "block";
                consentText.innerHTML = "<b>Privacy Terms:</b> This feature dynamically requests permission to read URLs across all sites to securely bypass CORS natively. Data remains local.";
            }
        }

        brw.storage.local.get({ privacyConsentUnshorten: false }, (data) => {
            consentCheckbox.checked = data.privacyConsentUnshorten;
            setCompactMode(data.privacyConsentUnshorten);
        });

        consentCheckbox.addEventListener("change", (e) => {
            brw.storage.local.set({ privacyConsentUnshorten: e.target.checked });
            if (e.target.checked) setCompactMode(true);
        });

        consentContainer.addEventListener("click", (e) => {
            if (consentCheckbox.checked && e.target !== consentCheckbox) {
                setCompactMode(false);
            }
        });

        consentLabel.appendChild(consentCheckbox);
        consentLabel.appendChild(consentText);
        consentContainer.appendChild(consentLabel);

        const inputGroup = document.createElement("div");
        inputGroup.innerHTML = `
            <label style="display:block; margin-bottom:6px;">Enter shortened URL:</label>
            <input id="short-url-input" type="text" style="width: calc(100% - 12px); margin-bottom:10px; background-color: #1f1530; color: white; border: 1px solid #555; padding: 5px; border-radius: 5px;" placeholder="e.g. https://bit.ly/..." />
            <button id="unshorten-now-btn" class="sub-category-button" style="width: auto; padding: 6px 12px;">Unshorten</button>
            <div id="unshorten-result" style="margin-top:10px; color: #ffcc99; word-break: break-all;"></div>
        `;

        form.appendChild(consentContainer);
        form.appendChild(inputGroup);

        shortenerBtn.parentNode.insertBefore(form, shortenerBtn.nextSibling);

        form.querySelector("#unshorten-now-btn").addEventListener("click", async (e) => {
            if (!consentCheckbox.checked) {
                flashButton(e.target, "Accept Privacy Terms!", true);
                return;
            }

            const url = form.querySelector("#short-url-input").value.trim();
            const resultDiv = form.querySelector("#unshorten-result");
            resultDiv.innerHTML = '';

            if (!url.startsWith("http")) {
                resultDiv.textContent = "Please enter a valid URL.";
                return;
            }

            try {
                const granted = await new Promise((resolve) => {
                    chrome.permissions.contains({ origins: ['<all_urls>'] }, (hasPerm) => {
                        if (hasPerm) resolve(true);
                        else chrome.permissions.request({ origins: ['<all_urls>'] }, resolve);
                    });
                });

                if (!granted) {
                    resultDiv.textContent = "Permission denied. Cannot resolve URL.";
                    return;
                }
            } catch (err) {
                resultDiv.textContent = "Error requesting permissions.";
                return;
            }

            resultDiv.textContent = "🔍 Checking...";

            try {
                // Native resolution bypassing CORS via requested extension privileges
                const res = await fetch(url, { method: "HEAD", redirect: "follow" });
                const finalUrl = res.url;

                resultDiv.innerHTML = '';
                
                // Validate finalUrl is HTTP/HTTPS
                if (!finalUrl || !finalUrl.startsWith("http")) {
                    resultDiv.textContent = "Invalid resolved URL.";
                    return;
                }

                const b = document.createElement('b');
                b.textContent = "Original URL: ";
                const a = document.createElement('a');
                a.href = finalUrl;
                a.target = "_blank";
                a.style.color = "lightblue";
                a.textContent = finalUrl;

                resultDiv.appendChild(b);
                resultDiv.appendChild(a);
            } catch (err) {
                console.error("Unshorten Native Error:", err);
                resultDiv.textContent = "Resolution failed or was blocked by the destination.";
            }
        });
    });
    siteWrapper.appendChild(shortenerBtn);

    // 2. Scan for Viruses
    const scanBtn = document.createElement("button");
    scanBtn.className = "sub-category-button";
    scanBtn.textContent = "Scan for Viruses";
    scanBtn.addEventListener("click", () => {
        const oldForm = siteWrapper.querySelector("#scan-form");
        if (oldForm) { oldForm.remove(); return; }

        const form = document.createElement("div");
        form.id = "scan-form";
        form.style.background = "#2c1e3f"; form.style.padding = "10px"; form.style.marginTop = "10px"; form.style.borderRadius = "8px";

        form.innerHTML = `
            <label style="display:block; margin-bottom:6px;">Enter URL to scan:</label>
            <input id="scan-url-input" type="text" style="width: calc(100% - 12px); margin-bottom:10px; background-color: #1f1530; color: white; border: 1px solid #555; padding: 5px; border-radius: 5px;" placeholder="e.g. https://example.com" />
            <button id="scan-now-btn" class="sub-category-button" style="width: auto; padding: 6px 12px;">Scan</button>
            <div id="scan-result" style="margin-top:10px;"></div>
        `;
        scanBtn.parentNode.insertBefore(form, scanBtn.nextSibling);

        form.querySelector("#scan-now-btn").addEventListener("click", () => {
            const url = form.querySelector("#scan-url-input").value.trim();
            const resultDiv = form.querySelector("#scan-result");
            resultDiv.innerHTML = '';

            if (!url) {
                resultDiv.textContent = "Please enter a URL.";
                return;
            }

            let domain;
            try {
                domain = new URL(url).hostname;
            } catch (e) {
                resultDiv.textContent = "Invalid URL format.";
                return;
            }

            const scanUrl = `https://www.virustotal.com/gui/domain/${encodeURIComponent(domain)}`;
            const b = document.createElement('b');
            b.textContent = "VirusTotal Scan: ";
            const a = document.createElement('a');
            a.href = scanUrl;
            a.target = "_blank";
            a.style.color = "lightblue";
            a.textContent = `Open report for ${domain}`;

            resultDiv.appendChild(b);
            resultDiv.appendChild(a);
        });
    });
    siteWrapper.appendChild(scanBtn);


    // ============================================================
    // SEPARATOR: Archive Tools
    // ============================================================
    const separator2 = document.createElement('div');
    separator2.textContent = "Archive & History";
    separator2.style.color = "#aaa";
    separator2.style.fontSize = "11px";
    separator2.style.marginTop = "10px";
    separator2.style.marginBottom = "5px";
    separator2.style.borderBottom = "1px solid #444";
    siteWrapper.appendChild(separator2);

    // Archive Logic
    const archiveEngineState = {};
    const archiveEngineContainer = document.createElement("div");
    archiveEngineContainer.style.margin = "10px auto";
    archiveEngineContainer.style.padding = "5px";
    archiveEngineContainer.style.textAlign = "left";
    archiveEngineContainer.style.background = "#2c1e3f";
    archiveEngineContainer.style.borderRadius = "10px";
    archiveEngineContainer.style.color = "#ffcc99";
    archiveEngineContainer.style.width = "90%";
    archiveEngineContainer.innerHTML = `<div style="text-align:center; font-weight:bold; margin-bottom:6px;">Choose Archive Engines</div>`;

    brw.storage.local.get({ archiveEngines: ['Wayback Machine'] }, (data) => {
        const saved = data.archiveEngines;
        archiveEngines.forEach(opt => {
            const label = document.createElement("label");
            label.style.display = "block";
            label.style.margin = "4px";
            const box = document.createElement("input");
            box.type = "checkbox";
            box.checked = saved.includes(opt.name);
            box.style.marginRight = "6px";
            archiveEngineState[opt.name] = box;
            label.appendChild(box);
            label.appendChild(document.createTextNode(opt.name));
            archiveEngineContainer.appendChild(label);
        });
    });

    setInterval(() => {
        const selected = Object.entries(archiveEngineState)
            .filter(([name, el]) => el.checked)
            .map(([name]) => name);
        brw.storage.local.set({ archiveEngines: selected });
    }, 1000);

    const performArchiveSearch = async (url) => {
        try {
            const data = await brw.storage.local.get({ archiveEngines: ['Wayback Machine'] });
            const selected = data.archiveEngines;
            const engines = archiveEngines.filter(e => selected.includes(e.name));

            if (engines.length === 0) {
                // Fallback if no visual error can be shown easily or maybe flash the button that called it
                return false;
            }

            engines.forEach(engine => {
                brw.tabs.create({ url: engine.url(url), active: false });
            });
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const currentPageBtn = document.createElement("button");
    currentPageBtn.className = "sub-category-button";
    currentPageBtn.textContent = "Search in Archives (Current Page)";
    currentPageBtn.addEventListener("click", async () => {
        try {
            const tab = await getCurrentTab();
            const url = tab.url;
            if (!await performArchiveSearch(url)) {
                flashButton(currentPageBtn, "Select Engine!", true);
            }
        } catch (e) {
            flashButton(currentPageBtn, "Error", true);
        }
    });

    const manualUrlBtn = document.createElement("button");
    manualUrlBtn.className = "sub-category-button";
    manualUrlBtn.textContent = "Search in Archives (By URL)";
    manualUrlBtn.addEventListener("click", () => {
        const existingForm = siteWrapper.querySelector("#archive-manual-form");
        if (existingForm) {
            existingForm.remove();
            return;
        }

        const form = document.createElement("div");
        form.id = "archive-manual-form";
        form.style.background = "#2c1e3f";
        form.style.padding = "10px";
        form.style.marginTop = "10px";
        form.style.borderRadius = "8px";

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Enter URL (e.g. https://example.com)...";
        input.style.width = "calc(100% - 16px)";
        input.style.padding = "8px";
        input.style.marginBottom = "8px";
        input.style.borderRadius = "4px";
        input.style.border = "1px solid #555";
        input.style.backgroundColor = "#1a1a2e";
        input.style.color = "#fff";

        const goBtn = document.createElement("button");
        goBtn.textContent = "Search";
        goBtn.className = "sub-category-button";
        goBtn.style.width = "auto";
        goBtn.style.padding = "6px 12px";

        goBtn.addEventListener("click", async () => {
            const urlVal = input.value.trim();
            if (!urlVal || !urlVal.startsWith("http")) {
                flashButton(goBtn, "Invalid URL", true);
                return;
            }

            if (!await performArchiveSearch(urlVal)) {
                flashButton(goBtn, "Select Engine!", true);
            }
        });

        // Allow 'Enter' key to trigger search
        input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") goBtn.click();
        });

        form.appendChild(input);
        form.appendChild(goBtn);

        // Insert after the manual button
        manualUrlBtn.parentNode.insertBefore(form, manualUrlBtn.nextSibling);
    });

    siteWrapper.appendChild(archiveEngineContainer);
    siteWrapper.appendChild(currentPageBtn);
    siteWrapper.appendChild(manualUrlBtn);


}