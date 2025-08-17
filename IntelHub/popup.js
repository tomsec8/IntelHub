// popup.js - Main script

import { brw } from './modules/utils.js';
import { initializeFavorites } from './modules/favorites.js';
import { initializeOsintTools } from './modules/osintTools.js';
import { initializeDorks } from './modules/dorks.js';
import { initializeSiteAnalyzer } from './modules/siteAnalyzer.js';
import { initializeMetadataAnalyzer } from './modules/metadataAnalyzer.js';
import { initializeReverseImageSearch } from './modules/reverseImageSearch.js';
import { initializeArchiveSearch } from './modules/archiveSearch.js';
import { initializeSocialIdExtractor } from './modules/socialIdExtractor.js';
import { initializeLinkAnalyzer } from './modules/linkAnalyzer.js';
import { initializeTextProfiler } from './modules/textProfiler.js';
import { initializeHelpSection } from './modules/help.js';
import { initializeCryptoAnalyzer } from './modules/cryptoAnalyzer.js';
import { initializeTelegramAnalyzer } from './modules/telegramAnalyzer.js'; // Import the new module

const GITHUB_TOOLS_URL = "https://raw.githubusercontent.com/tomsec8/IntelHub/main/tools.json";
let toolsData = {};
let allToolsFlat = [];

document.addEventListener('DOMContentLoaded', () => {
  manageToolUpdates();
});

function manageToolUpdates() {
  renderUI({ isLoading: true });

  chrome.storage.local.get(['toolsData', 'lastUpdated'], (result) => {
    const { toolsData: cachedTools, lastUpdated } = result;
    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    if (cachedTools) {
      renderUI({ tools: cachedTools });
    }

    if (!lastUpdated || (now - lastUpdated > oneDay)) {
      fetch(GITHUB_TOOLS_URL)
        .then(response => response.ok ? response.json() : Promise.reject('Network error'))
        .then(newTools => {
          chrome.storage.local.set({
            toolsData: newTools,
            lastUpdated: new Date().getTime()
          });
          if (!cachedTools) {
            renderUI({ tools: newTools });
          }
        }).catch(error => {
          console.error("Background fetch failed:", error);
          if (!cachedTools) {
            renderUI({ error: "Failed to load OSINT tools." });
          }
        });
    }
  });
}

function forceToolUpdate() {
    const refreshButton = document.querySelector("button[title='Refresh Tools List']");
    if (refreshButton) {
        refreshButton.textContent = '⏳';
        refreshButton.disabled = true;
    }

    fetch(GITHUB_TOOLS_URL)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(newTools => {
            chrome.storage.local.set({
                toolsData: newTools,
                lastUpdated: new Date().getTime()
            }, () => {
                renderUI({ tools: newTools });
                alert("Tools updated successfully!");
            });
        })
        .catch(error => {
            console.error("Failed to force fetch new tools:", error);
            alert("Failed to update tools. Check your internet connection.");
            renderUI({ tools: toolsData });
        });
}

function renderUI({ tools = null, isLoading = false, error = null }) {
  toolsData = tools;
  if (tools) {
    flattenTools(tools);
  }

  const container = document.getElementById("categoryButtons");
  container.innerHTML = "";

  const reRenderWithCurrentTools = () => renderUI({ tools: toolsData });

  initializeFavorites(container, reRenderWithCurrentTools);
  
  if (tools) {
    initializeOsintTools(container, tools, forceToolUpdate);
  } else if (isLoading) {
    const loadingP = document.createElement('p');
    loadingP.textContent = "Loading OSINT tools...";
    container.appendChild(loadingP);
  } else if (error) {
    const errorP = document.createElement('p');
    errorP.style.color = 'red';
    errorP.textContent = error;
    container.appendChild(errorP);
  }

  initializeReverseImageSearch(container);
  initializeArchiveSearch(container);
  initializeMetadataAnalyzer(container);
  initializeDorks(container);
  initializeCryptoAnalyzer(container);
  initializeTelegramAnalyzer(container); // Add the new module here
  initializeSiteAnalyzer(container);
  initializeSocialIdExtractor(container);
  initializeLinkAnalyzer(container);
  initializeTextProfiler(container);
  initializeHelpSection(container);
}

function flattenTools(data) {
  allToolsFlat = [];
  for (const category in data) {
    data[category].forEach((tool) => {
      allToolsFlat.push({ ...tool, category });
    });
  }
}

document.getElementById("searchBox").addEventListener("input", function (e) {
  const query = e.target.value.toLowerCase().trim();
  
  if (!query) {
    renderUI({ tools: toolsData });
    return;
  }
  
  const container = document.getElementById("categoryButtons");
  container.innerHTML = "";

  if (!allToolsFlat || allToolsFlat.length === 0) {
      const noResult = document.createElement('p');
      noResult.textContent = 'OSINT tools are not available for search.';
      noResult.style.textAlign = 'center';
      container.appendChild(noResult);
      return;
  }

  const results = allToolsFlat.filter(
    (tool) =>
      tool.name.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query)
  );

  const title = document.createElement("h2");
  title.textContent = `Search Results (${results.length})`;
  title.style.textAlign = "center";
  title.style.fontSize = "16px";
  container.appendChild(title);

  if (results.length === 0) {
      const noResult = document.createElement('p');
      noResult.textContent = 'No tools found.';
      noResult.style.textAlign = 'center';
      container.appendChild(noResult);
  } else {
      results.forEach((tool) => {
        const toolCard = document.createElement("div");
        toolCard.className = "tool-card";
        toolCard.textContent = tool.name;
        toolCard.title = tool.description;
        toolCard.addEventListener("click", () => window.open(tool.url, "_blank"));
        container.appendChild(toolCard);
      });
  }
});

brw.storage.local.get("firstVisitDone", (data) => {
  if (!data.firstVisitDone) {
    alert("Tip: Right-click the puzzle icon (🧩) and pin 📌 IntelHub for quick access!");
    brw.storage.local.set({ firstVisitDone: true });
  }
});
