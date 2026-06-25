// script.js - Visual Explorer

const brw = window.browser || window.chrome;

let toolsData = {};
let currentCategory = null;

// Category icons mapping
const categoryIcons = {
    'Username': '👤',
    'Email': '📧',
    'Phone': '📞',
    'IP Address': '🌐',
    'Domain': '🔗',
    'Image': '🖼️',
    'Social Media': '📱',
    'Location': '📍',
    'Documents': '📄',
    'People': '🧑‍🤝‍🧑',
    'Business': '🏢',
    'Threat Intel': '🛡️',
    'Dark Web': '🕵️',
    'Crypto': '💰',
    'default': '🔧'
};

document.addEventListener('DOMContentLoaded', async () => {
    const result = await new Promise(r => brw.storage.local.get(['toolsData'], r));

    if (result.toolsData) {
        toolsData = result.toolsData;
        renderCategories();
        setupSearch();
    } else {
        document.getElementById('tools-grid').innerHTML = `
            <div class="placeholder-message">
                <p>⚠️ No tools data found. Please open the main extension popup first.</p>
            </div>
        `;
    }
});

function renderCategories() {
    const container = document.getElementById('category-list');
    container.innerHTML = '';

    const sortedCategories = Object.keys(toolsData).sort((a, b) => a.localeCompare(b));

    sortedCategories.forEach(category => {
        const tools = toolsData[category];
        if (!Array.isArray(tools) || tools.length === 0) return;

        const icon = findIcon(category);

        const item = document.createElement('div');
        item.className = 'category-item';

        const iconSpan = document.createElement('span');
        iconSpan.className = 'category-icon';
        iconSpan.textContent = icon;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'category-name';
        nameSpan.textContent = category;

        const countSpan = document.createElement('span');
        countSpan.className = 'category-count';
        countSpan.textContent = tools.length;

        item.appendChild(iconSpan);
        item.appendChild(nameSpan);
        item.appendChild(countSpan);

        item.addEventListener('click', () => selectCategory(category, item));
        container.appendChild(item);
    });
}

function findIcon(category) {
    const lowerCat = category.toLowerCase();
    for (const [key, icon] of Object.entries(categoryIcons)) {
        if (lowerCat.includes(key.toLowerCase())) {
            return icon;
        }
    }
    return categoryIcons['default'];
}

function selectCategory(category, element) {
    // Update active state
    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');

    currentCategory = category;
    renderTools(toolsData[category], category);
}

function renderTools(tools, categoryName) {
    const grid = document.getElementById('tools-grid');
    const header = document.getElementById('current-category');
    const count = document.getElementById('tool-count');

    header.textContent = categoryName;
    count.textContent = `${tools.length} tool${tools.length !== 1 ? 's' : ''}`;

    grid.innerHTML = '';

    const sortedTools = [...tools].sort((a, b) => a.name.localeCompare(b.name));

    sortedTools.forEach((tool, index) => {
        const card = document.createElement('div');
        card.className = 'tool-card';
        card.style.animationDelay = `${index * 0.03}s`;

        const icon = getToolIcon(tool.name);

        card.innerHTML = '';

        const cardHeader = document.createElement('div');
        cardHeader.className = 'tool-card-header';

        const toolIconDiv = document.createElement('div');
        toolIconDiv.className = 'tool-icon';
        toolIconDiv.textContent = icon;

        const toolName = document.createElement('h3');
        toolName.textContent = tool.name;

        cardHeader.appendChild(toolIconDiv);
        cardHeader.appendChild(toolName);

        const toolDesc = document.createElement('p');
        toolDesc.className = 'tool-description';
        toolDesc.textContent = tool.description || 'No description available.';

        const cardFooter = document.createElement('div');
        cardFooter.className = 'tool-card-footer';

        const toolTag = document.createElement('span');
        toolTag.className = 'tool-tag';
        toolTag.textContent = categoryName;

        cardFooter.appendChild(toolTag);

        card.appendChild(cardHeader);
        card.appendChild(toolDesc);
        card.appendChild(cardFooter);

        card.addEventListener('click', () => {
            try {
                const parsed = new URL(tool.url);
                if (parsed.protocol === 'https:') {
                    brw.tabs.create({ url: parsed.href, active: false });
                } else {
                    console.warn('Blocked non-HTTPS URL:', tool.url);
                }
            } catch(e) {
                console.error('Invalid URL:', tool.url);
            }
        });

        grid.appendChild(card);
    });
}

function getToolIcon(name) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('search')) return '🔎';
    if (lowerName.includes('lookup')) return '🔍';
    if (lowerName.includes('check')) return '✅';
    if (lowerName.includes('scan')) return '📡';
    if (lowerName.includes('finder')) return '🧭';
    if (lowerName.includes('analyzer')) return '📊';
    if (lowerName.includes('tracker')) return '📌';
    return '🔧';
}

function setupSearch() {
    const searchInput = document.getElementById('search-input');

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();

        if (!query) {
            if (currentCategory) {
                renderTools(toolsData[currentCategory], currentCategory);
            }
            return;
        }

        // Search across all categories
        const results = [];
        for (const category in toolsData) {
            if (!Array.isArray(toolsData[category])) continue;
            toolsData[category].forEach(tool => {
                if (tool.name.toLowerCase().includes(query) ||
                    (tool.description && tool.description.toLowerCase().includes(query))) {
                    results.push({ ...tool, category });
                }
            });
        }

        renderSearchResults(results, query);
    });
}

function renderSearchResults(results, query) {
    const grid = document.getElementById('tools-grid');
    const header = document.getElementById('current-category');
    const count = document.getElementById('tool-count');

    header.textContent = `Search: "${query}"`;
    count.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;

    grid.innerHTML = '';

    if (results.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder-message';
        const p = document.createElement('p');
        p.textContent = `No tools found matching "${query}".`;
        placeholder.appendChild(p);
        grid.appendChild(placeholder);
        return;
    }

    results.forEach((tool, index) => {
        const card = document.createElement('div');
        card.className = 'tool-card';
        card.style.animationDelay = `${index * 0.03}s`;

        const icon = getToolIcon(tool.name);

        const cardHeader = document.createElement('div');
        cardHeader.className = 'tool-card-header';

        const toolIconDiv = document.createElement('div');
        toolIconDiv.className = 'tool-icon';
        toolIconDiv.textContent = icon;

        const toolNameEl = document.createElement('h3');
        toolNameEl.textContent = tool.name;

        cardHeader.appendChild(toolIconDiv);
        cardHeader.appendChild(toolNameEl);

        const toolDesc = document.createElement('p');
        toolDesc.className = 'tool-description';
        toolDesc.textContent = tool.description || 'No description available.';

        const cardFooter = document.createElement('div');
        cardFooter.className = 'tool-card-footer';

        const toolTag = document.createElement('span');
        toolTag.className = 'tool-tag';
        toolTag.textContent = tool.category;

        cardFooter.appendChild(toolTag);

        card.appendChild(cardHeader);
        card.appendChild(toolDesc);
        card.appendChild(cardFooter);

        card.addEventListener('click', () => {
            try {
                const parsed = new URL(tool.url);
                if (parsed.protocol === 'https:') {
                    brw.tabs.create({ url: parsed.href, active: false });
                } else {
                    console.warn('Blocked non-HTTPS URL:', tool.url);
                }
            } catch(e) {
                console.error('Invalid URL:', tool.url);
            }
        });

        grid.appendChild(card);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== AVAILABILITY CHECK =====

function setupAvailabilityCheck() {
    const btn = document.getElementById('check-availability');

    btn.addEventListener('click', async () => {
        if (!currentCategory) return;

        btn.disabled = true;
        btn.classList.add('checking');
        btn.textContent = '⏳ Checking...';

        const tools = toolsData[currentCategory];
        const cards = document.querySelectorAll('.tool-card');

        // Add status indicators to each card
        cards.forEach(card => {
            let indicator = card.querySelector('.status-indicator');
            if (!indicator) {
                indicator = document.createElement('span');
                indicator.className = 'status-indicator';
                card.appendChild(indicator);
            }
            indicator.className = 'status-indicator checking visible';
            indicator.textContent = '⟳';
        });

        // Check each tool
        const checkPromises = tools.map(async (tool, index) => {
            const card = cards[index];
            const indicator = card.querySelector('.status-indicator');

            try {
                const isOnline = await checkUrl(tool.url);
                indicator.className = `status-indicator visible ${isOnline ? 'online' : 'offline'}`;
                indicator.textContent = isOnline ? '✓' : '✗';
            } catch (e) {
                indicator.className = 'status-indicator visible offline';
                indicator.textContent = '✗';
            }
        });

        await Promise.all(checkPromises);

        btn.disabled = false;
        btn.classList.remove('checking');
        btn.textContent = '🔍 Check Availability';
    });
}

async function checkUrl(url) {
    return new Promise((resolve) => {
        let targetUrl;
        try {
            const urlObj = new URL(url);
            targetUrl = `${urlObj.origin}/favicon.ico`;
        } catch (e) {
            resolve(false);
            return;
        }

        const img = new Image();
        let timedOut = false;

        const timeout = setTimeout(() => {
            timedOut = true;
            img.src = ''; // Cancel the request
            resolve(false); // Only timeout = truly offline
        }, 5000);

        img.onload = () => {
            clearTimeout(timeout);
            resolve(true);
        };

        img.onerror = () => {
            clearTimeout(timeout);
            if (!timedOut) {
                // Got a response (even if error) = server is online!
                // CORS block, no favicon, 404 - all mean server responded
                resolve(true);
            }
        };

        img.src = targetUrl + '?t=' + Date.now();
    });
}

// Enable the button when a category is selected
const originalSelectCategory = selectCategory;
selectCategory = function (category, element) {
    originalSelectCategory(category, element);
    document.getElementById('check-availability').disabled = false;
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupAvailabilityCheck();
});
