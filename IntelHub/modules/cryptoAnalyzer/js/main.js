// --- Global State ---
let currentWalletData = null;
let allFetchedTransactions = [];
let filteredTransactions = [];
let currentPage = 1;
const TRANSACTIONS_PER_PAGE = 100;
let currentWalletType = '';
let scamAddresses = new Set();
const KNOWN_CEX_ADDRESSES = new Set([
    '0x73bceb1cd57c711feac4224d062b0f6ff338501e', // Binance 1
    '0x28c6c06298d514db089934071355e5743bf21d60', // Binance 2
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // Tether (USDT)
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'  // USD Coin (USDC)
]);
const KNOWN_TOKENS = new Set(['USDT', 'USDC', 'WETH', 'DAI', 'BUSD', 'SHIB', 'MATIC', 'WBTC']);


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fetchDataBtn').addEventListener('click', () => startAnalysis());
    document.getElementById('prevPageBtn').addEventListener('click', prevPage);
    document.getElementById('nextPageBtn').addEventListener('click', nextPage);
    
    document.getElementById('exportResultsBtn').addEventListener('click', exportResults);
    document.getElementById('applyFiltersBtn').addEventListener('click', applyFilters);
    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);

    loadBlacklist();
    loadHistory();
});

// --- Helper function for creating elements ---
function createElement(tag, options = {}) {
    const el = document.createElement(tag);
    if (options.className) el.className = options.className;
    if (options.textContent) el.textContent = options.textContent;
    if (options.title) el.title = options.title;
    if (options.href) el.href = options.href;
    if (options.target) el.target = options.target;
    if (options.style) {
        for (const prop in options.style) {
            el.style[prop] = options.style[prop];
        }
    }
    if (options.onClick) {
        el.addEventListener('click', options.onClick);
    }
    return el;
}


// --- Core Functions ---
async function loadBlacklist() {
    const blacklistUrl = 'https://raw.githubusercontent.com/scamsniffer/scam-database/refs/heads/main/blacklist/address.json';
    try {
        const response = await fetch(blacklistUrl);
        if (!response.ok) throw new Error('Response not OK');
        const data = await response.json();
        scamAddresses = new Set((data || []).map(addr => addr.toLowerCase()));
    } catch (error) {
        showMessage('Could not load the scam blacklist.', 'warning');
    }
}

function detectWalletType(address) {
    const cleanAddress = address.trim().replace(/[\u200B-\u200D\uFEFF\s]/g, '');
    if (cleanAddress.toLowerCase().startsWith('0x') && cleanAddress.length === 42) return 'eth';
    if (cleanAddress.length >= 26 && cleanAddress.length <= 62) return 'btc';
    return null;
}

async function checkAddressReputation(address, network) {
    try {
        // This API seems to be down (404). We'll skip it for now.
    } catch (error) {
        console.warn("CheckCryptoAddress API failed:", error);
    }
}

async function startAnalysis(addressFromHistory = null) {
    const address = typeof addressFromHistory === 'string' ? addressFromHistory : document.getElementById('walletAddressInput').value.trim();
    if (!address) {
        showMessage('Please enter a wallet address.', 'warning');
        return;
    }

    currentWalletType = detectWalletType(address);
    if (!currentWalletType) {
        showMessage('Invalid address format (not identified as BTC or ETH).', 'warning');
        return;
    }
    
    showLoading();
    clearAnalysis();
    
    try {
        await checkAddressReputation(address, currentWalletType);
        let analysisData;
        if (currentWalletType === 'btc') {
            analysisData = await fetchAndAnalyzeBitcoin(address);
        } else if (currentWalletType === 'eth') {
            analysisData = await fetchAndAnalyzeEthereum(address);
        }
        saveSearchToHistory(address); // Only save address, not full data
        renderAnalysis(analysisData);

    } catch (error) {
        console.error('Data fetch failed:', error);
        showMessage(`❌ ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

function renderAnalysis(data) {
    currentWalletData = data;
    allFetchedTransactions = data.txs;
    filteredTransactions = allFetchedTransactions;
    
    if(data.type === 'btc') {
        updateBtcHeader(data);
        updateBtcStats(data);
    } else {
        updateEthHeader(data);
        updateEthStats(data);
    }
    
    updateTransactionsList();
    updateRelatedAddresses(data.address, allFetchedTransactions);
    
    if(data.type === 'btc') {
        generateBtcAlerts(data);
    } else {
        generateEthAlerts(data);
    }
    
    renderNetworkGraph(data.address, allFetchedTransactions);
    showAnalysis();
}


// --- Bitcoin Analysis (Using Blockchain.info API) ---
async function fetchAndAnalyzeBitcoin(address) {
    const proxyUrl = 'https://corsproxy.io/?';
    // FIX: Switched to the more reliable blockchain.info API
    const apiUrl = `${proxyUrl}${encodeURIComponent(`https://blockchain.info/rawaddr/${address}`)}`;

    let response;
    try {
        response = await fetch(apiUrl);
    } catch (networkError) {
        console.error("Network error during BTC fetch:", networkError);
        throw new Error('A network error occurred. The API or proxy service may be down. Please try again.');
    }

    if (!response.ok) throw new Error(`Error fetching BTC data: ${response.statusText}`);
    
    const data = await response.json();
    
    if (data.error) throw new Error(`API error from Blockchain.info: ${data.error}`);

    // Transform the new API data structure to match what our functions expect
    const allTxs = (data.txs || []).map(tx => {
        const received = tx.out.reduce((sum, output) => (output.addr === address) ? sum + output.value : sum, 0);
        const sent = tx.inputs.reduce((sum, input) => (input.prev_out && input.prev_out.addr === address) ? sum + input.prev_out.value : sum, 0);
        const balanceChange = received - sent;
        const isOutgoing = balanceChange < 0;

        const counterparties = isOutgoing
            ? tx.out.map(o => o.addr).filter(a => a !== address)
            : tx.inputs.map(i => i.prev_out ? i.prev_out.addr : null);

        return {
            hash: tx.hash,
            time: tx.time, // Already in seconds
            result: balanceChange,
            counterparties: [...new Set(counterparties.filter(Boolean))],
            inputs: tx.inputs,
            outputs: tx.out // Note the change from 'outputs' to 'out'
        };
    }).sort((a, b) => b.time - a.time);

    return {
        type: 'btc',
        address: data.address,
        n_tx: data.n_tx,
        total_received: data.total_received,
        total_sent: data.total_sent,
        final_balance: data.final_balance,
        txs: allTxs
    };
}

function updateBtcHeader(data) {
    const header = document.getElementById('walletHeader');
    header.innerHTML = ''; // Clear previous content

    const title = createElement('h2', { textContent: '📊 Bitcoin Wallet Details' });
    
    const addressDiv = createElement('div');
    addressDiv.appendChild(createElement('strong', { textContent: 'Address: ' }));
    addressDiv.appendChild(createElement('a', { 
        href: `https://www.blockchain.com/btc/address/${data.address}`, 
        target: '_blank', 
        className: 'address-link', 
        textContent: data.address 
    }));

    const statsDiv = createElement('div', { 
        textContent: `Total Transactions: ${data.n_tx || 0} | Balance: ${formatCrypto(data.final_balance, 'btc')}` 
    });

    header.appendChild(title);
    header.appendChild(addressDiv);
    header.appendChild(statsDiv);
}

function updateBtcStats(data) {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = ''; // Clear previous content

    const stats = [
        { value: formatCrypto(data.total_received, 'btc'), label: '💰 Total Received' },
        { value: formatCrypto(data.total_sent, 'btc'), label: '💸 Total Sent' },
        { value: formatCrypto(data.final_balance, 'btc'), label: '🏦 Final Balance' },
        { value: data.n_tx || 0, label: '📊 Total Transactions' }
    ];

    stats.forEach(stat => {
        const card = createElement('div', { className: 'stat-card' });
        card.appendChild(createElement('div', { className: 'stat-value', textContent: stat.value }));
        card.appendChild(createElement('div', { className: 'stat-label', textContent: stat.label }));
        statsGrid.appendChild(card);
    });
}

// --- Ethereum Analysis (Using Blockscout API) ---
async function fetchAndAnalyzeEthereum(address) {
    const proxyUrl = 'https://corsproxy.io/?';
    
    const balanceApiUrl = `https://eth.blockscout.com/api?module=account&action=balance&address=${address}`;
    const txsApiUrl = `https://eth.blockscout.com/api?module=account&action=txlist&address=${address}&page=1&offset=100&sort=desc`;
    const tokenTxsApiUrl = `https://eth.blockscout.com/api?module=account&action=tokentx&address=${address}&page=1&offset=100&sort=desc`;

    const balanceUrl = `${proxyUrl}${encodeURIComponent(balanceApiUrl)}`;
    const txsUrl = `${proxyUrl}${encodeURIComponent(txsApiUrl)}`;
    const tokenTxsUrl = `${proxyUrl}${encodeURIComponent(tokenTxsApiUrl)}`;

    let balanceRes, txsRes, tokenTxsRes;
    try {
        // Fetch sequentially to be gentler on the proxy
        balanceRes = await fetch(balanceUrl);
        await new Promise(resolve => setTimeout(resolve, 250)); // 250ms delay
        txsRes = await fetch(txsUrl);
        await new Promise(resolve => setTimeout(resolve, 250)); // 250ms delay
        tokenTxsRes = await fetch(tokenTxsUrl);
    } catch (networkError) {
        console.error("Network error during ETH fetch:", networkError);
        throw new Error('A network error occurred. The API or proxy service may be down. Please try again.');
    }

    if (!balanceRes.ok || !txsRes.ok || !tokenTxsRes.ok) throw new Error('Failed to fetch data from the proxy service.');

    const balanceData = await balanceRes.json();
    const txsData = await txsRes.json();
    const tokenTxsData = await tokenTxsRes.json();

    if (balanceData.status !== "1") {
        throw new Error(`API error from Blockscout (Balance): ${balanceData.message}`);
    }

    const normalTxs = (txsData.status === "1" && txsData.result) 
        ? txsData.result.map(tx => ({...tx, type: 'ETH Transfer'})) 
        : [];

    const tokenTxs = (tokenTxsData.status === "1" && tokenTxsData.result) 
        ? tokenTxsData.result.map(tx => ({...tx, type: `Token (${tx.tokenSymbol})`}))
        : [];

    if (txsData.status === "0" && txsData.message !== "OK" && txsData.message !== 'No transactions found') {
        throw new Error(`API error from Blockscout (Txs): ${txsData.message}`);
    }
    if (tokenTxsData.status === "0" && tokenTxsData.message !== "OK" && tokenTxsData.message !== 'No transactions found') {
        throw new Error(`API error from Blockscout (Token Txs): ${tokenTxsData.message}`);
    }
    
    const allTxs = [...normalTxs, ...tokenTxs].sort((a, b) => b.timeStamp - a.timeStamp);

    return {
        type: 'eth',
        address: address,
        balance: balanceData.result,
        txs: allTxs,
        txCount: allTxs.length,
        tokenTxCount: tokenTxs.length
    };
}

function updateEthHeader(data) {
    const header = document.getElementById('walletHeader');
    header.innerHTML = ''; // Clear previous content

    const title = createElement('h2', { textContent: '📊 Ethereum Wallet Details' });

    const addressDiv = createElement('div');
    addressDiv.appendChild(createElement('strong', { textContent: 'Address: ' }));
    addressDiv.appendChild(createElement('a', { 
        href: `https://etherscan.io/address/${data.address}`, 
        target: '_blank', 
        className: 'address-link', 
        textContent: data.address 
    }));

    const statsDiv = createElement('div', { 
        textContent: `Total Transactions: ${data.txCount} | Balance: ${formatCrypto(data.balance, 'eth')}` 
    });

    header.appendChild(title);
    header.appendChild(addressDiv);
    header.appendChild(statsDiv);
}

function updateEthStats(data) {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = ''; // Clear previous content

    const stats = [
        { value: formatCrypto(data.balance, 'eth'), label: '🏦 ETH Balance' },
        { value: data.txCount, label: '📊 Total Actions' },
        { value: data.tokenTxCount, label: '🪙 Token Transfers' }
    ];

    stats.forEach(stat => {
        const card = createElement('div', { className: 'stat-card' });
        card.appendChild(createElement('div', { className: 'stat-value', textContent: stat.value }));
        card.appendChild(createElement('div', { className: 'stat-label', textContent: stat.label }));
        statsGrid.appendChild(card);
    });
}

// --- Generic Transaction Rendering & Pagination ---
function updateTransactionsList() {
    const startIndex = (currentPage - 1) * TRANSACTIONS_PER_PAGE;
    const endIndex = startIndex + TRANSACTIONS_PER_PAGE;
    const transactionsToDisplay = filteredTransactions.slice(startIndex, endIndex);

    if (currentWalletType === 'btc') {
        renderBtcTransactions(transactionsToDisplay);
    } else {
        renderEthTransactions(transactionsToDisplay);
    }
    updatePaginationControls();
}

function renderBtcTransactions(transactions) {
    const header = document.getElementById('transactionsTableHeader');
    header.innerHTML = '<tr><th>Date</th><th>Hash</th><th>From/To</th><th>Value</th><th>Risk</th><th>Details</th></tr>';
    
    const tbody = document.getElementById('transactionsList');
    tbody.innerHTML = ''; // Clear previous content

    transactions.forEach(tx => {
        const risk = assessBtcRisk(tx);
        const isOutgoing = tx.result < 0;
        const counterparty = (tx.counterparties && tx.counterparties.length > 0) ? tx.counterparties[0] : 'Multiple';

        const row = createElement('tr');
        if (risk.level === 'high') row.classList.add('suspicious');

        // Date
        row.appendChild(createElement('td', { textContent: formatDate(tx.time) }));
        
        // Hash
        const hashTd = createElement('td');
        hashTd.appendChild(createElement('a', {
            href: `https://www.blockchain.com/btc/tx/${tx.hash || ''}`,
            target: '_blank',
            className: 'address-link',
            textContent: `${(tx.hash || 'N/A').substring(0, 16)}...`
        }));
        row.appendChild(hashTd);

        // From/To
        const counterpartyTd = createElement('td');
        counterpartyTd.appendChild(createElement('span', { textContent: `${isOutgoing ? 'To:' : 'From:'}`, style: { marginRight: '5px' } }));
        const counterpartyLink = createElement('a', {
            href: `https://www.blockchain.com/btc/address/${counterparty}`,
            target: '_blank',
            className: 'address-link',
            title: counterparty,
            textContent: `${(counterparty || 'Multiple').substring(0, 10)}...`,
            onClick: (e) => e.stopPropagation()
        });
        counterpartyTd.appendChild(counterpartyLink);
        row.appendChild(counterpartyTd);

        // Value
        row.appendChild(createElement('td', { 
            textContent: formatCrypto(tx.result, 'btc'), 
            style: { color: isOutgoing ? '#ff7675' : '#55efc4' }
        }));
        
        // Risk
        const riskTd = createElement('td');
        riskTd.appendChild(createElement('span', { 
            className: `risk-indicator risk-${risk.level}`, 
            textContent: risk.level 
        }));
        row.appendChild(riskTd);

        // Details
        const detailsTd = createElement('td');
        getBtcBehavioralFlags(tx).forEach(flag => detailsTd.appendChild(flag));
        row.appendChild(detailsTd);

        tbody.appendChild(row);
    });
}

function renderEthTransactions(transactions) {
    const header = document.getElementById('transactionsTableHeader');
    header.innerHTML = '<tr><th>Date</th><th>Hash</th><th>Type</th><th>From/To</th><th>Value</th><th>Risk</th><th>Details</th></tr>';
    
    const tbody = document.getElementById('transactionsList');
    tbody.innerHTML = ''; // Clear previous content

    transactions.forEach(tx => {
        const risk = assessEthRisk(tx);
        const fromAddr = tx.from ? tx.from.toLowerCase() : '';
        const mainAddr = currentWalletData.address.toLowerCase();
        const isOutgoing = fromAddr === mainAddr;
        const counterparty = isOutgoing ? tx.to : tx.from;
        let valueDisplay = tx.tokenSymbol ? `${(tx.value / Math.pow(10, tx.tokenDecimal || 18)).toFixed(4)} ${tx.tokenSymbol}` : formatCrypto(tx.value, 'eth');
        
        const row = createElement('tr');
        if (risk.level === 'high' || (counterparty && isBlacklisted(counterparty))) row.classList.add('suspicious');

        // Date
        row.appendChild(createElement('td', { textContent: formatDate(tx.timeStamp) }));

        // Hash
        const hashTd = createElement('td');
        hashTd.appendChild(createElement('a', {
            href: `https://etherscan.io/tx/${tx.hash || ''}`,
            target: '_blank',
            className: 'address-link',
            textContent: `${(tx.hash || 'N/A').substring(0, 16)}...`
        }));
        row.appendChild(hashTd);

        // Type
        row.appendChild(createElement('td', { textContent: tx.type }));

        // From/To
        const counterpartyTd = createElement('td');
        counterpartyTd.appendChild(createElement('span', { textContent: `${isOutgoing ? 'To:' : 'From:'}`, style: { marginRight: '5px' } }));
        counterpartyTd.appendChild(createElement('a', {
            href: `https://etherscan.io/address/${counterparty}`,
            target: '_blank',
            className: 'address-link',
            title: counterparty,
            textContent: `${(counterparty || 'N/A').substring(0, 10)}...`,
            onClick: (e) => e.stopPropagation()
        }));
        row.appendChild(counterpartyTd);

        // Value
        row.appendChild(createElement('td', { 
            textContent: valueDisplay,
            style: { color: isOutgoing ? '#ff7675' : '#55efc4' }
        }));
        
        // Risk
        const riskTd = createElement('td');
        riskTd.appendChild(createElement('span', { 
            className: `risk-indicator risk-${risk.level}`, 
            textContent: risk.level 
        }));
        row.appendChild(riskTd);

        // Details
        const detailsTd = createElement('td');
        getEthBehavioralFlags(tx).forEach(flag => detailsTd.appendChild(flag));
        row.appendChild(detailsTd);
        
        tbody.appendChild(row);
    });
}

function updatePaginationControls() {
    const pageControls = document.getElementById('paginationControls');
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const totalPages = Math.ceil(filteredTransactions.length / TRANSACTIONS_PER_PAGE);

    if (totalPages <= 1) {
        pageControls.style.display = 'none';
        return;
    }

    pageControls.style.display = 'flex';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

function nextPage() {
    const totalPages = Math.ceil(filteredTransactions.length / TRANSACTIONS_PER_PAGE);
    if (currentPage < totalPages) {
        currentPage++;
        updateTransactionsList();
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        updateTransactionsList();
    }
}

// --- Risk Analysis ---
function isPeelChain(tx) {
    if (!tx.outputs || tx.outputs.length < 2) {
        return false;
    }
    const outputValues = tx.outputs.map(o => o.value).sort((a, b) => a - b);
    const smallest = outputValues[0];
    const largest = outputValues[outputValues.length - 1];
    if (smallest < largest * 0.1 && largest > 10000) { 
        return true;
    }
    return false;
}

function assessBtcRisk(tx) {
    let score = 0;
    if (Math.abs(tx.result) > 1e8) score += 2; // More than 1 BTC
    if (isPeelChain(tx)) score += 2;
    if ((tx.counterparties || []).some(isBlacklisted)) score += 5;
    if ((tx.counterparties || []).some(addr => KNOWN_CEX_ADDRESSES.has(addr))) score -= 1;
    let level = 'low';
    if (score >= 5) level = 'high';
    else if (score >= 2) level = 'medium';
    return { level, score };
}

function getBtcBehavioralFlags(tx) {
    let flags = [];
    if (isPeelChain(tx)) flags.push(createElement('span', { className: 'risk-indicator risk-medium', textContent: 'Peel Chain' }));
    if ((tx.counterparties || []).some(isBlacklisted)) flags.push(createElement('span', { className: 'risk-indicator risk-high', textContent: 'Blacklist' }));
    if ((tx.counterparties || []).some(addr => KNOWN_CEX_ADDRESSES.has(addr))) flags.push(createElement('span', { className: 'risk-indicator risk-low', textContent: 'CEX Link' }));
    if (flags.length === 0) flags.push(document.createTextNode('—'));
    return flags;
}

function generateBtcAlerts(data) {
    const alertsContainer = document.getElementById('alertsContainer');
    alertsContainer.innerHTML = ''; // Clear previous content
    const alerts = [];
    const txs = data.txs || [];

    if (data.final_balance === 0 && data.total_received > 0) alerts.push({ type: 'warning', message: '⚠️ Wallet has been emptied.' });
    const blacklistedCount = countBlacklistedInteractions(txs);
    if (blacklistedCount > 0) alerts.push({ type: 'danger', message: `🚨 Interactions with ${blacklistedCount} blacklisted addresses detected!` });
    
    const dustTxs = txs.filter(tx => tx.result > 0 && tx.result < 1000); // Less than 1000 satoshis
    if (dustTxs.length > 5) alerts.push({ type: 'warning', message: ' bụi Multiple "dust" transactions detected - potential privacy attack.' });
    
    if (txs.length > 10) {
        const lastTenTxs = txs.slice(0, 10);
        const avgTimeDiff = (lastTenTxs[0].time - lastTenTxs[9].time) / 9;
        if (avgTimeDiff < 60) alerts.push({ type: 'warning', message: '🕒 High transaction frequency detected - potential bot activity.' });
    }
    
    if (analyzeForTransitActivity(txs, data.address, 'btc')) alerts.push({ type: 'danger', message: '✈️ Suspicious "transit" wallet behavior detected.' });
    
    alerts.forEach(a => {
        alertsContainer.appendChild(createElement('div', { className: `alert alert-${a.type}`, textContent: a.message }));
    });
}

function getEthBehavioralFlags(tx) {
    const flags = [];
    const counterparty = (tx.from.toLowerCase() === currentWalletData.address.toLowerCase()) ? tx.to : tx.from;
    if (isBlacklisted(counterparty)) flags.push(createElement('span', { className: 'risk-indicator risk-high', textContent: 'Blacklist' }));
    if (KNOWN_CEX_ADDRESSES.has(counterparty.toLowerCase())) flags.push(createElement('span', { className: 'risk-indicator risk-low', textContent: 'CEX Link' }));
    if (tx.tokenSymbol && !KNOWN_TOKENS.has(tx.tokenSymbol)) flags.push(createElement('span', { className: 'risk-indicator risk-medium', textContent: 'Unknown Token' }));
    
    const valueInEth = parseFloat(tx.value) / 1e18;
    if (valueInEth > 0 && (valueInEth % 1 === 0 || (valueInEth * 10) % 1 === 0)) flags.push(createElement('span', { className: 'risk-indicator risk-low', textContent: 'Round Amount' }));
    
    if (flags.length === 0) flags.push(document.createTextNode('—'));
    return flags;
}

function assessEthRisk(tx) {
    let score = 0;
    const valueInWei = parseFloat(tx.value || 0);
    if (valueInWei > 1e19) score += 2; // > 10 ETH
    if (tx.isError === "1") score += 1;
    const counterparty = (tx.from.toLowerCase() === currentWalletData.address.toLowerCase()) ? tx.to : tx.from;
    if (isBlacklisted(counterparty)) score += 5;
    if (counterparty && counterparty.toLowerCase() === '0x722122df12d4e14e13ac3b6895a86e84145b6967') score += 5; // Tornado Cash
    if (KNOWN_CEX_ADDRESSES.has(counterparty.toLowerCase())) score -= 1;
    if (tx.tokenSymbol && !KNOWN_TOKENS.has(tx.tokenSymbol)) score += 1;
    let level = 'low';
    if (score >= 5) level = 'high';
    else if (score >= 2) level = 'medium';
    return { level, score };
}

function generateEthAlerts(data) {
    const alertsContainer = document.getElementById('alertsContainer');
    alertsContainer.innerHTML = ''; // Clear previous content
    const alerts = [];
    const txs = data.txs || [];

    const blacklistedCount = countBlacklistedInteractions(txs);
    if (blacklistedCount > 0) alerts.push({ type: 'danger', message: `🚨 Interactions with ${blacklistedCount} blacklisted addresses detected!` });
    
    if (txs.some(tx => (tx.to?.toLowerCase() === '0x722122df12d4e14e13ac3b6895a86e84145b6967' || tx.from?.toLowerCase() === '0x722122df12d4e14e13ac3b6895a86e84145b6967'))) alerts.push({ type: 'danger', message: `🚨 Interaction with a known mixer (Tornado Cash) detected.` });
    
    const dustTxs = txs.filter(tx => tx.from.toLowerCase() !== data.address.toLowerCase() && parseFloat(tx.value) < 1e12 && parseFloat(tx.value) > 0);
    if (dustTxs.length > 5) alerts.push({ type: 'warning', message: ' bụi Multiple "dust" transactions detected - potential privacy attack.' });
    
    if (txs.length > 10) {
         const lastTenTxs = txs.slice(0, 10);
         const avgTimeDiff = (lastTenTxs[0].timeStamp - lastTenTxs[9].timeStamp) / 9;
        if (avgTimeDiff < 60) alerts.push({ type: 'warning', message: '🕒 High transaction frequency detected - potential bot activity.' });
    }
    
    if (analyzeForTransitActivity(txs, data.address, 'eth')) alerts.push({ type: 'danger', message: '✈️ Suspicious "transit" wallet behavior detected.' });
    
    alerts.forEach(a => {
        alertsContainer.appendChild(createElement('div', { className: `alert alert-${a.type}`, textContent: a.message }));
    });
}

// --- Shared Helper Functions ---
function showMessage(message, type = 'error') {
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = message;
    messageBox.className = `message-box ${type} show`;
    setTimeout(() => {
        messageBox.className = messageBox.className.replace('show', '');
    }, 4000);
}

function updateRelatedAddresses(mainAddress, transactions) {
    const networkDiv = document.getElementById('addressesNetwork');
    networkDiv.innerHTML = ''; // Clear previous content
    const addresses = new Set();

    transactions.slice(0, 100).forEach(tx => {
        if (currentWalletType === 'btc') {
            (tx.counterparties || []).forEach(addr => addresses.add(addr));
        } else {
            if (tx.to && tx.to.toLowerCase() !== mainAddress.toLowerCase()) addresses.add(tx.to);
            if (tx.from && tx.from.toLowerCase() !== mainAddress.toLowerCase()) addresses.add(tx.from);
        }
    });

    const explorerUrl = currentWalletType === 'btc' ? 'https://www.blockchain.com/btc/address/' : 'https://etherscan.io/address/';
    
    Array.from(addresses).forEach(addr => {
        const div = createElement('div');
        div.appendChild(createElement('a', {
            href: `${explorerUrl}${addr}`,
            target: '_blank',
            className: 'address-link',
            title: addr,
            textContent: addr
        }));
        networkDiv.appendChild(div);
    });
}

function renderNetworkGraph(mainAddress, transactions) {
    const elements = [];
    const nodes = new Set([mainAddress]);
    transactions.slice(0, 50).forEach(tx => {
        const counterparties = tx.counterparties || [];
        if (currentWalletType === 'eth') {
            const isOutgoing = tx.from?.toLowerCase() === mainAddress.toLowerCase();
            if (isOutgoing) counterparties.push(tx.to); else counterparties.push(tx.from);
        }
        
        counterparties.forEach(addr => {
            if (!addr || addr === 'Multiple') return;
            nodes.add(addr);
            const source = (currentWalletType === 'btc' && tx.result > 0) || (currentWalletType === 'eth' && tx.from?.toLowerCase() !== mainAddress.toLowerCase()) ? addr : mainAddress;
            const target = source === mainAddress ? addr : mainAddress;
            elements.push({ group: 'edges', data: { id: `${tx.hash || 'unknown'}-${addr}`, source, target } });
        });
    });

    nodes.forEach(addr => {
        elements.push({ 
            group: 'nodes', 
            data: { id: addr, label: (addr || '').substring(0, 8) + '...' },
            classes: addr.toLowerCase() === mainAddress.toLowerCase() ? 'main-node' : 'other-node'
        });
    });

    cytoscape({
        container: document.getElementById('cy-network-graph'),
        elements: elements,
        style: [
            { selector: 'node', style: { 'background-color': '#667eea', 'label': 'data(label)', 'color': '#fff', 'text-valign': 'bottom', 'text-halign': 'center', 'font-size': '8px' } },
            { selector: '.main-node', style: { 'background-color': '#f5576c', 'width': '40px', 'height': '40px' } },
            { selector: 'edge', style: { 'width': 1, 'line-color': '#5a5a7a', 'target-arrow-color': '#5a5a7a', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } }
        ],
        layout: { name: 'cose', animate: false, padding: 30 }
    });
}

function isBlacklisted(address) {
    return address && scamAddresses.has(address.toLowerCase());
}

function countBlacklistedInteractions(transactions) {
    let count = 0;
    transactions.forEach(tx => {
        if (currentWalletType === 'btc') {
            if ((tx.counterparties || []).some(isBlacklisted)) count++;
        } else {
            if (isBlacklisted(tx.to) || isBlacklisted(tx.from)) count++;
        }
    });
    return count;
}

function analyzeForTransitActivity(transactions, address, type) {
    const sortedTxs = [...transactions].sort((a, b) => (a.time || a.timeStamp) - (b.time || b.timeStamp));
    const timeThreshold = 3600; // 1 hour
    const valueSimilarityThreshold = 0.1; // 10%

    for (let i = 0; i < sortedTxs.length; i++) {
        const txIn = sortedTxs[i];
        const isIncoming = type === 'btc' ? txIn.result > 0 : txIn.to.toLowerCase() === address.toLowerCase();
        if (isIncoming) {
            const inValue = parseFloat(type === 'btc' ? txIn.result : txIn.value);
            for (let j = i + 1; j < sortedTxs.length; j++) {
                const txOut = sortedTxs[j];
                const timeDiff = (txOut.time || txOut.timeStamp) - (txIn.time || txIn.timeStamp);
                if (timeDiff > timeThreshold) break;
                const isOutgoing = type === 'btc' ? txOut.result < 0 : txOut.from.toLowerCase() === address.toLowerCase();
                if (isOutgoing) {
                    const outValue = Math.abs(parseFloat(type === 'btc' ? txOut.result : txOut.value));
                    if (inValue > 0 && Math.abs(inValue - outValue) / inValue <= valueSimilarityThreshold) return true;
                }
            }
        }
    }
    return false;
}

function showLoading() { document.getElementById('loading').style.display = 'block'; document.getElementById('analysisSection').style.display = 'none'; }
function hideLoading() { document.getElementById('loading').style.display = 'none'; }
function showAnalysis() { document.getElementById('analysisSection').style.display = 'block'; document.getElementById('analysisSection').scrollIntoView({ behavior: 'smooth' }); }
function clearAnalysis() {
    document.getElementById('analysisSection').style.display = 'none';
    document.getElementById('reputationAlertContainer').innerHTML = '';
    currentWalletData = null;
    allFetchedTransactions = [];
    filteredTransactions = [];
    currentPage = 1;
    document.getElementById('alertsContainer').innerHTML = '';
    document.getElementById('transactionsList').innerHTML = '';
    resetFilters();
}

function formatCrypto(value, type) {
    if (value === undefined || value === null) return 'N/A';
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) return 'N/A';
    if (type === 'btc') return `${(numericValue / 1e8).toFixed(8)} BTC`;
    if (type === 'eth') return `${(numericValue / 1e18).toFixed(6)} ETH`;
    return value;
}

function formatDate(timestamp) { return new Date(timestamp * 1000).toLocaleString('en-US'); }

function applyFilters() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const minAmount = parseFloat(document.getElementById('minAmount').value);
    const maxAmount = parseFloat(document.getElementById('maxAmount').value);
    const addressFilter = document.getElementById('addressFilter').value.toLowerCase();

    filteredTransactions = allFetchedTransactions.filter(tx => {
        const txDate = new Date((tx.time || tx.timeStamp) * 1000);
        if (startDate && txDate < new Date(startDate)) return false;
        if (endDate && txDate > new Date(endDate)) return false;

        const value = currentWalletType === 'btc' ? Math.abs(tx.result) / 1e8 : Math.abs(tx.value) / 1e18;
        if (!isNaN(minAmount) && value < minAmount) return false;
        if (!isNaN(maxAmount) && value > maxAmount) return false;

        if (addressFilter) {
            const counterparties = tx.counterparties || [];
            if (currentWalletType === 'eth') {
                const ethCounterparty = (tx.from.toLowerCase() === currentWalletData.address.toLowerCase() ? tx.to : tx.from).toLowerCase();
                counterparties.push(ethCounterparty);
            }
            if (!counterparties.some(c => c.toLowerCase().includes(addressFilter))) return false;
        }
        return true;
    });
    currentPage = 1;
    updateTransactionsList();
}

function resetFilters() {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('minAmount').value = '';
    document.getElementById('maxAmount').value = '';
    document.getElementById('addressFilter').value = '';
    filteredTransactions = allFetchedTransactions;
    currentPage = 1;
    updateTransactionsList();
}

// --- History & Export ---
function saveSearchToHistory(address) {
    let history = JSON.parse(localStorage.getItem('cryptoAnalyzerHistory')) || [];
    history = history.filter(item => item.address !== address);

    const newHistoryItem = {
        address: address,
        type: currentWalletType,
        timestamp: new Date().toISOString()
    };
    
    history.unshift(newHistoryItem);

    if (history.length > 20) {
        history = history.slice(0, 20);
    }

    localStorage.setItem('cryptoAnalyzerHistory', JSON.stringify(history));
    loadHistory();
}

function removeFromHistory(addressToRemove) {
    let history = JSON.parse(localStorage.getItem('cryptoAnalyzerHistory')) || [];
    history = history.filter(item => item.address !== addressToRemove);
    localStorage.setItem('cryptoAnalyzerHistory', JSON.stringify(history));
    loadHistory();
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('cryptoAnalyzerHistory')) || [];
    const historyList = document.getElementById('historyList');
    const historySection = document.getElementById('historySection');
    historyList.innerHTML = '';

    if (history.length > 0) {
        historySection.style.display = 'block';
        history.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            const addressSpan = document.createElement('span');
            addressSpan.className = 'history-item-address';
            addressSpan.textContent = `${(item.address || '').substring(0, 10)}...`;
            addressSpan.title = `Check: ${item.address}\nLast checked: ${new Date(item.timestamp).toLocaleString()}`;
            addressSpan.onclick = () => startAnalysis(item.address);
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.textContent = '×'; // Using multiplication sign for better centering
            removeBtn.title = 'Remove from history';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeFromHistory(item.address);
            };

            historyItem.appendChild(addressSpan);
            historyItem.appendChild(removeBtn);
            historyList.appendChild(historyItem);
        });
    } else {
        historySection.style.display = 'none';
    }
}

function exportResults() {
    if (!currentWalletData) {
        showMessage('No data to export.', 'info');
        return;
    }
    const dataStr = JSON.stringify({
        walletInfo: currentWalletData,
        transactions: allFetchedTransactions,
        analysisDate: new Date().toISOString()
    }, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis-${currentWalletData.address}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
