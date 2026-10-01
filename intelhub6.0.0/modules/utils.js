export const brw = self.browser || self.chrome;

export async function getCurrentTab() {
  const [tab] = await brw.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export function isFirefox() {
  return navigator.userAgent.includes("Firefox");
}

export function closeExtensionPopup() {
  if (document.documentElement.classList.contains('workspace-page')) return;
  window.close();
}

export function flashButton(element, tempText = "", isError = false) {
  const btn = typeof element === 'string' ? document.getElementById(element) : element;
  if (!btn) return;

  if (btn.dataset.isFlashing === "true") return;
  btn.dataset.isFlashing = "true";

  const originalHTML = btn.innerHTML;

  if (tempText) {
    btn.textContent = tempText;
  }

  const classToAdd = isError ? 'btn-error' : 'btn-success';
  btn.classList.add(classToAdd);

  setTimeout(() => {
    if (tempText) btn.innerHTML = originalHTML;
    btn.classList.remove(classToAdd);
    btn.dataset.isFlashing = "false";
  }, 2000);
}

export function createSection(container, title, { id, onToggle, subtitle } = {}) {
  const btn = document.createElement("button");
  btn.className = "category-button";
  btn.type = "button";
  if (subtitle) {
    btn.classList.add("category-button-rich");
    const label = document.createElement("span");
    label.className = "category-button-label";
    label.textContent = title;
    const sub = document.createElement("span");
    sub.className = "category-button-sub";
    sub.textContent = subtitle;
    btn.append(label, sub);
  } else {
    btn.textContent = title;
  }
  const wrapper = document.createElement("div");
  wrapper.className = "tool-list";
  if (id) {
    wrapper.id = id;
    btn.dataset.section = id;
  }
  btn.addEventListener("click", () => {
    const open = wrapper.classList.toggle("open");
    btn.classList.toggle("is-open", open);
    if (onToggle) onToggle(open);
  });
  container.appendChild(btn);
  container.appendChild(wrapper);
  return { btn, wrapper };
}

export function insertToolResult(anchor, node) {
  if (!anchor || !node) return node;
  if (node.id) {
    document.querySelectorAll(`#${CSS.escape(node.id)}`).forEach((old) => {
      if (old !== node) old.remove();
    });
  }
  if (node.parentNode) node.remove();
  anchor.insertAdjacentElement('afterend', node);
  return node;
}

const popupStorage = () => chrome.storage.session || chrome.storage.local;

let cachedViewState = {};

export function hydrateViewStateCache(state) {
  cachedViewState = state && typeof state === 'object' ? { ...state } : {};
}

export function getCachedViewState() {
  return { ...cachedViewState };
}

export function readPopupScroll() {
  const main = document.querySelector('.container');
  return {
    scrollTop: main ? main.scrollTop : 0,
    pageScroll: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
  };
}

export function applyPopupScroll(state) {
  if (!state) return;
  const y = Number(state.scrollTop) || 0;
  const page = Number(state.pageScroll) || 0;
  const main = document.querySelector('.container');
  if (main) main.scrollTop = y;
  window.scrollTo(0, page);
}

function collectOpenButtons() {
  return [...document.querySelectorAll('#categoryButtons > .category-button.is-open')]
    .map((btn) => btn.dataset.section || btn.textContent.trim())
    .filter(Boolean);
}

function currentPopupTab() {
  if (document.getElementById('tabCases')?.classList.contains('active')) return 'cases';
  if (document.getElementById('tabOpsec')?.classList.contains('active')) return 'opsec';
  return 'tools';
}

function readInnerPlace(prev = {}) {
  const privacyBtn = document.querySelector('#opsecHubContainer .opsec-subtab[data-subtab="privacy"]');
  const securityBtn = document.querySelector('#opsecHubContainer .opsec-subtab[data-subtab="security"]');
  let opsecSubtab = prev.opsecSubtab || 'security';
  if (privacyBtn?.classList.contains('active')) opsecSubtab = 'privacy';
  else if (securityBtn?.classList.contains('active')) opsecSubtab = 'security';

  const caseHome = document.querySelector('.case-home');
  const caseList = document.querySelector('.case-list');
  const caseDetail = document.querySelector('.case-detail');
  const openFromDom = caseDetail?.dataset.cardId || '';
  const detailOpen = Boolean(caseDetail?.classList.contains('is-visible'));
  const homeOpen = Boolean(caseHome && !caseHome.classList.contains('is-hidden'));

  let openCardId = prev.openCardId || null;
  if (detailOpen) openCardId = openFromDom || prev.openCardId || null;
  else if (homeOpen) openCardId = null;

  return {
    opsecSubtab,
    caseListScroll: homeOpen && caseList ? caseList.scrollTop : (prev.caseListScroll || 0),
    openCardId,
    caseDetailScroll: detailOpen && caseDetail ? caseDetail.scrollTop : (prev.caseDetailScroll || 0)
  };
}

const PLACE_KEYS = ['openCardId', 'caseDetailScroll', 'caseListScroll', 'caseType', 'opsecSubtab'];

export function mergeViewState(patch, { captureScroll = true } = {}) {
  const prev = { ...cachedViewState };
  const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
  if (next.tab == null) next.tab = currentPopupTab();
  Object.assign(next, readInnerPlace(prev));
  if (patch && typeof patch === 'object') {
    PLACE_KEYS.forEach((key) => {
      if (key in patch) next[key] = patch[key];
    });
  }
  if (captureScroll) {
    const detailOpen = document.querySelector('.case-detail.is-visible');
    if (detailOpen && next.tab === 'cases') {
      const kept = Number(prev.scrollByTab?.cases ?? prev.scrollTop) || 0;
      next.scrollTop = kept;
      next.scrollByTab = { ...(prev.scrollByTab || {}), cases: kept };
    } else {
      Object.assign(next, readPopupScroll());
      next.scrollByTab = {
        ...(next.scrollByTab || {}),
        [next.tab]: next.scrollTop
      };
    }
  }
  cachedViewState = next;
  popupStorage().set({ lastState: next });
}

export function saveViewState(view, data = {}) {
  mergeViewState((prev) => ({
    ...prev,
    view,
    openButtons: collectOpenButtons(),
    sections: {
      ...(prev.sections || {}),
      [view]: { ...data }
    }
  }));
}

function closeAllPopupSelects(except) {
  document.querySelectorAll('.popup-select.is-open').forEach((node) => {
    if (except && node === except) return;
    node.classList.remove('is-open');
    const panel = node.querySelector('.popup-select-panel');
    if (panel) panel.hidden = true;
  });
}

if (typeof document !== 'undefined' && !document.documentElement.dataset.popupSelectBound) {
  document.documentElement.dataset.popupSelectBound = '1';
  document.addEventListener('click', () => closeAllPopupSelects());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllPopupSelects();
  });
}

export function createPopupSelect({ className = '', options = [], value = '', onChange } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `popup-select ${className}`.trim();

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'popup-select-btn';

  const panel = document.createElement('div');
  panel.className = 'popup-select-panel';
  panel.hidden = true;

  let current = value;

  function paint(next) {
    current = next == null ? '' : String(next);
    wrap.dataset.value = current;
    const match = options.find((opt) => String(opt.value) === current);
    btn.textContent = match?.label || options[0]?.label || '';
    panel.querySelectorAll('.popup-select-option').forEach((item) => {
      item.classList.toggle('is-active', item.dataset.value === current);
    });
  }

  function setOptions(nextOptions, nextValue = current) {
    options = nextOptions || [];
    panel.replaceChildren();
    options.forEach((opt) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'popup-select-option';
      item.dataset.value = String(opt.value);
      item.textContent = opt.label;
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        closeAllPopupSelects();
        paint(opt.value);
        onChange?.(opt.value);
      });
      panel.appendChild(item);
    });
    paint(nextValue);
  }

  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = panel.hidden;
    closeAllPopupSelects(wrap);
    panel.hidden = !willOpen;
    wrap.classList.toggle('is-open', willOpen);
    if (willOpen) {
      const space = window.innerHeight - btn.getBoundingClientRect().bottom;
      panel.classList.toggle('opens-up', space < 168);
    }
  });

  wrap.append(btn, panel);
  setOptions(options, value);

  return {
    el: wrap,
    get value() {
      return current;
    },
    set value(next) {
      paint(next);
    },
    setOptions,
    addEventListener(type, handler) {
      if (type === 'change') onChange = handler;
    }
  };
}

export function resetViewState(view) {
  mergeViewState((prev) => {
    const target = view || prev.view;
    const sections = { ...(prev.sections || {}) };
    if (target && sections[target]) {
      sections[target] = { ...sections[target], mainOpen: false };
    }
    const stillOpen = Object.keys(sections).find((key) => sections[key]?.mainOpen);
    return {
      ...prev,
      view: stillOpen || (prev.tab && prev.tab !== 'tools' ? prev.tab : 'home'),
      mainOpen: !!stillOpen,
      openButtons: collectOpenButtons(),
      sections
    };
  });
}

function ensureStyledSelectDismiss() {
  if (typeof document === 'undefined' || document.body?.dataset.wsSelectBound) return;
  if (!document.body) return;
  document.body.dataset.wsSelectBound = '1';
  document.addEventListener('click', (event) => {
    document.querySelectorAll('.ws-select.is-open').forEach((openPicker) => {
      if (!openPicker.contains(event.target)) openPicker.classList.remove('is-open');
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.ws-select.is-open').forEach((openPicker) => {
      openPicker.classList.remove('is-open');
    });
  });
}

export function createStyledSelect({ options = [], value = '', placeholder = 'Choose', onChange } = {}) {
  ensureStyledSelectDismiss();
  const picker = document.createElement('div');
  picker.className = 'ws-osint-picker ws-select';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ws-osint-picker-btn';
  const menu = document.createElement('div');
  menu.className = 'ws-osint-menu';
  picker.append(button, menu);

  let current = value;

  function labelFor(val) {
    const match = options.find((item) => item.value === val);
    return match?.label || placeholder;
  }

  function paint() {
    button.textContent = labelFor(current);
    button.classList.toggle('is-placeholder', !current);
    menu.replaceChildren();
    options.forEach((item) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = `ws-osint-option${item.value === current ? ' is-active' : ''}`;
      option.textContent = item.label;
      option.addEventListener('click', (event) => {
        event.stopPropagation();
        current = item.value;
        picker.classList.remove('is-open');
        paint();
        onChange?.(current);
      });
      menu.appendChild(option);
    });
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    document.querySelectorAll('.ws-osint-picker.is-open').forEach((openPicker) => {
      if (openPicker !== picker) openPicker.classList.remove('is-open');
    });
    picker.classList.toggle('is-open');
  });

  Object.defineProperty(picker, 'value', {
    get() { return current; },
    set(next) {
      current = next;
      paint();
    }
  });

  paint();
  return picker;
}

export function createFileButton(label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ws-btn ws-btn-file';
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 16 16');
  icon.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M2 4.2A1.2 1.2 0 0 1 3.2 3h3.1l1 1.1h5.5A1.2 1.2 0 0 1 14 5.3v6.5A1.2 1.2 0 0 1 12.8 13H3.2A1.2 1.2 0 0 1 2 11.8V4.2Z');
  icon.appendChild(path);
  button.append(icon, document.createTextNode(label));
  return button;
}