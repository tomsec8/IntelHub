import { brw, createSection, saveViewState, resetViewState } from './utils.js';

export function restoreOsintToolsView(container, state) {
    if (state.mainOpen) {
        const osintBtn = Array.from(container.querySelectorAll('.category-button')).find(btn => btn.textContent === "OSINT TOOLS");
        if (osintBtn) {
            const osintWrapper = osintBtn.nextElementSibling;
            if (osintWrapper) {
                osintWrapper.classList.add("open");

                if (state.openSubCategories && state.openSubCategories.length > 0) {
                    state.openSubCategories.forEach(subCategoryName => {
                        const subButton = Array.from(osintWrapper.querySelectorAll('.sub-category-button')).find(btn => btn.textContent === subCategoryName);
                        if (subButton) {
                            const toolsWrapper = subButton.nextElementSibling;
                            if (toolsWrapper) {
                                toolsWrapper.classList.add("open");
                            }
                        }
                    });
                }
            }
        }
    }
}

export function initializeOsintTools(container, toolsData, refreshCallback) {
    const subCategoryElements = [];

    function saveOsintState() {
        const isMainOpen = osintWrapper.classList.contains("open");
        if (!isMainOpen) {
            resetViewState();
            return;
        }
        const openSubCategories = subCategoryElements
            .filter(item => item.toolsWrapper.classList.contains("open"))
            .map(item => item.subCategoryName);
        saveViewState('osintTools', {
            mainOpen: isMainOpen,
            openSubCategories: openSubCategories
        });
    }

    const { wrapper: osintWrapper } = createSection(container, "OSINT TOOLS", {
        onToggle: () => saveOsintState()
    });

    // ------------------------------------------
    // New: Visual Explorer Button
    // ------------------------------------------
    const visualBtn = document.createElement("button");
    visualBtn.className = "sub-category-button";
    visualBtn.style.background = "linear-gradient(45deg, #3700b3, #03dac6)";
    visualBtn.style.fontWeight = "bold";
    visualBtn.textContent = "Launch Visual Explorer";

    visualBtn.addEventListener("click", () => {
        brw.tabs.create({ url: "modules/visualExplorer/index.html" });
    });

    osintWrapper.appendChild(visualBtn);
    // ------------------------------------------

    const sortedCategories = Object.keys(toolsData).sort((a, b) => a.localeCompare(b));

    for (const subCategory of sortedCategories) {
        if (!toolsData[subCategory]?.length) continue;

        const subButton = document.createElement("button");
        subButton.className = "sub-category-button";
        subButton.textContent = subCategory;

        const toolsWrapper = document.createElement("div");
        toolsWrapper.className = "tool-list";

        subCategoryElements.push({
            subCategoryName: subCategory,
            toolsWrapper: toolsWrapper
        });

        subButton.addEventListener("click", (e) => {
            e.stopPropagation();
            toolsWrapper.classList.toggle("open");
            saveOsintState();
        });

        const sortedTools = [...toolsData[subCategory]].sort((a, b) => a.name.localeCompare(b.name));

        sortedTools.forEach((tool) => {
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

            brw.storage.local.get({ favorites: {} }, (data) => {
                let favorites = data.favorites;
                if (Array.isArray(favorites)) {
                    favorites = { "__uncategorized__": favorites };
                }

                let isFav = false;
                for (const category in favorites) {
                    if (favorites[category].some(f => f.url === tool.url)) {
                        isFav = true;
                        break;
                    }
                }

                if (isFav) starBtn.innerHTML = "⭐";
            });

            starBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                brw.storage.local.get({ favorites: {} }, (data) => {
                    let favorites = data.favorites;
                    if (Array.isArray(favorites)) {
                        favorites = { "__uncategorized__": favorites };
                    }

                    let found = false;
                    let favCategory = null;
                    let favIndex = -1;

                    for (const category in favorites) {
                        const index = favorites[category].findIndex(f => f.url === tool.url);
                        if (index > -1) {
                            found = true;
                            favCategory = category;
                            favIndex = index;
                            break;
                        }
                    }

                    if (found) {
                        favorites[favCategory].splice(favIndex, 1);
                        starBtn.innerHTML = "☆";
                    } else {
                        const defaultCategory = "General";
                        if (!favorites[defaultCategory]) {
                            favorites[defaultCategory] = [];
                        }
                        favorites[defaultCategory].push(tool);
                        starBtn.innerHTML = "⭐";
                    }
                    brw.storage.local.set({ favorites });
                });
            });

            toolCard.addEventListener("click", () => {
                try {
                    const parsed = new URL(tool.url);
                    if (parsed.protocol === 'https:') {
                        brw.tabs.create({ url: parsed.href, active: false });
                    } else {
                        console.warn('Blocked non-HTTPS URL execution:', tool.url);
                    }
                } catch(e) {
                    console.error('Invalid URL:', tool.url);
                }
            });
            toolCard.appendChild(starBtn);
            toolsWrapper.appendChild(toolCard);
        });

        osintWrapper.appendChild(subButton);
        osintWrapper.appendChild(toolsWrapper);
    }


}