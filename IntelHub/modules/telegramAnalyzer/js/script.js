let allData = null;
let charts = {};
let currentMessages = [];
let currentPage = 1;
const messagesPerPage = 500;

document.getElementById('fileInput').addEventListener('change', event => {
    const file = event.target.files[0];
    if (file) processFile(file);
});

// --- Helper function for creating elements ---
function createElement(tag, options = {}) {
    const el = document.createElement(tag);
    if (options.className) el.className = options.className;
    if (options.textContent) el.textContent = options.textContent;
    if (options.title) el.title = options.title;
    if (options.href) el.href = options.href;
    if (options.target) el.target = options.target;
    if (options.rel) el.rel = options.rel;
    if (options.style) {
        for (const prop in options.style) {
            el.style[prop] = options.style[prop];
        }
    }
    if (options.onClick) {
        el.addEventListener('click', options.onClick);
    }
    if (options.disabled) el.disabled = options.disabled;
    return el;
}

function processFile(file) {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('errorAlert').classList.add('hidden');
    document.getElementById('results').classList.add('hidden');

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            const messages = data.messages || (data.chats && data.chats.list ? transformTelegramExport(data) : (data.data || []));
            allData = { data: messages };
            analyzeData(allData);
        } catch (error) {
            document.getElementById('errorAlert').classList.remove('hidden');
            console.error('Error parsing JSON:', error);
        } finally {
            document.getElementById('loading').classList.add('hidden');
        }
    };
    reader.readAsText(file);
}

function transformTelegramExport(data) {
    let messages = [];
    data.chats.list.forEach(chat => {
        (chat.messages || []).forEach(msg => {
            let textContent = '';
            if (typeof msg.text === 'string') {
                textContent = msg.text;
            } else if (Array.isArray(msg.text_entities)) {
                textContent = msg.text_entities.map(entity => entity.text).join('');
            }

            messages.push({
                ...msg,
                chatTitle: chat.name || `Chat ID ${chat.id}`,
                chatid: chat.id,
                messageid: msg.id,
                chatTag: chat.name && !chat.name.startsWith('Chat ID') ? chat.name.replace(/\s/g, '') : null,
                text: textContent,
                media: msg.photo ? { photo: true } : (msg.file ? { document: { mime_type: msg.mime_type || '' } } : (msg.contact_information ? { contact: true } : null)),
            });
        });
    });
    return messages;
}

function analyzeData(data) {
    const messages = data.data || [];
    if (messages.length === 0) {
        document.getElementById('errorAlert').innerText = 'No messages found in the provided file.';
        document.getElementById('errorAlert').classList.remove('hidden');
        return;
    }
    
    Object.values(charts).forEach(chart => chart.destroy());

    updateBasicStats(messages);
    createTimelineChart(messages);
    createChatsChart(messages);
    createHoursChart(messages);
    createWeekdayChart(messages);
    generateInsights(messages);
    findRegexMatches(messages);
    createGroupList(messages);
    createWordCloud(messages);
    
    populateChatFilter(messages);
    filterTimeline(); // Initial render with all messages

    document.getElementById('filterButton').onclick = () => filterTimeline();

    document.getElementById('results').classList.remove('hidden');
}

function updateBasicStats(messages) {
    const totalMessages = messages.length;
    const uniqueChats = new Set(messages.map(m => m.chatid)).size;
    
    const dates = messages.map(m => new Date(m.date)).filter(d => !isNaN(d)).sort((a, b) => a - b);
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    
    const daysDiff = (lastDate && firstDate) ? Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24))) : 1;
    const avgPerDay = Math.round(totalMessages / daysDiff);

    document.getElementById('totalMessages').textContent = totalMessages.toLocaleString();
    document.getElementById('uniqueChats').textContent = uniqueChats.toLocaleString();
    document.getElementById('dateRange').textContent = `${daysDiff} days`;
    document.getElementById('avgMessagesPerDay').textContent = avgPerDay.toLocaleString();
}

function createTimelineChart(messages) {
    const ctx = document.getElementById('timelineChart').getContext('2d');
    const monthlyData = {};
    messages.forEach(msg => {
        if(!msg.date) return;
        const date = new Date(msg.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
    });
    const labels = Object.keys(monthlyData).sort();
    const data = labels.map(label => monthlyData[label]);
    charts.timeline = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: 'Messages', data: data, borderColor: '#667eea', backgroundColor: 'rgba(102, 126, 234, 0.1)', fill: true, tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
}

function createChatsChart(messages) {
    const ctx = document.getElementById('chatsChart').getContext('2d');
    const chatCounts = {};
    messages.forEach(msg => {
        const chatTitle = msg.chatTitle || `Chat ID: ${msg.chatid}`;
        chatCounts[chatTitle] = (chatCounts[chatTitle] || 0) + 1;
    });
    const sortedChats = Object.entries(chatCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = sortedChats.map(([title]) => title.length > 25 ? title.substring(0, 25) + '...' : title);
    const data = sortedChats.map(([, count]) => count);
    charts.chats = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#ffecd2', '#fcb69f'] }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } } });
}

function createHoursChart(messages) {
    const ctx = document.getElementById('hoursChart').getContext('2d');
    const hourCounts = new Array(24).fill(0);
    messages.forEach(msg => { if(msg.date) hourCounts[new Date(msg.date).getHours()]++; });
    charts.hours = new Chart(ctx, { type: 'bar', data: { labels: Array.from({length: 24}, (_, i) => `${i}:00`), datasets: [{ label: 'Messages', data: hourCounts, backgroundColor: 'rgba(102, 126, 234, 0.6)', borderColor: '#667eea', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
}

function createWeekdayChart(messages) {
    const ctx = document.getElementById('weekdayChart').getContext('2d');
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayCounts = new Array(7).fill(0);
    messages.forEach(msg => { if(msg.date) weekdayCounts[new Date(msg.date).getDay()]++; });
    charts.weekdays = new Chart(ctx, { type: 'radar', data: { labels: weekdays, datasets: [{ label: 'Messages', data: weekdayCounts, backgroundColor: 'rgba(118, 75, 162, 0.2)', borderColor: '#764ba2', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: true, scales: { r: { beginAtZero: true } } } });
}

function generateInsights(messages) {
    const container = document.getElementById('insightsContainer');
    container.innerHTML = ''; // Clear previous content
    let insights = [];
    
    const hourCounts = new Array(24).fill(0);
    messages.forEach(msg => { if(msg.date) hourCounts[new Date(msg.date).getHours()]++; });
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    insights.push(`🕐 Peak activity hour is around <strong>${peakHour}:00</strong>.`);
    
    const uniqueChats = new Set(messages.map(m => m.chatid)).size;
    insights.push(`💬 Active in <strong>${uniqueChats}</strong> different chats.`);
    
    const replies = messages.filter(m => m.reply_to_message_id || m.isReply || m.reply_to).length;
    const replyRate = messages.length > 0 ? Math.round((replies / messages.length) * 100) : 0;
    insights.push(`↩️ <strong>${replyRate}%</strong> of messages are replies.`);

    const mediaCounters = { photos: 0, videos: 0, contacts: 0, files: 0, links: 0 };
    const urlRegex = /https?:\/\/[^"<>)\s]+/g;
    messages.forEach(m => {
        if (m.photo) mediaCounters.photos++;
        if (m.mime_type && m.mime_type.startsWith('video/')) mediaCounters.videos++;
        if (m.file && m.mime_type && !m.mime_type.startsWith('video/')) mediaCounters.files++;
        if (m.contact_information) mediaCounters.contacts++;
        
        const text = m.text || '';
        const foundLinks = text.match(urlRegex);
        if(foundLinks) mediaCounters.links += foundLinks.length;
    });

    if (mediaCounters.photos > 0) insights.push(`🖼️ Sent <strong>${mediaCounters.photos}</strong> photos.`);
    if (mediaCounters.videos > 0) insights.push(`🎬 Sent <strong>${mediaCounters.videos}</strong> videos.`);
    if (mediaCounters.files > 0) insights.push(`📎 Sent <strong>${mediaCounters.files}</strong> files.`);
    if (mediaCounters.contacts > 0) insights.push(`👤 Shared <strong>${mediaCounters.contacts}</strong> contacts.`);
    if (mediaCounters.links > 0) insights.push(`🔗 Shared <strong>${mediaCounters.links}</strong> links.`);

    insights.forEach(insight => {
        const item = createElement('div', { className: 'insight-item' });
        // Safely parse the string with the <strong> tag
        const parts = insight.split(/<strong>|<\/strong>/);
        item.appendChild(document.createTextNode(parts[0]));
        if (parts[1]) {
            item.appendChild(createElement('strong', { textContent: parts[1] }));
        }
        if (parts[2]) {
            item.appendChild(document.createTextNode(parts[2]));
        }
        container.appendChild(item);
    });
}

function findRegexMatches(messages) {
    const container = document.getElementById('regexContainer');
    container.innerHTML = ''; // Clear previous content
    const patterns = {
        "Email": /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        "Phone": /(?:\+?\d{1,3}[\s\-]?)?\(?\d{1,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4}/g,
        "Facebook Profile": /facebook\.com\/(?:profile\.php\?id=)?([a-zA-Z0-9.]+)/g,
        "Instagram Profile": /instagram\.com\/([a-zA-Z0-9._]+)/g,
        "Twitter Profile": /twitter\.com\/([a-zA-Z0-9_]+)/g,
        "LinkedIn Profile": /linkedin\.com\/in\/([a-zA-Z0-9-]+)/g,
        "GitHub Profile": /github\.com\/([a-zA-Z0-9_-]+)/g,
        "YouTube Channel": /youtube\.com\/(?:c|channel|user)\/([a-zA-Z0-9_-]+)/g,
        "TikTok Profile": /tiktok\.com\/@([a-zA-Z0-9._]+)/g,
        "BTC Wallet": /\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g,
        "ETH Wallet": /\b0x[a-fA-F0-9]{40}\b/g,
        "Discord Invite": /discord\.gg\/([a-zA-Z0-9]+)/g,
    };
    
    let allMatches = {};
    messages.forEach(msg => {
        const text = msg.text || '';
        if (!text) return;
        
        for (const [name, regex] of Object.entries(patterns)) {
            const matches = text.match(regex);
            if (matches) {
                if (!allMatches[name]) allMatches[name] = new Set();
                matches.forEach(match => allMatches[name].add(match));
            }
        }
    });

    if (Object.keys(allMatches).length === 0) {
         container.appendChild(createElement('div', { className: 'insight-item', textContent: 'No specific patterns (emails, profiles, etc.) were found.' }));
         return;
    }
    
    for (const [name, matchesSet] of Object.entries(allMatches)) {
        const item = createElement('div', { className: 'regex-item' });
        item.appendChild(createElement('div', { className: 'regex-category', textContent: name }));
        
        matchesSet.forEach(match => {
            const matchDiv = createElement('div');
            const truncatedMatch = match.length > 100 ? match.substring(0, 100) + '...' : match;

            if (name.includes('Profile') || name.includes('Link')) {
                matchDiv.appendChild(createElement('a', {
                    href: match,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    textContent: truncatedMatch
                }));
            } else {
                matchDiv.textContent = truncatedMatch;
            }
            item.appendChild(matchDiv);
        });
        container.appendChild(item);
    }
}

function createGroupList(messages) {
    const container = document.getElementById('groupListContainer');
    container.innerHTML = ''; // Clear previous content
    const chatMap = new Map();
    
    messages.forEach(msg => {
        if (!chatMap.has(msg.chatid)) {
            chatMap.set(msg.chatid, { 
                title: msg.chatTitle || `Chat ID: ${msg.chatid}`, 
                tag: msg.chatTag,
                count: 0 
            });
        }
        chatMap.get(msg.chatid).count++;
    });

    if (chatMap.size === 0) {
        container.appendChild(createElement('div', { className: 'insight-item', textContent: 'No chats found.' }));
        return;
    }

    const sortedChats = [...chatMap.entries()].sort((a, b) => b[1].count - a[1].count);

    sortedChats.forEach(([id, chatInfo]) => {
         const linkUrl = chatInfo.tag ? `https://t.me/${chatInfo.tag}` : `https://t.me/c/${String(id).replace('-100', '')}`;
         const link = createElement('a', {
            href: linkUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'group-node',
            textContent: `${chatInfo.title} (${chatInfo.count.toLocaleString()})`
         });
         container.appendChild(link);
    });
}

function createWordCloud(messages) {
    const container = document.getElementById('wordCloudContainer');
    container.innerHTML = ''; // Clear previous content
    const text = messages.map(m => m.text || '').join(' ');
    
    const words = text.split(/[\s,.;!?()"{}[\]]+/)
        .map(w => w.toLowerCase().trim())
        .filter(word => word.length > 3 && !/https?:\/\//.test(word) && isNaN(word))
        .reduce((acc, word) => {
            acc[word] = (acc[word] || 0) + 1;
            return acc;
        }, {});
    
    const sortedWords = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 50);
    
    sortedWords.forEach(([word, count]) => {
        const wordSpan = createElement('span', {
            className: 'word-item',
            textContent: word,
            title: `${count} times`,
            style: { fontSize: `${Math.min(24, 12 + count/5)}px` }
        });
        container.appendChild(wordSpan);
    });
}

function populateChatFilter(messages) {
    const chatFilter = document.getElementById('chatFilter');
    chatFilter.innerHTML = ''; // Clear previous content
    const chatMap = new Map([['all', 'All Chats']]);

    messages.forEach(msg => {
        if (!chatMap.has(msg.chatid)) {
            chatMap.set(msg.chatid, msg.chatTitle || `Chat ID: ${msg.chatid}`);
        }
    });

    chatMap.forEach((title, id) => {
        const option = createElement('option', { textContent: title });
        option.value = id;
        chatFilter.appendChild(option);
    });
}

function filterTimeline() {
    currentPage = 1; 
    const selectedChat = document.getElementById('chatFilter').value;
    const startDate = document.getElementById('startDateFilter').value;
    const endDate = document.getElementById('endDateFilter').value;
    const searchTerm = document.getElementById('searchFilter').value.toLowerCase();

    let filteredMessages = allData.data;

    if (selectedChat !== 'all') {
        filteredMessages = filteredMessages.filter(m => String(m.chatid) === selectedChat);
    }
    if (startDate) {
        const start = new Date(startDate).setHours(0,0,0,0);
        filteredMessages = filteredMessages.filter(m => m.date && new Date(m.date) >= start);
    }
    if (endDate) {
         const end = new Date(endDate).setHours(23,59,59,999);
        filteredMessages = filteredMessages.filter(m => m.date && new Date(m.date) <= end);
    }
    if (searchTerm) {
        filteredMessages = filteredMessages.filter(m => (m.text || '').toLowerCase().includes(searchTerm));
    }
    
    currentMessages = filteredMessages.sort((a, b) => new Date(b.date) - new Date(a.date));
    renderTimelinePage();
}

function renderTimelinePage() {
    const container = document.getElementById('timelineContainer');
    container.innerHTML = ''; // Clear previous content
    
    if (currentMessages.length === 0) {
        container.appendChild(createElement('div', { className: 'insight-item', textContent: 'No messages match the current filters.' }));
        renderPaginationControls(0);
        return;
    }

    const startIndex = (currentPage - 1) * messagesPerPage;
    const endIndex = startIndex + messagesPerPage;
    const paginatedMessages = currentMessages.slice(startIndex, endIndex);

    paginatedMessages.forEach(msg => {
        const date = msg.date ? new Date(msg.date).toLocaleString('en-GB') : 'No date';
        const text = msg.text || 'No text content';
        const chatTitle = msg.chatTitle || 'Unknown Chat';
        
        const item = createElement('div', { className: 'timeline-item' });

        if (msg.chatTag && msg.messageid) {
            const messageLink = `https://t.me/${msg.chatTag}/${msg.messageid}`;
            item.appendChild(createElement('a', {
                href: messageLink,
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'timeline-jump-btn',
                title: 'Go to message',
                textContent: '🔗'
            }));
        }

        item.appendChild(createElement('div', { className: 'timeline-date', textContent: date }));
        
        const contentDiv = createElement('div');
        const titleStrong = createElement('strong', { textContent: chatTitle });
        contentDiv.appendChild(titleStrong);
        contentDiv.appendChild(createElement('br'));
        contentDiv.appendChild(document.createTextNode(text)); // Use createTextNode for safety

        if(msg.reply_to_message_id) {
            contentDiv.appendChild(createElement('div', { 
                className: 'timeline-reply', 
                textContent: `↪ In reply to message ID: ${msg.reply_to_message_id}` 
            }));
        }
        
        item.appendChild(contentDiv);
        container.appendChild(item);
    });

    renderPaginationControls(currentMessages.length);
}

function renderPaginationControls(totalMessages) {
    const controlsContainer = document.getElementById('paginationControls');
    controlsContainer.innerHTML = ''; // Clear previous content
    const totalPages = Math.ceil(totalMessages / messagesPerPage);

    if (totalPages <= 1) return;

    const prevButton = createElement('button', {
        textContent: 'Previous',
        disabled: currentPage === 1,
        onClick: () => {
            if (currentPage > 1) {
                currentPage--;
                renderTimelinePage();
            }
        }
    });

    const pageInfo = createElement('span', {
        textContent: `Page ${currentPage} of ${totalPages}`,
        className: 'page-info'
    });

    const nextButton = createElement('button', {
        textContent: 'Next',
        disabled: currentPage === totalPages,
        onClick: () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderTimelinePage();
            }
        }
    });

    controlsContainer.appendChild(prevButton);
    controlsContainer.appendChild(pageInfo);
    controlsContainer.appendChild(nextButton);
}
