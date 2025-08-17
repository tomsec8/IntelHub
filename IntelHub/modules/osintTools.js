// modules/osintTools.js

import { brw } from './utils.js';

// The function now accepts a 'refreshCallback' to trigger an update
export function initializeOsintTools(container, toolsData, refreshCallback) {
    const headerWrapper = document.createElement('div');
    headerWrapper.style.position = 'relative';
    headerWrapper.style.display = 'flex';
    headerWrapper.style.alignItems = 'center';
    headerWrapper.style.width = '90%'; // Match parent button width
    headerWrapper.style.margin = '8px auto'; // Match parent button margin

    const osintBtn = document.createElement("button");
    osintBtn.className = "category-button";
    osintBtn.textContent = "OSINT TOOLS";
    osintBtn.style.width = '100%';
    osintBtn.style.margin = '0';

    // --- Refresh Button ---
    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "🔄";
    refreshBtn.title = "Refresh Tools List";
    refreshBtn.style.position = 'absolute';
    refreshBtn.style.right = '15px';
    refreshBtn.style.top = '50%';
    refreshBtn.style.transform = 'translateY(-50%)';
    refreshBtn.style.background = 'none';
    refreshBtn.style.border = 'none';
    refreshBtn.style.color = '#ff8c42';
    refreshBtn.style.fontSize = '18px';
    refreshBtn.style.cursor = 'pointer';
    refreshBtn.style.padding = '5px';

    refreshBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent the main button from toggling
        refreshCallback(); // Call the function passed from popup.js
    });

    headerWrapper.appendChild(osintBtn);
    headerWrapper.appendChild(refreshBtn);
    
    const osintWrapper = document.createElement("div");
    osintWrapper.className = "tool-list";

    osintBtn.addEventListener("click", () => {
        osintWrapper.classList.toggle("open");
    });

    for (const subCategory in toolsData) {
        if (!toolsData[subCategory]?.length) continue;

        const subButton = document.createElement("button");
        subButton.className = "sub-category-button";
        subButton.textContent = subCategory;

        const toolsWrapper = document.createElement("div");
        toolsWrapper.className = "tool-list";

        subButton.addEventListener("click", (e) => {
            e.stopPropagation();
            toolsWrapper.classList.toggle("open");
        });

        toolsData[subCategory].forEach((tool) => {
            const toolCard = document.createElement("div");
            toolCard.className = "tool-card";
            toolCard.title = tool.description;
            toolCard.style.position = "relative";
            
            const toolText = document.createElement("span");
            toolText.textContent = tool.name;
            toolCard.appendChild(toolText);
            
            const starBtn = document.createElement("span");
            starBtn.innerHTML = "☆";
            starBtn.style.position = "absolute";
            starBtn.style.top = "8px";
            starBtn.style.right = "10px";
            starBtn.style.cursor = "pointer";
            starBtn.style.fontSize = "16px";

            brw.storage.local.get("favorites", (data) => {
                const isFav = (data.favorites || []).some(f => f.name === tool.name && f.url === tool.url);
                if (isFav) starBtn.innerHTML = "⭐";
            });

            starBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                brw.storage.local.get({favorites: []}, (data) => {
                    let favorites = data.favorites;
                    const favIndex = favorites.findIndex(f => f.name === tool.name && f.url === tool.url);
                    
                    if (favIndex > -1) {
                        favorites.splice(favIndex, 1);
                        starBtn.innerHTML = "☆";
                    } else {
                        favorites.push(tool);
                        starBtn.innerHTML = "⭐";
                    }
                    brw.storage.local.set({ favorites });
                });
            });
            
            toolCard.addEventListener("click", () => window.open(tool.url, "_blank"));
            toolCard.appendChild(starBtn);
            toolsWrapper.appendChild(toolCard);
        });

        osintWrapper.appendChild(subButton);
        osintWrapper.appendChild(toolsWrapper);
    }

    container.appendChild(headerWrapper);
    container.appendChild(osintWrapper);
}
