// modules/siteAnalyzer.js

import { brw, getCurrentTab, isFirefox } from './utils.js';

function getRootDomain(hostname) {
    try {
        const parsed = psl.parse(hostname);
        return parsed.domain || hostname;
    } catch {
        return hostname;
    }
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

export function initializeSiteAnalyzer(container) {
    const siteBtn = document.createElement("button");
    siteBtn.className = "category-button";
    siteBtn.textContent = "Site Analyzer";

    const siteWrapper = document.createElement("div");
    siteWrapper.className = "tool-list";

    siteBtn.addEventListener("click", () => {
        siteWrapper.classList.toggle("open");
    });

    // --- Website Fingerprint ---
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
                alert("Failed to retrieve fingerprint.");
                return;
            }
            
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
                copyBtn.textContent = "Copied!";
                setTimeout(() => (copyBtn.textContent = "Copy All"), 1000);
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
        } catch (error) {
            console.error("Error executing script:", error);
            alert("Could not analyze the page.");
        }
    });
    siteWrapper.appendChild(fingerprintBtn);

    // --- WHOIS & DNS Lookup ---
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

    // --- Technology Detection ---
    const techBtn = document.createElement("button");
    techBtn.className = "sub-category-button";
    techBtn.textContent = "Technology Detection";
    techBtn.addEventListener("click", async () => {
        try {
            const tab = await getCurrentTab();
            const domain = getRootDomain(new URL(tab.url).hostname);
            brw.tabs.create({ url: `https://w3techs.com/sites/info/${domain}` });
        } catch(e) { console.error("Could not get current tab for tech detection:", e); }
    });
    siteWrapper.appendChild(techBtn);

    // --- Subdomain Finder ---
    const subdomainBtn = document.createElement("button");
    subdomainBtn.className = "sub-category-button";
    subdomainBtn.textContent = "Subdomain Finder";
    subdomainBtn.addEventListener("click", () => {
        brw.tabs.create({ url: "https://osint.sh/subdomain/" });
    });
    siteWrapper.appendChild(subdomainBtn);

    // --- Save Page Offline ---
    const savePageBtn = document.createElement("button");
    savePageBtn.className = "sub-category-button";
    savePageBtn.textContent = "Save Page Offline";
    savePageBtn.addEventListener("click", async () => {
        if (isFirefox()) {
            alert("This feature is coming soon to Firefox!");
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
            alert("Could not save the page. Please try reloading the page.");
        } finally {
            hideLoadingSpinner();
        }
    });
    siteWrapper.appendChild(savePageBtn);

    container.appendChild(siteBtn);
    container.appendChild(siteWrapper);
}
