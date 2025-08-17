// modules/cryptoAnalyzer.js

import { brw } from './utils.js';

export function initializeCryptoAnalyzer(container) {
    const cryptoBtn = document.createElement("button");
    cryptoBtn.className = "category-button";
    cryptoBtn.textContent = "Crypto Wallet Analyzer";

    const cryptoWrapper = document.createElement("div");
    cryptoWrapper.className = "tool-list";

    cryptoBtn.addEventListener("click", () => {
        cryptoWrapper.classList.toggle("open");
    });

    // --- Wallet Input and Lookup ---
    const lookupWrapper = document.createElement('div');
    lookupWrapper.style.padding = '10px';
    lookupWrapper.style.background = '#2c1e3f';
    lookupWrapper.style.borderRadius = '12px';
    lookupWrapper.style.margin = '8px auto';
    lookupWrapper.style.width = '85%';

    const addressInput = document.createElement('input');
    addressInput.type = 'text';
    addressInput.placeholder = 'Enter BTC or ETH address...';
    addressInput.style.width = '100%';
    addressInput.style.marginBottom = '10px';
    
    const resultDiv = document.createElement('div');
    resultDiv.style.minHeight = '20px';
    resultDiv.style.color = '#55efc4';
    resultDiv.style.marginBottom = '10px';
    resultDiv.style.fontWeight = 'bold';

    const lookupBtn = document.createElement('button');
    lookupBtn.className = 'sub-category-button';
    lookupBtn.textContent = 'Lookup Wallet';
    lookupBtn.style.width = '100%';

    addressInput.addEventListener('input', () => {
        const address = addressInput.value.trim();
        const type = detectWalletType(address);
        if (type === 'btc') {
            resultDiv.textContent = 'Detected: Bitcoin (BTC)';
        } else if (type === 'eth') {
            resultDiv.textContent = 'Detected: Ethereum (ETH)';
        } else {
            resultDiv.textContent = '';
        }
    });

    lookupBtn.addEventListener('click', () => {
        const address = addressInput.value.trim();
        const type = detectWalletType(address);
        if (!type) {
            alert('Please enter a valid BTC or ETH address.');
            return;
        }
        const url = type === 'btc' 
            ? `https://www.blockchain.com/btc/address/${address}`
            : `https://etherscan.io/address/${address}`;
        brw.tabs.create({ url });
    });

    lookupWrapper.appendChild(addressInput);
    lookupWrapper.appendChild(resultDiv);
    lookupWrapper.appendChild(lookupBtn);
    cryptoWrapper.appendChild(lookupWrapper);

    // --- Advanced Analyzer Tool ---
    const advancedToolBtn = document.createElement("button");
    advancedToolBtn.className = "sub-category-button";
    advancedToolBtn.textContent = "Open Advanced Analyzer";
    advancedToolBtn.addEventListener("click", () => {
        brw.tabs.create({ url: 'modules/cryptoAnalyzer/cryptoAnalyzer.html' });
    });
    cryptoWrapper.appendChild(advancedToolBtn);

    container.appendChild(cryptoBtn);
    container.appendChild(cryptoWrapper);
}

function detectWalletType(address) {
    const cleanAddress = address.trim();
    if (cleanAddress.toLowerCase().startsWith('0x') && cleanAddress.length === 42) return 'eth';
    if (cleanAddress.length >= 26 && cleanAddress.length <= 62) return 'btc';
    return null;
}
