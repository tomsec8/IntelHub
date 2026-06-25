import { brw, isFirefox, flashButton, saveViewState, resetViewState } from './modules/utils.js';
import { initializeFavorites } from './modules/favorites.js';
import { initializeOsintTools, restoreOsintToolsView } from './modules/osintTools.js';
import { initializeDorks, restoreDorksView } from './modules/dorks.js';
import { initializeTelegramAnalyzer, restoreTelegramView } from './modules/telegramAnalyzer.js';
import { initializeSiteAnalyzer, restoreSiteAnalyzerView } from './modules/siteAnalyzer.js';
import { initializeMetadataAnalyzer, restoreMetadataView } from './modules/metadataAnalyzer.js';
import { initializeReverseImageSearch, restoreReverseImageSearchView } from './modules/reverseImageSearch.js';
import { initializeSocialIdExtractor } from './modules/socialIdExtractor.js';
import { initializeUsernameSearch, restoreUsernameSearchView } from './modules/usernameSearch.js';
import { initializeTextProfiler, restoreTextProfilerView } from './modules/textProfiler.js';
import { initializeHelpSection } from './modules/help.js';
import { initializeInvestigationGraph, restoreInvestigationGraphView } from './modules/investigationGraph.js';
import { initializeEmailScanner, restoreEmailScanner } from './modules/emailScanner.js';

const GITHUB_TOOLS_URL = "https://raw.githubusercontent.com/tomsec8/IntelHub/main/tools.json";
let toolsData = {};
let allToolsFlat = [];

function validateToolsData(data) {
    if (!data || typeof data !== 'object') return {};
    const validCategories = {};
    for (const [category, toolsArray] of Object.entries(data)) {
        if (!Array.isArray(toolsArray)) continue;
        validCategories[category] = toolsArray.filter(tool => {
            if (!tool || typeof tool !== 'object') return false;
            if (typeof tool.name !== 'string' || !tool.name.trim()) return false;
            if (typeof tool.url !== 'string') return false;
            try {
                const parsedUrl = new URL(tool.url);
                if (parsedUrl.protocol !== 'https:') return false;
            } catch(e) {
                return false;
            }
            if (tool.description && typeof tool.description !== 'string') return false;
            return true;
        });
        if (validCategories[category].length === 0) {
            delete validCategories[category];
        }
    }
    return validCategories;
}

document.addEventListener('DOMContentLoaded', () => {

  const manifest = chrome.runtime.getManifest();
  const versionEl = document.getElementById('versionNumber');
  if (versionEl) {
    versionEl.textContent = `v${manifest.version}`;
  }

  const themeLink = document.getElementById('theme-stylesheet');
  const themeToggleBtn = document.getElementById('themeToggle');
  const THEMES = [
    'styles/styles_old.css',
    'styles/styles.css',
    'styles/styles_2.css'
  ];

  chrome.storage.local.get(['selectedTheme'], (result) => {
    if (result.selectedTheme && THEMES.includes(result.selectedTheme)) {
      themeLink.setAttribute('href', result.selectedTheme);
      // Sync to localStorage if missing (self-healing after update)
      if (!localStorage.getItem('selectedTheme')) {
        localStorage.setItem('selectedTheme', result.selectedTheme);
      }
    }
  });

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = themeLink.getAttribute('href');
      const currentIndex = THEMES.indexOf(currentTheme);
      const nextIndex = (currentIndex + 1) % THEMES.length;
      const nextTheme = THEMES[nextIndex];

      themeLink.setAttribute('href', nextTheme);
      themeLink.setAttribute('href', nextTheme);
      chrome.storage.local.set({ selectedTheme: nextTheme });
      localStorage.setItem('selectedTheme', nextTheme); // Sync for flicker-free load

      const iframe = document.getElementById('google-ai-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'THEME_SYNC',
          isDark: nextTheme.includes('styles.css') || nextTheme.includes('styles_2.css')
        }, '*');
      }

      flashButton(themeToggleBtn, '🎨');
    });
  }
  // ===============================================

  chrome.storage.session.get(['lastState'], (result) => {
    // Check if we are in window or side-panel mode
    const urlParams = new URLSearchParams(window.location.search);
    const isWindowQuery = urlParams.get('mode') === 'window';
    const popupViews = (chrome.extension && chrome.extension.getViews) ? chrome.extension.getViews({ type: 'popup' }) : [];
    const isPopup = popupViews.includes(window);

    if (isWindowQuery || !isPopup) {
      document.body.classList.add('window-mode');
      document.documentElement.classList.add('window-mode');
    }

    if (result.lastState) {
      restoreLastView(result.lastState);
    } else {
      manageToolUpdates();
    }
  });

  document.getElementById('refreshButton').addEventListener('click', forceToolUpdate);

  const whatsNewBtn = document.getElementById('whatsNewBtn');
  if (whatsNewBtn) {
    whatsNewBtn.addEventListener('click', () => {
      brw.tabs.create({ url: "https://github.com/tomsec8/IntelHub/releases", active: true });
    });
  }

  const donateBtn = document.getElementById('donateBtn');
  if (donateBtn) {
    donateBtn.addEventListener('click', () => {
      // You can change this URL to your actual donation page
      brw.tabs.create({ url: "https://github.com/sponsors/tomsec8", active: true });
    });
  }

  // --- AI Tab System ---
  initializeAiTab();

  const aiChatButton = document.getElementById('aiChatButton');
  if (aiChatButton) {
    aiChatButton.addEventListener('click', async () => {
      // Only works by opening side panel - never in popup
      if (typeof browser !== 'undefined' && browser.sidebarAction && browser.sidebarAction.open) {
        try {
          chrome.storage.session.set({ aiTabRequested: true });
          await browser.sidebarAction.open();
          window.close();
        } catch (err) { }
      } else if (chrome.sidePanel && chrome.sidePanel.open) {
        try {
          chrome.storage.session.set({ aiTabRequested: true });
          const currWindow = await chrome.windows.getCurrent();
          await chrome.sidePanel.open({ windowId: currWindow.id });
          window.close();
        } catch (err) { }
      }
    });
  }

  const expandBtn = document.getElementById('expandButton');
  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      chrome.windows.create({
        url: chrome.runtime.getURL("popup.html?mode=window"),
        type: "popup",
        width: 380,
        height: 600
      });
    });
  }

  const sidePanelBtn = document.getElementById('sidePanelButton');
  if (sidePanelBtn) {
    sidePanelBtn.addEventListener('click', async () => {
      if (typeof browser !== 'undefined' && browser.sidebarAction && browser.sidebarAction.open) {
        try {
          await browser.sidebarAction.open();
          window.close();
        } catch (err) {
          console.error("Error opening sidebar:", err);
        }
      } else if (chrome.sidePanel && chrome.sidePanel.open) {
        try {
          const currWindow = await chrome.windows.getCurrent();
          await chrome.sidePanel.open({ windowId: currWindow.id });
          window.close();
        } catch (err) {
          console.error("Error opening side panel:", err);
        }
      }
    });
  }

  const mainContainer = document.querySelector('.container');
  let scrollTimer;

  if (mainContainer) {
    mainContainer.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const storage = chrome.storage.session || chrome.storage.local;
        const currentScroll = mainContainer.scrollTop;

        storage.get(['lastState'], (result) => {
          const state = result.lastState || { view: 'home' };
          state.scrollTop = currentScroll;
          storage.set({ lastState: state });
        });
      }, 150);
    });
  }
});

function restoreLastView(state) {
  chrome.storage.local.get(['toolsData'], (result) => {
    if (result.toolsData) {
      toolsData = result.toolsData;
      flattenTools(toolsData);

      renderUI({ tools: toolsData, isRestoring: true });

      const container = document.getElementById("categoryButtons");

      switch (state.view) {
        case 'search':
          document.getElementById('searchBox').value = state.query;
          if (state.query) {
            performSearch(state.query);
          }
          break;

        case 'metadataAnalyzer':
          restoreMetadataView(container, state);
          break;

        case 'emailScanner':
          restoreEmailScanner(container, state);
          break;

        case 'dorks':
          restoreDorksView(container, state);
          break;

        case 'osintTools':
          restoreOsintToolsView(container, state, toolsData, forceToolUpdate);
          break;

        case 'siteAnalyzer':
          restoreSiteAnalyzerView(container, state);
          break;

        case 'telegram':
          restoreTelegramView(container);
          break;

        case 'usernameSearch':
          restoreUsernameSearchView(container, state);
          break;

        case 'textProfiler':
          restoreTextProfilerView(container, state);
          break;

        case 'reverseImageSearch':
          restoreReverseImageSearchView(container);
          break;

        case 'investigationGraph':
          restoreInvestigationGraphView(container, state);
          break;



        default:
          break;
      }

      if (state.scrollTop && state.scrollTop > 0) {
        setTimeout(() => {
          const mainContainer = document.querySelector('.container');
          if (mainContainer) {
            mainContainer.scrollTo({
              top: state.scrollTop,
              behavior: "instant"
            });
          }
        }, 100);
      }

    } else {
      manageToolUpdates();
    }
  });
}

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
          const validatedTools = validateToolsData(newTools);
          chrome.storage.local.set({
            toolsData: validatedTools,
            lastUpdated: new Date().getTime()
          });
          if (!cachedTools) {
            renderUI({ tools: validatedTools });
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
  chrome.storage.session.remove('lastState');
  const refreshButton = document.getElementById('refreshButton');
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
      const validatedTools = validateToolsData(newTools);
      chrome.storage.local.set({
        toolsData: validatedTools,
        lastUpdated: new Date().getTime()
      }, () => {
        renderUI({ tools: validatedTools });
        flashButton('refreshButton', 'Updated!');
      });
    })
    .catch(error => {
      console.error("Failed to force fetch new tools:", error);
      flashButton('refreshButton', 'Failed', true);
      renderUI({ tools: toolsData });
    })
    .finally(() => {
      if (refreshButton) {
        refreshButton.textContent = 'Refresh';
        refreshButton.disabled = false;
      }
    });
}

function renderUI({ tools = null, isLoading = false, error = null, isRestoring = false }) {
  if (!isRestoring) {
    chrome.storage.session.set({ lastState: { view: 'home' } });
  }

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
  initializeMetadataAnalyzer(container);
  initializeDorks(container);
  initializeEmailScanner(container);
  initializeTelegramAnalyzer(container);
  initializeSiteAnalyzer(container);
  initializeSocialIdExtractor(container);
  initializeUsernameSearch(container);
  initializeTextProfiler(container);
  initializeInvestigationGraph(container);
  initializeHelpSection(container);


  const loader = document.getElementById('initial-loader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 300);
  }
}

function flattenTools(data) {
  allToolsFlat = [];
  for (const category in data) {
    if (Array.isArray(data[category])) {
      data[category].forEach((tool) => {
        allToolsFlat.push({ ...tool, category });
      });
    }
  }
}

function performSearch(query) {
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
      container.appendChild(toolCard);
    });
  }
}

document.getElementById("searchBox").addEventListener("input", function (e) {
  const query = e.target.value.toLowerCase().trim();
  chrome.storage.session.set({ lastState: { view: 'search', query: query } });

  if (!query) {
    renderUI({ tools: toolsData });
    return;
  }

  performSearch(query);
});

// ============================================================
// TAB SYSTEM (Tools / AI)
// ============================================================

function switchToTab(tabName) {
  const tabBar = document.getElementById('tabBar');
  const toolsContent = document.getElementById('toolsTabContent');
  const aiContent = document.getElementById('aiTabContent');
  const tabTools = document.getElementById('tabTools');
  const tabAI = document.getElementById('tabAI');
  const searchBox = document.getElementById('searchBox');

  if (!tabBar || !toolsContent || !aiContent) return;

  const isPinned = window.location.search.includes('mode=sidepanel');

  // AI tab is only available in side panel mode
  if (tabName === 'ai' && !isPinned) return;

  if (isPinned) {
    tabBar.classList.add('visible');
  }

  if (tabName === 'ai') {
    toolsContent.classList.remove('active');
    aiContent.classList.add('active');
    tabTools.classList.remove('active');
    tabAI.classList.add('active');
    if (searchBox) searchBox.style.display = 'none';

    // Lazy-load iframe: only create and load when AI tab is first opened
    lazyLoadAiIframe();
  } else {
    aiContent.classList.remove('active');
    toolsContent.classList.add('active');
    tabAI.classList.remove('active');
    tabTools.classList.add('active');
    if (searchBox) searchBox.style.display = '';
  }
}

let aiIframeLoaded = false;

function lazyLoadAiIframe() {
  if (aiIframeLoaded) return;
  aiIframeLoaded = true;

  const container = document.getElementById('aiIframeContainer');
  if (!container) return;

  if (isFirefox()) {
    const note = document.createElement('div');
    note.className = 'ai-firefox-note';
    note.textContent = '🦊 Firefox: Google AI will open in a new tab.';
    const btn = document.createElement('button');
    btn.textContent = 'Open AI ↗';
    btn.style.cssText = 'margin-top:10px;padding:8px 16px;cursor:pointer;border-radius:6px;border:1px solid #4ade80;background:transparent;color:#4ade80;';
    btn.onclick = () => brw.tabs.create({ url: 'https://www.google.com/search?udm=50', active: true });
    container.appendChild(note);
    container.appendChild(btn);
  } else {
    const wrap = document.createElement('div');
    wrap.className = 'ai-iframe-wrap';
    const iframe = document.createElement('iframe');
    iframe.id = 'google-ai-iframe';
    iframe.src = 'https://www.google.com/search?udm=50';
    iframe.allow = "camera; microphone; clipboard-read; clipboard-write; display-capture";
    wrap.appendChild(iframe);
    container.appendChild(wrap);

    iframe.addEventListener('load', () => {
      const currentTheme = document.getElementById('theme-stylesheet').getAttribute('href');
      iframe.contentWindow.postMessage({
        type: 'THEME_SYNC',
        isDark: currentTheme && (currentTheme.includes('styles.css') || currentTheme.includes('styles_2.css'))
      }, '*');
    });

    // Listen for height updates from the injected Google AI content script
    let previousContentHeight = 0;
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'RESIZE_IFRAME' && event.data.height) {
        if (event.data.height > 200) {
          wrap.style.height = `${event.data.height}px`;

          // The iframe will resize dynamically, but we no longer force the container to auto-scroll
        }
      }
    });
  }
}

function initializeAiTab() {
  const tabTools = document.getElementById('tabTools');
  const tabAI = document.getElementById('tabAI');

  if (tabTools) {
    tabTools.addEventListener('click', () => switchToTab('tools'));
  }
  if (tabAI) {
    tabAI.addEventListener('click', () => switchToTab('ai'));
  }

  // --- AI Engine Selector Logic ---
  const btnGoogle = document.getElementById('engineGoogle');
  const btnBrave = document.getElementById('engineBrave');
  const btnPhind = document.getElementById('enginePhind');
  const btnAndi = document.getElementById('engineAndi');
  const containerGoogle = document.getElementById('aiIframeContainer');
  const containerBrave = document.getElementById('braveIframeContainer');
  const containerPhind = document.getElementById('phindIframeContainer');
  const containerAndi = document.getElementById('andiIframeContainer');

  if (btnGoogle && btnBrave && btnPhind && btnAndi) {
    function resetAiEngines() {
      btnGoogle.classList.remove('active');
      btnBrave.classList.remove('active');
      btnPhind.classList.remove('active');
      btnAndi.classList.remove('active');
      containerGoogle.style.display = 'none';
      containerBrave.style.display = 'none';
      containerPhind.style.display = 'none';
      containerAndi.style.display = 'none';
    }

    btnGoogle.addEventListener('click', () => {
      resetAiEngines();
      btnGoogle.classList.add('active');
      containerGoogle.style.display = 'block';
    });

    btnBrave.addEventListener('click', () => {
      resetAiEngines();
      btnBrave.classList.add('active');
      containerBrave.style.display = 'block';
      lazyLoadBraveIframe();
    });

    btnPhind.addEventListener('click', () => {
      resetAiEngines();
      btnPhind.classList.add('active');
      containerPhind.style.display = 'block';
      lazyLoadPhindIframe();
    });

    btnAndi.addEventListener('click', () => {
      resetAiEngines();
      btnAndi.classList.add('active');
      containerAndi.style.display = 'block';
      lazyLoadAndiIframe();
    });
  }

  // Check if we were asked to open the AI tab (from popup AI button click)
  const storage = chrome.storage.session || chrome.storage.local;
  storage.get(['aiTabRequested'], (result) => {
    if (result.aiTabRequested) {
      storage.remove('aiTabRequested');
      switchToTab('ai');
    }
  });

  const isPinned = window.location.search.includes('mode=sidepanel');
  if (isPinned) {
    const tabBar = document.getElementById('tabBar');
    if (tabBar) tabBar.classList.add('visible');

    // Hide top AI button since we have tabs now
    const topAiBtn = document.getElementById('aiChatButton');
    if (topAiBtn) topAiBtn.style.display = 'none';

    // Note: We leave the Pin button visible so the user can use it if they want.
    // Chrome handles closing the side panel via the top-right X button natively.
  }
}

let braveIframeLoaded = false;

function lazyLoadBraveIframe() {
  if (braveIframeLoaded) return;
  braveIframeLoaded = true;

  const container = document.getElementById('braveIframeContainer');
  if (!container) return;

  if (isFirefox()) {
    const note = document.createElement('div');
    note.className = 'ai-firefox-note';
    note.textContent = '🦊 Firefox: Brave AI will open in a new tab.';
    const btn = document.createElement('button');
    btn.textContent = 'Open Brave AI ↗';
    btn.style.cssText = 'margin-top:10px;padding:8px 16px;cursor:pointer;border-radius:6px;border:1px solid #4ade80;background:transparent;color:#4ade80;';
    btn.onclick = () => brw.tabs.create({ url: 'https://search.brave.com/ask', active: true });
    container.appendChild(note);
    container.appendChild(btn);
  } else {
    const wrap = document.createElement('div');
    wrap.className = 'ai-iframe-wrap'; // Reusing the same wrapper styles
    const iframe = document.createElement('iframe');
    iframe.id = 'brave-ai-iframe';
    iframe.src = 'https://search.brave.com/ask';
    iframe.allow = "camera; microphone; clipboard-read; clipboard-write; display-capture";
    wrap.appendChild(iframe);
    container.appendChild(wrap);

    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'RESIZE_BRAVE_IFRAME' && event.data.height) {
        if (event.data.height > 200) {
          wrap.style.height = `${event.data.height}px`;
        }
      } else if (event.data && event.data.type === 'FORCE_SCROLL_PARENT') {
        const mainContainer = document.querySelector('.container');
        if (mainContainer) {
          mainContainer.scrollTop += event.data.deltaY;
        }
      }
    });
  }
}

let phindIframeLoaded = false;

function lazyLoadPhindIframe() {
  if (phindIframeLoaded) return;
  phindIframeLoaded = true;

  const container = document.getElementById('phindIframeContainer');
  if (!container) return;

  if (isFirefox()) {
    const note = document.createElement('div');
    note.className = 'ai-firefox-note';
    note.textContent = '🦊 Firefox: Phind AI will open in a new tab.';
    const btn = document.createElement('button');
    btn.textContent = 'Open Phind AI ↗';
    btn.style.cssText = 'margin-top:10px;padding:8px 16px;cursor:pointer;border-radius:6px;border:1px solid #4ade80;background:transparent;color:#4ade80;';
    btn.onclick = () => brw.tabs.create({ url: 'https://phindai.org/phind-chat/', active: true });
    container.appendChild(note);
    container.appendChild(btn);
  } else {
    const wrap = document.createElement('div');
    wrap.className = 'ai-iframe-wrap'; // Reusing the same wrapper styles
    const iframe = document.createElement('iframe');
    iframe.id = 'phind-ai-iframe';
    iframe.src = 'https://phindai.org/phind-chat/';
    iframe.allow = "camera; microphone; clipboard-read; clipboard-write; display-capture";
    wrap.appendChild(iframe);
    container.appendChild(wrap);

    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'RESIZE_PHIND_IFRAME' && event.data.height) {
        if (event.data.height > 200) {
          wrap.style.height = `${event.data.height}px`;
        }
      } else if (event.data && event.data.type === 'FORCE_SCROLL_PARENT_PHIND') {
        const mainContainer = document.querySelector('.container');
        if (mainContainer) {
          mainContainer.scrollTop += event.data.deltaY;
        }
      }
    });
  }
}

let andiIframeLoaded = false;

function lazyLoadAndiIframe() {
  if (andiIframeLoaded) return;
  andiIframeLoaded = true;

  const container = document.getElementById('andiIframeContainer');
  if (!container) return;

  if (isFirefox()) {
    const note = document.createElement('div');
    note.className = 'ai-firefox-note';
    note.textContent = '🦊 Firefox: Andi will open in a new tab.';
    const btn = document.createElement('button');
    btn.textContent = 'Open Andi ↗';
    btn.style.cssText = 'margin-top:10px;padding:8px 16px;cursor:pointer;border-radius:6px;border:1px solid #4ade80;background:transparent;color:#4ade80;';
    btn.onclick = () => brw.tabs.create({ url: 'https://andisearch.com/', active: true });
    container.appendChild(note);
    container.appendChild(btn);
  } else {
    const wrap = document.createElement('div');
    wrap.className = 'ai-iframe-wrap'; // Reusing the same wrapper styles
    const iframe = document.createElement('iframe');
    iframe.id = 'andi-ai-iframe';
    iframe.src = 'https://andisearch.com/';
    iframe.allow = "camera; microphone; clipboard-read; clipboard-write; display-capture";
    wrap.appendChild(iframe);
    container.appendChild(wrap);

    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'RESIZE_ANDI_IFRAME' && event.data.height) {
        if (event.data.height > 200) {
          wrap.style.height = `${event.data.height}px`;
        }
      } else if (event.data && event.data.type === 'FORCE_SCROLL_PARENT_ANDI') {
        const mainContainer = document.querySelector('.container');
        if (mainContainer) {
          mainContainer.scrollTop += event.data.deltaY;
        }
      }
    });
  }
}