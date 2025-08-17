// modules/telegramAnalyzer.js

import { brw } from './utils.js';

export function initializeTelegramAnalyzer(container) {
    const telegramBtn = document.createElement("button");
    telegramBtn.className = "category-button";
    telegramBtn.textContent = "Telegram Tools";

    const telegramWrapper = document.createElement("div");
    telegramWrapper.className = "tool-list";

    telegramBtn.addEventListener("click", () => {
        telegramWrapper.classList.toggle("open");
    });

    // --- Phone Number Lookup ---
    const lookupWrapper = document.createElement('div');
    lookupWrapper.style.padding = '10px';
    lookupWrapper.style.background = '#2c1e3f';
    lookupWrapper.style.borderRadius = '12px';
    lookupWrapper.style.margin = '8px auto';
    lookupWrapper.style.width = '85%';

    const phoneInput = document.createElement('input');
    phoneInput.type = 'text';
    phoneInput.placeholder = 'Enter phone number...';
    phoneInput.style.width = '100%';
    phoneInput.style.marginBottom = '10px';
    
    const lookupBtn = document.createElement('button');
    lookupBtn.className = 'sub-category-button';
    lookupBtn.textContent = 'Check Phone on Telegram';
    lookupBtn.style.width = '100%';

    lookupBtn.addEventListener('click', () => {
        const phoneNumber = phoneInput.value;
        const normalized = normalizePhoneNumber(phoneNumber);
        if (!normalized) {
            alert('Invalid phone number format. Please enter a valid Israeli number.');
            return;
        }
        brw.tabs.create({ url: `https://t.me/${normalized}` });
    });

    lookupWrapper.appendChild(phoneInput);
    lookupWrapper.appendChild(lookupBtn);
    telegramWrapper.appendChild(lookupWrapper);

    // --- Funstat Bot Analyzer ---
    const funstatBtn = document.createElement("button");
    funstatBtn.className = "sub-category-button";
    funstatBtn.textContent = "Funstat Bot Analyzer";
    funstatBtn.addEventListener("click", () => {
        brw.tabs.create({ url: 'modules/telegramAnalyzer/analyzer.html' });
    });
    telegramWrapper.appendChild(funstatBtn);

    container.appendChild(telegramBtn);
    container.appendChild(telegramWrapper);
}

function normalizePhoneNumber(phone) {
    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, '');

    // Handle numbers starting with country code
    if (digits.startsWith('972')) {
        return `+${digits}`;
    }

    // Handle numbers starting with 0
    if (digits.startsWith('0')) {
        return `+972${digits.substring(1)}`;
    }

    // If it's a 9-digit number without a leading 0 (e.g., 523848865)
    if (digits.length === 9) {
        return `+972${digits}`;
    }
    
    // Invalid format
    return null;
}
