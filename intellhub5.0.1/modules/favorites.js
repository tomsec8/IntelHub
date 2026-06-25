import { brw, isFirefox, flashButton, createSection } from './utils.js';

export function initializeFavorites(container, renderMenuCallback) {
    const { btn: favBtn, wrapper: favWrapper } = createSection(container, "Favorites");

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
    addToolForm.innerHTML = `
        <select id="customToolCategory" style="width: 92%; margin-bottom: 5px; background-color: #1f1530; color: #fff; border: 1px solid #888; border-radius: 8px; padding: 6px;"></select>
        <input type="text" id="customToolName" placeholder="Tool Name" style="width: 90%; margin-bottom: 5px;">
        <input type="text" id="customToolUrl" placeholder="Tool URL" style="width: 90%; margin-bottom: 5px;">
        <textarea id="customToolDesc" placeholder="Description" style="width: 90%; margin-bottom: 5px; background-color: #1f1530; color: #fff; border: 1px solid #888; border-radius: 8px; padding: 6px;"></textarea>
        <button id="saveCustomTool" class="sub-category-button" style="width: 45%;">Save</button>
        <button id="cancelCustomTool" class="sub-category-button" style="width: 45%; border-color: #ccc; color: #ccc;">Cancel</button>
    `;

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
        const category = addToolForm.querySelector('#customToolCategory').value;
        const name = addToolForm.querySelector('#customToolName').value.trim();
        const url = addToolForm.querySelector('#customToolUrl').value.trim();
        const description = addToolForm.querySelector('#customToolDesc').value.trim();

        if (!name || !url) {
            flashButton(saveBtn, "Missing Info", true);
            return;
        }

        const newTool = { name, url, description, isCustom: true };

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
    favWrapper.appendChild(controlsWrapper);

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
    favWrapper.appendChild(ieWrapper);

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
            window.close();
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
                            if (tool.url && !allExistingUrls.has(tool.url)) {
                                existingFavs[category].push(tool);
                                allExistingUrls.add(tool.url);
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
                displayFavorites(migratedFavorites, favWrapper, renderMenuCallback);
            });
            return;
        }
        displayFavorites(favorites, favWrapper, renderMenuCallback);
    });


}

function displayFavorites(favoritesData, parentWrapper, renderMenuCallback) {
    const categorySelect = document.getElementById('customToolCategory');
    if (categorySelect) {
        categorySelect.innerHTML = '';
        categorySelect.add(new Option("No Category", ""));
    }

    const uncategorizedWrapper = document.createElement('div');
    const uncategorizedTools = favoritesData["__uncategorized__"] || [];
    uncategorizedTools.forEach(tool => {
        uncategorizedWrapper.appendChild(createToolCard(tool, "__uncategorized__", favoritesData, renderMenuCallback));
    });
    parentWrapper.appendChild(uncategorizedWrapper);

    const sortedCategories = Object.keys(favoritesData).filter(c => c !== "__uncategorized__").sort();
    if (categorySelect) {
        sortedCategories.forEach(catName => categorySelect.add(new Option(catName, catName)));
    }

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
            toolsWrapper.classList.toggle("open");
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
        brw.tabs.create({ url: tool.url, active: false });
    });
    toolCard.appendChild(starBtn);
    return toolCard;
}