import {
  brw,
  isFirefox,
  flashButton,
  hydrateViewStateCache,
  getCachedViewState,
  mergeViewState,
  applyPopupScroll
} from './modules/utils.js';
import { fetchAwesomeOsintTools, TOOLS_SOURCE } from './modules/toolsCatalog.js';
import { initializeOsintTools, restoreOsintToolsView } from './modules/osintTools.js';
import { initializeSiteAnalyzer, restoreSiteAnalyzerView } from './modules/siteAnalyzer.js';
import { initializeSocialIdExtractor, restoreSocialIdExtractorView } from './modules/socialIdExtractor.js';
import { initializeTextProfiler, restoreTextProfilerView } from './modules/textProfiler.js';
import { bindHelpButton } from './modules/help.js';
import { initializeInvestigationGraph, restoreInvestigationGraphView } from './modules/investigationGraph.js';
import { initializeOpsecHub, applyOpsecSubtab } from './modules/opsecHub/popupUi.js';

let toolsData = {};
let allToolsFlat = [];
let opsecReady = false;
let casesReady = false;

document.addEventListener('DOMContentLoaded', () => {

  const manifest = chrome.runtime.getManifest();
  const versionEl = document.getElementById('versionNumber');
  if (versionEl) {
    versionEl.textContent = `v${manifest.version}`;
  }

  chrome.storage.session.get(['lastState'], (result) => {
    const popupViews = (chrome.extension && chrome.extension.getViews) ? chrome.extension.getViews({ type: 'popup' }) : [];
    const isPopup = popupViews.includes(window);

    if (!isPopup) {
      document.body.classList.add('window-mode');
      document.documentElement.classList.add('window-mode');
    }

    hydrateViewStateCache(result.lastState || {});

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
      brw.tabs.create({ url: "https://github.com/sponsors/tomsec8", active: true });
    });
  }

  initializeTabs();

  document.getElementById('workspaceLaunch')?.addEventListener('click', openWorkspace);

  bindHelpButton(document.getElementById('helpButton'));

  const sidePanelBtn = document.getElementById('sidePanelButton');
  const inSidePanel = new URLSearchParams(location.search).get('mode') === 'sidepanel';
  const PIN_KEY = 'ihSidePinned';
  if (inSidePanel) {
    document.documentElement.classList.add('sidepanel-mode');
    document.body.classList.add('sidepanel-mode');
  }
  const canPin = isFirefox()
    ? !!(browser.sidebarAction?.toggle || browser.sidebarAction?.open)
    : !!(chrome.sidePanel?.open);
  if (sidePanelBtn && !canPin) sidePanelBtn.hidden = true;
  if (sidePanelBtn && canPin) {
    const pinLabel = inSidePanel || localStorage.getItem(PIN_KEY) === '1'
      ? 'Close side panel'
      : 'Pin beside the page';
    sidePanelBtn.title = pinLabel;
    sidePanelBtn.setAttribute('aria-label', pinLabel);
    sidePanelBtn.addEventListener('click', () => {
      if (isFirefox() && browser.sidebarAction) {
        const toggle = browser.sidebarAction.toggle || browser.sidebarAction.open;
        Promise.resolve(toggle.call(browser.sidebarAction))
          .then(() => {
            if (!inSidePanel) window.close();
          })
          .catch((err) => {
            console.error('Error toggling sidebar:', err);
            flashButton(sidePanelBtn, 'Failed', true);
          });
        return;
      }

      if (!chrome.sidePanel?.open) return;
      const shouldClose = inSidePanel || localStorage.getItem(PIN_KEY) === '1';

      const openPanel = () => {
        chrome.windows.getCurrent((win) => {
          if (chrome.runtime.lastError || !win?.id) {
            console.error(chrome.runtime.lastError);
            flashButton(sidePanelBtn, 'Failed', true);
            return;
          }
          chrome.sidePanel.open({ windowId: win.id }).then(() => {
            localStorage.setItem(PIN_KEY, '1');
            if (!inSidePanel) window.close();
          }).catch((err) => {
            console.error('Error opening side panel:', err);
            flashButton(sidePanelBtn, 'Failed', true);
          });
        });
      };

      if (!shouldClose) {
        openPanel();
        return;
      }

      chrome.windows.getCurrent((win) => {
        if (chrome.runtime.lastError || !win?.id || !chrome.sidePanel.close) {
          console.error(chrome.runtime.lastError || 'sidePanel.close is unavailable');
          flashButton(sidePanelBtn, 'Failed', true);
          return;
        }
        chrome.sidePanel.close({ windowId: win.id }).then(() => {
          localStorage.setItem(PIN_KEY, '0');
          if (!inSidePanel) window.close();
        }).catch((err) => {
          console.error('Error closing side panel:', err);
          flashButton(sidePanelBtn, 'Failed', true);
        });
      });
    });
  }

  const persistScroll = () => {
    if (restoringPlace) return;
    mergeViewState({});
  };

  const mainContainer = document.querySelector('.container');
  let scrollTimer;
  const onScroll = () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(persistScroll, 120);
  };

  if (mainContainer) mainContainer.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pagehide', persistScroll);
});

let restoringPlace = false;

function tabFromState(state) {
  if (state.tab === 'cases' || state.tab === 'opsec' || state.tab === 'tools') return state.tab;
  if (state.view === 'investigationGraph') return 'cases';
  if (state.view === 'opsec') return 'opsec';
  return 'tools';
}

async function restoreOpenPlace(state = getCachedViewState()) {
  if (!state) return;

  const tab = tabFromState(state);
  await switchToTab(tab, { persist: false });

  const searchBox = document.getElementById('searchBox');
  const query = state.search || state.query || '';
  if (searchBox && tab === 'tools') searchBox.value = query;

  const scrollState = {
    ...state,
    scrollTop: state.scrollByTab?.[tab] ?? state.scrollTop
  };

  if (tab === 'cases') {
    restoreInvestigationGraphView(state);
    replayPopupScroll(scrollState);
    return;
  }

  if (tab === 'opsec') {
    applyOpsecSubtab(state.opsecSubtab);
    replayPopupScroll(scrollState);
    return;
  }

  if (query) {
    performSearch(query.toLowerCase().trim());
    replayPopupScroll(scrollState);
    return;
  }

  const container = document.getElementById('categoryButtons');
  if (!container) {
    replayPopupScroll(scrollState);
    return;
  }

  const sections = state.sections || {};
  const openButtons = state.openButtons || [];
  const sectionById = {
    'online-shortcuts': 'osintTools',
    'site-link-archive': 'siteAnalyzer',
    'text-profiler': 'textProfiler',
    'social-id-extractor': 'socialIdExtractor'
  };

  function sectionWasOpen(sectionId) {
    const record = sections[sectionById[sectionId]];
    if (record && typeof record.mainOpen === 'boolean') return record.mainOpen;
    return openButtons.includes(sectionId);
  }

  container.querySelectorAll(':scope > .category-button').forEach((btn) => {
    const key = btn.dataset.section || btn.textContent.trim();
    const shouldOpen = sectionById[key] ? sectionWasOpen(key) : openButtons.includes(key);
    if (!shouldOpen) return;
    btn.classList.add('is-open');
    btn.nextElementSibling?.classList.add('open');
  });

  const osintState = sections.osintTools || {};
  if (osintState.mainOpen || osintState.osintView || osintState.selectedCategory) {
    restoreOsintToolsView(container, osintState);
  }

  const siteState = sections.siteAnalyzer || {};
  if (siteState.mainOpen || siteState.fingerprintData) {
    restoreSiteAnalyzerView(container, siteState);
  }

  const profilerState = sections.textProfiler || {};
  if (profilerState.mainOpen || profilerState.results?.length) {
    restoreTextProfilerView(container, profilerState);
  }

  const socialState = sections.socialIdExtractor || {};
  if (socialState.mainOpen || socialState.lastResult || socialState.gotoOpen) {
    restoreSocialIdExtractorView(container, socialState);
  }

  replayPopupScroll(scrollState);
}

function replayPopupScroll(state) {
  restoringPlace = true;
  const apply = () => applyPopupScroll(state);
  requestAnimationFrame(apply);
  setTimeout(apply, 80);
  setTimeout(() => {
    apply();
    restoringPlace = false;
  }, 220);
}

function restoreLastView(state) {
  chrome.storage.local.get(['toolsData'], (result) => {
    if (result.toolsData) {
      toolsData = result.toolsData;
      flattenTools(toolsData);
      renderUI({ tools: toolsData, isRestoring: true });
      restoreOpenPlace(state);
    } else {
      manageToolUpdates();
    }
  });
}

function cacheTools(tools) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      toolsData: tools,
      toolsSource: TOOLS_SOURCE,
      lastUpdated: Date.now()
    }, () => resolve(tools));
  });
}

function manageToolUpdates() {
  renderUI({ isLoading: true });
  restoreOpenPlace(getCachedViewState());

  chrome.storage.local.get(['toolsData', 'toolsSource', 'lastUpdated'], (result) => {
    const cachedOk = result.toolsData && result.toolsSource === TOOLS_SOURCE;
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (cachedOk) {
      renderUI({ tools: result.toolsData, isRestoring: true });
      restoreOpenPlace(getCachedViewState());
    }

    if (!cachedOk || !result.lastUpdated || (now - result.lastUpdated > oneDay)) {
      fetchAwesomeOsintTools()
        .then((newTools) => cacheTools(newTools).then(() => {
          if (!cachedOk) {
            renderUI({ tools: newTools, isRestoring: true });
            restoreOpenPlace(getCachedViewState());
          }
        }))
        .catch((error) => {
          console.error("Background fetch failed:", error);
          if (!cachedOk) {
            renderUI({ error: "Failed to load OSINT tools." });
          }
        });
    }
  });
}

function forceToolUpdate() {
  const savedPlace = getCachedViewState();
  const refreshButton = document.getElementById('refreshButton');
  if (refreshButton) {
    refreshButton.textContent = '⏳';
    refreshButton.disabled = true;
  }

  fetchAwesomeOsintTools()
    .then((newTools) => cacheTools(newTools).then(() => {
      renderUI({ tools: newTools, isRestoring: true });
      restoreOpenPlace(savedPlace);
      flashButton('refreshButton', 'Updated!');
    }))
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

function openWorkspace() {
  brw.tabs.create({ url: brw.runtime.getURL('workspace.html'), active: true });
  window.close();
}

function addGroupLabel(container, text) {
  const label = document.createElement('p');
  label.className = 'tools-group-label';
  label.textContent = text;
  container.appendChild(label);
}

function renderUI({ tools = null, isLoading = false, error = null, isRestoring = false }) {
  toolsData = tools;
  if (tools) {
    flattenTools(tools);
  }

  const container = document.getElementById("categoryButtons");
  container.innerHTML = "";

  const reRenderWithCurrentTools = () => {
    const place = getCachedViewState();
    renderUI({ tools: toolsData, isRestoring: true });
    restoreOpenPlace(place);
  };

  addGroupLabel(container, 'Shortcuts');
  initializeOsintTools(container, tools || {}, reRenderWithCurrentTools);

  if (!tools && isLoading) {
    const loadingP = document.createElement('p');
    loadingP.className = 'section-note';
    loadingP.textContent = "Loading online shortcuts…";
    container.appendChild(loadingP);
  } else if (!tools && error) {
    const errorP = document.createElement('p');
    errorP.className = 'section-note is-error';
    errorP.textContent = error;
    container.appendChild(errorP);
  }

  addGroupLabel(container, 'This tab');
  initializeSiteAnalyzer(container);
  initializeSocialIdExtractor(container);
  initializeTextProfiler(container);

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
    noResult.textContent = 'Online shortcuts are not available for search.';
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
  mergeViewState({
    view: query ? 'search' : 'home',
    search: query,
    query,
    tab: 'tools'
  });

  if (!query) {
    renderUI({ tools: toolsData, isRestoring: true });
    restoreOpenPlace({ ...getCachedViewState(), search: '', query: '' });
    return;
  }

  performSearch(query);
});

function currentVisibleTab() {
  if (document.getElementById('tabCases')?.classList.contains('active')) return 'cases';
  if (document.getElementById('tabOpsec')?.classList.contains('active')) return 'opsec';
  return 'tools';
}

async function switchToTab(tabName, { persist = true } = {}) {
  const toolsContent = document.getElementById('toolsTabContent');
  const casesContent = document.getElementById('casesTabContent');
  const opsecContent = document.getElementById('opsecHubContainer');
  const tabTools = document.getElementById('tabTools');
  const tabCases = document.getElementById('tabCases');
  const tabOpsec = document.getElementById('tabOpsec');

  if (!toolsContent || !tabTools) return;

  const fromTab = currentVisibleTab();
  const fromScroll = document.querySelector('.container')?.scrollTop || 0;

  const showTools = tabName === 'tools';
  const showCases = tabName === 'cases';
  const showOpsec = tabName === 'opsec';

  tabTools.classList.toggle('active', showTools);
  tabTools.setAttribute('aria-selected', String(showTools));
  if (tabCases) {
    tabCases.classList.toggle('active', showCases);
    tabCases.setAttribute('aria-selected', String(showCases));
  }
  if (tabOpsec) {
    tabOpsec.classList.toggle('active', showOpsec);
    tabOpsec.setAttribute('aria-selected', String(showOpsec));
  }

  toolsContent.classList.toggle('active', showTools);
  if (casesContent) casesContent.classList.toggle('active', showCases);
  if (opsecContent) opsecContent.classList.toggle('active', showOpsec);

  if (showCases && casesContent) {
    if (!casesReady) {
      casesReady = true;
      try {
        await Promise.resolve(initializeInvestigationGraph(casesContent));
      } catch (err) {
        console.error('[Cases] popup init failed:', err);
        casesReady = false;
      }
    }
  }

  if (showOpsec && opsecContent) {
    if (!opsecReady) {
      opsecReady = true;
      try {
        await initializeOpsecHub(opsecContent);
      } catch (err) {
        console.error('[OPSEC] popup init failed:', err);
        opsecReady = false;
      }
    } else {
      applyOpsecSubtab(getCachedViewState().opsecSubtab);
    }
  }

  if (persist) {
    mergeViewState((prev) => {
      const scrollByTab = { ...(prev.scrollByTab || {}), [fromTab]: fromScroll };
      return {
        ...prev,
        tab: tabName,
        scrollByTab,
        scrollTop: scrollByTab[tabName] || 0,
        view: showCases
          ? 'investigationGraph'
          : showOpsec
            ? 'opsec'
            : (prev.view === 'investigationGraph' || prev.view === 'opsec' ? 'home' : prev.view)
      };
    }, { captureScroll: false });
    applyPopupScroll({ scrollTop: getCachedViewState().scrollByTab?.[tabName] || 0 });
  }
}

function initializeTabs() {
  document.getElementById('tabTools')?.addEventListener('click', () => switchToTab('tools'));
  document.getElementById('tabCases')?.addEventListener('click', () => switchToTab('cases'));
  document.getElementById('tabOpsec')?.addEventListener('click', () => switchToTab('opsec'));
}
