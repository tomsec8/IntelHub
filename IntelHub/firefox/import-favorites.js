// This script runs on the import-favorites.html page, specifically for Firefox.

// Use the 'brw' alias for the browser API
const brw = typeof browser !== "undefined" ? browser : chrome;

document.addEventListener('DOMContentLoaded', () => {
    const selectFileBtn = document.getElementById('selectFileBtn');
    const importFileInput = document.getElementById('importFile');
    const statusEl = document.getElementById('status');

    // Trigger the hidden file input when the main button is clicked
    selectFileBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    // Handle the file selection
    importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedFavorites = JSON.parse(event.target.result);
                if (!Array.isArray(importedFavorites)) {
                    throw new Error("Invalid format: The file should contain a list of tools.");
                }

                brw.storage.local.get({ favorites: [] }, (data) => {
                    const existingFavorites = data.favorites;
                    const existingUrls = new Set(existingFavorites.map(f => f.url));
                    let newToolsCount = 0;

                    importedFavorites.forEach(tool => {
                        // Add tool only if it has a URL and doesn't already exist
                        if (tool.url && !existingUrls.has(tool.url)) {
                            existingFavorites.push(tool);
                            newToolsCount++;
                        }
                    });

                    brw.storage.local.set({ favorites: existingFavorites }, () => {
                        statusEl.textContent = `Import complete! ${newToolsCount} new tools were added. This tab will close shortly.`;
                        statusEl.style.color = '#4caf50'; // Green for success
                        
                        // Close the tab after a short delay
                        setTimeout(() => {
                            window.close();
                        }, 2500);
                    });
                });

            } catch (error) {
                statusEl.textContent = `Error: ${error.message}`;
                statusEl.style.color = '#f44336'; // Red for error
            }
        };
        reader.readAsText(file);
    });
});
