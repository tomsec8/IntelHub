// modules/socialIdExtractor.js

import { brw, getCurrentTab } from './utils.js';

export function initializeSocialIdExtractor(container) {
    const socialBtn = document.createElement("button");
    socialBtn.className = "category-button";
    socialBtn.textContent = "Social ID Extractor";

    const socialWrapper = document.createElement("div");
    socialWrapper.className = "tool-list";

    socialBtn.addEventListener("click", () => {
        socialWrapper.classList.toggle("open");
    });

    const socialAutoBtn = document.createElement("button");
    socialAutoBtn.className = "sub-category-button";
    socialAutoBtn.textContent = "Extract Social ID from Page";

    socialAutoBtn.addEventListener("click", async () => {
        const tab = await getCurrentTab();
        try {
            const results = await brw.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const raw = document.documentElement.innerHTML;
                    const hostname = location.hostname;
                    const path = location.pathname;
                    let platform = "Unknown";
                    let name = document.title;
                    let userId = "";
                    if (hostname.includes("facebook.com")) {
                        platform = "Facebook";
                        const nameMatch = raw.match(/"__isProfile":"User","name":"(.*?)"/);
                        if (nameMatch) name = nameMatch[1];
                        const idMatch = raw.match(/"userID":"(\d{6,})"/) || raw.match(/"entity_id":"(\d{6,})"/);
                        if (idMatch) userId = idMatch[1];
                    } else if (hostname.includes("instagram.com")) {
                        platform = "Instagram";
                        const idMatch = raw.match(/"profile_id":"(\d+)"/);
                        if (idMatch) userId = idMatch[1];
                    } else if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
                        platform = "Twitter";
                        const match = path.match(/^\/([^\/\?]+)/);
                        if (match) userId = match[1];
                    } 
                    return { platform, name, userId };
                }
            });

            const result = results[0].result;
            
            // --- FIX: Decode Unicode escape sequences for the name ---
            try {
                // This safely parses strings like "\u05d9..." into readable text
                result.name = JSON.parse('"' + result.name + '"');
            } catch (e) {
                console.warn("Could not decode name from Unicode:", result.name);
            }
            // --- END FIX ---

            const box = document.createElement("div");
            box.style.background = "#2c1e3f";
            box.style.color = "#ffcc99";
            box.style.padding = "10px";
            box.style.marginTop = "10px";
            box.style.borderRadius = "8px";
            box.style.fontSize = "14px";
            box.style.lineHeight = "1.6";

            const platformDiv = document.createElement('div');
            const platformB = document.createElement('b');
            platformB.textContent = 'Platform: ';
            platformDiv.appendChild(platformB);
            platformDiv.appendChild(document.createTextNode(result.platform));

            const nameDiv = document.createElement('div');
            const nameB = document.createElement('b');
            nameB.textContent = 'Name: ';
            nameDiv.appendChild(nameB);
            nameDiv.appendChild(document.createTextNode(result.name));

            const idDiv = document.createElement('div');
            const idB = document.createElement('b');
            idB.textContent = 'ID: ';
            const idSpan = document.createElement('span');
            idSpan.id = 'extracted-id';
            idSpan.textContent = result.userId;
            idDiv.appendChild(idB);
            idDiv.appendChild(idSpan);

            const copyBtn = document.createElement('button');
            copyBtn.id = 'copy-social-id';
            copyBtn.className = 'sub-category-button';
            copyBtn.style.width = 'auto';
            copyBtn.style.padding = '4px 8px';
            copyBtn.style.marginTop = '8px';
            copyBtn.textContent = 'Copy ID';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(result.userId).then(() => alert("ID copied!"));
            });

            box.appendChild(platformDiv);
            box.appendChild(nameDiv);
            box.appendChild(idDiv);
            box.appendChild(copyBtn);

            const oldBox = socialWrapper.querySelector("#extraction-result-box");
            if (oldBox) oldBox.remove();
            box.id = "extraction-result-box";
            socialWrapper.appendChild(box);

        } catch (error) {
            console.error("Failed to extract social ID:", error);
            alert("Could not extract ID from this page.");
        }
    });
    socialWrapper.appendChild(socialAutoBtn);

    const goToProfileBtn = document.createElement("button");
    goToProfileBtn.className = "sub-category-button";
    goToProfileBtn.textContent = "Go to Profile by ID";

    goToProfileBtn.addEventListener("click", () => {
        const oldForm = socialWrapper.querySelector("#goto-profile-form");
        if (oldForm) {
            oldForm.remove();
            return;
        }

        const form = document.createElement("div");
        form.id = "goto-profile-form";
        form.style.background = "#2c1e3f";
        form.style.color = "#ffcc99";
        form.style.padding = "10px";
        form.style.marginTop = "10px";
        form.style.borderRadius = "8px";

        form.innerHTML = `
            <label style="display:block; margin-bottom:6px;">Choose Platform:</label>
            <select id="platform-select" style="width:100%; margin-bottom:10px; background-color: #1f1530; color: white; border: 1px solid #555; padding: 5px; border-radius: 5px;">
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="twitter">Twitter / X</option>
              <option value="tiktok">TikTok</option>
              <option value="linkedin">LinkedIn</option>
            </select>
            <label style="display:block; margin-bottom:6px;">Enter ID / Username:</label>
            <input id="profile-id-input" type="text" style="width: calc(100% - 12px); margin-bottom:10px; background-color: #1f1530; color: white; border: 1px solid #555; padding: 5px; border-radius: 5px;" placeholder="Enter ID or username..." />
            <button id="open-profile-btn" class="sub-category-button" style="width: auto; padding: 6px 12px;">Go</button>
        `;

        socialWrapper.appendChild(form);

        form.querySelector("#open-profile-btn").addEventListener("click", () => {
            const platform = form.querySelector("#platform-select").value;
            const input = form.querySelector("#profile-id-input").value.trim();
            if (!input) return alert("Please enter a valid ID or username.");

            let url = "";
            switch (platform) {
                case "facebook": url = `https://facebook.com/${input}`; break;
                case "instagram": url = `https://instagram.com/${input}`; break;
                case "twitter": url = `https://x.com/${input}`; break;
                case "tiktok": url = `https://www.tiktok.com/@${input}`; break;
                case "linkedin": url = `https://www.linkedin.com/in/${input}`; break;
            }

            if (url) window.open(url, "_blank");
        });
    });

    socialWrapper.appendChild(goToProfileBtn);

    container.appendChild(socialBtn);
    container.appendChild(socialWrapper);
}
