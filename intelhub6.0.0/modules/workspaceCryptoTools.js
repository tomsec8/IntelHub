import { brw, flashButton } from './utils.js';
import { getToolResult, setToolResult, apiNote, API_SOURCES, paintToolChrome } from './workspaceToolResults.js';

let charts = [];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function toolChrome(wrap, title) {
  return paintToolChrome(wrap, title, { resultId: 'crypto:wallet' });
}

function destroyCharts() {
  charts.forEach((chart) => {
    try {
      chart.destroy();
    } catch {
      /* already gone */
    }
  });
  charts = [];
}

function formatTime(unix) {
  if (!unix) return '';
  return new Date(unix * 1000).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function cleanCryptoQuery(value) {
  let raw = String(value || '').trim();
  if (!raw) return '';
  if (/^bitcoin:/i.test(raw)) raw = raw.slice(8).split('?')[0];
  if (/^ethereum:/i.test(raw)) raw = raw.slice(9).split('?')[0];
  try {
    const url = new URL(raw);
    const parts = url.pathname.split('/').filter(Boolean);
    const marker = parts.findIndex((part) => /^(address|tx|txid)$/i.test(part));
    if (marker >= 0 && parts[marker + 1]) raw = parts[marker + 1];
  } catch {
    /* not a URL */
  }
  return raw.replace(/\s+/g, '');
}

function identifyCrypto(query) {
  const q = String(query || '').trim();
  if (!q) return null;

  if (/^0x[a-fA-F0-9]{64}$/.test(q)) {
    return {
      chain: 'Ethereum',
      network: 'Mainnet',
      script: 'Transaction hash',
      kind: 'tx',
      live: true,
      source: 'eth',
      explorers: [
        { href: `https://etherscan.io/tx/${q}`, label: 'Etherscan' },
        { href: `https://eth.blockscout.com/tx/${q}`, label: 'Blockscout' }
      ]
    };
  }

  if (/^0x[a-fA-F0-9]{40}$/.test(q)) {
    return {
      chain: 'Ethereum',
      network: 'Mainnet',
      script: 'Account (EOA or contract)',
      kind: 'address',
      live: true,
      source: 'eth',
      explorers: [
        { href: `https://etherscan.io/address/${q}`, label: 'Etherscan' },
        { href: `https://eth.blockscout.com/address/${q}`, label: 'Blockscout' }
      ]
    };
  }

  if (/^tb1p[ac-hj-np-z02-9]{58}$/i.test(q)) {
    return btcAddress(q, 'testnet', 'P2TR (Taproot)');
  }
  if (/^tb1q[ac-hj-np-z02-9]{25,62}$/i.test(q)) {
    return btcAddress(q, 'testnet', q.length === 42 ? 'P2WPKH' : 'P2WSH');
  }
  if (/^bc1p[ac-hj-np-z02-9]{58}$/i.test(q)) {
    return btcAddress(q, 'mainnet', 'P2TR (Taproot)');
  }
  if (/^bc1q[ac-hj-np-z02-9]{25,62}$/i.test(q)) {
    return btcAddress(q, 'mainnet', q.length === 42 ? 'P2WPKH' : 'P2WSH');
  }
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(q)) {
    return btcAddress(q, 'mainnet', q.startsWith('3') ? 'P2SH' : 'P2PKH');
  }
  if (/^[mn2][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(q)) {
    return btcAddress(q, 'testnet', q.startsWith('2') ? 'P2SH' : 'P2PKH');
  }

  if (/^ltc1[ac-hj-np-z02-9]{11,71}$/i.test(q) || /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(q)) {
    return {
      chain: 'Litecoin',
      network: 'Mainnet',
      script: q.toLowerCase().startsWith('ltc1') ? 'Bech32' : 'Base58',
      kind: 'address',
      live: false,
      explorers: [{ href: `https://blockchair.com/litecoin/address/${q}`, label: 'Blockchair' }]
    };
  }
  if (/^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/.test(q)) {
    return {
      chain: 'Dogecoin',
      network: 'Mainnet',
      script: 'P2PKH',
      kind: 'address',
      live: false,
      explorers: [{ href: `https://blockchair.com/dogecoin/address/${q}`, label: 'Blockchair' }]
    };
  }
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(q)) {
    return {
      chain: 'Tron',
      network: 'Mainnet',
      script: 'Base58',
      kind: 'address',
      live: false,
      explorers: [{ href: `https://tronscan.org/#/address/${q}`, label: 'Tronscan' }]
    };
  }
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(q)) {
    return {
      chain: 'XRP',
      network: 'Mainnet',
      script: 'Classic address',
      kind: 'address',
      live: false,
      explorers: [{ href: `https://xrpscan.com/account/${q}`, label: 'XRPScan' }]
    };
  }
  if (/^addr1[a-z0-9]{20,}$/i.test(q)) {
    return {
      chain: 'Cardano',
      network: 'Mainnet',
      script: 'Shelley address',
      kind: 'address',
      live: false,
      explorers: [{ href: `https://cardanoscan.io/address/${q}`, label: 'Cardanoscan' }]
    };
  }
  if (/^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(q)) {
    return {
      chain: 'TON',
      network: 'Mainnet',
      script: 'Friendly address',
      kind: 'address',
      live: false,
      explorers: [{ href: `https://tonviewer.com/${q}`, label: 'Tonviewer' }]
    };
  }
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q) && !/^[13mn2]/.test(q)) {
    return {
      chain: 'Solana (possible)',
      network: 'Mainnet',
      script: 'Base58 public key',
      kind: 'address',
      live: false,
      explorers: [{ href: `https://solscan.io/account/${q}`, label: 'Solscan' }]
    };
  }

  if (/^[a-fA-F0-9]{64}$/.test(q)) {
    return {
      chain: 'Bitcoin',
      network: 'Mainnet',
      script: 'Transaction ID',
      kind: 'tx',
      live: true,
      testnet: false,
      source: 'btc',
      explorers: [
        { href: `https://www.blockchain.com/explorer/transactions/btc/${q}`, label: 'Blockchain.com' },
        { href: `https://mempool.space/tx/${q}`, label: 'Mempool' }
      ]
    };
  }

  return null;
}

function btcAddress(query, network, script) {
  const testnet = network === 'testnet';
  return {
    chain: 'Bitcoin',
    network: testnet ? 'Testnet' : 'Mainnet',
    script,
    kind: 'address',
    live: !testnet,
    testnet,
    source: 'btc',
    explorers: testnet
      ? [
        { href: `https://blockstream.info/testnet/address/${query}`, label: 'Blockstream' },
        { href: `https://mempool.space/testnet/address/${query}`, label: 'Mempool' }
      ]
      : [
        { href: `https://www.blockchain.com/explorer/addresses/btc/${query}`, label: 'Blockchain.com' },
        { href: `https://mempool.space/address/${query}`, label: 'Mempool' }
      ]
  };
}

function unknownAddress(query) {
  return {
    chain: 'Unrecognized',
    network: 'Trying Bitcoin',
    script: 'Format not identified locally',
    kind: 'address',
    live: true,
    testnet: false,
    source: 'btc',
    explorers: [
      { href: `https://www.blockchain.com/explorer/search?search=${encodeURIComponent(query)}`, label: 'Blockchain.com' },
      { href: `https://blockchair.com/search?q=${encodeURIComponent(query)}`, label: 'Blockchair' }
    ]
  };
}

function asSats(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function reverseTxHash(hex) {
  const h = String(hex || '');
  if (!/^[a-fA-F0-9]+$/.test(h) || h.length % 2) return h;
  return h.match(/.{2}/g).reverse().join('');
}

let lookupLog = [];

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (res.status === 500 || res.status === 404) {
      const text = await res.text().catch(() => '');
      if (/no free outputs/i.test(text)) return { unspent_outputs: [] };
      throw new Error('No record for this value.');
    }
    if (res.status === 429) throw new Error('Rate limited. Wait a moment and try again.');
    if (!res.ok) throw new Error(`blockchain.info HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The lookup timed out.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(label)), ms);
    })
  ]);
}

async function blockchainGet(kind, query, offset = 0) {
  try {
    const reply = await withTimeout(
      brw.runtime.sendMessage({
        action: 'blockchainLookup',
        kind,
        query,
        offset
      }),
      15000,
      'blockchain.info lookup timed out.'
    );
    if (reply?.success) {
      lookupLog.push(`OK ${kind}`);
      return reply.json;
    }
    lookupLog.push(`background: ${reply?.error || 'no response'}`);
    if (reply?.error) throw new Error(reply.error);
  } catch (err) {
    lookupLog.push(`background: ${err.message || 'failed'}`);
  }

  const encoded = encodeURIComponent(query);
  const skip = Math.max(0, offset);
  let url = `https://blockchain.info/rawaddr/${encoded}?limit=10&offset=${skip}&cors=true`;
  if (kind === 'balance') url = `https://blockchain.info/balance?active=${encoded}&cors=true`;
  else if (kind === 'tx') url = `https://blockchain.info/rawtx/${encoded}?cors=true`;
  else if (kind === 'unspent') url = `https://blockchain.info/unspent?active=${encoded}&limit=20&cors=true`;
  const json = await fetchJson(url);
  lookupLog.push(`OK page ${kind}`);
  return json;
}

function packBalance(query, json) {
  const row = json?.[query] || Object.values(json || {}).find((item) => item && typeof item === 'object') || {};
  const received = asSats(row.total_received);
  const balance = asSats(row.final_balance);
  return {
    asset: 'btc',
    address: {
      chain_stats: {
        funded_txo_sum: received,
        spent_txo_sum: Math.max(0, received - balance),
        tx_count: asSats(row.n_tx)
      },
      mempool_stats: {}
    },
    txs: [],
    utxos: [],
    tokens: [],
    n_tx: asSats(row.n_tx)
  };
}

async function ethGet(kind, query) {
  try {
    const reply = await withTimeout(
      brw.runtime.sendMessage({
        action: 'ethLookup',
        kind,
        query
      }),
      15000,
      'Ethereum lookup timed out.'
    );
    if (reply?.success) {
      lookupLog.push(`OK eth ${kind}`);
      return reply.json;
    }
    lookupLog.push(`eth background: ${reply?.error || 'no response'}`);
    if (reply?.error) throw new Error(reply.error);
  } catch (err) {
    lookupLog.push(`eth background: ${err.message || 'failed'}`);
  }

  const encoded = encodeURIComponent(query);
  const key = 'apiKey=freekey';
  let url = `https://api.ethplorer.io/getAddressInfo/${encoded}?${key}`;
  if (kind === 'txs') url = `https://api.ethplorer.io/getAddressTransactions/${encoded}?${key}&limit=10`;
  else if (kind === 'tx') url = `https://api.ethplorer.io/getTxInfo/${encoded}?${key}`;
  else if (kind === 'tokens') url = `https://api.ethplorer.io/getAddressInfo/${encoded}?${key}`;
  const json = await fetchJson(url);
  if (json && !Array.isArray(json) && json.error) {
    throw new Error(json.error.message || json.error || 'Ethplorer error');
  }
  lookupLog.push(`OK eth page ${kind}`);
  return json;
}

function parseUnix(value) {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function tokenMove(tx) {
  const params = tx.params || tx.decoded_input?.parameters || [];
  const valueParam = params.find((param) => param.name === 'value');
  if (!valueParam) return null;
  const symbol = tx.to_name || tx.to?.name || 'Token';
  const decimals = tx.token_decimals
    ? Number(tx.token_decimals)
    : (/usdc|usdt|pyusd|busd|tusd/i.test(symbol) ? 6 : 18);
  const toParam = params.find((param) => param.name === 'to');
  return {
    symbol,
    decimals,
    value: String(valueParam.value || '0'),
    to: toParam?.value || (typeof tx.to === 'string' ? tx.to : tx.to?.hash) || ''
  };
}

function normalizeEthTx(tx) {
  const value = asSats(tx.rawValue != null ? tx.rawValue : tx.value);
  const from = typeof tx.from === 'string' ? tx.from : (tx.from?.hash || '');
  const to = typeof tx.to === 'string' ? tx.to : (tx.to?.hash || '');
  const fee = typeof tx.fee === 'object' && tx.fee ? tx.fee.value : tx.fee;
  return {
    txid: tx.hash || '',
    fee: asSats(fee),
    method: tx.method || tx.decoded_input?.method_call || '',
    token: tokenMove(tx),
    status: {
      confirmed: tx.status === 'ok' || (tx.block_number != null && Number(tx.block_number) > 0),
      block_height: tx.block_number ?? null,
      block_time: parseUnix(tx.timestamp)
    },
    vin: [{
      prevout: { scriptpubkey_address: from, value }
    }],
    vout: [{
      scriptpubkey_address: to,
      scriptpubkey_type: tx.to_name || tx.to?.name || '',
      value
    }]
  };
}

function normalizeTokens(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((item) => {
    if (item?.token) {
      return {
        symbol: item.token.symbol || 'Token',
        name: item.token.name || '',
        decimals: String(item.token.decimals || '18'),
        value: String(item.value || '0'),
        type: item.token.type || 'ERC-20',
        address: item.token.address_hash || ''
      };
    }
    return {
      symbol: item.symbol || 'Token',
      name: item.name || '',
      decimals: String(item.decimals || '18'),
      value: String(item.value || '0'),
      type: item.type || 'ERC-20',
      address: item.address || ''
    };
  });
}

function coerceEthInfo(info, query) {
  if (!info || typeof info !== 'object') {
    return { hash: query, coin_balance: '0', tokens: [] };
  }
  if (info.ETH) {
    return {
      hash: info.address || query,
      coin_balance: String(info.ETH.rawBalance || '0'),
      is_contract: !!info.contractInfo,
      ens_domain_name: '',
      tokens: (info.tokens || []).map((item) => ({
        symbol: item.tokenInfo?.symbol || item.symbol || 'Token',
        name: item.tokenInfo?.name || item.name || '',
        decimals: String(item.tokenInfo?.decimals || item.decimals || '18'),
        value: String(item.rawBalance || item.balance || item.value || '0'),
        type: 'ERC-20',
        address: item.tokenInfo?.address || item.address || ''
      }))
    };
  }
  return {
    ...info,
    hash: info.hash || info.address || query,
    coin_balance: String(info.coin_balance || '0'),
    tokens: info.tokens || []
  };
}

function packEthAddress(info, txs = [], tokens = []) {
  let received = 0;
  let sent = 0;
  const address = info.hash || '';
  txs.forEach((tx) => {
    const delta = addressDelta(tx, address);
    received += delta.received;
    sent += delta.sent;
  });
  return {
    asset: 'eth',
    balanceWei: String(info.coin_balance || '0'),
    ens: info.ens_domain_name || '',
    isContract: !!info.is_contract,
    address: {
      chain_stats: {
        funded_txo_sum: received,
        spent_txo_sum: sent,
        tx_count: txs.length
      },
      mempool_stats: {}
    },
    txs,
    utxos: [],
    tokens,
    n_tx: txs.length
  };
}

function normalizeBcTx(tx) {
  const inputs = tx.inputs || [];
  const outputs = tx.out || [];
  const inSum = inputs.reduce((sum, vin) => sum + asSats(vin.prev_out?.value), 0);
  const outSum = outputs.reduce((sum, vout) => sum + asSats(vout.value), 0);
  return {
    txid: tx.hash || tx.txid || '',
    fee: asSats(tx.fee) || Math.max(0, inSum - outSum),
    result: asSats(tx.result),
    status: {
      confirmed: tx.block_height != null && Number(tx.block_height) >= 0,
      block_height: tx.block_height ?? null,
      block_time: tx.time || null
    },
    vin: inputs.map((vin) => ({
      txid: vin.prev_out?.hash || '',
      is_coinbase: !vin.prev_out,
      prevout: vin.prev_out
        ? {
          scriptpubkey_address: vin.prev_out.addr || '',
          value: asSats(vin.prev_out.value)
        }
        : null
    })),
    vout: outputs.map((vout) => ({
      scriptpubkey_address: vout.addr || '',
      scriptpubkey_type: vout.type || '',
      value: asSats(vout.value)
    }))
  };
}

function normalizeUtxos(json) {
  return (json?.unspent_outputs || []).map((item) => ({
    txid: reverseTxHash(item.tx_hash_big_endian || item.tx_hash),
    vout: asSats(item.tx_output_n),
    value: asSats(item.value),
    status: {
      confirmed: asSats(item.confirmations) > 0,
      block_height: item.confirmations ? `${item.confirmations} conf` : ''
    }
  }));
}

function packAddressResult(json, extraUtxos) {
  return {
    address: {
      chain_stats: {
        funded_txo_sum: asSats(json.total_received),
        spent_txo_sum: asSats(json.total_sent),
        tx_count: asSats(json.n_tx)
      },
      mempool_stats: {}
    },
    txs: (json.txs || []).map(normalizeBcTx),
    utxos: extraUtxos || [],
    tokens: [],
    n_tx: asSats(json.n_tx),
    asset: 'btc'
  };
}

function diagnosticBlock(lines) {
  const box = el('div', 'ws-crypto-log');
  box.append(el('h3', '', 'Lookup log'));
  lines.forEach((line) => box.appendChild(el('code', '', line)));
  return box;
}

function loadingBlock(query, host = 'blockchain.info') {
  const box = el('div', 'ws-crypto-infographic');
  box.append(
    el('h3', '', `Contacting ${host}`),
    el('p', 'ws-image-note', `Loading ${shorten(query, 16, 12)}…`)
  );
  return box;
}

async function lookupTx(txid) {
  const tx = await blockchainGet('tx', txid);
  return { tx: normalizeBcTx(tx), testnet: false };
}

function shorten(value, head = 10, tail = 8) {
  const text = String(value || '');
  if (text.length <= head + tail + 1) return text;
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

function formatBtcShort(sats) {
  if (typeof sats !== 'number' || !Number.isFinite(sats)) return '0 BTC';
  const btc = sats / 1e8;
  const text = Math.abs(btc) >= 1 ? btc.toFixed(4) : btc.toFixed(8);
  return `${text.replace(/\.?0+$/, '')} BTC`;
}

function formatEth(wei) {
  try {
    const n = BigInt(String(wei || '0').split('.')[0] || '0');
    const neg = n < 0n;
    const abs = neg ? -n : n;
    const whole = abs / 1000000000000000000n;
    const frac = abs % 1000000000000000000n;
    if (whole === 0n && frac === 0n) return '0 ETH';
    const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '').slice(0, 8);
    const body = fracStr ? `${whole}.${fracStr}` : `${whole}`;
    return `${neg ? '-' : ''}${body} ETH`;
  } catch {
    return '0 ETH';
  }
}

function formatToken(value, decimals, symbol) {
  const d = Math.max(0, Number(decimals) || 0);
  const raw = String(value || '0').split('.')[0] || '0';
  try {
    const n = BigInt(raw);
    if (d === 0) return `${n.toString()} ${symbol || ''}`.trim();
    const base = 10n ** BigInt(d);
    const whole = n / base;
    const frac = n % base;
    const fracStr = frac.toString().padStart(d, '0').replace(/0+$/, '').slice(0, 6);
    const body = fracStr ? `${whole}.${fracStr}` : `${whole}`;
    return `${body} ${symbol || ''}`.trim();
  } catch {
    return `0 ${symbol || ''}`.trim();
  }
}

function formatCoin(amount, asset = 'btc') {
  return asset === 'eth' ? formatEth(amount) : formatBtcShort(amount);
}

function toBtc(sats) {
  return Number(((sats || 0) / 1e8).toFixed(8));
}

function toEth(wei) {
  const s = String(wei || '0').replace(/^-/, '');
  if (!s || s === '0') return 0;
  if (s.length <= 15) return Number(s) / 1e18;
  const head = Number(s.slice(0, 15));
  if (!Number.isFinite(head)) return 0;
  return (head * (10 ** (s.length - 15))) / 1e18;
}

function toCoin(amount, asset = 'btc') {
  return asset === 'eth' ? toEth(amount) : toBtc(amount);
}

function addrMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (/^0x/i.test(a) || /^0x/i.test(b) || /^(bc1|tb1)/i.test(a) || /^(bc1|tb1)/i.test(b)) {
    return a.toLowerCase() === b.toLowerCase();
  }
  return false;
}

function addressDelta(tx, address) {
  let received = 0;
  let sent = 0;
  (tx.vin || []).forEach((vin) => {
    if (addrMatch(vin.prevout?.scriptpubkey_address, address)) {
      sent += vin.prevout?.value || 0;
    }
  });
  (tx.vout || []).forEach((vout) => {
    if (addrMatch(vout.scriptpubkey_address, address)) {
      received += vout.value || 0;
    }
  });
  return { received, sent, net: received - sent };
}

function activitySeries(txs, address) {
  const map = new Map();
  (txs || []).forEach((tx) => {
    const t = tx.status?.block_time;
    const key = t
      ? new Date(t * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      : 'Mempool';
    const sort = t || Date.now() / 1000;
    if (!map.has(key)) map.set(key, { in: 0, out: 0, count: 0, sort });
    const delta = addressDelta(tx, address);
    const row = map.get(key);
    row.in += delta.received;
    row.out += delta.sent;
    row.count += 1;
    row.sort = Math.min(row.sort, sort);
  });
  return [...map.entries()].sort((a, b) => a[1].sort - b[1].sort);
}

function counterparties(txs, address) {
  const map = new Map();
  (txs || []).forEach((tx) => {
    const delta = addressDelta(tx, address);
    const pool = delta.net >= 0 ? tx.vin || [] : tx.vout || [];
    pool.forEach((item) => {
      const other = delta.net >= 0
        ? item.prevout?.scriptpubkey_address
        : item.scriptpubkey_address;
      const value = delta.net >= 0 ? item.prevout?.value || 0 : item.value || 0;
      if (!other || addrMatch(other, address)) return;
      map.set(other, (map.get(other) || 0) + value);
    });
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
}

function copyButton(value) {
  const btn = el('button', 'ws-crypto-copy', 'Copy');
  btn.type = 'button';
  btn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(value || ''));
      flashButton(btn, 'Copied');
    } catch {
      flashButton(btn, 'Failed', true);
    }
  });
  return btn;
}

function chip(text, tone = '') {
  return el('span', `ws-crypto-chip${tone ? ` ${tone}` : ''}`, text);
}

function statCard(value, label) {
  const card = el('div', 'ws-crypto-stat');
  card.append(el('strong', '', value), el('span', '', label));
  return card;
}

function explorerRow(explorers) {
  const links = el('div', 'ws-email-links');
  (explorers || []).forEach((item) => {
    const link = el('a', 'ws-btn ws-btn-ghost', item.label);
    link.href = item.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    links.appendChild(link);
  });
  return links;
}

function ioCard(label, amount, own = false, asset = 'btc') {
  const btn = el('button', `ws-crypto-io${own ? ' is-own' : ''}`);
  btn.type = 'button';
  const code = document.createElement('code');
  code.textContent = shorten(label, 12, 10) || '—';
  const amt = document.createElement('em');
  amt.textContent = formatCoin(amount || 0, asset);
  btn.append(code, amt);
  if (own) btn.appendChild(chip('This wallet', 'is-ok'));
  if (label && label !== 'coinbase') {
    btn.title = label;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(label);
        flashButton(btn, 'Copied');
      } catch {
        /* ignore */
      }
    });
  }
  return btn;
}

function resultsShell(title, onNewLookup) {
  const page = el('div', 'ws-crypto-page');
  const bar = el('div', 'ws-crypto-toolbar');
  const again = el('button', 'ws-btn ws-btn-ghost', 'New lookup');
  again.type = 'button';
  again.addEventListener('click', onNewLookup);
  bar.append(el('h2', '', title), again);
  page.appendChild(bar);
  return page;
}

function heroCard(query, ident, balance, asset = 'btc') {
  const hero = el('div', `ws-crypto-hero${ident.chain === 'Ethereum' ? ' is-eth' : ''}`);
  const kicker = el('div', 'ws-crypto-kicker');
  kicker.append(chip(ident.chain), chip(ident.network), chip(ident.script));
  if (ident.kind === 'tx') kicker.append(chip('Transaction'));
  const addr = el('div', 'ws-crypto-address');
  addr.append(el('strong', '', shorten(query, 14, 12)), copyButton(query));
  hero.append(kicker, addr);
  if (balance != null && balance !== '') {
    const bal = el('div', 'ws-crypto-balance', formatCoin(balance, asset));
    bal.append(el('span', '', asset === 'eth' ? 'ETH on chain' : `${Number(balance).toLocaleString()} sats on chain`));
    hero.appendChild(bal);
  }
  return hero;
}

function activityMeter(funded, spent, asset = 'btc') {
  const total = Math.max(1, Number(funded) + Number(spent));
  const box = el('div', 'ws-crypto-infographic');
  const meter = el('div', 'ws-crypto-meter');
  const inn = document.createElement('i');
  inn.className = 'is-in';
  inn.style.width = `${(Number(funded) / total) * 100}%`;
  const outn = document.createElement('i');
  outn.className = 'is-out';
  outn.style.width = `${(Number(spent) / total) * 100}%`;
  meter.append(inn, outn);
  const legend = el('div', 'ws-crypto-legend');
  legend.append(
    el('span', '', 'Received '),
    el('b', '', formatCoin(funded, asset)),
    el('span', '', ' · Sent '),
    el('b', '', formatCoin(spent, asset))
  );
  box.append(el('h3', '', 'Value flow'), meter, legend);
  return box;
}

function chartTheme() {
  const styles = getComputedStyle(document.documentElement);
  return {
    text: styles.getPropertyValue('--muted').trim() || '#a8b0c2',
    grid: 'rgba(255, 255, 255, 0.08)',
    in: '#34d399',
    inSoft: 'rgba(52, 211, 153, 0.28)',
    out: '#f87171',
    outSoft: 'rgba(248, 113, 113, 0.28)',
    accent: '#f7931a',
    accentSoft: 'rgba(247, 147, 26, 0.28)',
    palette: ['#f7931a', '#34d399', '#f87171', '#6ea8ff', '#c084fc', '#38bdf8', '#fbbf24', '#fb923c']
  };
}

function baseChartOptions(theme, asset = 'btc') {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(8, 12, 20, 0.92)',
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label(ctx) {
            const raw = ctx.raw;
            if (typeof raw === 'number') {
              return asset === 'eth' ? ` ${raw.toFixed(6)} ETH` : ` ${formatBtcShort(Math.round(raw * 1e8))}`;
            }
            return ` ${ctx.formattedValue}`;
          }
        }
      }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: theme.grid }, ticks: { color: theme.text } },
      x: { grid: { display: false }, ticks: { color: theme.text, maxRotation: 0, autoSkip: true } }
    }
  };
}

function chartCard(title, subtitle) {
  const card = el('div', 'ws-crypto-chart');
  const head = el('div', 'ws-crypto-chart-head');
  head.append(el('strong', '', title));
  if (subtitle) head.append(el('span', '', subtitle));
  const canvas = document.createElement('canvas');
  card.append(head, canvas);
  return { card, canvas };
}

function doughnutCenter(text) {
  return {
    id: 'cryptoCenter',
    afterDraw(chart) {
      const arc = chart.getDatasetMeta(0)?.data?.[0];
      if (!arc) return;
      const { x, y } = typeof arc.getCenterPoint === 'function' ? arc.getCenterPoint() : arc;
      const ctx = chart.ctx;
      ctx.save();
      ctx.fillStyle = '#e8edf7';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 14px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(text, x, y);
      ctx.restore();
    }
  };
}

function txFlow(tx, address = '', asset = 'btc') {
  const flow = el('div', 'ws-crypto-flow');
  const ins = el('div', 'ws-crypto-col');
  ins.append(el('h3', '', `From · ${(tx.vin || []).length}`));
  (tx.vin || []).slice(0, 24).forEach((vin) => {
    const label = vin.prevout?.scriptpubkey_address || (vin.is_coinbase ? 'coinbase' : vin.txid || '—');
    ins.appendChild(ioCard(label, vin.prevout?.value, addrMatch(label, address), asset));
  });
  const mid = el('div', 'ws-crypto-mid');
  mid.append(
    chip(tx.status?.confirmed ? 'Confirmed' : 'Unconfirmed', tx.status?.confirmed ? 'is-ok' : 'is-warn'),
    el('strong', '', tx.token ? formatToken(tx.token.value, tx.token.decimals, tx.token.symbol) : formatCoin(tx.fee || 0, asset)),
    el('span', '', tx.status?.block_height != null ? `Block ${tx.status.block_height}` : 'Pending')
  );
  const outs = el('div', 'ws-crypto-col');
  outs.append(el('h3', '', `To · ${(tx.vout || []).length}`));
  (tx.vout || []).slice(0, 24).forEach((vout) => {
    const label = vout.scriptpubkey_address || vout.scriptpubkey_type || '—';
    outs.appendChild(ioCard(label, tx.token ? 0 : vout.value, addrMatch(label, address), asset));
  });
  flow.append(ins, mid, outs);
  return flow;
}

function txAmountLabel(tx, address, asset) {
  if (tx.token) {
    const outgoing = address && addrMatch(tx.vin?.[0]?.prevout?.scriptpubkey_address, address);
    return `${outgoing ? '−' : '+'}${formatToken(tx.token.value, tx.token.decimals, tx.token.symbol)}`;
  }
  if (address) {
    const delta = addressDelta(tx, address);
    return `${delta.net >= 0 ? '+' : '−'}${formatCoin(Math.abs(delta.net), asset)}`;
  }
  return formatCoin((tx.vout || []).reduce((sum, vout) => sum + (vout.value || 0), 0), asset);
}

function txList(txs, address, asset = 'btc') {
  const list = el('div', 'ws-crypto-list');
  list.append(el('h3', '', `Transfers · ${txs.length}`));
  txs.forEach((tx) => {
    const delta = address ? addressDelta(tx, address) : { net: 0 };
    const incoming = tx.token
      ? !(address && addrMatch(tx.vin?.[0]?.prevout?.scriptpubkey_address, address))
      : delta.net >= 0;
    const row = el('div', 'ws-crypto-tx');
    row.tabIndex = 0;
    const left = el('div');
    const id = document.createElement('code');
    id.textContent = shorten(tx.txid, 16, 12);
    left.append(id, el('span', '', tx.status?.confirmed ? formatTime(tx.status.block_time) : 'Pending'));
    const amt = el('em', `ws-crypto-amt ${incoming ? 'is-in' : 'is-out'}`);
    amt.textContent = txAmountLabel(tx, address, asset);
    row.append(left, amt, copyButton(tx.txid));
    const detail = el('div', 'ws-crypto-detail');
    detail.hidden = true;
    detail.appendChild(txFlow(tx, address, asset));
    function toggleDetail(event) {
      if (event.target.closest('.ws-crypto-copy')) return;
      const open = detail.hidden;
      list.querySelectorAll('.ws-crypto-detail').forEach((node) => {
        node.hidden = true;
      });
      list.querySelectorAll('.ws-crypto-tx').forEach((node) => node.classList.remove('is-open'));
      if (open) {
        detail.hidden = false;
        row.classList.add('is-open');
      }
    }
    row.addEventListener('click', toggleDetail);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleDetail(event);
      }
    });
    list.append(row, detail);
  });
  return list;
}

function tokenList(tokens) {
  const box = el('div', 'ws-crypto-list');
  box.append(el('h3', '', `Tokens · ${tokens.length}`));
  (tokens || []).forEach((item) => {
    const row = el('div', 'ws-crypto-tx');
    const left = el('div');
    const id = document.createElement('code');
    id.textContent = item.symbol || 'Token';
    left.append(id, el('span', '', item.name || item.type || 'ERC-20'));
    const amt = el('em', 'ws-crypto-amt is-in', formatToken(item.value, item.decimals, item.symbol));
    row.append(left, amt);
    if (item.address) row.appendChild(copyButton(item.address));
    box.appendChild(row);
  });
  return box;
}

function utxoList(utxos) {
  const box = el('div', 'ws-crypto-list');
  const total = (utxos || []).reduce((sum, item) => sum + (item.value || 0), 0);
  box.append(el('h3', '', `UTXOs · ${utxos.length} · ${formatBtcShort(total)}`));
  (utxos || []).slice(0, 16).forEach((item) => {
    const row = el('div', 'ws-crypto-tx');
    const left = el('div');
    const id = document.createElement('code');
    id.textContent = `${shorten(item.txid, 12, 8)}:${item.vout}`;
    left.append(id, el('span', '', item.status?.confirmed ? `Block ${item.status.block_height}` : 'Unconfirmed'));
    const amt = el('em', 'ws-crypto-amt is-in', formatBtcShort(item.value || 0));
    row.append(left, amt, copyButton(item.txid));
    box.appendChild(row);
  });
  return box;
}

function renderAddressCharts(host, { funded, spent, balance, txs, utxos, address, asset = 'btc' }) {
  if (typeof Chart === 'undefined') {
    host.appendChild(activityMeter(funded, spent, asset));
    host.appendChild(el('p', 'ws-image-note', 'Charts unavailable — reload the workspace to load Chart.js.'));
    return;
  }

  const theme = chartTheme();
  const wrap = el('div', 'ws-crypto-charts');
  const doughnut = chartCard('Received vs sent', asset === 'eth' ? 'ETH in recent transfers' : 'lifetime on-chain');
  const activity = chartCard('In / out over time', `last ${txs.length} transfers`);
  wrap.append(doughnut.card, activity.card);

  const peers = counterparties(txs, address);
  let peersCard = null;
  if (peers.length) {
    peersCard = chartCard('Counterparties', 'from recent transfers');
    wrap.appendChild(peersCard.card);
  }

  let utxoCard = null;
  if (utxos.length) {
    utxoCard = chartCard('UTXO sizes', `${utxos.length} unspent outputs`);
    wrap.appendChild(utxoCard.card);
  }

  host.appendChild(wrap);

  charts.push(
    new Chart(doughnut.canvas, {
      type: 'doughnut',
      data: {
        labels: ['Received', 'Sent'],
        datasets: [{
          data: [toCoin(funded, asset), toCoin(spent, asset)],
          backgroundColor: [theme.inSoft, theme.outSoft],
          borderColor: [theme.in, theme.out],
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: theme.text, boxWidth: 10, padding: 14 }
          },
          tooltip: baseChartOptions(theme, asset).plugins.tooltip
        }
      },
      plugins: [doughnutCenter(formatCoin(balance, asset))]
    })
  );

  const series = activitySeries(txs, address);
  charts.push(
    new Chart(activity.canvas, {
      type: 'bar',
      data: {
        labels: series.map(([key]) => key),
        datasets: [
          {
            label: 'Received',
            data: series.map(([, row]) => toCoin(row.in, asset)),
            backgroundColor: theme.inSoft,
            borderColor: theme.in,
            borderWidth: 1,
            borderRadius: 6,
            stack: 'flow'
          },
          {
            label: 'Sent',
            data: series.map(([, row]) => toCoin(row.out, asset)),
            backgroundColor: theme.outSoft,
            borderColor: theme.out,
            borderWidth: 1,
            borderRadius: 6,
            stack: 'flow'
          }
        ]
      },
      options: {
        ...baseChartOptions(theme, asset),
        plugins: {
          ...baseChartOptions(theme, asset).plugins,
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: theme.text, boxWidth: 10, padding: 12 }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: theme.text, maxRotation: 0, autoSkip: true } },
          y: { stacked: true, beginAtZero: true, grid: { color: theme.grid }, ticks: { color: theme.text } }
        }
      }
    })
  );

  if (peersCard) {
    charts.push(
      new Chart(peersCard.canvas, {
        type: 'bar',
        data: {
          labels: peers.map(([addr]) => shorten(addr, 8, 6)),
          datasets: [{
            data: peers.map(([, sats]) => toCoin(sats, asset)),
            backgroundColor: theme.accentSoft,
            borderColor: theme.accent,
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          ...baseChartOptions(theme, asset),
          indexAxis: 'y',
          scales: {
            x: { beginAtZero: true, grid: { color: theme.grid }, ticks: { color: theme.text } },
            y: { grid: { display: false }, ticks: { color: theme.text } }
          }
        }
      })
    );
  }

  if (utxoCard) {
    const top = [...utxos].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 10);
    charts.push(
      new Chart(utxoCard.canvas, {
        type: 'bar',
        data: {
          labels: top.map((item, index) => `#${index + 1}`),
          datasets: [{
            data: top.map((item) => toCoin(item.value || 0, asset)),
            backgroundColor: theme.inSoft,
            borderColor: theme.in,
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: baseChartOptions(theme, asset)
      })
    );
  }
}

function renderTxCharts(host, tx, asset = 'btc') {
  if (typeof Chart === 'undefined') return;
  const theme = chartTheme();
  const wrap = el('div', 'ws-crypto-charts');
  const outputs = chartCard('Output split', `${(tx.vout || []).length} outputs`);
  wrap.appendChild(outputs.card);
  host.appendChild(wrap);

  const vouts = (tx.vout || []).slice(0, 12);
  charts.push(
    new Chart(outputs.canvas, {
      type: 'doughnut',
      data: {
        labels: vouts.map((vout) => shorten(vout.scriptpubkey_address || vout.scriptpubkey_type || '—', 8, 6)),
        datasets: [{
          data: vouts.map((vout) => toCoin(vout.value || 0, asset)),
          backgroundColor: theme.palette.map((color) => `${color}55`),
          borderColor: theme.palette,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: theme.text, boxWidth: 10, padding: 10, font: { size: 11 } }
          },
          tooltip: baseChartOptions(theme, asset).plugins.tooltip
        }
      }
    })
  );
}

function paintWallet(wrap) {
  destroyCharts();
  const panel = toolChrome(wrap, 'Wallet Lookup');
  panel.appendChild(apiNote([API_SOURCES.blockchain, API_SOURCES.ethplorer]));
  const note = el(
    'p',
    'ws-image-note',
    'Paste a Bitcoin or Ethereum address. Bitcoin uses blockchain.info. Ethereum (0x…) uses Ethplorer (REST, public freekey, no signup). Other chains get explorer links only.'
  );

  const row = el('div', 'ws-people-row');
  const input = el('input', 'ws-osint-search');
  input.type = 'text';
  input.placeholder = 'bc1q…, 1…, 0x…, or a txid';
  const lookupBtn = el('button', 'ws-btn', 'Look up');
  lookupBtn.type = 'button';
  row.append(input, lookupBtn);

  const status = el('p', 'ws-image-status', '');
  const out = el('div', 'ws-web-out');
  const search = el('div');
  search.append(note, row, status);
  panel.append(search, out);

  function showSearch() {
    destroyCharts();
    search.hidden = false;
    out.replaceChildren();
    input.focus();
  }

  function showResult(data) {
    destroyCharts();
    const ident = data?.ident;
    if (!ident) return;
    status.textContent = '';
    const page = resultsShell(ident.kind === 'tx' ? 'Transfer result' : 'Wallet result', showSearch);
    const asset = data.chain?.asset || (ident.source === 'eth' ? 'eth' : 'btc');
    const stats = data.chain?.address?.chain_stats || {};
    const mempool = data.chain?.address?.mempool_stats || {};
    const funded = (stats.funded_txo_sum || 0) + (mempool.funded_txo_sum || 0);
    const spent = (stats.spent_txo_sum || 0) + (mempool.spent_txo_sum || 0);
    const balance = asset === 'eth'
      ? (data.chain?.balanceWei ?? '')
      : (data.chain?.address ? funded - spent : undefined);
    const txs = Array.isArray(data.chain?.txs) ? data.chain.txs : [];
    const utxos = Array.isArray(data.chain?.utxos) ? data.chain.utxos : [];
    const tokens = Array.isArray(data.chain?.tokens) ? data.chain.tokens : [];
    const chartHost = el('div');

    page.appendChild(heroCard(data.query, ident, balance, asset));

    if (data.chain?.address) {
      const grid = el('div', 'ws-crypto-stats');
      if (asset === 'eth') {
        grid.append(
          statCard(formatEth(balance), 'ETH balance'),
          statCard(String(stats.tx_count || txs.length), 'Transactions'),
          statCard(String(tokens.length), 'Tokens'),
          statCard(formatEth(funded), 'ETH in (recent)')
        );
      } else {
        grid.append(
          statCard(formatBtcShort(balance), 'Balance'),
          statCard(String((stats.tx_count || 0) + (mempool.tx_count || 0)), 'Transactions'),
          statCard(formatBtcShort(funded), 'Received'),
          statCard(formatBtcShort(spent), 'Sent')
        );
      }
      page.append(grid, chartHost);
      if (tokens.length) page.appendChild(tokenList(tokens));
      if (txs.length) page.appendChild(txList(txs, data.query, asset));
      if (utxos.length) page.appendChild(utxoList(utxos));
      if (data.canLoadMore && asset !== 'eth') {
        const more = el('button', 'ws-btn ws-btn-ghost ws-crypto-more', 'Load older transfers');
        more.type = 'button';
        more.addEventListener('click', () => loadOlder(data));
        page.appendChild(more);
      }
    }

    if (data.chain?.tx) {
      const tx = data.chain.tx;
      const grid = el('div', 'ws-crypto-stats');
      grid.append(
        statCard(tx.status?.confirmed ? 'Confirmed' : 'Pending', 'Status'),
        statCard(formatCoin(tx.fee || 0, asset), 'Fee'),
        statCard(String((tx.vin || []).length), asset === 'eth' ? 'From' : 'Inputs'),
        statCard(String((tx.vout || []).length), asset === 'eth' ? 'To' : 'Outputs')
      );
      if (tx.token) grid.append(statCard(formatToken(tx.token.value, tx.token.decimals, tx.token.symbol), 'Token'));
      if (tx.status?.block_time) {
        grid.append(statCard(formatTime(tx.status.block_time), 'Mined'));
      }
      page.append(grid, chartHost, txFlow(tx, data.query, asset));
    }

    if (data.chainError) {
      page.appendChild(el('p', 'ws-image-status is-bad', data.chainError));
      if (lookupLog.length) page.appendChild(diagnosticBlock(lookupLog));
    }
    if (data.chain) {
      page.appendChild(apiNote(asset === 'eth' ? [API_SOURCES.ethplorer] : [API_SOURCES.blockchain]));
    }
    page.appendChild(explorerRow(ident.explorers));
    out.replaceChildren(page);

    try {
      if (data.chain?.address) {
        renderAddressCharts(chartHost, {
          funded,
          spent,
          balance,
          txs,
          utxos,
          address: data.query,
          asset
        });
      } else if (data.chain?.tx) {
        renderTxCharts(chartHost, data.chain.tx, asset);
      }
    } catch {
      chartHost.replaceChildren(activityMeter(funded || 0, spent || 0, asset));
    }
  }

  async function loadOlder(data) {
    const offset = (data.chain?.txs || []).length;
    if (!data.query || offset >= (data.chain?.n_tx || 0)) return;
    try {
      const extra = await blockchainGet('address', data.query, offset);
      const packed = packAddressResult(extra, data.chain.utxos);
      const seen = new Set((data.chain.txs || []).map((tx) => tx.txid));
      data.chain.txs = [...data.chain.txs, ...packed.txs.filter((tx) => tx?.txid && !seen.has(tx.txid))];
      data.canLoadMore = data.chain.txs.length < (packed.n_tx || data.chain.n_tx || 0);
      setToolResult('crypto:wallet', data);
      showResult(data);
    } catch (err) {
      data.chainError = err.message || 'Could not load older transfers.';
      showResult(data);
    }
  }

  async function run() {
    const query = cleanCryptoQuery(input.value);
    if (!query) {
      status.textContent = 'Paste a wallet address first.';
      status.className = 'ws-image-status is-bad';
      return;
    }
    const ident = identifyCrypto(query) || unknownAddress(query);
    lookupBtn.disabled = true;
    lookupLog = [];
    const host = ident.source === 'eth' ? 'Ethplorer' : 'blockchain.info';
    status.textContent = ident.live ? `Looking up ${query} on ${host}…` : `Identified ${ident.chain}.`;
    status.className = 'ws-image-status';
    out.replaceChildren(loadingBlock(query, host));
    const saved = { query, ident, chain: null, chainError: '', canLoadMore: false };
    try {
      if (ident.testnet && ident.kind === 'address') {
        saved.chainError = 'blockchain.info is Bitcoin mainnet only. Open an explorer for testnet.';
      } else if (ident.source === 'eth' && ident.kind === 'address') {
        const info = coerceEthInfo(await ethGet('address', query), query);
        saved.chain = packEthAddress(info, [], normalizeTokens(info.tokens || []));
        input.value = query;
        status.textContent = '';
        showResult(saved);
        setToolResult('crypto:wallet', saved);

        try {
          const raw = await ethGet('txs', query);
          const items = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw) ? raw : []);
          const txs = items.map(normalizeEthTx);
          saved.chain = packEthAddress(info, txs, saved.chain.tokens || []);
          showResult(saved);
          setToolResult('crypto:wallet', saved);
        } catch (err) {
          lookupLog.push(`Transfers unavailable: ${err.message || 'failed'}`);
        }

        if (!(saved.chain.tokens && saved.chain.tokens.length)) {
          try {
            const tokens = await ethGet('tokens', query);
            saved.chain.tokens = normalizeTokens(tokens);
            setToolResult('crypto:wallet', saved);
            showResult(saved);
          } catch (err) {
            lookupLog.push(`Tokens unavailable: ${err.message || 'failed'}`);
          }
        }
      } else if (ident.source === 'eth' && ident.kind === 'tx') {
        const found = await ethGet('tx', query);
        saved.chain = { asset: 'eth', tx: normalizeEthTx(found) };
      } else if (ident.live && ident.kind === 'address') {
        const summary = await blockchainGet('balance', query);
        saved.chain = packBalance(query, summary);
        input.value = query;
        status.textContent = '';
        showResult(saved);
        setToolResult('crypto:wallet', saved);

        try {
          const raw = await blockchainGet('address', query, 0);
          const packed = packAddressResult(raw, saved.chain.utxos || []);
          saved.chain = packed;
          saved.canLoadMore = packed.txs.length < packed.n_tx;
          showResult(saved);
          setToolResult('crypto:wallet', saved);
        } catch (err) {
          lookupLog.push(`Transfers unavailable: ${err.message || 'failed'}`);
        }

        try {
          saved.chain.utxos = normalizeUtxos(await blockchainGet('unspent', query)).slice(0, 20);
          setToolResult('crypto:wallet', saved);
          showResult(saved);
        } catch (err) {
          lookupLog.push(`UTXO details unavailable: ${err.message || 'failed'}`);
        }
      } else if (ident.live && ident.kind === 'tx') {
        const found = await lookupTx(query);
        saved.chain = { asset: 'btc', tx: found.tx };
      }
      input.value = query;
      status.textContent = saved.chainError || '';
      status.className = saved.chainError ? 'ws-image-status is-bad' : 'ws-image-status';
      showResult(saved);
      setToolResult('crypto:wallet', saved);
    } catch (err) {
      saved.chainError = err?.message || 'Lookup failed.';
      status.textContent = saved.chainError;
      status.className = 'ws-image-status is-bad';
      try {
        showResult(saved);
      } catch {
        out.replaceChildren(diagnosticBlock(lookupLog.length ? lookupLog : [saved.chainError]));
      }
    } finally {
      lookupBtn.disabled = false;
    }
  }

  function safeRun() {
    try {
      Promise.resolve(run()).catch((err) => {
        status.textContent = `Crypto tool error: ${err?.message || err}`;
        status.className = 'ws-image-status is-bad';
      });
    } catch (err) {
      status.textContent = `Crypto tool error: ${err?.message || err}`;
      status.className = 'ws-image-status is-bad';
    }
  }

  lookupBtn.addEventListener('click', safeRun);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') safeRun();
  });

  const saved = getToolResult('crypto:wallet');
  if (saved?.query && saved?.ident && (saved.chain?.address || saved.chain?.tx || saved.chainError)) {
    input.value = saved.query;
    if (saved.chainError) {
      status.textContent = saved.chainError;
      status.className = 'ws-image-status is-bad';
    }
    try {
      showResult(saved);
    } catch {
      out.replaceChildren();
    }
  }
}

export function renderCryptoTools(wrap) {
  wrap.dataset.osintReady = '';
  paintWallet(wrap);
}
