import { brw, flashButton, createPopupSelect, mergeViewState, getCachedViewState, applyPopupScroll } from './utils.js';
import { BUILT_IN_TEMPLATES } from './investigationGraph/js/templates.js';

const CARD_ICONS = {
  person: '👤', phone: '📱', email: '📧', address: '🏠',
  company: '🏢', vehicle: '🚗', website: '🌐', social: '💬',
  document: '📄', location: '📍', event: '📅', other: '📝'
};

const QUICK_TYPES = ['person', 'phone', 'email', 'website', 'social', 'document', 'location', 'other'];
const DEFAULT_CARD_COLOR = '#1e3a5f';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function descriptionField(type) {
  const fields = BUILT_IN_TEMPLATES[type]?.fields || [];
  return fields.find((field) => (
    !field.isTitle && (field.id === 'notes' || field.id === 'description' || field.id === 'summary' || field.type === 'textarea')
  )) || null;
}

function nodeDescription(node) {
  const field = descriptionField(node.type);
  return (field && node.customData?.[field.id]) || node.content || '';
}

async function readStore() {
  const data = await brw.storage.local.get(['osint_investigations', 'osint_folders', 'last_investigation_id']);
  return {
    investigations: data.osint_investigations || [],
    folders: data.osint_folders || [],
    lastId: data.last_investigation_id
  };
}

async function writeInvestigations(investigations, extra = {}) {
  await brw.storage.local.set({ osint_investigations: investigations, ...extra });
}

async function ensureFolder(folders) {
  if (folders.length) return folders;
  const folder = { id: Date.now(), name: 'Cases' };
  await brw.storage.local.set({ osint_folders: [folder] });
  return [folder];
}

function relativeTime(iso) {
  if (!iso) return 'not saved yet';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function restoreInvestigationGraphView(state = getCachedViewState()) {
  const apply = () => {
    const list = document.querySelector('.case-list');
    const detail = document.querySelector('.case-detail');
    if (detail?.classList.contains('is-visible')) {
      detail.scrollTop = Number(state.caseDetailScroll) || 0;
      return;
    }
    if (list && Number(state.caseListScroll) > 0) {
      list.scrollTop = Number(state.caseListScroll);
    }
  };
  apply();
  requestAnimationFrame(apply);
}

export function initializeInvestigationGraph(container) {
  const dock = el('section', 'case-dock');
  container.appendChild(dock);

  let investigations = [];
  let folders = [];
  const savedPlace = getCachedViewState();
  let selectedType = QUICK_TYPES.includes(savedPlace.caseType) ? savedPlace.caseType : 'person';
  let skipRemote = false;
  let restoreListScroll = Number(savedPlace.caseListScroll) || 0;
  let listScroll = restoreListScroll;
  let homeScroll = Number(savedPlace.scrollByTab?.cases ?? savedPlace.scrollTop) || 0;
  let openCardId = savedPlace.openCardId || null;

  const home = el('div', 'case-home');
  const detail = el('div', 'case-detail');
  dock.append(home, detail);

  const createBlock = el('div', 'case-block');
  createBlock.append(el('p', 'case-block-label', 'New investigation'));
  const newRow = el('div', 'case-new-row');
  const newInput = document.createElement('input');
  newInput.className = 'case-input';
  newInput.placeholder = 'Investigation name';
  const newSave = el('button', 'case-btn case-btn-primary', 'Create');
  newSave.type = 'button';
  newRow.append(newInput, newSave);
  createBlock.append(newRow, el('p', 'case-hint', 'Creates a case that syncs with the workspace graph.'));
  home.appendChild(createBlock);

  home.appendChild(el('div', 'case-rule'));

  const activeBlock = el('div', 'case-block');
  activeBlock.append(el('p', 'case-block-label', 'Open investigation'));
  const select = createPopupSelect({
    className: 'case-select',
    onChange: async () => {
      const inv = activeInvestigation();
      if (inv) await brw.storage.local.set({ last_investigation_id: inv.id });
      closeCard();
      paintMeta();
      paintList();
    }
  });
  const meta = el('p', 'case-meta', 'No investigation yet.');
  activeBlock.append(select.el, meta);
  home.appendChild(activeBlock);

  const composer = el('div', 'case-composer');
  composer.appendChild(el('span', 'case-composer-label', 'Add card'));
  const typeSelect = createPopupSelect({
    className: 'case-type-select',
    options: QUICK_TYPES.map((type) => ({
      value: type,
      label: `${CARD_ICONS[type]} ${BUILT_IN_TEMPLATES[type].name}`
    })),
    value: selectedType,
    onChange: (value) => {
      selectedType = value;
      titleInput.placeholder = BUILT_IN_TEMPLATES[selectedType].fields.find((field) => field.isTitle)?.label || 'Title';
      mergeViewState({ tab: 'cases', view: 'investigationGraph', caseType: value });
    }
  });
  const titleInput = document.createElement('input');
  titleInput.className = 'case-input';
  titleInput.placeholder = BUILT_IN_TEMPLATES[selectedType].fields.find((field) => field.isTitle)?.label || 'Title';
  const descInput = document.createElement('textarea');
  descInput.className = 'case-textarea';
  descInput.rows = 3;
  descInput.placeholder = 'Description / notes';
  const addBtn = el('button', 'case-btn case-btn-primary case-btn-wide', 'Add card');
  addBtn.type = 'button';
  composer.append(typeSelect.el, titleInput, descInput, addBtn);
  home.appendChild(composer);

  const list = el('div', 'case-list');
  list.addEventListener('scroll', () => {
    if (home.classList.contains('is-hidden')) return;
    listScroll = list.scrollTop;
    mergeViewState({ tab: 'cases', view: 'investigationGraph', caseListScroll: listScroll });
  }, { passive: true });
  home.appendChild(list);

  function activeInvestigation() {
    return investigations.find((inv) => String(inv.id) === String(select.value)) || null;
  }

  function paintSelect(preferredId) {
    const current = preferredId ?? select.value;
    if (!investigations.length) {
      select.setOptions([{ value: '', label: 'No investigations yet' }], '');
      return;
    }
    const options = investigations
      .slice()
      .sort((a, b) => String(b.modified || '').localeCompare(String(a.modified || '')))
      .map((inv) => ({ value: String(inv.id), label: inv.name }));
    const match = investigations.find((inv) => String(inv.id) === String(current));
    select.setOptions(options, String(match?.id || investigations[0].id));
  }

  function paintMeta() {
    const inv = activeInvestigation();
    if (!inv) {
      meta.textContent = 'Create an investigation above to start adding cards.';
      return;
    }
    const count = inv.data?.nodes?.length || 0;
    meta.textContent = `${inv.name} · ${count} card${count === 1 ? '' : 's'} · ${relativeTime(inv.modified)}`;
  }

  function snapshotHomePlace() {
    if (home.classList.contains('is-hidden')) return;
    listScroll = list.scrollTop;
    const main = document.querySelector('.container');
    if (main) homeScroll = main.scrollTop;
  }

  function restoreHomePlace() {
    list.scrollTop = listScroll;
    applyPopupScroll({ scrollTop: homeScroll });
  }

  function persistHomePlace(extra = {}) {
    const prev = getCachedViewState();
    mergeViewState({
      tab: 'cases',
      view: 'investigationGraph',
      caseListScroll: listScroll,
      scrollTop: homeScroll,
      scrollByTab: { ...(prev.scrollByTab || {}), cases: homeScroll },
      ...extra
    }, { captureScroll: false });
  }

  function closeCard() {
    document.activeElement?.blur?.();
    openCardId = null;
    delete detail.dataset.cardId;
    detail.classList.remove('is-visible', 'is-enter');
    home.classList.remove('is-hidden');
    dock.classList.remove('is-card-open');
    restoreHomePlace();
    requestAnimationFrame(restoreHomePlace);
    persistHomePlace({ openCardId: null, caseDetailScroll: 0 });
  }

  function paintDetail(node, { animate = true } = {}) {
    const inv = activeInvestigation();
    if (!inv || !node) {
      closeCard();
      return;
    }

    snapshotHomePlace();
    document.activeElement?.blur?.();

    const keepScroll = !animate && String(openCardId) === String(node.id);
    const savedScroll = keepScroll ? (Number(getCachedViewState().caseDetailScroll) || 0) : 0;
    openCardId = node.id;
    detail.dataset.cardId = String(node.id);
    detail.replaceChildren();

    const bar = el('div', 'case-detail-bar');
    const back = el('button', 'case-back');
    back.type = 'button';
    back.title = 'Back';
    back.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M9.8 3.2 5 8l4.8 4.8 1.1-1.1L7.2 8l3.7-3.7z"/></svg><span>Back</span>';
    back.addEventListener('click', closeCard);
    bar.append(back, el('span', 'case-detail-kicker', inv.name));
    detail.appendChild(bar);

    const hero = el('div', 'case-detail-hero');
    const badge = el('span', 'case-detail-badge', CARD_ICONS[node.type] || '📝');
    const copy = el('div', 'case-detail-copy');
    const chip = el('span', 'case-type-chip', BUILT_IN_TEMPLATES[node.type]?.name || node.type);
    copy.append(chip, el('strong', '', node.title || 'Untitled'));
    hero.append(badge, copy);
    detail.appendChild(hero);

    const template = BUILT_IN_TEMPLATES[node.type];
    const fields = template?.fields || [];
    const descField = descriptionField(node.type);
    const extra = fields.filter((field) => !field.isTitle && field.id !== descField?.id);
    const filled = extra.filter((field) => String(node.customData?.[field.id] || '').trim());

    if (filled.length) {
      const extras = el('div', 'case-detail-fields');
      filled.forEach((field) => {
        const row = el('div', 'case-detail-field');
        row.append(el('span', '', field.label), el('strong', '', node.customData[field.id]));
        extras.appendChild(row);
      });
      detail.appendChild(extras);
    }

    const descWrap = el('div', 'case-detail-notes');
    descWrap.appendChild(el('label', '', descField?.label || 'Description'));
    const notes = document.createElement('textarea');
    notes.className = 'case-textarea';
    notes.rows = 5;
    notes.placeholder = 'Add a description…';
    notes.value = nodeDescription(node);
    const saveNotes = el('button', 'case-btn case-btn-primary case-btn-wide', 'Save description');
    saveNotes.type = 'button';
    saveNotes.addEventListener('click', async () => {
      if (!node.customData) node.customData = {};
      if (descField) node.customData[descField.id] = notes.value.trim();
      else node.content = notes.value.trim();
      inv.modified = new Date().toISOString();
      skipRemote = true;
      await writeInvestigations(investigations, { last_investigation_id: inv.id });
      skipRemote = false;
      paintList();
      flashButton(saveNotes, 'Saved');
    });
    descWrap.append(notes, saveNotes);
    detail.appendChild(descWrap);

    home.classList.add('is-hidden');
    dock.classList.add('is-card-open');
    detail.classList.add('is-visible');
    detail.classList.remove('is-enter');
    if (animate) requestAnimationFrame(() => detail.classList.add('is-enter'));
    detail.scrollTop = savedScroll;
    persistHomePlace({ openCardId: node.id, caseDetailScroll: savedScroll });
  }

  function paintList() {
    const inv = activeInvestigation();
    list.replaceChildren();
    if (!inv) {
      list.appendChild(el('p', 'case-empty', 'No cards yet.'));
      return;
    }
    const nodes = [...(inv.data?.nodes || [])].reverse();
    if (!nodes.length) {
      list.appendChild(el('p', 'case-empty', 'No cards yet. Add one above.'));
      return;
    }
    nodes.forEach((node) => {
      const row = el('button', 'case-card');
      row.type = 'button';
      row.title = 'Open card';
      const icon = el('span', 'case-card-icon', CARD_ICONS[node.type] || '📝');
      const body = el('span', 'case-card-body');
      const desc = nodeDescription(node);
      body.append(
        el('strong', '', node.title || 'Untitled'),
        el('span', '', desc || (BUILT_IN_TEMPLATES[node.type]?.name || node.type))
      );
      row.append(icon, body);
      row.addEventListener('click', () => {
        snapshotHomePlace();
        row.blur();
        paintDetail(node);
      });
      list.appendChild(row);
    });
    if (!home.classList.contains('is-hidden')) list.scrollTop = listScroll;
  }

  async function refresh(preferredId) {
    const store = await readStore();
    investigations = store.investigations;
    folders = store.folders;
    paintSelect(preferredId ?? store.lastId);
    paintMeta();
    paintList();
    if (restoreListScroll) {
      list.scrollTop = restoreListScroll;
      listScroll = restoreListScroll;
      restoreListScroll = 0;
    } else if (!home.classList.contains('is-hidden')) {
      list.scrollTop = listScroll;
    }
    if (openCardId) {
      const inv = activeInvestigation();
      const node = inv?.data?.nodes?.find((item) => String(item.id) === String(openCardId));
      if (node) paintDetail(node, { animate: false });
      else closeCard();
    }
  }

  newSave.addEventListener('click', async () => {
    const name = newInput.value.trim();
    if (!name) {
      flashButton(newSave, 'Name?', true);
      return;
    }
    folders = await ensureFolder(folders);
    const created = {
      id: Date.now(),
      name,
      folderId: folders[0].id,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      data: { nodes: [], connections: [], shapes: [] }
    };
    investigations.push(created);
    skipRemote = true;
    await writeInvestigations(investigations, { last_investigation_id: created.id, osint_folders: folders });
    skipRemote = false;
    newInput.value = '';
    await refresh(created.id);
    flashButton(newSave, 'Created');
  });
  newInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') newSave.click();
  });

  addBtn.addEventListener('click', async () => {
    const inv = activeInvestigation();
    if (!inv) {
      flashButton(addBtn, 'Create a case first', true);
      return;
    }
    const title = titleInput.value.trim();
    if (!title) {
      flashButton(addBtn, 'Enter a title', true);
      return;
    }
    const template = BUILT_IN_TEMPLATES[selectedType];
    const customData = {};
    const titleField = template?.fields.find((f) => f.isTitle);
    if (titleField) customData[titleField.id] = title;
    const descField = descriptionField(selectedType);
    const desc = descInput.value.trim();
    if (desc && descField) customData[descField.id] = desc;

    const count = inv.data?.nodes?.length || 0;
    const newNode = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      x: 120 + (count % 4) * 40,
      y: 120 + (count % 5) * 36,
      width: 250,
      height: null,
      title,
      type: selectedType,
      customData,
      color: DEFAULT_CARD_COLOR,
      sources: []
    };
    if (!inv.data.nodes) inv.data.nodes = [];
    inv.data.nodes.push(newNode);
    inv.modified = new Date().toISOString();
    skipRemote = true;
    await writeInvestigations(investigations, { last_investigation_id: inv.id });
    skipRemote = false;
    titleInput.value = '';
    descInput.value = '';
    paintMeta();
    paintList();
    flashButton(addBtn, 'Added');
  });

  brw.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || skipRemote) return;
    if (changes.osint_investigations || changes.last_investigation_id || changes.osint_folders) {
      refresh(select.value);
    }
  });

  detail.addEventListener('scroll', () => {
    if (!detail.classList.contains('is-visible')) return;
    mergeViewState({
      tab: 'cases',
      view: 'investigationGraph',
      openCardId: detail.dataset.cardId || openCardId,
      caseDetailScroll: detail.scrollTop
    });
  }, { passive: true });

  return refresh();
}
