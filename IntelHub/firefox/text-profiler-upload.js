// firefox/text-profiler-upload.js
let lastResults = []; 

//  firefox/text-profiler-upload.js

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const resultsDiv = document.getElementById('results');
    const exportBtn = document.getElementById('exportBtn');

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;


        resultsDiv.textContent = `Reading ${file.name}...`;
        
        const text = await file.text();
        renderProfilerResults(text);
    });


    exportBtn.addEventListener('click', () => {
        if (lastResults.length === 0) {
            alert("No results to export.");
            return;
        }

        const csvRows = [["Type", "Value"]];
        lastResults.forEach(row => {
            const type = `"${row.type.replace(/"/g, '""')}"`;
            const value = `"${row.value.replace(/"/g, '""')}"`;
            csvRows.push([type, value]);
        });
        
        const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "extracted_entities.csv");
        document.body.appendChild(link);
        link.click();
        link.remove();
    });
});

function renderProfilerResults(text) {
    const resultsDiv = document.getElementById('results');
    const exportBtn = document.getElementById('exportBtn');
    
    const results = extractEntities(text);
    lastResults = results; 

    resultsDiv.innerHTML = '';

    if (results.length === 0) {
        resultsDiv.textContent = '❌ No identifiable entities found.';
        exportBtn.style.display = 'none';
        return;
    }

    const title = document.createElement('h3');
    title.textContent = 'Extracted Entities';
    resultsDiv.appendChild(title);

    const table = document.createElement('table');
    const headerRow = table.insertRow();
    const th1 = document.createElement('th');
    th1.textContent = 'Type';
    const th2 = document.createElement('th');
    th2.textContent = 'Value';
    headerRow.appendChild(th1);
    headerRow.appendChild(th2);

    results.forEach(result => {
        const row = table.insertRow();
        row.insertCell().textContent = result.type;
        row.insertCell().textContent = result.value;
    });
    
    resultsDiv.appendChild(table);
    exportBtn.style.display = 'inline-block';
}

function extractEntities(text) {
    const results = [];
    const found = new Set();
    const patterns = {
        "Facebook Profile": /facebook\.com\/(?:profile\.php\?id=)?([a-zA-Z0-9.]+)/g,
        "Instagram Profile": /instagram\.com\/([a-zA-Z0-9._]+)/g,
        "Twitter Profile": /twitter\.com\/([a-zA-Z0-9_]+)/g,
        "LinkedIn Profile": /linkedin\.com\/in\/([a-zA-Z0-9-]+)/g,
        "TikTok Profile": /tiktok\.com\/@([a-zA-Z0-9._]+)/g,
        "Snapchat Profile": /snapchat\.com\/add\/([a-zA-Z0-9._]+)/g,
        "Reddit Profile": /reddit\.com\/user\/([a-zA-Z0-9_-]+)/g,
        "Threads Profile": /threads\.net\/@([a-zA-Z0-9._]+)/g,
        "Pinterest Profile": /pinterest\.com\/([a-zA-Z0-9._]+)/g,
        "Tumblr Profile": /([a-zA-Z0-9-]+)\.tumblr\.com/g,
        "Telegram Username": /t(?:elegram)?\.me\/([a-zA-Z0-9_]+)/g,
        "WhatsApp Link": /wa\.me\/(\d{6,15})/g,
        "Discord Invite": /discord\.gg\/([a-zA-Z0-9]+)/g,
        "Signal Link": /signal\.me\/#eu\/([a-zA-Z0-9]+)/g,
        "YouTube Channel": /youtube\.com\/(?:c|channel|user)\/([a-zA-Z0-9_-]+)/g,
        "GitHub Profile": /github\.com\/([a-zA-Z0-9_-]+)/g,
        "Email": /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        "Phone": /\+?\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4}/g,
        "BTC Wallet": /\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g,
        "ETH Wallet": /\b0x[a-fA-F0-9]{40}\b/g,
        "URL": /https?:\/\/[^"<>)\s]+/g
    };

    for (const label in patterns) {
        const matches = [...text.matchAll(patterns[label])];
        matches.forEach(match => {
            let val = match[1] || match[0];
            val = val.trim().replace(/[.,;:]$/, '');
            const key = label + "::" + val;
            if (!found.has(key) && val) {
                results.push({ type: label, value: val });
                found.add(key);
            }
        });
    }
    return results;
}