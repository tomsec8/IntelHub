// modules/textProfiler.js

import { brw, getCurrentTab, isFirefox } from './utils.js';

let resultArea;
let profilerLastResults = [];

// Function to open an upload page (for Firefox)
function openUploadPage() {
    brw.tabs.create({ url: 'firefox/text-profiler-upload.html' });
    window.close();
}

// --- Processing and display functions ---

function extractEntities(text) {
    const results = [];
    const found = new Set();
    const patterns = {
        "Facebook Profile": /facebook\.com\/(?:profile\.php\?id=)?([a-zA-Z0-9.]+)/g,
        "Instagram Profile": /instagram\.com\/([a-zA-Z0-9._]+)/g,
        "Twitter Profile": /twitter\.com\/([a-zA-Z0-9_]+)/g,
        "LinkedIn Profile": /linkedin\.com\/in\/([a-zA-Z0-9-]+)/g,
        "TikTok Profile": /tiktok\.com\/@([a-zA-Z0-9._]+)/g,
        "Snapchat Profile": /snapchat\.com\/add\/([a-zA-Z0-9._]+)/g,
        "Reddit Profile": /reddit\.com\/user\/([a-zA-Z0-9_-]+)/g,
        "Threads Profile": /threads\.net\/@([a-zA-Z0-9._]+)/g,
        "Pinterest Profile": /pinterest\.com\/([a-zA-Z0-9._]+)/g,
        "Tumblr Profile": /([a-zA-Z0-9-]+)\.tumblr\.com/g,
        "Telegram Username": /t(?:elegram)?\.me\/([a-zA-Z0-9_]+)/g,
        "WhatsApp Link": /wa\.me\/(\d{6,15})/g,
        "Discord Invite": /discord\.gg\/([a-zA-Z0-9]+)/g,
        "Signal Link": /signal\.me\/#eu\/([a-zA-Z0-9]+)/g,
        "YouTube Channel": /youtube\.com\/(?:c|channel|user)\/([a-zA-Z0-9_-]+)/g,
        "GitHub Profile": /github\.com\/([a-zA-Z0-9_-]+)/g,
        "Email": /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        "Phone": /\+?\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4}/g,
        "BTC Wallet": /\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g,
        "ETH Wallet": /\b0x[a-fA-F0-9]{40}\b/g,
        "URL": /https?:\/\/[^"<>)\s]+/g
    };

    for (const label in patterns) {
        const matches = [...text.matchAll(patterns[label])];
        matches.forEach(match => {
            let val = match[1] || match[0];
            val = val.trim().replace(/[.,;:]$/, '');
            const key = label + "::" + val;
            if (!found.has(key) && val) {
                results.push({ type: label, value: val });
                found.add(key);
            }
        });
    }
    return results;
}

function renderProfilerResults(text) {
    const results = extractEntities(text);
    if (results.length === 0) {
        resultArea.innerHTML = "<p style='text-align:center; color: #ffcc99;'>❌ No identifiable entities found.</p>";
        return;
    }
    profilerLastResults = results;
    resultArea.innerHTML = "";

    const types = [...new Set(results.map(r => r.type))].sort();
    const filterDiv = document.createElement("div");
    filterDiv.style.margin = "10px auto";
    filterDiv.style.textAlign = "center";
    
    const searchInput = document.createElement("input");
    searchInput.placeholder = "Search results...";
    searchInput.style.marginBottom = "8px";
    searchInput.style.padding = "6px";
    searchInput.style.width = "90%";
    searchInput.style.borderRadius = "8px";
    searchInput.style.border = "1px solid #888";
    searchInput.style.background = "#1f1530";
    searchInput.style.color = "#fff";
    filterDiv.appendChild(searchInput);

    const checkboxes = {};
    const checkboxContainer = document.createElement('div');
    checkboxContainer.style.fontSize = '12px';
    types.forEach(type => {
        const label = document.createElement("label");
        label.style.margin = "0 5px";
        label.style.display = "inline-block";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = true;
        box.dataset.type = type;
        checkboxes[type] = box;
        label.appendChild(box);
        label.appendChild(document.createTextNode(" " + type));
        checkboxContainer.appendChild(label);
    });
    filterDiv.appendChild(checkboxContainer);

    resultArea.appendChild(filterDiv);

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.color = "#ffcc99";

    const scrollBox = document.createElement("div");
    scrollBox.className = "profiler-results-container";
    scrollBox.style.maxHeight = '200px';
    scrollBox.style.overflowY = 'auto';
    scrollBox.appendChild(table);
    resultArea.appendChild(scrollBox);

    function renderTable() {
        table.innerHTML = "";
        const query = searchInput.value.toLowerCase();
        results.forEach(({ type, value }) => {
            if (!checkboxes[type].checked) return;
            if (!type.toLowerCase().includes(query) && !value.toLowerCase().includes(query)) return;
            const row = document.createElement("tr");
            row.title = "Click to copy value";
            row.style.cursor = "pointer";
            const td1 = document.createElement("td");
            td1.textContent = type;
            td1.style.fontWeight = "bold";
            td1.style.padding = "6px";
            const td2 = document.createElement("td");
            td2.textContent = value;
            td2.style.padding = "6px";
            row.addEventListener('click', () => {
                navigator.clipboard.writeText(value);
                td2.textContent = "✅ Copied!";
                setTimeout(() => (td2.textContent = value), 1000);
            });
            row.appendChild(td1);
            row.appendChild(td2);
            table.appendChild(row);
        });
    }

    renderTable();
    searchInput.addEventListener("input", renderTable);
    Object.values(checkboxes).forEach(c => c.addEventListener("change", renderTable));
}

export function initializeTextProfiler(container) {
    const profilerBtn = document.createElement("button");
    profilerBtn.className = "category-button";
    profilerBtn.textContent = "Text Profiler";
    const profilerWrapper = document.createElement("div");
    profilerWrapper.className = "tool-list";
    profilerBtn.addEventListener("click", () => profilerWrapper.classList.toggle("open"));

    const pasteBtn = document.createElement("button");
    pasteBtn.className = "sub-category-button";
    pasteBtn.textContent = "Paste Text";
    pasteBtn.addEventListener("click", () => {
        const userInput = prompt("Paste the text to analyze:");
        if (userInput) renderProfilerResults(userInput);
    });

    const uploadBtn = document.createElement("button");
    uploadBtn.className = "sub-category-button";
    uploadBtn.textContent = "Upload TXT / JSON";
    uploadBtn.addEventListener("click", () => {
        if (isFirefox()) {
            openUploadPage();
        } else {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".txt,.json";
            input.style.display = "none";
            input.addEventListener("change", async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const text = await file.text();
                renderProfilerResults(text);
            });
            document.body.appendChild(input);
            input.click();
        }
    });

    const analyzePageBtn = document.createElement("button");
    analyzePageBtn.className = "sub-category-button";
    analyzePageBtn.textContent = "Analyze Current Page";
    analyzePageBtn.addEventListener("click", async () => {
        const tab = await getCurrentTab();
        
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('https://chrome.google.com/')) {
            alert("For security reasons, browser pages and the web store cannot be analyzed.");
            return;
        }

        try {
            await brw.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
            const response = await brw.tabs.sendMessage(tab.id, { action: "extractPageText" });
            if (response && response.text) {
                renderProfilerResults(response.text);
            } else {
                alert("Failed to extract text from page.");
            }
        } catch(e) { 
            console.error("Error analyzing page:", e); 
            alert("Could not analyze this page. It might be a protected page."); 
        }
    });

    const exportBtn = document.createElement("button");
    exportBtn.className = "sub-category-button";
    exportBtn.textContent = "Export as CSV";
    exportBtn.addEventListener("click", () => {
        if (profilerLastResults.length === 0) return alert("No results to export.");
        
        const csvRows = [["Type", "Value"]];
        profilerLastResults.forEach(row => {
            const type = `"${row.type.replace(/"/g, '""')}"`;
            const value = `"${row.value.replace(/"/g, '""')}"`;
            csvRows.push([type, value]);
        });
        const csvContent = csvRows.map(e => e.join(",")).join("\n");

        if (isFirefox()) {
            // Use Blob method for Firefox for reliable downloads without closing the popup
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'extracted_entities.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            // Use downloads API for Chrome to get the "Save As" dialog
            const dataUrl = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
            brw.downloads.download({
                url: dataUrl,
                filename: "extracted_entities.csv",
                saveAs: true
            }).catch(err => console.error("Download failed:", err));
        }
    });

    resultArea = document.createElement("div");
    
    profilerWrapper.appendChild(pasteBtn);
    profilerWrapper.appendChild(uploadBtn);
    profilerWrapper.appendChild(analyzePageBtn);
    profilerWrapper.appendChild(exportBtn);
    profilerWrapper.appendChild(resultArea);

    container.appendChild(profilerBtn);
    container.appendChild(profilerWrapper);
}
