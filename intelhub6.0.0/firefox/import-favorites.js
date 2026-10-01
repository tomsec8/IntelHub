const brw = typeof browser !== "undefined" ? browser : chrome;

// An imported file is untrusted input: keep only plain http(s) URLs so a shared
// favorites list cannot smuggle in javascript:, data: or chrome: entries.
function safeToolUrl(raw) {
    try {
        const parsed = new URL(String(raw || '').trim());
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
        return parsed.href;
    } catch {
        return '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const selectFileBtn = document.getElementById('selectFileBtn');
    const importFileInput = document.getElementById('importFile');
    const statusEl = document.getElementById('status');

    selectFileBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        statusEl.textContent = "Importing...";
        statusEl.style.color = 'inherit';

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
                    Object.values(existingFavs).forEach(arr => {
                        if (Array.isArray(arr)) {
                           arr.forEach(tool => allExistingUrls.add(tool.url));
                        }
                    });

                    let newToolsCount = 0;

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
                                newToolsCount++;
                            }
                        });
                    }

                    brw.storage.local.set({ favorites: existingFavs }, () => {
                        statusEl.textContent = `Import complete! ${newToolsCount} new tools were added. This tab will close shortly.`;
                        statusEl.style.color = '#4caf50';
                        
                        setTimeout(() => {
                            window.close();
                        }, 2500);
                    });
                });

            } catch (error) {
                statusEl.textContent = `Error: ${error.message}`;
                statusEl.style.color = '#f44336';
            }
        };
        reader.readAsText(file);
    });
});