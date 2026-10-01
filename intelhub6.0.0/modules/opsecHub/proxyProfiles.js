import { brw, createPopupSelect, flashButton } from '../utils.js';
import { opsecIcon } from './opsecIcons.js';

const STORAGE_KEY = 'customProxies';
const SELECTED_KEY = 'selectedProxyProfile';

const BURP = { type: 'http', host: '127.0.0.1', port: '8080' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function parseProxyAddress(raw, typeHint = 'http') {
  let text = String(raw || '').trim();
  if (!text) return null;

  let type = typeHint === 'socks5' ? 'socks5' : 'http';
  const proto = text.match(/^(socks5?|https?):\/\//i);
  if (proto) {
    const scheme = proto[1].toLowerCase();
    type = scheme.startsWith('socks') ? 'socks5' : 'http';
    text = text.slice(proto[0].length);
  }

  const authAt = text.lastIndexOf('@');
  if (authAt !== -1) text = text.slice(authAt + 1);

  let host = '';
  let port = '';
  if (text.startsWith('[')) {
    const end = text.indexOf(']');
    if (end === -1) return null;
    host = text.slice(1, end);
    port = text.slice(end + 1).replace(/^:/, '');
  } else {
    const colon = text.lastIndexOf(':');
    if (colon === -1) return null;
    host = text.slice(0, colon);
    port = text.slice(colon + 1);
  }

  host = host.trim();
  port = String(port).trim();
  const portNum = parseInt(port, 10);
  if (!host || !/^[a-zA-Z0-9.\-:]+$/.test(host)) return null;
  if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) return null;
  return { type, host, port: String(portNum) };
}

export async function loadProxyProfiles() {
  const data = await brw.storage.local.get({
    [STORAGE_KEY]: [],
    [SELECTED_KEY]: 'burp'
  });
  return {
    proxies: Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [],
    selected: data[SELECTED_KEY] && data[SELECTED_KEY] !== 'auto' ? data[SELECTED_KEY] : 'burp'
  };
}

function profileLabel(proxy) {
  return proxy.label || `${proxy.type}://${proxy.host}:${proxy.port}`;
}

function selectOptions(proxies) {
  return [
    { value: 'burp', label: 'Burp Suite (127.0.0.1:8080)' },
    ...proxies.map((proxy) => ({ value: proxy.id, label: profileLabel(proxy) }))
  ];
}

async function applyProfile(value, proxies) {
  await brw.storage.local.set({ [SELECTED_KEY]: value });
  if (value === 'burp') {
    await brw.runtime.sendMessage({ action: 'setProxy', config: BURP });
    return;
  }
  const found = proxies.find((proxy) => proxy.id === value);
  if (!found) {
    await brw.runtime.sendMessage({ action: 'setProxy', config: BURP });
    await brw.storage.local.set({ [SELECTED_KEY]: 'burp', activeProxy: BURP });
    return;
  }
  await brw.runtime.sendMessage({
    action: 'setProxy',
    config: { type: found.type, host: found.host, port: String(found.port) }
  });
}

export function buildProxyBox({ hidden = false, boxClass = 'opsec-proxy-box' } = {}) {
  const box = el('div', boxClass);
  box.hidden = hidden;

  box.appendChild(el('label', '', 'Proxy profile'));

  let proxies = [];
  const select = createPopupSelect({
    className: 'opsec-proxy-select',
    options: selectOptions([]),
    value: 'burp',
    onChange: (value) => applyProfile(value, proxies).catch(() => {})
  });
  box.appendChild(select.el);

  const addRow = el('div', 'opsec-proxy-add');
  const typeSelect = createPopupSelect({
    className: 'opsec-proxy-type',
    options: [
      { value: 'http', label: 'HTTP' },
      { value: 'socks5', label: 'SOCKS5' }
    ],
    value: 'http'
  });
  const address = document.createElement('input');
  address.className = 'opsec-proxy-input';
  address.type = 'text';
  address.placeholder = 'host:port';
  address.autocomplete = 'off';
  const addBtn = el('button', 'opsec-proxy-btn');
  addBtn.type = 'button';
  const addText = el('span', '', 'Add');
  addBtn.append(opsecIcon('plus', 13), addText);
  addRow.append(typeSelect.el, address, addBtn);
  box.appendChild(addRow);

  const list = el('div', 'opsec-proxy-list');
  box.appendChild(list);

  function paintList(selected) {
    list.replaceChildren();
    if (!proxies.length) {
      list.appendChild(el('p', 'opsec-proxy-empty', 'No saved proxies yet. Add host:port above.'));
      return;
    }
    proxies.forEach((proxy) => {
      const row = el('div', 'opsec-proxy-item');
      if (proxy.id === selected) row.classList.add('is-active');
      const pick = el('button', 'opsec-proxy-pick');
      pick.type = 'button';
      pick.append(
        el('strong', '', profileLabel(proxy)),
        el('span', '', `${proxy.type}://${proxy.host}:${proxy.port}`)
      );
      pick.addEventListener('click', async () => {
        select.value = proxy.id;
        await applyProfile(proxy.id, proxies);
        paintList(proxy.id);
      });
      const remove = el('button', 'opsec-proxy-remove');
      remove.type = 'button';
      remove.title = 'Remove proxy';
      remove.appendChild(opsecIcon('close', 12));
      remove.addEventListener('click', async () => {
        proxies = proxies.filter((item) => item.id !== proxy.id);
        await brw.storage.local.set({ [STORAGE_KEY]: proxies });
        const next = select.value === proxy.id ? 'burp' : select.value;
        select.setOptions(selectOptions(proxies), next);
        if (next === 'burp') await applyProfile('burp', proxies);
        paintList(next);
      });
      row.append(pick, remove);
      list.appendChild(row);
    });
  }

  async function refresh() {
    const stored = await loadProxyProfiles();
    proxies = stored.proxies;
    const selected = proxies.some((proxy) => proxy.id === stored.selected) || stored.selected === 'burp'
      ? stored.selected
      : 'burp';
    select.setOptions(selectOptions(proxies), selected);
    paintList(selected);
  }

  addBtn.addEventListener('click', async () => {
    const parsed = parseProxyAddress(address.value, typeSelect.value);
    if (!parsed) {
      flashButton(addText, 'Invalid', true);
      return;
    }
    const exists = proxies.some((proxy) => (
      proxy.host === parsed.host && String(proxy.port) === parsed.port && proxy.type === parsed.type
    ));
    if (exists) {
      flashButton(addText, 'Exists', true);
      return;
    }
    const created = {
      id: `px-${Date.now()}`,
      type: parsed.type,
      host: parsed.host,
      port: parsed.port,
      label: `${parsed.type}://${parsed.host}:${parsed.port}`
    };
    proxies = [...proxies, created];
    await brw.storage.local.set({ [STORAGE_KEY]: proxies });
    select.setOptions(selectOptions(proxies), created.id);
    await applyProfile(created.id, proxies);
    address.value = '';
    paintList(created.id);
    flashButton(addText, 'Saved');
  });

  address.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addBtn.click();
  });

  refresh();
  return box;
}
