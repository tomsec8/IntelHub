// modules/socialIdExtractor.js

import { brw, getCurrentTab, flashButton, createSection } from './utils.js';

export async function extractSocialIdFromPage(tabId) {
    const results = await brw.scripting.executeScript({
        target: { tabId },
        func: () => {
            const raw = document.documentElement.innerHTML;
            const hostname = location.hostname;
            const path = location.pathname;
            const url = location.href;
            let platform = "Unknown";
            let name = document.title;
            let userId = "";

            if (hostname.includes("facebook.com")) {
                platform = "Facebook";
                // Try multiple patterns for FB ID
                const idPatterns = [
                    /"userID":"(\d+)"/,
                    /"entity_id":"(\d+)"/,
                    /"profile_id":"(\d+)"/,
                    /fb:\/\/profile\/(\d+)/,
                    /content="fb:\/\/page\/\?id=(\d+)"/
                ];
                for (const pattern of idPatterns) {
                    const match = raw.match(pattern);
                    if (match) { userId = match[1]; break; }
                }
                const nameMatch = raw.match(/"__isProfile":"User","name":"(.*?)"/) || raw.match(/<title>(.*?)<\/title>/);
                if (nameMatch) name = nameMatch[1];
            } else if (hostname.includes("instagram.com")) {
                platform = "Instagram";
                const idMatch = raw.match(/"profile_id":"(\d+)"/);
                if (idMatch) userId = idMatch[1];
            } else if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
                platform = "Twitter";
                const match = path.match(/^\/([^\/\?]+)/);
                if (match) userId = match[1];
            }
            return { platform, name, userId, url };
        }
    });

    const result = results[0].result;
    if (result.name) {
        try {
            if (result.name.includes('\\u')) {
                result.name = JSON.parse('"' + result.name + '"');
            }
        } catch (e) {}
    }
    return result;
}

export function initializeSocialIdExtractor(container) {
    const { wrapper: socialWrapper } = createSection(container, "Social ID Extractor");

    const socialAutoBtn = document.createElement("button");
    socialAutoBtn.className = "sub-category-button";
    socialAutoBtn.textContent = "Extract Social ID from Page";

    socialAutoBtn.addEventListener("click", async () => {
        const tab = await getCurrentTab();
        try {
            const result = await extractSocialIdFromPage(tab.id);

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
                navigator.clipboard.writeText(result.userId).then(() => {
                    flashButton(copyBtn, "Copied!");
                });
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
            flashButton(socialAutoBtn, "No ID Found", true);
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

        form.querySelector("#open-profile-btn").addEventListener("click", (e) => {
            const platform = form.querySelector("#platform-select").value;
            const input = form.querySelector("#profile-id-input").value.trim();
            if (!input) {
                flashButton(e.target, "Enter ID!", true);
                return;
            }

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


}
