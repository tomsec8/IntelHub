import { brw, isFirefox, flashButton, closeExtensionPopup, createPopupSelect } from './utils.js';

// Favorites can be typed by hand or imported from a shared JSON file, so every
// URL is re-checked before it is stored and again before a tab is opened.
// Anything that is not plain http(s) (javascript:, data:, blob:, chrome:) is dropped.
function safeToolUrl(raw) {
    try {
        const parsed = new URL(String(raw || '').trim());
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
        return parsed.href;
    } catch {
        return '';
    }
}

export function initializeFavorites(parentWrapper, renderMenuCallback) {

    const controlsWrapper = document.createElement('div');
    controlsWrapper.style.padding = '10px 0';

    const addCategoryBtn = document.createElement("button");
    addCategoryBtn.textContent = "＋ New Category";
    addCategoryBtn.className = "sub-category-button";

    const addCategoryForm = document.createElement('div');
    addCategoryForm.style.display = 'none';
    addCategoryForm.style.padding = '10px';
    addCategoryForm.innerHTML = `
        <input type="text" id="newCategoryName" placeholder="Category Name" style="width: 90%; margin-bottom: 5px;">
        <button id="saveNewCategory" class="sub-category-button" style="width: 45%;">Save</button>
        <button id="cancelNewCategory" class="sub-category-button" style="width: 45%; border-color: #ccc; color: #ccc;">Cancel</button>
    `;

    addCategoryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addCategoryForm.style.display = addCategoryForm.style.display === 'none' ? 'block' : 'none';
    });

    addCategoryForm.querySelector('#saveNewCategory').addEventListener('click', (e) => {
        e.stopPropagation();
        const saveBtn = e.target;
        const newCatName = addCategoryForm.querySelector('#newCategoryName').value.trim();

        if (!newCatName || newCatName === "__uncategorized__") {
            flashButton(saveBtn, "Invalid Name", true);
            return;
        }

        brw.storage.local.get({ favorites: {} }, (data) => {
            let favorites = data.favorites;
            if (!favorites[newCatName]) {
                favorites[newCatName] = [];
                brw.storage.local.set({ favorites }, () => {
                    addCategoryForm.style.display = 'none';
                    addCategoryForm.querySelector('#newCategoryName').value = '';
                    renderMenuCallback();
                });
            } else {
                flashButton(saveBtn, "Exists!", true);
            }
        });
    });

    addCategoryForm.querySelector('#cancelNewCategory').addEventListener('click', (e) => {
        e.stopPropagation();
        addCategoryForm.style.display = 'none';
    });

    const addToolBtn = document.createElement("button");
    addToolBtn.textContent = "＋ Add Custom Tool";
    addToolBtn.className = "sub-category-button";

    const addToolForm = document.createElement("div");
    addToolForm.style.display = "none";
    addToolForm.style.padding = "10px";
    const categorySelect = createPopupSelect({
        className: 'opsec-proxy-select',
        options: [{ value: '', label: 'No Category' }]
    });
    categorySelect.el.id = 'customToolCategory';
    categorySelect.el.style.marginBottom = '5px';
    addToolForm.appendChild(categorySelect.el);
    const extras = document.createElement('div');
    extras.innerHTML = `
        <input type="text" id="customToolName" placeholder="Tool Name" style="width: 90%; margin-bottom: 5px;">
        <input type="text" id="customToolUrl" placeholder="Tool URL" style="width: 90%; margin-bottom: 5px;">
        <textarea id="customToolDesc" placeholder="Description" style="width: 90%; margin-bottom: 5px; background-color: #121826; color: #fff; border: 1px solid #888; border-radius: 8px; padding: 6px;"></textarea>
        <button id="saveCustomTool" class="sub-category-button" style="width: 45%;">Save</button>
        <button id="cancelCustomTool" class="sub-category-button" style="width: 45%; border-color: #ccc; color: #ccc;">Cancel</button>
    `;
    addToolForm.append(...extras.children);
    addToolForm._categorySelect = categorySelect;

    addToolBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addToolForm.style.display = addToolForm.style.display === 'none' ? 'block' : 'none';
    });

    addToolForm.querySelector('#cancelCustomTool').addEventListener('click', (e) => {
        e.stopPropagation();
        addToolForm.style.display = 'none';
    });

    addToolForm.querySelector('#saveCustomTool').addEventListener('click', (e) => {
        e.stopPropagation();
        const saveBtn = e.target;
        const category = (addToolForm._categorySelect?.value || '').trim();
        const name = addToolForm.querySelector('#customToolName').value.trim();
        const url = addToolForm.querySelector('#customToolUrl').value.trim();
        const description = addToolForm.querySelector('#customToolDesc').value.trim();

        if (!name || !url) {
            flashButton(saveBtn, "Missing Info", true);
            return;
        }

        const safeUrl = safeToolUrl(url);
        if (!safeUrl) {
            flashButton(saveBtn, "Invalid URL", true);
            return;
        }

        const newTool = { name, url: safeUrl, description, isCustom: true };

        brw.storage.local.get({ favorites: {} }, (data) => {
            let favorites = data.favorites;
            const targetCategory = category || "__uncategorized__";

            if (!favorites[targetCategory]) favorites[targetCategory] = [];
            favorites[targetCategory].push(newTool);

            brw.storage.local.set({ favorites }, () => {
                addToolForm.style.display = 'none';
                renderMenuCallback();
            });
        });
    });

    controlsWrapper.appendChild(addCategoryBtn);
    controlsWrapper.appendChild(addCategoryForm);
    controlsWrapper.appendChild(addToolBtn);
    controlsWrapper.appendChild(addToolForm);
    parentWrapper.appendChild(controlsWrapper);

    const ieWrapper = document.createElement('div');
    ieWrapper.style.textAlign = 'center';
    ieWrapper.style.marginTop = '10px';

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export';
    exportBtn.className = 'sub-category-button';
    exportBtn.style.width = '45%';
    exportBtn.style.marginRight = '5%';

    const importBtn = document.createElement('button');
    importBtn.textContent = 'Import';
    importBtn.className = 'sub-category-button';
    importBtn.style.width = '45%';

    ieWrapper.appendChild(exportBtn);
    ieWrapper.appendChild(importBtn);
    parentWrapper.appendChild(ieWrapper);

    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        brw.storage.local.get({ favorites: {} }, (data) => {
            if (Object.keys(data.favorites).length === 0) {
                flashButton(exportBtn, "No Favorites", true);
                return;
            }
            const json = JSON.stringify(data.favorites, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            brw.downloads.download({ url, filename: 'intelhub_favorites.json' });
        });
    });

    importBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isFirefox()) {
            brw.tabs.create({ url: 'firefox/import-favorites.html' });
            closeExtensionPopup();
        } else {
            const importInput = document.createElement('input');
            importInput.type = 'file';
            importInput.accept = '.json';
            importInput.style.display = 'none';
            importInput.onchange = (evt) => handleImportFile(evt, importBtn);
            document.body.appendChild(importInput);
            importInput.click();
        }
    });

    function handleImportFile(e, btnElement) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                let importedData = JSON.parse(event.target.result);
                brw.storage.local.get({ favorites: {} }, (data) => {
                    let existingFavs = data.favorites;
                    if (Array.isArray(importedData)) {
                        importedData = { "Imported": importedData };
                    }
                    if (typeof importedData !== 'object' || importedData === null) {
                        throw new Error("Invalid format.");
                    }
                    const allExistingUrls = new Set();
                    Object.values(existingFavs).forEach(arr => arr.forEach(tool => allExistingUrls.add(tool.url)));

                    for (const category in importedData) {
                        if (!Array.isArray(importedData[category])) continue;
                        if (!existingFavs[category]) {
                            existingFavs[category] = [];
                        }
                        importedData[category].forEach(tool => {
                            const safeUrl = safeToolUrl(tool?.url);
                            if (safeUrl && !allExistingUrls.has(safeUrl)) {
                                existingFavs[category].push({ ...tool, url: safeUrl });
                                allExistingUrls.add(safeUrl);
                            }
                        });
                    }
                    brw.storage.local.set({ favorites: existingFavs }, () => {
                        flashButton(btnElement, "Imported!");
                        renderMenuCallback();
                    });
                });
            } catch (error) {
                flashButton(btnElement, "File Error", true);
            }
        };
        reader.readAsText(file);
    }

    brw.storage.local.get({ favorites: [] }, (data) => {
        let favorites = data.favorites;
        if (Array.isArray(favorites)) {
            const migratedFavorites = { "__uncategorized__": favorites };
            brw.storage.local.set({ favorites: migratedFavorites }, () => {
                displayFavorites(migratedFavorites, parentWrapper, renderMenuCallback);
            });
            return;
        }
        displayFavorites(favorites, parentWrapper, renderMenuCallback);
    });


}

function displayFavorites(favoritesData, parentWrapper, renderMenuCallback) {
    const categoryMenu = parentWrapper.querySelector('#customToolName')?.parentElement?._categorySelect;
    const sortedCategories = Object.keys(favoritesData).filter(c => c !== "__uncategorized__").sort();
    if (categoryMenu) {
        categoryMenu.setOptions([
            { value: '', label: 'No Category' },
            ...sortedCategories.map((catName) => ({ value: catName, label: catName }))
        ]);
    }

    const uncategorizedWrapper = document.createElement('div');
    const uncategorizedTools = favoritesData["__uncategorized__"] || [];
    uncategorizedTools.forEach(tool => {
        uncategorizedWrapper.appendChild(createToolCard(tool, "__uncategorized__", favoritesData, renderMenuCallback));
    });
    parentWrapper.appendChild(uncategorizedWrapper);

    sortedCategories.forEach(categoryName => {
        const tools = favoritesData[categoryName];

        const subButton = document.createElement("button");
        subButton.className = "sub-category-button";
        subButton.style.display = 'flex';
        subButton.style.justifyContent = 'space-between';
        subButton.style.alignItems = 'center';

        const categoryText = document.createElement('span');
        categoryText.textContent = `${categoryName} (${tools.length})`;
        subButton.appendChild(categoryText);

        const deleteCategoryBtn = document.createElement('span');
        deleteCategoryBtn.textContent = '🗑️';
        deleteCategoryBtn.title = `Delete '${categoryName}' category`;
        deleteCategoryBtn.style.padding = '0 5px';
        deleteCategoryBtn.style.cursor = 'pointer';
        deleteCategoryBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete the category "${categoryName}" and all ${tools.length} tools in it?`)) {
                delete favoritesData[categoryName];
                brw.storage.local.set({ favorites: favoritesData }, renderMenuCallback);
            }
        };
        subButton.appendChild(deleteCategoryBtn);

        const toolsWrapper = document.createElement("div");
        toolsWrapper.className = "tool-list";

        subButton.addEventListener("click", (e) => {
            if (e.target === deleteCategoryBtn) return;
            const open = toolsWrapper.classList.toggle("open");
            subButton.classList.toggle("is-open", open);
        });

        if (tools.length === 0) {
            const noToolsMsg = document.createElement('div');
            noToolsMsg.textContent = 'No tools in this category yet.';
            noToolsMsg.className = 'tool-card';
            noToolsMsg.style.textAlign = 'center';
            noToolsMsg.style.fontStyle = 'italic';
            noToolsMsg.style.color = '#ccc';
            toolsWrapper.appendChild(noToolsMsg);
        } else {
            tools.forEach((tool) => {
                toolsWrapper.appendChild(createToolCard(tool, categoryName, favoritesData, renderMenuCallback));
            });
        }

        parentWrapper.appendChild(subButton);
        parentWrapper.appendChild(toolsWrapper);
    });
}

function createToolCard(tool, categoryName, favoritesData, renderMenuCallback) {
    const toolCard = document.createElement("div");
    toolCard.className = "tool-card";
    toolCard.title = tool.description;
    toolCard.style.position = "relative";

    const toolText = document.createElement("span");
    toolText.textContent = tool.name;
    toolCard.appendChild(toolText);

    const starBtn = document.createElement("span");
    starBtn.innerHTML = "⭐";
    starBtn.style.position = "absolute";
    starBtn.style.top = "8px";
    starBtn.style.right = "10px";
    starBtn.style.cursor = "pointer";
    starBtn.style.fontSize = "16px";

    starBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        favoritesData[categoryName] = favoritesData[categoryName].filter(f => f.url !== tool.url);
        brw.storage.local.set({ favorites: favoritesData }, renderMenuCallback);
    });

    toolCard.addEventListener("click", () => {
        const safeUrl = safeToolUrl(tool.url);
        if (safeUrl) brw.tabs.create({ url: safeUrl, active: false });
    });
    toolCard.appendChild(starBtn);
    return toolCard;
}