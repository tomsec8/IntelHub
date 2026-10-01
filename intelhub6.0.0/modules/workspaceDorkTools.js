import { brw, flashButton, createStyledSelect } from './utils.js';
import { DORK_FIELDS, FILETYPE_OPTIONS, buildDorkQueryFromValues } from './dorks.js';
import { apiNote, API_SOURCES, paintToolChrome } from './workspaceToolResults.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function fieldKey(field) {
  return field.prefix ?? '__free';
}

export function renderDorkTools(wrap, { values, onValuesChange }) {
  wrap.dataset.osintReady = '';
  const panel = paintToolChrome(wrap, 'Google Dorks');
  panel.appendChild(apiNote([API_SOURCES.googleSearch]));
  panel.appendChild(el('p', 'ws-image-note', 'Build a Google dork, then search or copy the query.'));

  const form = el('div', 'ws-dork-form');
  const inputs = {};
  function syncPreview() {
    onValuesChange({ ...readValues() });
    preview.value = buildDorkQueryFromValues(readValues());
  }

  DORK_FIELDS.forEach((field) => {
    const key = fieldKey(field);
    const label = el('label', 'ws-dork-field');
    label.appendChild(el('span', '', field.label));
    const input = el('input', 'ws-osint-search');
    input.type = field.type || 'text';
    input.placeholder = field.prefix ? `${field.prefix}:…` : 'any keywords';
    input.value = values?.[key] || '';
    input.addEventListener('input', syncPreview);

    if (field.prefix === 'filetype') {
      const combo = el('div', 'ws-dork-combo');
      const saved = String(values?.[key] || '').trim().toLowerCase();
      const select = createStyledSelect({
        placeholder: 'Choose type',
        value: FILETYPE_OPTIONS.includes(saved) ? saved : '',
        options: FILETYPE_OPTIONS.map((type) => ({ value: type, label: type })),
        onChange(type) {
          if (!type) return;
          input.value = type;
          syncPreview();
        }
      });
      input.placeholder = 'or type';
      input.addEventListener('input', () => {
        const typed = input.value.trim().toLowerCase();
        select.value = FILETYPE_OPTIONS.includes(typed) ? typed : '';
      });
      combo.append(select, input);
      label.appendChild(combo);
    } else {
      label.appendChild(input);
    }

    inputs[key] = input;
    form.appendChild(label);
  });

  function readValues() {
    const next = {};
    Object.entries(inputs).forEach(([key, input]) => {
      next[key] = input.value;
    });
    return next;
  }

  const preview = el('textarea', 'ws-dork-preview');
  preview.readOnly = true;
  preview.rows = 3;
  preview.placeholder = 'Query preview';
  preview.value = buildDorkQueryFromValues(readValues());

  const actions = el('div', 'ws-image-actions');
  const searchBtn = el('button', 'ws-btn', 'Search on Google');
  const copyBtn = el('button', 'ws-btn ws-btn-ghost', 'Copy dork');
  searchBtn.type = copyBtn.type = 'button';

  searchBtn.addEventListener('click', () => {
    const query = buildDorkQueryFromValues(readValues());
    preview.value = query;
    if (!query) {
      flashButton(searchBtn, 'Empty query', true);
      return;
    }
    brw.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, active: false });
    flashButton(searchBtn, 'Opened search');
  });

  copyBtn.addEventListener('click', async () => {
    const query = buildDorkQueryFromValues(readValues());
    preview.value = query;
    if (!query) {
      flashButton(copyBtn, 'Empty query', true);
      return;
    }
    await navigator.clipboard.writeText(query);
    flashButton(copyBtn, 'Copied');
  });

  actions.append(searchBtn, copyBtn);
  panel.append(form, preview, actions);
}
