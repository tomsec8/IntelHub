// modules/archiveSearch.js

import { brw, getCurrentTab } from './utils.js';

const archiveEngines = [
    { name: "Wayback Machine", url: url => `https://web.archive.org/web/${encodeURIComponent(url)}` },
    { name: "WebCite", url: url => `http://www.webcitation.org/query?url=${encodeURIComponent(url)}` },
    { name: "Archive.today", url: url => `https://archive.today/?run=1&url=${encodeURIComponent(url)}` },
    { name: "Megalodon.jp", url: url => `https://megalodon.jp/?url=${encodeURIComponent(url)}` },
    { name: "Ghostarchive", url: url => `https://ghostarchive.org/search?term=${encodeURIComponent(url)}` }
];

export function initializeArchiveSearch(container) {
    const archiveBtn = document.createElement("button");
    archiveBtn.className = "category-button";
    archiveBtn.textContent = "Archive Search";

    const archiveWrapper = document.createElement("div");
    archiveWrapper.className = "tool-list";

    archiveBtn.addEventListener("click", () => {
        archiveWrapper.classList.toggle("open");
    });

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

    brw.storage.local.get({ archiveEngines: [] }, (data) => {
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

    const currentPageBtn = document.createElement("button");
    currentPageBtn.className = "sub-category-button";
    currentPageBtn.textContent = "Search Archive for Current Page";
    currentPageBtn.addEventListener("click", async () => {
        try {
            const tab = await getCurrentTab();
            const url = tab.url;
            
            const data = await brw.storage.local.get({ archiveEngines: [] });
            const selected = data.archiveEngines;

            const engines = archiveEngines.filter(e => selected.includes(e.name));
            if (engines.length === 0) return alert("No archive engines selected.");

            engines.forEach(engine => {
                const fullUrl = engine.url(url);
                brw.tabs.create({ url: fullUrl }); 
            });
        } catch (e) {
            console.error("Failed to search archives for current page:", e);
        }
    });

    const manualUrlBtn = document.createElement("button");
    manualUrlBtn.className = "sub-category-button";
    manualUrlBtn.textContent = "Search Archive by URL";
    manualUrlBtn.addEventListener("click", async () => {
        const input = prompt("Enter URL to search in archives:");
        if (!input || !input.startsWith("http")) {
            alert("Please enter a valid URL (starting with http/https).");
            return;
        }
        
        try {
            const data = await brw.storage.local.get({ archiveEngines: [] });
            const selected = data.archiveEngines;

            const engines = archiveEngines.filter(e => selected.includes(e.name));
            if (engines.length === 0) return alert("No archive engines selected.");

            engines.forEach(engine => {
                const fullUrl = engine.url(input);
                brw.tabs.create({ url: fullUrl }); 
            });
        } catch (e) {
            console.error("Failed to search archives by URL:", e);
        }
    });

    archiveWrapper.appendChild(currentPageBtn);
    archiveWrapper.appendChild(manualUrlBtn);
    archiveWrapper.appendChild(archiveEngineContainer);
    container.appendChild(archiveBtn);
    container.appendChild(archiveWrapper);
}