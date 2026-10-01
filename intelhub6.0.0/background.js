const brw = typeof browser !== 'undefined' ? browser : chrome;

import webrtcModule from './modules/opsecHub/webrtc/index.js';
import mediaBlockModule from './modules/opsecHub/mediaBlock/index.js';
import locationBlockModule from './modules/opsecHub/locationBlock/index.js';
import googleTelemetryModule from './modules/opsecHub/googleTelemetry/index.js';
import privacyHeadersModule from './modules/opsecHub/privacyHeaders/index.js';
import cookieGuardModule from './modules/opsecHub/cookieGuard/index.js';
import forceHttpsModule from './modules/opsecHub/forceHttps/index.js';
import { proxyManagerModule } from './modules/opsecHub/proxyManager/proxyManager.js';
import clipboardGuardModule from './modules/opsecHub/clipboardGuard/index.js';
import {
  hasModuleOptionalPermissions,
  modulesNeedingPermission,
  MODULE_OPTIONAL_PERMISSIONS
} from './modules/opsecHub/js/optional-permissions.mjs';
import { checkUsernameSite } from './modules/usernameCheck.js';
import { fetchPublic, fetchPublicFinal, publicFetchUrl } from './modules/publicFetchUrl.js';

const usernameScanControllers = new Map();

function addUsernameScanController(scanId, controller) {
  if (!scanId) return;
  let group = usernameScanControllers.get(scanId);
  if (!group) {
    group = new Set();
    usernameScanControllers.set(scanId, group);
  }
  group.add(controller);
}

function removeUsernameScanController(scanId, controller) {
  const group = usernameScanControllers.get(scanId);
  if (!group) return;
  group.delete(controller);
  if (group.size === 0) usernameScanControllers.delete(scanId);
}

function abortUsernameScan(scanId) {
  const group = usernameScanControllers.get(scanId);
  if (!group) return;
  for (const controller of group) controller.abort();
  usernameScanControllers.delete(scanId);
}

const HTTP_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function resolveRedirectLocation(currentUrl, location) {
  const loc = String(location || '').trim();
  if (!loc) return '';
  try {
    return new URL(loc, currentUrl).href;
  } catch {
    return '';
  }
}

async function traceRedirectChain(startUrl, maxHops = 15) {
  const hops = [];
  let current = String(startUrl || '').trim();
  const seen = new Set();

  for (let i = 0; i < maxHops; i++) {
    if (!current) break;
    if (seen.has(current)) {
      hops.push({ url: current, status: 0, note: 'Redirect loop' });
      break;
    }
    seen.add(current);

    let res;
    try {
      res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store',
        credentials: 'omit',
        headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' }
      });
    } catch (err) {
      hops.push({ url: current, status: 0, note: err.message || 'Fetch failed' });
      break;
    }

    if (res.type === 'opaqueredirect') {
      try {
        const followed = await fetch(current, {
          method: 'GET',
          redirect: 'follow',
          cache: 'no-store',
          credentials: 'omit'
        });
        const finalUrl = followed.url || '';
        hops.push({ url: current, status: 0, note: 'HTTP redirect (status hidden)' });
        if (finalUrl && finalUrl !== current) {
          hops.push({ url: finalUrl, status: followed.status || 0 });
        }
      } catch {
        hops.push({
          url: current,
          status: 0,
          note: 'Redirect hidden (missing host permission)'
        });
      }
      break;
    }

    const status = res.status || 0;
    const location = res.headers.get('Location') || '';
    hops.push({ url: current, status, location: location || undefined });

    if (!HTTP_REDIRECT_STATUSES.has(status)) break;

    const next = resolveRedirectLocation(current, location);
    if (!next || next === current) {
      if (!location) hops[hops.length - 1].note = `${status} with no Location header`;
      break;
    }
    if (!publicFetchUrl(next)) {
      hops.push({ url: next, status: 0, note: 'Stopped — not a public http(s) address' });
      break;
    }
    current = next;
  }

  return hops;
}

const IN_MEMORY_LISTENER_MODULES = ['cookieGuard', 'proxyManager'];

async function sanitizeOptionalModuleStates() {
  const data = await brw.storage.local.get({ moduleStates: {} });
  const states = { ...(data.moduleStates || {}) };
  let changed = false;
  for (const id of Object.keys(MODULE_OPTIONAL_PERMISSIONS)) {
    if (!states[id]) continue;
    const ok = await hasModuleOptionalPermissions(id);
    if (!ok) {
      states[id] = false;
      changed = true;
      try {
        await handleModuleToggle(id, false);
      } catch {
        /* ignore */
      }
    }
  }
  if (changed) await brw.storage.local.set({ moduleStates: states });
}

async function rebindInMemoryModules() {
  const { moduleStates } = await brw.storage.local.get({ moduleStates: {} });
  for (const mod of IN_MEMORY_LISTENER_MODULES) {
    if (moduleStates[mod] !== true) continue;
    await handleModuleToggle(mod, true).catch((err) =>
      console.error(`[OPSECHub] Failed to re-bind ${mod}:`, err)
    );
  }
}

async function initializeModulesSafely() {
  await sanitizeOptionalModuleStates();
  const d = await brw.storage.local.get({ moduleStates: {} });
  const states = d.moduleStates || {};
  for (const [mod, enabled] of Object.entries(states)) {
    if (!enabled) continue;
    if (mod === 'adBlocker' || mod === 'threatIntel') continue;
    try {
      await handleModuleToggle(mod, true);
    } catch (err) {
      console.warn(`[OPSECHub] Startup enable failed for ${mod}:`, err);
    }
  }
  await rebindInMemoryModules();
  if (states.proxyManager !== true) {
    await proxyManagerModule.clearProxy();
  }
}

async function isProxyModuleOn() {
  const { moduleStates } = await brw.storage.local.get({ moduleStates: {} });
  return moduleStates?.proxyManager === true;
}

async function applyStoredProxyIfEnabled() {
  if (!(await isProxyModuleOn())) {
    await proxyManagerModule.clearProxy();
    return;
  }
  const data = await brw.storage.local.get('activeProxy');
  if (data.activeProxy) await proxyManagerModule.setProxy(data.activeProxy);
  else await proxyManagerModule.clearProxy();
}

async function handleModuleToggle(module, enabled) {
  if (enabled) {
    const ok = await hasModuleOptionalPermissions(module);
    if (!ok) {
      return { success: false, error: 'permission_required', code: 'permission_required' };
    }
  }

  switch (module) {
    case 'proxyManager':
      if (!enabled) await proxyManagerModule.clearProxy();
      else await applyStoredProxyIfEnabled();
      break;
    case 'webrtcBlock':
      await webrtcModule.toggle(enabled);
      break;
    case 'mediaBlock':
      await mediaBlockModule.toggle(enabled);
      break;
    case 'locationBlock':
      await locationBlockModule.toggle(enabled);
      break;
    case 'clipboardGuard':
      await clipboardGuardModule.toggle(enabled);
      break;
    case 'googleTelemetry':
      await googleTelemetryModule.toggle(enabled);
      break;
    case 'privacyHeaders':
      await privacyHeadersModule.toggle(enabled);
      break;
    case 'cookieGuard':
      await cookieGuardModule.toggle(enabled);
      break;
    case 'forceHttps':
      await forceHttpsModule.toggle(enabled);
      break;
    default:
      break;
  }
  return { success: true };
}

brw.runtime.onInstalled.addListener(() => {
  initializeModulesSafely().catch((err) => console.error('[OPSECHub] onInstalled failed:', err));
});

brw.runtime.onStartup.addListener(() => {
  initializeModulesSafely().catch((err) => console.error('[OPSECHub] onStartup failed:', err));
});

initializeModulesSafely().catch((err) => console.error('[OPSECHub] boot failed:', err));

if (brw.sidePanel?.setOptions) {
  brw.sidePanel.setOptions({
    path: 'sidepanel.html',
    enabled: true
  }).catch((err) => console.warn('[sidePanel] setOptions failed:', err));
}

async function fetchRdapJson(url) {
  let res = await fetch(url, { cache: 'no-store', redirect: 'manual' });
  let finalUrl = url;
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('Location');
    if (!location) return null;
    finalUrl = new URL(location, url).href;
    res = await fetch(finalUrl, { cache: 'no-store', redirect: 'follow' });
  } else if (!res.ok) {
    return null;
  }
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json || json.errorCode) return null;
  return { json, url: res.url || finalUrl };
}

function ipRdapFallbacks(ip) {
  const q = encodeURIComponent(ip);
  return [
    `https://rdap.arin.net/registry/ip/${q}`,
    `https://rdap.db.ripe.net/ip/${q}`,
    `https://rdap.apnic.net/ip/${q}`,
    `https://rdap.lacnic.net/rdap/ip/${q}`,
    `https://rdap.afrinic.net/rdap/ip/${q}`
  ];
}

async function lookupRdap(kind, query) {
  const encoded = encodeURIComponent(query);
  const bootstrap = kind === 'domain'
    ? `https://rdap.org/domain/${encoded}`
    : `https://rdap.org/ip/${encoded}`;
  const first = await fetchRdapJson(bootstrap).catch(() => null);
  if (first) return first;
  if (kind !== 'ip') return null;
  const hits = await Promise.all(ipRdapFallbacks(query).map((url) => fetchRdapJson(url).catch(() => null)));
  return hits.find(Boolean) || null;
}

function blockchainInfoUrl(kind, query, offset = 0) {
  const q = encodeURIComponent(String(query || '').trim());
  if (!q) throw new Error('No query');
  if (kind === 'balance') return `https://blockchain.info/balance?active=${q}&cors=true`;
  if (kind === 'address') {
    const skip = Math.max(0, Number(offset) || 0);
    return `https://blockchain.info/rawaddr/${q}?limit=10&offset=${skip}&cors=true`;
  }
  if (kind === 'tx') return `https://blockchain.info/rawtx/${q}?cors=true`;
  if (kind === 'unspent') return `https://blockchain.info/unspent?active=${q}&limit=20&cors=true`;
  throw new Error('Invalid blockchain.info lookup');
}

function asSats(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function slimBcTx(tx) {
  return {
    hash: tx.hash || '',
    fee: asSats(tx.fee),
    result: asSats(tx.result),
    time: tx.time || 0,
    block_height: tx.block_height ?? null,
    inputs: (tx.inputs || []).slice(0, 16).map((vin) => ({
      prev_out: vin.prev_out
        ? { addr: vin.prev_out.addr || '', value: asSats(vin.prev_out.value) }
        : null
    })),
    out: (tx.out || []).slice(0, 16).map((vout) => ({
      addr: vout.addr || '',
      type: vout.type || '',
      value: asSats(vout.value)
    }))
  };
}

function slimBlockchainPayload(kind, json) {
  if (!json || typeof json !== 'object') return json;
  if (kind === 'address') {
    return {
      address: json.address || '',
      n_tx: asSats(json.n_tx),
      n_unredeemed: asSats(json.n_unredeemed),
      total_received: asSats(json.total_received),
      total_sent: asSats(json.total_sent),
      final_balance: asSats(json.final_balance),
      txs: (json.txs || []).slice(0, 10).map(slimBcTx)
    };
  }
  if (kind === 'tx') return slimBcTx(json);
  if (kind === 'unspent') {
    return {
      unspent_outputs: (json.unspent_outputs || []).slice(0, 20).map((item) => ({
        tx_hash: item.tx_hash_big_endian || item.tx_hash || '',
        tx_output_n: asSats(item.tx_output_n),
        value: asSats(item.value),
        confirmations: asSats(item.confirmations)
      }))
    };
  }
  return json;
}

async function fetchBlockchainJson(kind, query, offset = 0) {
  const url = blockchainInfoUrl(kind, query, offset);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (res.status === 500 || res.status === 404) {
      const text = await res.text().catch(() => '');
      if (kind === 'unspent' && /no free outputs/i.test(text)) return { unspent_outputs: [] };
      throw new Error('No record for this value.');
    }
    if (res.status === 429) throw new Error('Rate limited. Wait a moment and try again.');
    if (!res.ok) throw new Error(`blockchain.info HTTP ${res.status}`);
    const json = await res.json();
    return slimBlockchainPayload(kind, json);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The lookup timed out.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function ethBlockscoutUrl(kind, query) {
  const q = encodeURIComponent(String(query || '').trim());
  if (!q) throw new Error('No query');
  if (kind === 'address') return `https://eth.blockscout.com/api/v2/addresses/${q}`;
  if (kind === 'txs') return `https://eth.blockscout.com/api/v2/addresses/${q}/transactions`;
  if (kind === 'tokens') return `https://eth.blockscout.com/api/v2/addresses/${q}/token-balances`;
  if (kind === 'tx') return `https://eth.blockscout.com/api/v2/transactions/${q}`;
  throw new Error('Invalid Ethereum lookup');
}

async function fetchJsonUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (res.status === 404) throw new Error('No record for this value.');
    if (res.status === 429) throw new Error('Rate limited. Wait a moment and try again.');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The lookup timed out.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function slimEthplorerTokens(json) {
  return (json.tokens || []).slice(0, 20).map((item) => ({
    symbol: item.tokenInfo?.symbol || 'Token',
    name: item.tokenInfo?.name || '',
    decimals: String(item.tokenInfo?.decimals || '18'),
    value: String(item.rawBalance || item.balance || '0'),
    type: 'ERC-20',
    address: item.tokenInfo?.address || ''
  }));
}

function slimEthplorerAddress(json) {
  if (json?.error) throw new Error(json.error.message || 'Ethplorer error');
  return {
    hash: json.address || '',
    coin_balance: String(json.ETH?.rawBalance || '0'),
    is_contract: !!json.contractInfo,
    ens_domain_name: '',
    is_scam: false,
    exchange_rate: json.ETH?.price?.rate || '',
    tokens: slimEthplorerTokens(json)
  };
}

function slimEthplorerNativeTx(tx) {
  return {
    hash: tx.hash || '',
    value: String(tx.rawValue ?? tx.value ?? '0'),
    fee: '0',
    timestamp: tx.timestamp || null,
    block_number: tx.success === false ? null : (tx.blockNumber || 1),
    status: tx.success === false ? 'error' : 'ok',
    method: 'ETH',
    from: tx.from || '',
    to: tx.to || '',
    to_name: '',
    params: []
  };
}

function slimEthplorerTokenOp(op) {
  return {
    hash: op.transactionHash || '',
    value: '0',
    fee: '0',
    timestamp: op.timestamp || null,
    block_number: 1,
    status: 'ok',
    method: op.type || 'transfer',
    from: op.from || '',
    to: op.to || '',
    to_name: op.tokenInfo?.symbol || 'Token',
    token_decimals: String(op.tokenInfo?.decimals || ''),
    params: [
      { name: 'value', value: String(op.value || '0') },
      { name: 'to', value: op.to || '' }
    ]
  };
}

async function fetchEthplorer(kind, query) {
  const q = encodeURIComponent(String(query || '').trim());
  const key = 'apiKey=freekey';
  if (kind === 'address') {
    return slimEthplorerAddress(await fetchJsonUrl(`https://api.ethplorer.io/getAddressInfo/${q}?${key}`));
  }
  if (kind === 'tokens') {
    return slimEthplorerAddress(await fetchJsonUrl(`https://api.ethplorer.io/getAddressInfo/${q}?${key}`)).tokens;
  }
  if (kind === 'txs') {
    const [native, history] = await Promise.all([
      fetchJsonUrl(`https://api.ethplorer.io/getAddressTransactions/${q}?${key}&limit=10`).catch(() => []),
      fetchJsonUrl(`https://api.ethplorer.io/getAddressHistory/${q}?${key}&limit=10`).catch(() => ({ operations: [] }))
    ]);
    const items = [
      ...(Array.isArray(native) ? native.map(slimEthplorerNativeTx) : []),
      ...((history.operations || []).map(slimEthplorerTokenOp))
    ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 15);
    return { items };
  }
  if (kind === 'tx') {
    const json = await fetchJsonUrl(`https://api.ethplorer.io/getTxInfo/${q}?${key}`);
    if (json?.error) throw new Error(json.error.message || 'Ethplorer error');
    const firstOp = (json.operations || [])[0];
    if (firstOp) return slimEthplorerTokenOp({ ...firstOp, transactionHash: json.hash || query });
    return slimEthplorerNativeTx({
      hash: json.hash || query,
      from: json.from,
      to: json.to,
      rawValue: json.rawValue || json.value,
      timestamp: json.timestamp,
      success: json.success !== false
    });
  }
  throw new Error('Invalid Ethereum lookup');
}

function slimEthTx(tx) {
  return {
    hash: tx.hash || '',
    value: String(tx.value || '0'),
    fee: String(tx.fee?.value || '0'),
    timestamp: tx.timestamp || null,
    block_number: tx.block_number ?? null,
    status: tx.status || tx.result || '',
    method: tx.method || tx.decoded_input?.method_call || '',
    from: tx.from?.hash || '',
    to: tx.to?.hash || '',
    to_name: tx.to?.name || '',
    params: (tx.decoded_input?.parameters || []).slice(0, 6).map((param) => ({
      name: param.name || '',
      value: typeof param.value === 'string' ? param.value : String(param.value ?? '')
    }))
  };
}

function slimEthPayload(kind, json) {
  if (kind === 'address' && json && typeof json === 'object') {
    return {
      hash: json.hash || '',
      coin_balance: String(json.coin_balance || '0'),
      is_contract: !!json.is_contract,
      ens_domain_name: json.ens_domain_name || '',
      is_scam: !!json.is_scam,
      exchange_rate: json.exchange_rate || ''
    };
  }
  if (kind === 'txs') {
    const items = Array.isArray(json?.items) ? json.items : [];
    return { items: items.slice(0, 15).map(slimEthTx) };
  }
  if (kind === 'tokens') {
    const list = Array.isArray(json) ? json : [];
    return list.slice(0, 20).map((item) => ({
      symbol: item.token?.symbol || 'Token',
      name: item.token?.name || '',
      decimals: String(item.token?.decimals || '18'),
      value: String(item.value || '0'),
      type: item.token?.type || 'ERC-20',
      address: item.token?.address_hash || ''
    }));
  }
  if (kind === 'tx') return slimEthTx(json || {});
  return json;
}

async function fetchBlockscoutJson(kind, query) {
  const url = ethBlockscoutUrl(kind, query);
  const json = await fetchJsonUrl(url);
  return slimEthPayload(kind, json);
}

async function fetchEthJson(kind, query) {
  try {
    return await fetchEthplorer(kind, query);
  } catch (err) {
    try {
      return await fetchBlockscoutJson(kind, query);
    } catch {
      throw err;
    }
  }
}

brw.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;
  if (sender?.id && sender.id !== brw.runtime.id) return false;

  if (message.action === 'toggleModule') {
    const { module, enabled } = message;
    (async () => {
      const data = await brw.storage.local.get({ moduleStates: {} });
      const states = { ...(data.moduleStates || {}) };
      const res = await handleModuleToggle(module, !!enabled);
      if (res.success !== false) {
        states[module] = !!enabled;
        await brw.storage.local.set({ moduleStates: states });
      }
      sendResponse(res && typeof res === 'object' ? { success: res.success !== false, ...res } : { success: true });
    })().catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }

  if (message.action === 'cookieGuardPagehide') {
    cookieGuardModule.noteOrigin(sender.tab?.id, message.origin);
    return false;
  }

  if (message.action === 'getOpsecStates') {
    brw.storage.local.get({ moduleStates: {}, activeProxy: null, locationMode: 'block' }).then((data) => {
      sendResponse({ success: true, ...data });
    });
    return true;
  }

  if (message.action === 'setProxy') {
    const { config } = message;
    (async () => {
      if (config) {
        if (
          typeof config.host !== 'string' ||
          typeof config.port === 'undefined' ||
          !/^[a-zA-Z0-9.\-:]+$/.test(config.host) ||
          Number.isNaN(parseInt(config.port, 10)) ||
          parseInt(config.port, 10) < 1 ||
          parseInt(config.port, 10) > 65535
        ) {
          sendResponse({ success: false, error: 'Invalid proxy configuration' });
          return;
        }
        await brw.storage.local.set({ activeProxy: config });
        if (await isProxyModuleOn()) {
          const applied = await proxyManagerModule.setProxy(config);
          if (applied === false) {
            sendResponse({ success: false, error: 'Proxy could not be applied' });
            return;
          }
        } else {
          await proxyManagerModule.clearProxy();
        }
      } else {
        await proxyManagerModule.clearProxy();
        await brw.storage.local.set({ activeProxy: null });
      }
      sendResponse({ success: true });
    })().catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }

  if (message.action === 'fetchSecurityHeaders') {
    const targetUrl = publicFetchUrl(message.targetUrl);
    if (!targetUrl) {
      sendResponse({ success: false, error: 'Unsupported URL' });
      return true;
    }
    (async () => {
      const blocked = (error) => /public http|could not be verified|Redirect loop|Too many redirects/i.test(error || '');
      let result = await fetchPublicFinal(targetUrl, { method: 'GET' });
      if (!result.ok && !blocked(result.error)) {
        result = await fetchPublicFinal(targetUrl, { method: 'HEAD' });
      }
      if (!result.ok) {
        sendResponse({ success: false, error: result.error || 'Fetch failed' });
        return;
      }
      const headersObj = {};
      result.response.headers.forEach((val, key) => {
        headersObj[key.toLowerCase()] = val;
      });
      sendResponse({ success: true, status: result.response.status, headers: headersObj });
    })().catch((err) => sendResponse({ success: false, error: err?.message || 'Fetch failed' }));
    return true;
  }

  if (message.action === 'probeDohEndpoint') {
    const targetUrl = publicFetchUrl(message.targetUrl);
    if (!targetUrl) {
      sendResponse({ success: false, error: 'Unsupported URL' });
      return true;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    fetchPublic(targetUrl, {
      method: 'GET',
      headers: { Accept: 'application/dns-message, application/dns-json, application/json' },
      signal: controller.signal
    })
      .then(async (result) => {
        clearTimeout(timeoutId);
        if (!result.ok) {
          sendResponse({ success: false, error: result.error || 'Probing failed' });
          return;
        }
        let isDnssec = false;
        if (result.response.ok) {
          const data = await result.response.json().catch(() => ({}));
          isDnssec = !!(data.AD || data.AuthenticData);
        }
        sendResponse({ success: true, status: result.response.status, isDnssec });
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        sendResponse({ success: false, error: err.message || 'Probing failed' });
      });
    return true;
  }

  if (message.action === 'blockchainLookup') {
    const kind = ['tx', 'unspent', 'balance'].includes(message.kind) ? message.kind : 'address';
    const query = String(message.query || '').trim();
    fetchBlockchainJson(kind, query, message.offset)
      .then((json) => sendResponse({ success: true, json }))
      .catch((err) => sendResponse({ success: false, error: err.message || 'blockchain.info failed' }));
    return true;
  }

  if (message.action === 'ethLookup') {
    const kind = ['txs', 'tokens', 'tx'].includes(message.kind) ? message.kind : 'address';
    const query = String(message.query || '').trim();
    fetchEthJson(kind, query)
      .then((json) => sendResponse({ success: true, json }))
      .catch((err) => sendResponse({ success: false, error: err.message || 'Blockscout failed' }));
    return true;
  }

  if (message.action === 'rdapLookup') {
    const kind = message.kind === 'domain' ? 'domain' : 'ip';
    const query = String(message.query || '').trim();
    if (!query) {
      sendResponse({ success: false, error: 'No query' });
      return true;
    }
    lookupRdap(kind, query)
      .then((hit) => {
        if (!hit) sendResponse({ success: false, error: 'No RDAP record' });
        else sendResponse({ success: true, json: hit.json, url: hit.url });
      })
      .catch((err) => sendResponse({ success: false, error: err.message || 'RDAP failed' }));
    return true;
  }

  if (message.action === 'trace_redirects_background') {
    const targetUrl = publicFetchUrl(message.url);
    if (!targetUrl) {
      sendResponse({ success: false, error: 'Enter a public http or https URL', hops: [] });
      return true;
    }
    traceRedirectChain(targetUrl)
      .then((hops) => sendResponse({ success: true, hops }))
      .catch((err) => sendResponse({ success: false, error: err.message, hops: [] }));
    return true;
  }

  if (message.action === 'registerBlock') {
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'usernameCheckSite') {
    const { site, username, scanId } = message;
    if (!site || typeof username !== 'string') {
      sendResponse({ success: false, exists: false });
      return true;
    }
    const controller = new AbortController();
    addUsernameScanController(scanId, controller);
    checkUsernameSite(site, username, controller.signal)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch(() => sendResponse({ success: false, exists: false }))
      .finally(() => removeUsernameScanController(scanId, controller));
    return true;
  }

  if (message.action === 'usernameAbortScan') {
    abortUsernameScan(message.scanId);
    sendResponse({ success: true });
    return true;
  }

  return false;
});

if (brw.permissions?.onRemoved) {
  brw.permissions.onRemoved.addListener(async (removed) => {
    const affected = new Set();
    for (const p of removed.permissions || []) {
      for (const id of modulesNeedingPermission(p)) affected.add(id);
    }
    if (affected.size === 0) return;
    const data = await brw.storage.local.get({ moduleStates: {} });
    const states = { ...(data.moduleStates || {}) };
    let changed = false;
    for (const id of affected) {
      if (states[id]) {
        states[id] = false;
        changed = true;
        try {
          await handleModuleToggle(id, false);
        } catch {
          /* ignore */
        }
      }
    }
    if (changed) await brw.storage.local.set({ moduleStates: states });
  });
}
