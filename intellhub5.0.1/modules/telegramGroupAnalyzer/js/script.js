document.addEventListener('DOMContentLoaded', () => {
    let allData = null;
    let charts = {};
    let currentMessages = [];
    let currentPage = 1;
    let zipFileObject = null;

    const fileInputElement = document.getElementById('fileInput');
    const modalElement = document.getElementById('modal');
    const modalCloseBtn = document.querySelector('.modal-close-btn');

    // Event Listeners
    if (fileInputElement) {
        fileInputElement.addEventListener('change', event => {
            const file = event.target.files[0];
            if (file) processZipFile(file);
        });
        
        // Drag & Drop support
        const uploadSection = document.querySelector('.upload-section');
        uploadSection.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadSection.style.borderColor = '#764ba2';
            uploadSection.style.background = 'linear-gradient(135deg, #e8eaff 0%, #d3d8f2 100%)';
        });
        
        uploadSection.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadSection.style.borderColor = '#667eea';
            uploadSection.style.background = 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)';
        });
        
        uploadSection.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadSection.style.borderColor = '#667eea';
            uploadSection.style.background = 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)';
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith('.zip')) {
                processZipFile(file);
            } else {
                showError('Please drop a .zip file');
            }
        });
    }

    if (modalCloseBtn) {
        modalCloseBtn.onclick = () => modalElement.classList.add('hidden');
    }

    // Close modal on background click
    modalElement?.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            modalElement.classList.add('hidden');
        }
    });

    // Helper function for error display
    function showError(message) {
        const errorAlert = document.getElementById('errorAlert');
        errorAlert.textContent = `Error: ${message}`;
        errorAlert.classList.remove('hidden');
        setTimeout(() => errorAlert.classList.add('hidden'), 5000);
    }

    async function processZipFile(file) {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('errorAlert').classList.add('hidden');
        document.getElementById('results').classList.add('hidden');
        document.getElementById('loading-text').textContent = 'Loading zip file...';

        try {
            zipFileObject = await JSZip.loadAsync(file);
            
            // Detect the root folder (if exists)
            let rootFolder = '';
            const allPaths = Object.keys(zipFileObject.files);
            
            // Check if all files are inside a common root folder
            if (allPaths.length > 0) {
                const firstPath = allPaths[0];
                const firstSlashIndex = firstPath.indexOf('/');
                
                if (firstSlashIndex > 0) {
                    const potentialRoot = firstPath.substring(0, firstSlashIndex + 1);
                    
                    // Check if all paths start with this root
                    const allInRoot = allPaths.every(path => path.startsWith(potentialRoot));
                    
                    if (allInRoot) {
                        rootFolder = potentialRoot;
                        console.log(`Detected root folder: ${rootFolder}`);
                    }
                }
            }
            
            const htmlFileHandles = [];
            const mediaFiles = new Map();
            const fileCounts = { photos: 0, videos: 0, files: 0, stickers: 0, voiceMessages: 0 };

            zipFileObject.forEach((relativePath, zipEntry) => {
                // Remove root folder from path if it exists
                let normalizedPath = relativePath;
                if (rootFolder && relativePath.startsWith(rootFolder)) {
                    normalizedPath = relativePath.substring(rootFolder.length);
                }
                
                // Skip if path is empty after removing root
                if (!normalizedPath) return;
                
                if (normalizedPath.startsWith('messages') && normalizedPath.endsWith('.html')) {
                    htmlFileHandles.push(zipEntry);
                } else if (normalizedPath.startsWith('photos/')) {
                    if (!zipEntry.dir) {
                        fileCounts.photos++;
                        mediaFiles.set(normalizedPath, zipEntry);
                    }
                } else if (normalizedPath.startsWith('video_files/')) {
                    if (!zipEntry.dir) {
                        fileCounts.videos++;
                        mediaFiles.set(normalizedPath, zipEntry);
                    }
                } else if (normalizedPath.startsWith('files/')) {
                    if (!zipEntry.dir) {
                        fileCounts.files++;
                        mediaFiles.set(normalizedPath, zipEntry);
                    }
                } else if (normalizedPath.startsWith('stickers/')) {
                    if (!zipEntry.dir) {
                        fileCounts.stickers++;
                        mediaFiles.set(normalizedPath, zipEntry);
                    }
                } else if (normalizedPath.startsWith('voice_messages/')) {
                    if (!zipEntry.dir) {
                        fileCounts.voiceMessages++;
                        mediaFiles.set(normalizedPath, zipEntry);
                    }
                }
            });

            if (htmlFileHandles.length === 0) {
                throw new Error("No 'messages.html' files found in the zip archive.");
            }

            htmlFileHandles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

            document.getElementById('loading-text').textContent = `Parsing ${htmlFileHandles.length} message file(s)...`;
            const htmlContents = await Promise.all(htmlFileHandles.map(handle => handle.async('string')));
            
            const contentViewer = document.getElementById('html-content-viewer');
            contentViewer.replaceChildren();
            
            const parser = new DOMParser();

            htmlContents.forEach((html, index) => {
                if (index > 0) {
                    const hr = document.createElement('hr');
                    hr.className = 'hidden';
                    contentViewer.appendChild(hr);
                }
                
                const doc = parser.parseFromString(html, 'text/html');
                
                Array.from(doc.body.childNodes).forEach(node => {
                    contentViewer.appendChild(node);
                });
            });

            const parsed = parseHtmlToMessages(contentViewer);
            
            allData = { 
                messages: parsed.messages, 
                mediaFiles: mediaFiles, 
                chatTitle: parsed.chatTitle,
                fileCounts: fileCounts
            };
            
            analyzeData(allData, fileCounts);

        } catch (error) {
            showError(error.message);
            console.error('Error processing zip file:', error);
        } finally {
            document.getElementById('loading').classList.add('hidden');
        }
    }

    function parseHtmlToMessages(doc) {
        const chatTitle = doc.querySelector('.page_header .text.bold')?.innerText.trim() || "Chat";
        const messages = [];
        
        doc.querySelectorAll('.history .message.default').forEach(msgEl => {
            try {
                const messageid = parseInt(msgEl.id.replace('message', ''), 10);
                if (isNaN(messageid)) return;

                const from_name = msgEl.querySelector('.from_name')?.innerText.trim() || 'Unknown User';
                const dateStr = msgEl.querySelector('.body > .pull_right.date.details')?.getAttribute('title');
                
                let date = null;
                if (dateStr) {
                    const parts = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
                    if (parts) {
                        date = new Date(`${parts[3]}-${parts[2]}-${parts[1]}T${parts[4]}:${parts[5]}:${parts[6]}`).toISOString();
                    }
                }

                const textEl = msgEl.querySelector('.body > .text');
                const text = textEl ? textEl.innerText.trim() : "";
                const replyEl = msgEl.querySelector('.reply_to a');
                const reply_to_message_id = replyEl ? parseInt(replyEl.hash.replace('#go_to_message', ''), 10) : null;
                
                let media = null;
                const mediaEl = msgEl.querySelector('.media_wrap a');
                if (mediaEl) {
                    media = { path: mediaEl.getAttribute('href') };
                }

                messages.push({
                    id: messageid, 
                    from_name, 
                    date, 
                    text, 
                    reply_to_message_id, 
                    media, 
                    chatTitle
                });
            } catch(e) { 
                console.warn("Could not parse a message element:", msgEl, e); 
            }
        });
        
        return { messages, chatTitle };
    }

    async function showMedia(mediaPath) {
        const modalBody = document.getElementById('modal-body');
        modalBody.replaceChildren();
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        modalBody.appendChild(spinner);
        modalElement.classList.remove('hidden');

        const mediaFile = allData.mediaFiles.get(mediaPath);
        if (!mediaFile) {
            modalBody.replaceChildren();
            modalBody.appendChild(createElement('p', { textContent: 'Error: Media file not found in zip.' }));
            return;
        }

        try {
            const extension = mediaPath.split('.').pop().toLowerCase();
            
            // Determine MIME type from extension
            let mimeType = '';
            const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
            const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
            const audioExtensions = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac'];
            
            if (imageExtensions.includes(extension)) {
                mimeType = extension === 'svg' ? 'image/svg+xml' : `image/${extension === 'jpg' ? 'jpeg' : extension}`;
            } else if (videoExtensions.includes(extension)) {
                mimeType = `video/${extension}`;
            } else if (audioExtensions.includes(extension)) {
                mimeType = `audio/${extension === 'mp3' ? 'mpeg' : extension}`;
            }
            
            // Create blob with correct MIME type
            const blobData = await mediaFile.async('blob');
            const blob = mimeType ? new Blob([blobData], { type: mimeType }) : blobData;
            const url = URL.createObjectURL(blob);
            
            modalBody.replaceChildren();
            
            // Display based on file type
            if (imageExtensions.includes(extension)) {
                const img = document.createElement('img');
                img.src = url;
                img.alt = mediaPath;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                modalBody.appendChild(img);
            } else if (videoExtensions.includes(extension)) {
                const video = document.createElement('video');
                video.src = url;
                video.controls = true;
                video.autoplay = true;
                video.style.maxWidth = '100%';
                video.style.height = 'auto';
                modalBody.appendChild(video);
            } else if (audioExtensions.includes(extension)) {
                const audio = document.createElement('audio');
                audio.src = url;
                audio.controls = true;
                audio.autoplay = true;
                modalBody.appendChild(audio);
            } else {
                const fileName = mediaPath.split('/').pop();
                modalBody.appendChild(createElement('p', { textContent: 'Preview not available for this file type.' }));
                const downloadLink = createElement('a', {
                    href: url,
                    className: 'download-btn',
                    textContent: `📥 Download File (${extension.toUpperCase()})`
                });
                downloadLink.download = fileName;
                modalBody.appendChild(downloadLink);
            }
        } catch (e) {
            modalBody.replaceChildren();
            modalBody.appendChild(createElement('p', { textContent: 'Error loading media.' }));
            console.error("Error showing media:", e);
        }
    }

    function jumpToMessage(messageId) {
        const modalBody = document.getElementById('modal-body');
        modalElement.classList.remove('hidden');

        const viewer = document.getElementById('html-content-viewer');
        const messageElement = viewer.querySelector(`#message${messageId}`);
        
        if (messageElement) {
            modalBody.replaceChildren();
            const clonedMessage = messageElement.cloneNode(true);
            clonedMessage.style.margin = '0';
            modalBody.appendChild(clonedMessage);
        } else {
            modalBody.replaceChildren();
            modalBody.appendChild(createElement('p', { textContent: 'Could not find the original message.' }));
        }
    }

    function getMessagesPerPage() {
        return parseInt(document.getElementById('pageSizeFilter').value, 10) || 100;
    }

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
        if (options.onClick) el.addEventListener('click', options.onClick);
        if (options.disabled) el.disabled = options.disabled;
        return el;
    }

    function analyzeData(data, fileCounts) {
        const messages = data.messages || [];
        if (messages.length === 0) {
            showError('No messages found in the provided file(s).');
            return;
        }
        
        // Destroy old charts
        Object.values(charts).forEach(chart => chart.destroy());
        charts = {};

        updateBasicStats(messages, fileCounts);
        createTimelineChart(messages);
        createChatsChart(messages);
        createHoursChart(messages);
        createWeekdayChart(messages);
        createMessageLengthChart(messages);
        createResponseTimeChart(messages);
        createEmojiChart(messages);
        generateInsights(messages);
        findRegexMatches(messages);
        createWordCloud(messages);
        
        populateChatFilter(messages);
        filterTimeline();

        document.getElementById('filterButton').onclick = () => filterTimeline();
        document.getElementById('pageSizeFilter').onchange = () => filterTimeline();
        document.getElementById('contentTypeFilter').onchange = () => filterTimeline();

        document.getElementById('results').classList.remove('hidden');
        
        // Smooth scroll to results
        document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function updateBasicStats(messages, fileCounts) {
        document.getElementById('totalMessages').textContent = messages.length.toLocaleString();
        document.getElementById('uniqueUsers').textContent = new Set(messages.map(m => m.from_name)).size.toLocaleString();
        
        const dates = messages.map(m => new Date(m.date)).filter(d => !isNaN(d)).sort((a, b) => a - b);
        const firstDate = dates[0];
        const lastDate = dates[dates.length - 1];
        const daysDiff = (lastDate && firstDate) ? Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24))) : 1;
        
        document.getElementById('dateRange').textContent = `${daysDiff} days`;
        document.getElementById('avgMessagesPerDay').textContent = Math.round(messages.length / daysDiff).toLocaleString();

        const statsGrid = document.querySelector('.stats-grid');
        document.querySelectorAll('.media-stat-card').forEach(c => c.remove());
        
        if(fileCounts.photos > 0) {
            const card = createElement('div', { className: 'stat-card media-stat-card' });
            card.appendChild(createElement('div', { className: 'stat-value', textContent: fileCounts.photos.toLocaleString() }));
            card.appendChild(createElement('div', { className: 'stat-label', textContent: '📷 Photos' }));
            statsGrid.appendChild(card);
        }
        
        if(fileCounts.videos > 0) {
            const card = createElement('div', { className: 'stat-card media-stat-card' });
            card.appendChild(createElement('div', { className: 'stat-value', textContent: fileCounts.videos.toLocaleString() }));
            card.appendChild(createElement('div', { className: 'stat-label', textContent: '🎥 Videos' }));
            statsGrid.appendChild(card);
        }
        
        if(fileCounts.files > 0) {
            const card = createElement('div', { className: 'stat-card media-stat-card' });
            card.appendChild(createElement('div', { className: 'stat-value', textContent: fileCounts.files.toLocaleString() }));
            card.appendChild(createElement('div', { className: 'stat-label', textContent: '📎 Files' }));
            statsGrid.appendChild(card);
        }
        
        if(fileCounts.stickers > 0) {
            const card = createElement('div', { className: 'stat-card media-stat-card' });
            card.appendChild(createElement('div', { className: 'stat-value', textContent: fileCounts.stickers.toLocaleString() }));
            card.appendChild(createElement('div', { className: 'stat-label', textContent: '🎭 Stickers' }));
            statsGrid.appendChild(card);
        }
        
        if(fileCounts.voiceMessages > 0) {
            const card = createElement('div', { className: 'stat-card media-stat-card' });
            card.appendChild(createElement('div', { className: 'stat-value', textContent: fileCounts.voiceMessages.toLocaleString() }));
            card.appendChild(createElement('div', { className: 'stat-label', textContent: '🎤 Voice' }));
            statsGrid.appendChild(card);
        }
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
        
        charts.timeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Messages',
                    data: data,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: { size: 14 },
                        bodyFont: { size: 13 }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function createChatsChart(messages) {
        const ctx = document.getElementById('chatsChart').getContext('2d');
        const chatCounts = {};
        
        messages.forEach(msg => {
            chatCounts[msg.from_name] = (chatCounts[msg.from_name] || 0) + 1;
        });
        
        const sortedChats = Object.entries(chatCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const labels = sortedChats.map(([title]) => title.length > 25 ? title.substring(0, 25) + '...' : title);
        const data = sortedChats.map(([, count]) => count);
        
        charts.chats = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe',
                        '#00f2fe', '#43e97b', '#38f9d7', '#ffecd2', '#fcb69f'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    function createHoursChart(messages) {
        const ctx = document.getElementById('hoursChart').getContext('2d');
        const hourCounts = new Array(24).fill(0);
        
        messages.forEach(msg => {
            if(msg.date) hourCounts[new Date(msg.date).getHours()]++;
        });
        
        charts.hours = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                datasets: [{
                    label: 'Messages',
                    data: hourCounts,
                    backgroundColor: 'rgba(102, 126, 234, 0.6)',
                    borderColor: '#667eea',
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function createWeekdayChart(messages) {
        const ctx = document.getElementById('weekdayChart').getContext('2d');
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const weekdayCounts = new Array(7).fill(0);
        
        messages.forEach(msg => {
            if(msg.date) weekdayCounts[new Date(msg.date).getDay()]++;
        });
        
        charts.weekdays = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: weekdays,
                datasets: [{
                    label: 'Messages',
                    data: weekdayCounts,
                    backgroundColor: 'rgba(118, 75, 162, 0.2)',
                    borderColor: '#764ba2',
                    borderWidth: 2,
                    pointBackgroundColor: '#764ba2',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#764ba2'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.1)' }
                    }
                }
            }
        });
    }

    function createMessageLengthChart(messages) {
        const ctx = document.getElementById('messageLengthChart')?.getContext('2d');
        if (!ctx) return;
        
        const lengths = messages
            .filter(m => m.text && m.text.trim().length > 0)
            .map(m => m.text.length);
        
        if (lengths.length === 0) return;
        
        const ranges = {
            '1-10': 0,
            '11-50': 0,
            '51-100': 0,
            '101-200': 0,
            '200+': 0
        };
        
        lengths.forEach(len => {
            if (len <= 10) ranges['1-10']++;
            else if (len <= 50) ranges['11-50']++;
            else if (len <= 100) ranges['51-100']++;
            else if (len <= 200) ranges['101-200']++;
            else ranges['200+']++;
        });
        
        charts.messageLength = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(ranges),
                datasets: [{
                    label: 'Messages',
                    data: Object.values(ranges),
                    backgroundColor: 'rgba(240, 147, 251, 0.6)',
                    borderColor: '#f093fb',
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function createResponseTimeChart(messages) {
        const ctx = document.getElementById('responseTimeChart')?.getContext('2d');
        if (!ctx) return;
        
        const sortedMessages = messages
            .filter(m => m.date)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const responseTimes = [];
        const userLastMessage = {};
        
        sortedMessages.forEach(msg => {
            const currentUser = msg.from_name;
            const currentTime = new Date(msg.date).getTime();
            
            // Check if there was a message from a different user before
            for (const [user, time] of Object.entries(userLastMessage)) {
                if (user !== currentUser) {
                    const timeDiff = (currentTime - time) / (1000 * 60); // minutes
                    if (timeDiff < 60 * 24) { // Only within 24 hours
                        responseTimes.push(timeDiff);
                    }
                }
            }
            
            userLastMessage[currentUser] = currentTime;
        });
        
        if (responseTimes.length === 0) return;
        
        const ranges = {
            '< 1min': 0,
            '1-5min': 0,
            '5-15min': 0,
            '15-60min': 0,
            '1-6h': 0,
            '6-24h': 0
        };
        
        responseTimes.forEach(time => {
            if (time < 1) ranges['< 1min']++;
            else if (time < 5) ranges['1-5min']++;
            else if (time < 15) ranges['5-15min']++;
            else if (time < 60) ranges['15-60min']++;
            else if (time < 360) ranges['1-6h']++;
            else ranges['6-24h']++;
        });
        
        charts.responseTime = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(ranges),
                datasets: [{
                    label: 'Responses',
                    data: Object.values(ranges),
                    backgroundColor: 'rgba(67, 233, 123, 0.6)',
                    borderColor: '#43e97b',
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function createEmojiChart(messages) {
        const ctx = document.getElementById('emojiChart')?.getContext('2d');
        if (!ctx) return;
        
        const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
        const emojiCounts = {};
        
        messages.forEach(msg => {
            if (!msg.text) return;
            const emojis = msg.text.match(emojiRegex);
            if (emojis) {
                emojis.forEach(emoji => {
                    emojiCounts[emoji] = (emojiCounts[emoji] || 0) + 1;
                });
            }
        });
        
        const sortedEmojis = Object.entries(emojiCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        if (sortedEmojis.length === 0) return;
        
        charts.emoji = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedEmojis.map(([emoji]) => emoji),
                datasets: [{
                    label: 'Count',
                    data: sortedEmojis.map(([, count]) => count),
                    backgroundColor: 'rgba(245, 87, 108, 0.6)',
                    borderColor: '#f5576c',
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 20 }
                        }
                    }
                }
            }
        });
    }

    function generateInsights(messages) {
        const container = document.getElementById('insightsContainer');
        container.replaceChildren(); 
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
            const parts = insight.split(/<strong>|<\/strong>/);
            item.appendChild(document.createTextNode(parts[0]));
            if (parts[1]) item.appendChild(createElement('strong', { textContent: parts[1] }));
            if (parts[2]) item.appendChild(document.createTextNode(parts[2]));
            container.appendChild(item);
        });
    }

    function findRegexMatches(messages) {
        const container = document.getElementById('regexContainer');
        container.replaceChildren(); 
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


    function createWordCloud(messages) {
        const container = document.getElementById('wordCloudContainer');
        container.replaceChildren(); 
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
        chatFilter.replaceChildren(); 
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
        const selectedUser = document.getElementById('chatFilter').value;
        const contentType = document.getElementById('contentTypeFilter').value;
        const startDate = document.getElementById('startDateFilter').value;
        const endDate = document.getElementById('endDateFilter').value;
        const searchTerm = document.getElementById('searchFilter').value.toLowerCase();

        let filteredMessages = allData.messages;

        // Filter by user
        if (selectedUser !== 'all') {
            filteredMessages = filteredMessages.filter(m => m.from_name === selectedUser);
        }
        
        // Filter by content type
        if (contentType !== 'all') {
            filteredMessages = filteredMessages.filter(m => {
                if (contentType === 'text') {
                    return !m.media && m.text && m.text.trim().length > 0;
                } else if (contentType === 'media') {
                    return m.media;
                } else if (contentType === 'photos') {
                    return m.media && m.media.path.startsWith('photos/');
                } else if (contentType === 'videos') {
                    return m.media && m.media.path.startsWith('video_files/');
                } else if (contentType === 'files') {
                    return m.media && m.media.path.startsWith('files/');
                } else if (contentType === 'stickers') {
                    return m.media && m.media.path.startsWith('stickers/');
                } else if (contentType === 'voice') {
                    return m.media && m.media.path.startsWith('voice_messages/');
                }
                return true;
            });
        }
        
        // Filter by date range
        if (startDate) {
            filteredMessages = filteredMessages.filter(m => 
                m.date && new Date(m.date) >= new Date(startDate).setHours(0,0,0,0)
            );
        }
        if (endDate) {
            filteredMessages = filteredMessages.filter(m => 
                m.date && new Date(m.date) <= new Date(endDate).setHours(23,59,59,999)
            );
        }
        
        // Filter by search term
        if (searchTerm) {
            filteredMessages = filteredMessages.filter(m => 
                (m.text || '').toLowerCase().includes(searchTerm)
            );
        }
        
        currentMessages = filteredMessages.sort((a, b) => new Date(b.date) - new Date(a.date));
        renderTimelinePage();
    }

    function renderTimelinePage() {
        const container = document.getElementById('timelineContainer');
        container.replaceChildren(); 
        const messagesPerPage = getMessagesPerPage();
        
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
            let text = msg.text || '';
            const chatTitle = msg.chatTitle || 'Unknown Chat';
            const isMedia = msg.media || (msg.mediaKind && typeof msg.mediaKind === 'number');

            if (!text && isMedia) {
                let mediaType = 'Media';
                if (msg.media && msg.media.photo) mediaType = 'Photo';
                else if (msg.media && msg.media.contact) mediaType = 'Contact';
                else if (msg.media && msg.media.document) mediaType = 'File/Document';
                text = `[${mediaType}]`;
            } else if (!text) {
                text = '[Empty Message]';
            }
            
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
            contentDiv.appendChild(document.createTextNode(text));

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
        controlsContainer.replaceChildren(); 
        const messagesPerPage = getMessagesPerPage();
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
});