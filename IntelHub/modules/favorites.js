// modules/favorites.js

import { brw, isFirefox } from './utils.js';

export function initializeFavorites(container, renderMenuCallback) {
    const favBtn = document.createElement("button");
    favBtn.className = "category-button";
    favBtn.textContent = "Favorites";

    const favWrapper = document.createElement("div");
    favWrapper.className = "tool-list";

    favBtn.addEventListener("click", () => {
        favWrapper.classList.toggle("open");
    });
    
    // --- Add Custom Tool Button and Form ---
    const addToolBtn = document.createElement("button");
    addToolBtn.textContent = "＋ Add Custom Tool";
    addToolBtn.className = "sub-category-button";
    addToolBtn.style.marginTop = "10px";

    const addToolForm = document.createElement("div");
    addToolForm.style.display = "none"; // Hidden by default
    addToolForm.style.padding = "10px";
    addToolForm.innerHTML = `
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
    
    favWrapper.appendChild(addToolBtn);
    favWrapper.appendChild(addToolForm);

    // --- Form Logic ---
    addToolForm.querySelector('#cancelCustomTool').addEventListener('click', (e) => {
        e.stopPropagation();
        addToolForm.style.display = 'none';
    });

    addToolForm.querySelector('#saveCustomTool').addEventListener('click', (e) => {
        e.stopPropagation();
        const name = addToolForm.querySelector('#customToolName').value.trim();
        const url = addToolForm.querySelector('#customToolUrl').value.trim();
        const description = addToolForm.querySelector('#customToolDesc').value.trim();

        if (!name || !url) {
            alert("Tool Name and URL are required.");
            return;
        }

        const newTool = { name, url, description, isCustom: true };

        brw.storage.local.get({favorites: []}, (data) => {
            const favorites = data.favorites;
            favorites.push(newTool);
            brw.storage.local.set({ favorites }, () => {
                addToolForm.style.display = 'none';
                addToolForm.querySelector('#customToolName').value = '';
                addToolForm.querySelector('#customToolUrl').value = '';
                addToolForm.querySelector('#customToolDesc').value = '';
                renderMenuCallback();
            });
        });
    });

    // --- Import/Export Buttons ---
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

    // Export logic
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        brw.storage.local.get({favorites: []}, (data) => {
            if (data.favorites.length === 0) {
                return alert("No favorites to export.");
            }
            const json = JSON.stringify(data.favorites, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'intelhub_favorites.json';
            a.click();
            URL.revokeObjectURL(url);
        });
    });

    // Import logic
    importBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isFirefox()) {
            // For Firefox, open a dedicated page to handle file upload
            brw.tabs.create({ url: 'firefox/import-favorites.html' });
            window.close(); // Close the popup
        } else {
            // For Chrome, use the hidden input method
            const importInput = document.createElement('input');
            importInput.type = 'file';
            importInput.accept = '.json';
            importInput.style.display = 'none';
            
            importInput.addEventListener('change', handleImportFile);
            
            ieWrapper.appendChild(importInput);
            importInput.click();
        }
    });

    function handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedFavorites = JSON.parse(event.target.result);
                if (!Array.isArray(importedFavorites)) {
                   throw new Error("Invalid format.");
                }

                brw.storage.local.get({favorites: []}, (data) => {
                    const existingFavorites = data.favorites;
                    const existingUrls = new Set(existingFavorites.map(f => f.url));
                    let newToolsCount = 0;

                    importedFavorites.forEach(tool => {
                        if (tool.url && !existingUrls.has(tool.url)) {
                            existingFavorites.push(tool);
                            newToolsCount++;
                        }
                    });

                    brw.storage.local.set({ favorites: existingFavorites }, () => {
                        alert(`Import complete! ${newToolsCount} new tools were added.`);
                        renderMenuCallback();
                    });
                });

            } catch (error) {
                alert("Failed to import favorites. Please check the file format.");
            }
        };
        reader.readAsText(file);
    }

    // --- Load and Display Favorites ---
    brw.storage.local.get({favorites: []}, (data) => {
        const favorites = data.favorites;
        const favListContainer = document.createElement('div');
        
        if (favorites.length === 0) {
            const msg = document.createElement("div");
            msg.textContent = "No favorites yet. Click the star ☆ next to a tool to add it.";
            msg.style.textAlign = "center";
            msg.style.padding = "10px";
            favListContainer.appendChild(msg);
        } else {
            favorites.forEach((tool) => {
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
                    const updated = favorites.filter((f) => f.name !== tool.name || f.url !== tool.url);
                    brw.storage.local.set({ favorites: updated }, () => {
                        renderMenuCallback(); 
                    });
                });

                toolCard.addEventListener("click", () => window.open(tool.url, "_blank"));
                toolCard.appendChild(starBtn);
                favListContainer.appendChild(toolCard);
            });
        }
        favWrapper.appendChild(favListContainer);
    });

    container.appendChild(favBtn);
    container.appendChild(favWrapper);
}
