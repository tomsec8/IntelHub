import { brw, isFirefox, flashButton, createSection, saveViewState, resetViewState } from './utils.js';
import { TelegramScraper } from './telegramScraper.js';

export function initializeTelegramAnalyzer(container) {
    const { wrapper: telegramWrapper } = createSection(container, "Telegram Tools", {
        onToggle: (isOpen) => {
            if (isOpen) saveViewState('telegram');
            else resetViewState();
        }
    });

    // ============================================================
    // 1. User & Group Profiler (The Main Scraper)
    // ============================================================

    const scraperBtn = document.createElement("button");
    scraperBtn.className = "sub-category-button";
    scraperBtn.textContent = "User & Group Profiler";
    scraperBtn.style.fontWeight = "bold";

    const scraperContainer = document.createElement("div");
    scraperContainer.style.display = "none";
    scraperContainer.style.padding = "10px";
    scraperContainer.style.background = "#251d38";
    scraperContainer.style.borderRadius = "8px";
    scraperContainer.style.marginBottom = "10px";

    buildScraperUI(scraperContainer);

    scraperBtn.addEventListener("click", () => {
        if (scraperContainer.style.display === "none") {
            scraperContainer.style.display = "block";
            scraperBtn.textContent = "User & Group Profiler (Close)";
        } else {
            scraperContainer.style.display = "none";
            scraperBtn.textContent = "User & Group Profiler";
        }
    });

    telegramWrapper.appendChild(scraperBtn);
    telegramWrapper.appendChild(scraperContainer);

    // ============================================================
    // 2. Phone Number Lookup 
    // ============================================================

    const phoneBtn = document.createElement("button");
    phoneBtn.className = "sub-category-button";
    phoneBtn.textContent = "Phone Number Lookup";

    const phoneContainer = document.createElement("div");
    phoneContainer.style.display = "none";
    phoneContainer.style.padding = "10px";
    phoneContainer.style.background = "#251d38";
    phoneContainer.style.borderRadius = "8px";
    phoneContainer.style.marginBottom = "10px";

    buildPhoneUI(phoneContainer);

    phoneBtn.addEventListener("click", () => {
        if (phoneContainer.style.display === "none") {
            phoneContainer.style.display = "block";
            phoneBtn.textContent = "Phone Number Lookup (Close)";
        } else {
            phoneContainer.style.display = "none";
            phoneBtn.textContent = "Phone Number Lookup";
        }
    });

    telegramWrapper.appendChild(phoneBtn);
    telegramWrapper.appendChild(phoneContainer);

    // ============================================================
    // Separator & Other Tools
    // ============================================================
    const sep = document.createElement('hr');
    sep.style.borderTop = '1px solid #444';
    sep.style.margin = '10px 0';
    telegramWrapper.appendChild(sep);

    // Telegram Export Analyzer
    const groupExportBtn = document.createElement("button");
    groupExportBtn.className = "sub-category-button";
    groupExportBtn.textContent = "Telegram Export Analyzer";
    groupExportBtn.addEventListener("click", () => {
        brw.tabs.create({ url: 'modules/telegramGroupAnalyzer/analyzer.html' });
    });
    telegramWrapper.appendChild(groupExportBtn);

    // Funstat Report Analyzer
    const funstatBtn = document.createElement("button");
    funstatBtn.className = "sub-category-button";
    funstatBtn.textContent = "Funstat Report Analyzer";
    funstatBtn.addEventListener("click", () => {
        brw.tabs.create({ url: 'modules/telegramAnalyzer/analyzer.html' });
    });
    telegramWrapper.appendChild(funstatBtn);


}

// ============================================================
// Logic: Phone Number Lookup
// ============================================================
function buildPhoneUI(container) {
    const label = document.createElement('div');
    label.textContent = "Enter Phone Number:";
    label.style.fontSize = "12px";
    label.style.color = "#ccc";
    label.style.marginBottom = "5px";

    const input = document.createElement('input');
    input.type = "text";
    input.placeholder = "+44252...";
    input.style.width = "94%";
    input.style.padding = "8px";
    input.style.marginBottom = "4px";
    input.style.borderRadius = "4px";
    input.style.border = "1px solid #555";
    input.style.backgroundColor = "#1a1a2e";
    input.style.color = "#fff";

    const countryDisplay = document.createElement('div');
    countryDisplay.style.fontSize = "11px";
    countryDisplay.style.color = "#0fbcf9";
    countryDisplay.style.marginBottom = "10px";
    countryDisplay.style.minHeight = "14px";
    countryDisplay.textContent = "Waiting for number...";

    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = "flex";
    buttonsContainer.style.flexWrap = "wrap";
    buttonsContainer.style.gap = "6px";

    const platforms = [
        { name: "Telegram", color: "#0fbcf9" },
        { name: "WhatsApp", color: "#25D366" },
        { name: "Truecaller", color: "#005bfa" },
        { name: "Sync.me", color: "#ff4d4f" }
    ];

    const countryDialingCodes = {
        "1": { code: "us", name: "USA/Canada", flag: "🇺🇸/🇨🇦" },
        "7": { code: "ru", name: "Russia/KZ", flag: "🇷🇺" },
        "20": { code: "eg", name: "Egypt", flag: "🇪🇬" },
        "27": { code: "za", name: "South Africa", flag: "🇿🇦" },
        "30": { code: "gr", name: "Greece", flag: "🇬🇷" },
        "31": { code: "nl", name: "Netherlands", flag: "🇳🇱" },
        "32": { code: "be", name: "Belgium", flag: "🇧🇪" },
        "33": { code: "fr", name: "France", flag: "🇫🇷" },
        "34": { code: "es", name: "Spain", flag: "🇪🇸" },
        "36": { code: "hu", name: "Hungary", flag: "🇭🇺" },
        "39": { code: "it", name: "Italy", flag: "🇮🇹" },
        "40": { code: "ro", name: "Romania", flag: "🇷🇴" },
        "41": { code: "ch", name: "Switzerland", flag: "🇨🇭" },
        "43": { code: "at", name: "Austria", flag: "🇦🇹" },
        "44": { code: "gb", name: "UK", flag: "🇬🇧" },
        "45": { code: "dk", name: "Denmark", flag: "🇩🇰" },
        "46": { code: "se", name: "Sweden", flag: "🇸🇪" },
        "47": { code: "no", name: "Norway", flag: "🇳🇴" },
        "48": { code: "pl", name: "Poland", flag: "🇵🇱" },
        "49": { code: "de", name: "Germany", flag: "🇩🇪" },
        "51": { code: "pe", name: "Peru", flag: "🇵🇪" },
        "52": { code: "mx", name: "Mexico", flag: "🇲🇽" },
        "53": { code: "cu", name: "Cuba", flag: "🇨🇺" },
        "54": { code: "ar", name: "Argentina", flag: "🇦🇷" },
        "55": { code: "br", name: "Brazil", flag: "🇧🇷" },
        "56": { code: "cl", name: "Chile", flag: "🇨🇱" },
        "57": { code: "co", name: "Colombia", flag: "🇨🇴" },
        "58": { code: "ve", name: "Venezuela", flag: "🇻🇪" },
        "60": { code: "my", name: "Malaysia", flag: "🇲🇾" },
        "61": { code: "au", name: "Australia", flag: "🇦🇺" },
        "62": { code: "id", name: "Indonesia", flag: "🇮🇩" },
        "63": { code: "ph", name: "Philippines", flag: "🇵🇭" },
        "64": { code: "nz", name: "New Zealand", flag: "🇳🇿" },
        "65": { code: "sg", name: "Singapore", flag: "🇸🇬" },
        "66": { code: "th", name: "Thailand", flag: "🇹🇭" },
        "81": { code: "jp", name: "Japan", flag: "🇯🇵" },
        "82": { code: "kr", name: "South Korea", flag: "🇰🇷" },
        "84": { code: "vn", name: "Vietnam", flag: "🇻🇳" },
        "86": { code: "cn", name: "China", flag: "🇨🇳" },
        "90": { code: "tr", name: "Turkey", flag: "🇹🇷" },
        "91": { code: "in", name: "India", flag: "🇮🇳" },
        "92": { code: "pk", name: "Pakistan", flag: "🇵🇰" },
        "93": { code: "af", name: "Afghanistan", flag: "🇦🇫" },
        "94": { code: "lk", name: "Sri Lanka", flag: "🇱🇰" },
        "95": { code: "mm", name: "Myanmar", flag: "🇲🇲" },
        "98": { code: "ir", name: "Iran", flag: "🇮🇷" },
        "212": { code: "ma", name: "Morocco", flag: "🇲🇦" },
        "213": { code: "dz", name: "Algeria", flag: "🇩🇿" },
        "216": { code: "tn", name: "Tunisia", flag: "🇹🇳" },
        "218": { code: "ly", name: "Libya", flag: "🇱🇾" },
        "234": { code: "ng", name: "Nigeria", flag: "🇳🇬" },
        "254": { code: "ke", name: "Kenya", flag: "🇰🇪" },
        "351": { code: "pt", name: "Portugal", flag: "🇵🇹" },
        "353": { code: "ie", name: "Ireland", flag: "🇮🇪" },
        "355": { code: "al", name: "Albania", flag: "🇦🇱" },
        "358": { code: "fi", name: "Finland", flag: "🇫🇮" },
        "359": { code: "bg", name: "Bulgaria", flag: "🇧🇬" },
        "370": { code: "lt", name: "Lithuania", flag: "🇱🇹" },
        "371": { code: "lv", name: "Latvia", flag: "🇱🇻" },
        "372": { code: "ee", name: "Estonia", flag: "🇪🇪" },
        "373": { code: "md", name: "Moldova", flag: "🇲🇩" },
        "374": { code: "am", name: "Armenia", flag: "🇦🇲" },
        "375": { code: "by", name: "Belarus", flag: "🇧🇾" },
        "380": { code: "ua", name: "Ukraine", flag: "🇺🇦" },
        "381": { code: "rs", name: "Serbia", flag: "🇷🇸" },
        "385": { code: "hr", name: "Croatia", flag: "🇭🇷" },
        "386": { code: "si", name: "Slovenia", flag: "🇸🇮" },
        "420": { code: "cz", name: "Czechia", flag: "🇨🇿" },
        "421": { code: "sk", name: "Slovakia", flag: "🇸🇰" },
        "880": { code: "bd", name: "Bangladesh", flag: "🇧🇩" },
        "886": { code: "tw", name: "Taiwan", flag: "🇹🇼" },
        "961": { code: "lb", name: "Lebanon", flag: "🇱🇧" },
        "962": { code: "jo", name: "Jordan", flag: "🇯🇴" },
        "963": { code: "sy", name: "Syria", flag: "🇸🇾" },
        "964": { code: "iq", name: "Iraq", flag: "🇮🇶" },
        "965": { code: "kw", name: "Kuwait", flag: "🇰🇼" },
        "966": { code: "sa", name: "Saudi Arabia", flag: "🇸🇦" },
        "967": { code: "ye", name: "Yemen", flag: "🇾🇪" },
        "968": { code: "om", name: "Oman", flag: "🇴🇲" },
        "971": { code: "ae", name: "UAE", flag: "🇦🇪" },
        "972": { code: "il", name: "Israel", flag: "🇮🇱" },
        "973": { code: "bh", name: "Bahrain", flag: "🇧🇭" },
        "974": { code: "qa", name: "Qatar", flag: "🇶🇦" },
        "977": { code: "np", name: "Nepal", flag: "🇳🇵" },
        "994": { code: "az", name: "Azerbaijan", flag: "🇦🇿" },
        "995": { code: "ge", name: "Georgia", flag: "🇬🇪" }
    };

    function getCountryInfo(phoneStr) {
        let clean = phoneStr.replace(/[\s\+\-]/g, '');
        for (let i = 4; i > 0; i--) {
            let prefix = clean.substring(0, i);
            if (countryDialingCodes[prefix]) {
                return {
                    prefix: prefix,
                    iso: countryDialingCodes[prefix].code,
                    name: countryDialingCodes[prefix].name,
                    flag: countryDialingCodes[prefix].flag,
                    localNumber: clean.substring(i)
                };
            }
        }
        return { prefix: "", iso: "global", name: "Unknown Region", flag: "🌍", localNumber: clean };
    }

    input.addEventListener('input', () => {
        const val = input.value.trim();
        if (val.length > 2) {
            const info = getCountryInfo(val);
            if (info.iso !== "global") {
                countryDisplay.textContent = `Region: ${info.name} ${info.flag} (+${info.prefix})`;
            } else {
                countryDisplay.textContent = "Region: Unknown 🌍";
            }
        } else {
            countryDisplay.textContent = "Waiting for number...";
        }
    });

    platforms.forEach(p => {
        const btn = document.createElement('button');
        btn.textContent = p.name;
        btn.className = "sub-category-button";
        btn.style.flex = "1 1 45%";
        btn.style.margin = "0";
        btn.style.textAlign = "center";
        btn.style.background = "transparent";
        btn.style.border = `1px solid ${p.color}`;
        btn.style.color = p.color;
        btn.style.fontWeight = "bold";
        
        btn.onmouseover = () => { btn.style.background = p.color; btn.style.color = "#fff"; };
        btn.onmouseout = () => { btn.style.background = "transparent"; btn.style.color = p.color; };

        btn.addEventListener('click', () => {
            let phone = input.value.trim();
            if (!phone) return;
            
            const info = getCountryInfo(phone);
            const fullNumberClean = phone.replace(/[\s\+\-]/g, '');
            const fullNumberWithPlus = '+' + fullNumberClean;

            let targetUrl = "";

            if (p.name === "WhatsApp") {
                targetUrl = `https://wa.me/${fullNumberClean}`;
            } else if (p.name === "Telegram") {
                targetUrl = `https://t.me/${fullNumberWithPlus}`;
            } else if (p.name === "Sync.me") {
                targetUrl = `https://sync.me/search/?number=${fullNumberWithPlus}`;
            } else if (p.name === "Truecaller") {
                if (info.iso !== "global") {
                    targetUrl = `https://www.truecaller.com/search/${info.iso}/${info.localNumber}`;
                } else {
                    targetUrl = `https://www.truecaller.com/search/global/${fullNumberWithPlus}`;
                }
            }

            brw.tabs.create({ url: targetUrl, active: false });
        });
        buttonsContainer.appendChild(btn);
    });

    container.appendChild(label);
    container.appendChild(input);
    container.appendChild(countryDisplay);
    container.appendChild(buttonsContainer);
}

// ============================================================
// Logic: User & Group Profiler
// ============================================================

function buildScraperUI(container) {
    const label = document.createElement('div');
    label.textContent = "Enter Username / Link:";
    label.style.fontSize = "12px";
    label.style.color = "#ccc";
    label.style.marginBottom = "5px";

    const input = document.createElement('input');
    input.type = "text";
    input.placeholder = "e.g. @username";
    input.style.width = "94%";
    input.style.padding = "8px";
    input.style.marginBottom = "8px";
    input.style.borderRadius = "4px";
    input.style.border = "1px solid #555";
    input.style.backgroundColor = "#1a1a2e";
    input.style.color = "#fff";

    const warningNote = document.createElement('div');
    warningNote.style.fontSize = "10px";
    warningNote.style.color = "#ff9f43";
    warningNote.style.marginBottom = "10px";
    warningNote.style.lineHeight = "1.3";

    warningNote.textContent = "⚠️ ";
    const boldPart = document.createElement('b');
    boldPart.textContent = "Note:";
    warningNote.appendChild(boldPart);
    warningNote.appendChild(document.createTextNode(" To fetch Numeric IDs, you must be logged into Telegram Web in this browser."));

    const btn = document.createElement('button');
    btn.textContent = "Analyze";
    btn.className = "sub-category-button";
    btn.style.width = "100%";
    btn.style.background = "#badc58";
    btn.style.color = "#1e272e";
    btn.style.fontWeight = "bold";

    const resultDiv = document.createElement('div');
    resultDiv.style.marginTop = "10px";
    resultDiv.style.fontSize = "12px";

    input.addEventListener("keypress", (e) => { if (e.key === "Enter") btn.click(); });

    btn.addEventListener('click', async () => {
        const target = input.value.trim();
        if (!target) return;

        resultDiv.textContent = "⏳ Fetching public data...";
        btn.disabled = true;

        try {
            const result = await TelegramScraper.analyze(target);
            if (result.success) {
                renderScraperResults(resultDiv, result.data);
            } else {
                resultDiv.textContent = "";
                const errDiv = document.createElement('div');
                errDiv.style.color = "#ff6b6b";
                errDiv.style.padding = "5px";
                errDiv.textContent = "❌ " + result.error;
                resultDiv.appendChild(errDiv);
            }
        } catch (e) {
            resultDiv.textContent = "";
            const errDiv = document.createElement('div');
            errDiv.style.color = "#ff6b6b";
            errDiv.textContent = "❌ Unexpected Error";
            resultDiv.appendChild(errDiv);
        } finally {
            btn.disabled = false;
        }
    });

    container.appendChild(label);
    container.appendChild(input);
    container.appendChild(warningNote);
    container.appendChild(btn);
    container.appendChild(resultDiv);
}

function renderScraperResults(container, data) {
    container.innerHTML = '';

    const card = document.createElement('div');
    card.style.background = '#1e272e';
    card.style.padding = '12px';
    card.style.borderRadius = '6px';
    card.style.border = '1px solid #555';

    // Header
    const headDiv = document.createElement('div');
    headDiv.style.display = 'flex';
    headDiv.style.alignItems = 'start';
    headDiv.style.marginBottom = '10px';

    if (data.image) {
        const imgWrapper = document.createElement('div');
        imgWrapper.style.position = 'relative';
        imgWrapper.style.marginRight = '12px';
        const img = document.createElement('img');
        img.src = data.image;
        img.style.width = '55px';
        img.style.height = '55px';
        img.style.borderRadius = '50%';
        img.style.objectFit = 'cover';
        img.style.border = '1px solid #777';
        imgWrapper.appendChild(img);

        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = '⬇';
        downloadBtn.style.position = 'absolute';
        downloadBtn.style.bottom = '-5px';
        downloadBtn.style.right = '-5px';
        downloadBtn.style.background = '#0fbcf9';
        downloadBtn.style.color = '#fff';
        downloadBtn.style.border = 'none';
        downloadBtn.style.borderRadius = '50%';
        downloadBtn.style.width = '20px';
        downloadBtn.style.height = '20px';
        downloadBtn.style.fontSize = '10px';
        downloadBtn.style.cursor = 'pointer';
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            chrome.downloads.download({ url: data.image, filename: 'profile.jpg' });
        };
        imgWrapper.appendChild(downloadBtn);
        headDiv.appendChild(imgWrapper);
    }

    const titleBox = document.createElement('div');
    const nameDiv = document.createElement('div');

    const nameBold = document.createElement('b');
    nameBold.style.fontSize = "14px";
    nameBold.style.color = "#fff";
    nameBold.textContent = data.title;
    nameDiv.appendChild(nameBold);

    if (data.verified) {
        const badge = document.createElement('span');
        badge.textContent = " ✓";
        badge.title = "Verified";
        badge.style.color = "#0fbcf9";
        badge.style.marginLeft = "4px";
        nameDiv.appendChild(badge);
    }
    titleBox.appendChild(nameDiv);

    if (data.username) {
        const userDisplay = document.createElement('div');
        userDisplay.textContent = `@${data.username}`;
        userDisplay.style.fontSize = "11px";
        userDisplay.style.color = "#aaa";
        titleBox.appendChild(userDisplay);
    }

    // Status Display
    const statusDisplay = document.createElement('div');
    statusDisplay.style.fontSize = "11px";
    statusDisplay.style.marginTop = "4px";

    let typeLabel = data.type || "Unknown";
    let typeColor = "#777";
    let statsIcon = "ℹ️";

    if (typeLabel === 'Group') { typeColor = "#ff9f43"; statsIcon = "👥"; }
    else if (typeLabel === 'Channel') { typeColor = "#ff9f43"; statsIcon = "📢"; }
    else if (typeLabel === 'Bot') { typeColor = "#badc58"; statsIcon = "🤖"; }
    else { typeColor = "#0fbcf9"; statsIcon = "🕒"; }

    let initialStats = data.stats || "";
    if (typeLabel === 'User' && !initialStats) {
        initialStats = "Scan required";
        statusDisplay.style.color = "#777";
    } else {
        statusDisplay.style.color = "#eee";
    }

    statusDisplay.innerHTML = '';
    const typeSpan = document.createElement('span');
    typeSpan.textContent = typeLabel.toUpperCase();
    typeSpan.style.background = typeColor;
    typeSpan.style.color = "#000";
    typeSpan.style.padding = "1px 4px";
    typeSpan.style.borderRadius = "3px";
    typeSpan.style.fontSize = "9px";
    typeSpan.style.fontWeight = "bold";
    typeSpan.style.marginRight = "4px";

    const statsSpan = document.createElement('span');
    statsSpan.textContent = `${statsIcon} ${initialStats}`;

    statusDisplay.appendChild(typeSpan);
    statusDisplay.appendChild(statsSpan);
    titleBox.appendChild(statusDisplay);
    headDiv.appendChild(titleBox);
    card.appendChild(headDiv);

    const extraDataDiv = document.createElement('div');
    extraDataDiv.id = "extra-data-container";
    extraDataDiv.style.marginTop = "8px";
    extraDataDiv.style.padding = "8px";
    extraDataDiv.style.background = "rgba(0,0,0,0.2)";
    extraDataDiv.style.borderRadius = "4px";
    extraDataDiv.style.display = "none";
    card.appendChild(extraDataDiv);

    const actionsDiv = document.createElement('div');
    actionsDiv.style.display = 'flex';
    actionsDiv.style.gap = '5px';
    actionsDiv.style.marginTop = '8px';

    let btnText = "🕵️ Fetch ID & Last Seen";
    if (typeLabel === 'Group' || typeLabel === 'Channel') btnText = "🕵️ Fetch Numeric ID";

    const deepFetchBtn = document.createElement('button');
    deepFetchBtn.textContent = btnText;
    deepFetchBtn.style.flex = "1";
    deepFetchBtn.style.padding = "6px";
    deepFetchBtn.style.background = "transparent";
    deepFetchBtn.style.border = "1px dashed #badc58";
    deepFetchBtn.style.color = "#badc58";
    deepFetchBtn.style.borderRadius = "4px";
    deepFetchBtn.style.cursor = "pointer";
    deepFetchBtn.style.fontSize = "11px";

    const openChatBtn = document.createElement('button');
    openChatBtn.textContent = "Open App ↗";
    openChatBtn.style.padding = "6px 10px";
    openChatBtn.style.background = "#2c3e50";
    openChatBtn.style.border = "1px solid #444";
    openChatBtn.style.color = "#fff";
    openChatBtn.style.borderRadius = "4px";
    openChatBtn.style.cursor = "pointer";
    openChatBtn.style.fontSize = "11px";
    openChatBtn.onclick = () => {
        if (data.username) window.open(`https://t.me/${data.username}`, '_blank');
        else window.open(data.url, '_blank');
    };

    actionsDiv.appendChild(deepFetchBtn);
    actionsDiv.appendChild(openChatBtn);
    card.appendChild(actionsDiv);

    deepFetchBtn.addEventListener('click', () => {
        if (!data.username) {
            flashButton(deepFetchBtn, "No Username", true);
            return;
        }

        // Firefox Handling
        if (isFirefox()) {
            brw.tabs.create({ url: `firefox/telegram-scanner.html?username=${data.username}` });
            window.close();
            return;
        }

        // Chrome Handling
        deepFetchBtn.disabled = true;
        deepFetchBtn.textContent = "⏳ Scanning...";

        performBackgroundScan(data.username, (res) => {
            if (res.error) {
                deepFetchBtn.textContent = "❌ Error";
                setTimeout(() => { deepFetchBtn.disabled = false; deepFetchBtn.textContent = "🕵️ Try Again"; }, 3000);
            } else {
                deepFetchBtn.style.display = "none";

                statusDisplay.innerHTML = '';

                if (res.status && res.status !== "Extracted from DOM" && res.status !== "Not Scanned") {
                    const newType = document.createElement('span');
                    newType.textContent = res.type.toUpperCase();
                    newType.style.cssText = "background:#0fbcf9; color:#000; padding:1px 4px; border-radius:3px; font-size:9px; font-weight:bold; margin-right:4px;";

                    const newStats = document.createElement('span');
                    newStats.textContent = `🕒 ${res.status}`;
                    if (res.status.includes('online')) newStats.style.color = '#badc58';

                    statusDisplay.appendChild(newType);
                    statusDisplay.appendChild(newStats);
                }
                else if (res.type !== typeLabel && res.type !== 'Unknown') {
                    let newColor = "#777";
                    if (res.type === 'Channel' || res.type === 'Group') newColor = "#ff9f43";

                    const newType = document.createElement('span');
                    newType.textContent = res.type.toUpperCase();
                    newType.style.background = newColor;
                    newType.style.color = "#000";
                    newType.style.padding = "1px 4px";
                    newType.style.borderRadius = "3px";
                    newType.style.fontSize = "9px";
                    newType.style.fontWeight = "bold";
                    newType.style.marginRight = "4px";

                    const oldStats = document.createElement('span');
                    oldStats.textContent = initialStats;

                    statusDisplay.appendChild(newType);
                    statusDisplay.appendChild(oldStats);
                }

                extraDataDiv.style.display = "block";
                extraDataDiv.innerHTML = '';

                const row = document.createElement('div');
                row.style.display = "flex";
                row.style.justifyContent = "space-between";
                row.style.alignItems = "center";

                const labelId = document.createElement('span');
                labelId.textContent = "Numeric ID:";
                labelId.style.color = "#aaa";
                labelId.style.fontSize = "11px";

                const valId = document.createElement('span');
                valId.textContent = res.id;
                valId.style.color = "#0fbcf9";
                valId.style.fontFamily = "monospace";
                valId.style.fontSize = "12px";
                valId.style.cursor = "pointer";
                valId.title = "Click to copy";

                valId.onclick = () => {
                    navigator.clipboard.writeText(res.id);
                    flashButton(valId, "Copied!");
                };

                row.appendChild(labelId);
                row.appendChild(valId);
                extraDataDiv.appendChild(row);
            }
        });
    });

    if (data.description) {
        const desc = document.createElement('div');
        desc.textContent = data.description;
        desc.style.color = "#ccc";
        desc.style.fontSize = "11px";
        desc.style.marginTop = "8px";
        desc.style.paddingTop = "8px";
        desc.style.borderTop = "1px solid #444";
        card.appendChild(desc);
    }

    container.appendChild(card);
}

// ============================================================
// CHROME BACKGROUND SCAN
// ============================================================

function performBackgroundScan(username, callback) {
    const targetUrl = `https://web.telegram.org/a/#?tgaddr=tg%3A%2F%2Fresolve%3Fdomain%3D${username}`;

    chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {

        const scriptToInject = (targetUsername) => {
            return new Promise((resolve) => {
                let attempts = 0;
                let searchTriggered = false;
                const maxAttempts = 60;

                const triggerTyping = (element, text) => {
                    element.focus();
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    nativeInputValueSetter.call(element, text);
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                };

                const interval = setInterval(() => {
                    attempts++;
                    const hash = window.location.hash;
                    const urlMatch = hash.match(/#(-?\d+)/);

                    // 1. Fast Track (URL)
                    if (urlMatch) {
                        const urlId = urlMatch[1];
                        let type = urlId.startsWith('-') ? "Group/Channel" : "User";

                        let statusText = "Not Scanned";
                        const header = document.querySelector('.chat-header, .ChatInfo, .top');
                        if (header) {
                            const statusEl = header.querySelector('.user-status, .chat-status, .subtitle');
                            if (statusEl && statusEl.innerText) statusText = statusEl.innerText.trim();
                        }

                        clearInterval(interval);
                        resolve({ success: true, id: urlId, status: statusText, name: targetUsername, type: type });
                        return;
                    }

                    // 2. DOM Check
                    const middleCol = document.querySelector('.MiddleColumn, .chat-info');
                    let foundId = null;
                    if (middleCol) {
                        const header = middleCol.querySelector('.chat-header, .top');
                        if (header) {
                            const idEl = header.querySelector('[data-peer-id]');
                            if (idEl) {
                                const pid = idEl.getAttribute('data-peer-id');
                                if (pid !== '777000') foundId = pid;
                            }
                        }
                    }

                    if (foundId) {
                        clearInterval(interval);
                        let type = foundId.startsWith('-') ? "Group/Channel" : "User";
                        let statusText = "Extracted from DOM";
                        if (middleCol) {
                            const statusEl = middleCol.querySelector('.user-status, .subtitle');
                            if (statusEl && statusEl.innerText) statusText = statusEl.innerText.trim();
                        }
                        resolve({ success: true, id: foundId, status: statusText, name: "User", type: type });
                        return;
                    }

                    // 3. Search Robot
                    if (attempts > 10 && !searchTriggered && !foundId && !urlMatch) {
                        const searchInput = document.querySelector('input#telegram-search-input, input[type="text"]');
                        if (searchInput) {
                            searchTriggered = true;
                            triggerTyping(searchInput, "@" + targetUsername);
                            setTimeout(() => {
                                const firstResult = document.querySelector('.search-group .ListItem, .ListItem-button');
                                if (firstResult) firstResult.click();
                            }, 2000);
                        }
                    }

                    if (attempts >= maxAttempts) {
                        clearInterval(interval);
                        resolve({ success: false, error: "Timeout" });
                    }
                }, 500);
            });
        };

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scriptToInject,
            args: [username]
        }, (results) => {
            chrome.tabs.remove(tab.id);
            if (chrome.runtime.lastError || !results || !results[0]?.result) {
                callback({ error: "Script failed." });
            } else {
                const result = results[0].result;
                if (result.success) callback(result);
                else callback({ error: result.error });
            }
        });
    });
}

export function restoreTelegramView(container) {
    const allBtns = container.querySelectorAll('.category-button');
    for (const btn of allBtns) {
        if (btn.textContent === "Telegram Tools") {
            const wrapper = btn.nextElementSibling;
            if (wrapper) {
                wrapper.classList.add("open");
            }
            break;
        }
    }
}