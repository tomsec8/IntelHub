// modules/linkAnalyzer.js

export function initializeLinkAnalyzer(container) {
    const linkBtn = document.createElement("button");
    linkBtn.className = "category-button";
    linkBtn.textContent = "Link Analyzer";

    const linkWrapper = document.createElement("div");
    linkWrapper.className = "tool-list";

    linkBtn.addEventListener("click", () => {
        linkWrapper.classList.toggle("open");
    });

    // --- Unshorten URL Button  ---
    const shortenerBtn = document.createElement("button");
    shortenerBtn.className = "sub-category-button";
    shortenerBtn.textContent = "Unshorten URL";
    shortenerBtn.addEventListener("click", () => {
        const oldForm = linkWrapper.querySelector("#unshorten-form");
        if (oldForm) { oldForm.remove(); return; }

        const form = document.createElement("div");
        form.id = "unshorten-form";
        form.style.background = "#2c1e3f"; form.style.padding = "10px"; form.style.marginTop = "10px"; form.style.borderRadius = "8px";

        form.innerHTML = `
            <label style="display:block; margin-bottom:6px;">Enter shortened URL:</label>
            <input id="short-url-input" type="text" style="width: calc(100% - 12px); margin-bottom:10px; background-color: #1f1530; color: white; border: 1px solid #555; padding: 5px; border-radius: 5px;" placeholder="e.g. https://bit.ly/..." />
            <button id="unshorten-now-btn" class="sub-category-button" style="width: auto; padding: 6px 12px;">Unshorten</button>
            <div id="unshorten-result" style="margin-top:10px; color: #ffcc99; word-break: break-all;"></div>
        `;
        linkWrapper.appendChild(form);

        form.querySelector("#unshorten-now-btn").addEventListener("click", async () => {
            const url = form.querySelector("#short-url-input").value.trim();
            const resultDiv = form.querySelector("#unshorten-result");
            resultDiv.innerHTML = ''; 

            if (!url.startsWith("http")) {
                resultDiv.textContent = "Please enter a valid URL.";
                return;
            }

            resultDiv.textContent = "🔍 Checking...";

            try {
                const targetUrl = `https://unshorten.me/json/${url}`;
                const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
                if (!proxyRes.ok) throw new Error(`Network response was not ok, status: ${proxyRes.status}`);
                const proxyData = await proxyRes.json();
                if (!proxyData.contents) throw new Error("Proxy returned empty contents.");
                const data = JSON.parse(proxyData.contents);
                
                resultDiv.innerHTML = ''; 
                if (data.success) {
                    const b = document.createElement('b');
                    b.textContent = "Original URL: ";
                    const a = document.createElement('a');
                    a.href = data.resolved_url;
                    a.target = "_blank";
                    a.style.color = "lightblue";
                    a.textContent = data.resolved_url;
                    const br = document.createElement('br');
                    const span = document.createElement('span');
                    span.style.fontSize = "12px";
                    span.style.color = "#aaa";
                    span.textContent = `Remaining API calls: ${data.remaining_calls}`;
                    
                    resultDiv.appendChild(b);
                    resultDiv.appendChild(a);
                    resultDiv.appendChild(br);
                    resultDiv.appendChild(span);
                } else {
                    resultDiv.textContent = data.error || 'Unshortening failed. Try again later.';
                }
            } catch (err) {
                console.error("Unshorten Error:", err);
                resultDiv.textContent = "An error occurred. The service might be temporarily unavailable.";
            }
        });
    });
    linkWrapper.appendChild(shortenerBtn);

    // --- Scan URL via VirusTotal Button  ---
    const scanBtn = document.createElement("button");
    scanBtn.className = "sub-category-button";
    scanBtn.textContent = "Scan for Viruses";
    scanBtn.addEventListener("click", () => {
        const oldForm = linkWrapper.querySelector("#scan-form");
        if (oldForm) { oldForm.remove(); return; }

        const form = document.createElement("div");
        form.id = "scan-form";
        form.style.background = "#2c1e3f"; form.style.padding = "10px"; form.style.marginTop = "10px"; form.style.borderRadius = "8px";

        form.innerHTML = `
            <label style="display:block; margin-bottom:6px;">Enter URL to scan:</label>
            <input id="scan-url-input" type="text" style="width: calc(100% - 12px); margin-bottom:10px; background-color: #1f1530; color: white; border: 1px solid #555; padding: 5px; border-radius: 5px;" placeholder="e.g. https://example.com" />
            <button id="scan-now-btn" class="sub-category-button" style="width: auto; padding: 6px 12px;">Scan</button>
            <div id="scan-result" style="margin-top:10px;"></div>
        `;
        linkWrapper.appendChild(form);

        form.querySelector("#scan-now-btn").addEventListener("click", () => {
            const url = form.querySelector("#scan-url-input").value.trim();
            const resultDiv = form.querySelector("#scan-result");
            resultDiv.innerHTML = ''; 

            if (!url) {
                resultDiv.textContent = "Please enter a URL.";
                return;
            }
            
            let domain;
            try {
                domain = new URL(url).hostname;
            } catch (e) {
                resultDiv.textContent = "Invalid URL format.";
                return;
            }

            const scanUrl = `https://www.virustotal.com/gui/domain/${encodeURIComponent(domain)}`;
            const b = document.createElement('b');
            b.textContent = "VirusTotal Scan: ";
            const a = document.createElement('a');
            a.href = scanUrl;
            a.target = "_blank";
            a.style.color = "lightblue";
            a.textContent = `Open report for ${domain}`;
            
            resultDiv.appendChild(b);
            resultDiv.appendChild(a);
        });
    });
    linkWrapper.appendChild(scanBtn);

    container.appendChild(linkBtn);
    container.appendChild(linkWrapper);
}