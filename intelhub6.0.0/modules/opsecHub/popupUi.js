import { brw, mergeViewState, getCachedViewState } from '../utils.js';
import {
  ensureModulePermissions,
  showPermToast
} from './js/optional-permissions.mjs';
import { SECURITY_MODULES, PRIVACY_MODULES } from './moduleCatalog.js';
import { buildProxyBox } from './proxyProfiles.js';
import { opsecIcon } from './opsecIcons.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function buildModuleRow(mod, states) {
  const row = el('div', 'opsec-module');
  row.dataset.module = mod.id;

  const iconWrap = el('span', 'opsec-module-icon');
  iconWrap.appendChild(opsecIcon(mod.id, 15));
  const info = el('div', 'opsec-module-info');
  info.append(el('strong', '', mod.name), el('span', '', mod.desc));
  row.append(iconWrap, info);

  const label = el('label', 'opsec-toggle');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!states[mod.id];
  input.dataset.module = mod.id;
  label.append(input, el('span', 'opsec-toggle-slider'));
  row.appendChild(label);

  if (mod.proxy) {
    const proxyBox = buildProxyBox({ hidden: !input.checked, boxClass: 'opsec-proxy-box' });
    row.appendChild(proxyBox);
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
        if (mod.proxy) row.querySelector('.opsec-proxy-box').hidden = true;
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
        if (mod.proxy) row.querySelector('.opsec-proxy-box').hidden = !input.checked;
        showPermToast(res?.error || 'Could not toggle module.', { isError: true });
      }
    } catch (err) {
      input.checked = !wantOn;
      if (mod.proxy) row.querySelector('.opsec-proxy-box').hidden = !input.checked;
      showPermToast(err?.message || 'Background unavailable.', { isError: true });
    }
  });

  return row;
}

function paintSection(title, modules, states, panelId) {
  const section = el('section', 'opsec-section');
  if (panelId) section.dataset.panel = panelId;
  section.appendChild(el('p', 'opsec-section-label', title));
  const list = el('div', 'opsec-module-list');
  modules.forEach((mod) => list.appendChild(buildModuleRow(mod, states)));
  section.appendChild(list);
  return section;
}

export function applyOpsecSubtab(subtab) {
  const container = document.getElementById('opsecHubContainer');
  if (!container) return;
  const want = subtab === 'privacy' ? 'privacy' : 'security';
  container.querySelectorAll('.opsec-subtab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.subtab === want);
  });
  container.querySelectorAll('.opsec-section').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== want;
  });
}

export async function initializeOpsecHub(container) {
  if (!container) return;

  container.replaceChildren();
  const sub = el('div', 'opsec-subtabs');
  const btnSec = el('button', 'opsec-subtab active');
  btnSec.type = 'button';
  btnSec.dataset.subtab = 'security';
  btnSec.append(opsecIcon('security', 14), document.createTextNode('Security'));
  const btnPriv = el('button', 'opsec-subtab');
  btnPriv.type = 'button';
  btnPriv.dataset.subtab = 'privacy';
  btnPriv.append(opsecIcon('privacy', 14), document.createTextNode('Privacy'));
  sub.append(btnSec, btnPriv);
  container.appendChild(sub);

  const body = el('div', 'opsec-body');
  container.appendChild(body);

  let states = {};
  try {
    const res = await brw.runtime.sendMessage({ action: 'getOpsecStates' });
    states = res?.moduleStates || {};
  } catch {
    try {
      const data = await brw.storage.local.get({ moduleStates: {} });
      states = data.moduleStates || {};
    } catch {
      states = {};
    }
  }

  const secPanel = paintSection('Security', SECURITY_MODULES, states, 'security');
  const privPanel = paintSection('Privacy', PRIVACY_MODULES, states, 'privacy');
  privPanel.hidden = true;
  body.append(secPanel, privPanel);

  const showSubtab = (subtab) => {
    applyOpsecSubtab(subtab);
    mergeViewState({ tab: 'opsec', view: 'opsec', opsecSubtab: subtab });
  };

  btnSec.addEventListener('click', () => showSubtab('security'));
  btnPriv.addEventListener('click', () => showSubtab('privacy'));
  applyOpsecSubtab(getCachedViewState().opsecSubtab);

  brw.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.moduleStates) return;
    const next = changes.moduleStates.newValue || {};
    container.querySelectorAll('.opsec-toggle input[data-module]').forEach((input) => {
      input.checked = !!next[input.dataset.module];
      const proxyBox = input.closest('.opsec-module')?.querySelector('.opsec-proxy-box');
      if (proxyBox) proxyBox.hidden = !input.checked;
    });
  });
}
