import { brw } from '../utils.js';
import { buildProxyBox } from './proxyProfiles.js';
import {
  ensureModulePermissions,
  showPermToast
} from './js/optional-permissions.mjs';
import { SECURITY_MODULES, PRIVACY_MODULES } from './moduleCatalog.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

async function loadStates() {
  try {
    const res = await brw.runtime.sendMessage({ action: 'getOpsecStates' });
    return res?.moduleStates || {};
  } catch {
    try {
      const data = await brw.storage.local.get({ moduleStates: {} });
      return data.moduleStates || {};
    } catch {
      return {};
    }
  }
}

function buildVerifyRow(tests) {
  if (!tests?.length) return null;
  const row = el('div', 'opsec-ws-verify');
  row.appendChild(el('span', 'opsec-ws-verify-label', 'Verify:'));
  tests.forEach((test) => {
    const btn = el('button', 'ws-btn ws-btn-ghost opsec-ws-verify-btn', test.label);
    btn.type = 'button';
    btn.title = `Open ${test.label}`;
    btn.addEventListener('click', () => {
      brw.tabs.create({ url: test.url, active: true }).catch(() => {});
    });
    row.appendChild(btn);
  });
  return row;
}

function buildCard(mod, states) {
  const card = el('div', 'opsec-ws-card');
  card.dataset.module = mod.id;

  const head = el('div', 'opsec-ws-card-head');
  const titles = el('div', 'opsec-ws-card-titles');
  titles.append(el('strong', '', mod.name), el('span', '', mod.desc));
  head.appendChild(titles);

  const label = el('label', 'opsec-toggle');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!states[mod.id];
  input.dataset.module = mod.id;
  label.append(input, el('span', 'opsec-toggle-slider'));
  head.appendChild(label);
  card.appendChild(head);

  card.appendChild(el('p', 'opsec-ws-detail', mod.detail));

  const verifyRow = buildVerifyRow(mod.tests);
  if (verifyRow) card.appendChild(verifyRow);

  let proxyBox = null;
  if (mod.proxy) {
    proxyBox = buildProxyBox({ hidden: !input.checked, boxClass: 'opsec-proxy-box' });
    card.appendChild(proxyBox);
    input.addEventListener('change', () => {
      proxyBox.hidden = !input.checked;
    });
  }

  input.addEventListener('change', async () => {
    const wantOn = input.checked;
    if (wantOn) {
      const result = await ensureModulePermissions(mod.id);
      if (!result.granted) {
        input.checked = false;
        if (proxyBox) proxyBox.hidden = true;
        showPermToast(result.cancelled ? 'Permission request cancelled.' : 'Permission denied.', { isError: true });
        return;
      }
    }
    try {
      const res = await brw.runtime.sendMessage({
        action: 'toggleModule',
        module: mod.id,
        enabled: wantOn
      });
      if (!res?.success) {
        input.checked = !wantOn;
        if (proxyBox) proxyBox.hidden = !input.checked;
        showPermToast(res?.error || 'Could not toggle module.', { isError: true });
      }
    } catch (err) {
      input.checked = !wantOn;
      if (proxyBox) proxyBox.hidden = !input.checked;
      showPermToast(err?.message || 'Background unavailable.', { isError: true });
    }
  });

  return card;
}

function paintGroup(wrap, title, modules, states) {
  wrap.appendChild(el('p', 'opsec-ws-group-label', title));
  const list = el('div', 'opsec-ws-list');
  modules.forEach((mod) => list.appendChild(buildCard(mod, states)));
  wrap.appendChild(list);
}

export async function renderOpsecProtections(wrap, { onBack } = {}) {
  wrap.className = 'ws-image opsec-ws-protections';
  wrap.replaceChildren();

  if (typeof onBack === 'function') {
    const bar = el('div', 'ws-image-bar');
    const back = el('button', 'ws-btn ws-btn-ghost', 'Back');
    back.type = 'button';
    back.addEventListener('click', onBack);
    bar.append(back, el('h2', '', 'Protections'));
    wrap.appendChild(bar);
  }

  wrap.appendChild(el('p', 'ws-image-note', 'Turn each OPSEC protection on or off. Use Verify to open an external test page.'));

  const states = await loadStates();
  paintGroup(wrap, 'Security', SECURITY_MODULES, states);
  paintGroup(wrap, 'Privacy', PRIVACY_MODULES, states);

  const onChanged = (changes, area) => {
    if (area !== 'local' || !changes.moduleStates) return;
    if (!wrap.isConnected) {
      brw.storage.onChanged.removeListener(onChanged);
      return;
    }
    const next = changes.moduleStates.newValue || {};
    wrap.querySelectorAll('.opsec-toggle input[data-module]').forEach((input) => {
      input.checked = !!next[input.dataset.module];
      const proxyBox = input.closest('.opsec-ws-card')?.querySelector('.opsec-proxy-box');
      if (proxyBox) proxyBox.hidden = !input.checked;
    });
  };
  brw.storage.onChanged.addListener(onChanged);
}
