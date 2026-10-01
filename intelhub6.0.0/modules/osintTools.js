import { brw, createSection, saveViewState, resetViewState } from './utils.js';
import { initializeFavorites } from './favorites.js';

const SECTION_TITLE = 'Online Shortcuts';
const SECTION_SUBTITLE = 'Favorites and OSINT categories';

export function restoreOsintToolsView(container, state) {
  const osintBtn = container.querySelector('[data-section="online-shortcuts"]');
  if (!osintBtn) return;
  const osintWrapper = osintBtn.nextElementSibling;
  if (!osintWrapper) return;

  if (state.mainOpen) {
    osintWrapper.classList.add('open');
    osintBtn.classList.add('is-open');
  }

  const api = osintWrapper._osintNav;
  if (!api) return;

  if (state.osintView === 'favorites') api.openFavorites({ persist: false });
  else if (state.osintView === 'category' && state.selectedCategory) {
    api.openCategory(state.selectedCategory, { persist: false });
  } else {
    api.openRoot({ persist: false });
  }
}

export function initializeOsintTools(container, toolsData, refreshCallback) {
  const categories = Object.entries(toolsData || {})
    .filter(([, tools]) => Array.isArray(tools) && tools.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  const toolsByCategory = Object.fromEntries(categories);

  let osintView = 'root';
  let selectedCategory = '';

  const { btn, wrapper: osintWrapper } = createSection(container, SECTION_TITLE, {
    id: 'online-shortcuts',
    subtitle: SECTION_SUBTITLE,
    onToggle: () => saveOsintState()
  });
  btn.classList.add('category-button-rich');

  function saveOsintState() {
    if (!osintWrapper.classList.contains('open')) {
      resetViewState('osintTools');
      return;
    }
    saveViewState('osintTools', {
      mainOpen: true,
      osintView,
      selectedCategory,
      openSubCategories: osintView === 'category' && selectedCategory ? [selectedCategory] : []
    });
  }

  const nav = document.createElement('div');
  nav.className = 'osint-nav';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'osint-back';
  backBtn.textContent = '← All shortcuts';
  backBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    openRoot();
  });

  const crumb = document.createElement('span');
  crumb.className = 'osint-crumb';

  nav.append(backBtn, crumb);
  osintWrapper.appendChild(nav);

  const filter = document.createElement('input');
  filter.type = 'search';
  filter.className = 'osint-filter';
  filter.placeholder = 'Filter…';
  filter.autocomplete = 'off';
  filter.addEventListener('click', (event) => event.stopPropagation());
  filter.addEventListener('input', () => paintBody());
  osintWrapper.appendChild(filter);

  const body = document.createElement('div');
  body.className = 'osint-body';
  osintWrapper.appendChild(body);

  const favoritesPane = document.createElement('div');
  favoritesPane.className = 'osint-favorites-pane';
  initializeFavorites(favoritesPane, refreshCallback);

  function openTool(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:') brw.tabs.create({ url: parsed.href, active: false });
    } catch {
      /* ignore invalid URL */
    }
  }

  function createRow({ label, count, icon, trailing = '›' }) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'osint-row';

    const name = document.createElement('span');
    name.className = 'osint-row-name';
    name.textContent = icon ? `${icon} ${label}` : label;

    const meta = document.createElement('span');
    meta.className = 'osint-row-meta';
    if (typeof count === 'number') {
      const badge = document.createElement('span');
      badge.className = 'osint-count';
      badge.textContent = String(count);
      meta.appendChild(badge);
    }
    if (trailing) {
      const chevron = document.createElement('span');
      chevron.className = 'osint-chevron';
      chevron.textContent = trailing;
      meta.appendChild(chevron);
    }

    row.append(name, meta);
    return row;
  }

  function createToolCard(tool) {
    const row = createRow({ label: tool.name, trailing: '↗' });
    row.classList.add('osint-tool-row');
    row.title = tool.description || tool.name;
    row.addEventListener('click', () => openTool(tool.url));
    return row;
  }

  function paintEmpty(message) {
    const empty = document.createElement('p');
    empty.className = 'osint-empty';
    empty.textContent = message;
    body.appendChild(empty);
  }

  function paintRoot(query) {
    const favRow = createRow({ label: 'Favorites', icon: '★' });
    favRow.classList.add('osint-row-favorites');
    favRow.addEventListener('click', (event) => {
      event.stopPropagation();
      openFavorites();
    });
    if (!query || 'favorites'.includes(query)) body.appendChild(favRow);

    const matches = categories.filter(([name]) => !query || name.toLowerCase().includes(query));
    matches.forEach(([name, tools]) => {
      const row = createRow({ label: name, count: tools.length });
      row.addEventListener('click', (event) => {
        event.stopPropagation();
        openCategory(name);
      });
      body.appendChild(row);
    });

    if (!matches.length && query && !'favorites'.includes(query)) {
      paintEmpty('No matching category.');
    }
  }

  function paintCategory(query) {
    const tools = toolsByCategory[selectedCategory] || [];
    const matches = tools.filter((tool) => {
      if (!query) return true;
      return `${tool.name} ${tool.description || ''}`.toLowerCase().includes(query);
    });

    if (!matches.length) {
      paintEmpty('No matching tool.');
      return;
    }
    matches.forEach((tool) => body.appendChild(createToolCard(tool)));
  }

  function paintBody() {
    const query = filter.value.trim().toLowerCase();
    body.replaceChildren();

    if (osintView === 'favorites') {
      body.appendChild(favoritesPane);
      return;
    }
    if (osintView === 'category') {
      paintCategory(query);
      return;
    }
    paintRoot(query);
  }

  function applyChrome() {
    const atRoot = osintView === 'root';
    nav.classList.toggle('is-hidden', atRoot);
    crumb.textContent = osintView === 'favorites' ? 'Favorites' : selectedCategory;
    filter.classList.toggle('is-hidden', osintView === 'favorites');
    filter.placeholder = atRoot ? 'Filter categories…' : 'Filter tools…';
  }

  function openRoot({ persist = true } = {}) {
    osintView = 'root';
    selectedCategory = '';
    filter.value = '';
    applyChrome();
    paintBody();
    if (persist) saveOsintState();
  }

  function openFavorites({ persist = true } = {}) {
    osintView = 'favorites';
    selectedCategory = '';
    filter.value = '';
    applyChrome();
    paintBody();
    if (persist) saveOsintState();
  }

  function openCategory(name, { persist = true } = {}) {
    if (!toolsByCategory[name]) return;
    osintView = 'category';
    selectedCategory = name;
    filter.value = '';
    applyChrome();
    paintBody();
    if (persist) saveOsintState();
  }

  osintWrapper._osintNav = { openRoot, openFavorites, openCategory };

  const browseBtn = document.createElement('button');
  browseBtn.type = 'button';
  browseBtn.className = 'sub-category-button browse-workspace-btn';
  browseBtn.textContent = 'Open full catalog in Workspace →';
  browseBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    try {
      localStorage.setItem('wsViewState', JSON.stringify({
        ...JSON.parse(localStorage.getItem('wsViewState') || '{}'),
        category: 'osint',
        graphOpen: false
      }));
    } catch {
      /* ignore */
    }
    brw.tabs.create({ url: brw.runtime.getURL('workspace.html'), active: true });
    window.close();
  });
  osintWrapper.appendChild(browseBtn);

  openRoot({ persist: false });
}
