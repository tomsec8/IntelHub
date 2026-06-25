import { brw, flashButton, createSection, saveViewState, resetViewState } from './utils.js';

const searchList = [
    {
        name: "YouTube",
        uri: "https://www.youtube.com/{account}",
        category: "video",
        check_type: "header_check",
        valid_header: "reporting-endpoints"
    },
    {
        name: "Facebook",
        uri: "https://www.facebook.com/{account}/",
        category: "social",
        check_type: "header_check",
        valid_header: "permissions-policy"
    },
    {
        name: "Instagram",
        uri: "https://www.instagram.com/{account}/",
        category: "social",
        check_type: "header_check",
        valid_header: "permissions-policy"
    },
    {
        name: "Pinterest",
        uri: "https://www.pinterest.com/{account}/",
        category: "social",
        check_type: "status_and_content",
        valid_text: " - Profile | Pinterest"
    },
    {
        name: "Reddit",
        uri: "https://www.reddit.com/user/{account}/",
        category: "social",
        check_type: "status_and_content",
        valid_text: "?sort=hot"
    },
    {
        name: "Snapchat",
        uri: "https://www.snapchat.com/@{account}",
        category: "social",
        check_type: "status_and_content",
        valid_text: "{account}"
    },
    {
        name: "X (Twitter)",
        uri: "https://shadowban-api.yuzurisa.com:444/{account}",
        display_uri: "https://x.com/{account}",
        category: "social",
        check_type: "json_check",
        valid_json_path: "profile.exists",
        valid_json_value: true
    },
    {
        name: "Threads",
        uri: "https://www.threads.net/@{account}",
        category: "social",
        check_type: "status_and_content",
        valid_text: "Say more"
    },
    {
        name: "TikTok",
        uri: "https://www.tiktok.com/@{account}",
        category: "social",
        check_type: "status_and_content",
        valid_text: '"nickname"'
    },
    {
        name: "Tumblr",
        uri: "https://{account}.tumblr.com/",
        category: "social",
        check_type: "status_and_content",
        valid_text: "Tumblr"
    },
    {
        name: "Twitch",
        uri: "https://www.twitch.tv/{account}",
        category: "video",
        check_type: "status_and_content",
        valid_text: 'content="{account} - Twitch"'
    },
    {
        name: "GitHub",
        uri: "https://github.com/{account}",
        category: "code",
        check_type: "status_and_content",
        valid_text: "GitHub"
    }
];


let lastResults = null;

export function restoreUsernameSearchView(container, state) {
    if (state.mainOpen) {
        const userBtn = Array.from(container.querySelectorAll('.category-button')).find(btn => btn.textContent === "Username Search");
        if (userBtn) {
            const userWrapper = userBtn.nextElementSibling;
            if (userWrapper) {
                userWrapper.classList.add("open");

                if (state.username) {
                    const input = userWrapper.querySelector("#username-search-input");
                    if (input) input.value = state.username;
                }

                if (state.results) {
                    lastResults = state.results;
                    renderResults(userWrapper, lastResults);
                }
            }
        }
    }
}

function saveState(wrapper) {
    const isOpen = wrapper.classList.contains("open");
    if (!isOpen) {
        resetViewState();
        return;
    }
    const input = wrapper.querySelector("#username-search-input");
    saveViewState('usernameSearch', {
        mainOpen: isOpen,
        username: input ? input.value : "",
        results: lastResults
    });
}

function renderResults(wrapper, foundItems) {
    const resultsArea = wrapper.querySelector("#username-results-area");
    if (!resultsArea) return;

    resultsArea.style.display = "block";
    resultsArea.textContent = "";

    const statsDiv = document.createElement("div");
    statsDiv.style.color = "#ccc";
    statsDiv.style.marginBottom = "10px";
    statsDiv.style.fontSize = "0.9em";
    statsDiv.replaceChildren(
        document.createTextNode("Found "),
        Object.assign(document.createElement("strong"), { textContent: foundItems.length }),
        document.createTextNode(" profiles.")
    );
    resultsArea.appendChild(statsDiv);

    if (foundItems.length === 0) {
        const noResult = document.createElement("div");
        noResult.textContent = "No verified profiles found.";
        noResult.style.textAlign = "center";
        noResult.style.color = "#aaa";
        noResult.style.padding = "20px";
        resultsArea.appendChild(noResult);
        return;
    }

    foundItems.forEach(item => {
        const card = document.createElement("div");
        card.className = "tool-card";
        card.style.display = "flex";
        card.style.justifyContent = "space-between";
        card.style.alignItems = "center";
        card.style.marginBottom = "8px";
        card.style.borderLeft = "4px solid #2ecc71";

        const infoDiv = document.createElement("div");
        const nameDiv = document.createElement("div");
        nameDiv.textContent = item.name;
        nameDiv.style.fontWeight = "bold";
        nameDiv.style.color = "#fff";

        const methodDiv = document.createElement("div");
        methodDiv.textContent = `${item.details}`;
        methodDiv.style.fontSize = "10px";
        methodDiv.style.color = "#888";

        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(methodDiv);

        const link = document.createElement("a");
        link.href = item.url;
        link.target = "_blank";
        link.textContent = "OPEN";
        link.style.background = "transparent";
        link.style.border = "1px solid #2ecc71";
        link.style.color = "#2ecc71";
        link.style.padding = "4px 10px";
        link.style.borderRadius = "4px";
        link.style.textDecoration = "none";
        link.style.fontSize = "12px";
        link.style.fontWeight = "bold";
        link.style.transition = "all 0.2s";

        link.onmouseover = () => { link.style.background = "#2ecc71"; link.style.color = "#000"; };
        link.onmouseout = () => { link.style.background = "transparent"; link.style.color = "#2ecc71"; };

        card.appendChild(infoDiv);
        card.appendChild(link);
        resultsArea.appendChild(card);
    });
}

export function initializeUsernameSearch(container) {
    const { wrapper: userWrapper } = createSection(container, "Username Search", {
        onToggle: () => saveState(userWrapper)
    });

    const inputGroup = document.createElement("div");
    inputGroup.style.display = "flex";
    inputGroup.style.gap = "8px";
    inputGroup.style.marginBottom = "10px";
    inputGroup.style.padding = "0 10px";

    const userInput = document.createElement("input");
    userInput.type = "text";
    userInput.id = "username-search-input";
    userInput.placeholder = "Enter username (e.g. zuck)";
    userInput.style.flex = "1";
    userInput.addEventListener("input", () => saveState(userWrapper));

    const searchBtn = document.createElement("button");
    searchBtn.className = "sub-category-button";
    searchBtn.textContent = "Search";
    searchBtn.style.width = "auto";
    searchBtn.style.margin = "0";

    inputGroup.appendChild(userInput);
    inputGroup.appendChild(searchBtn);

    const resultsArea = document.createElement("div");
    resultsArea.id = "username-results-area";
    resultsArea.style.padding = "10px";
    resultsArea.style.maxHeight = "400px";
    resultsArea.style.overflowY = "auto";
    resultsArea.style.display = "none";

    const progressBlock = document.createElement("div");
    progressBlock.style.padding = "10px";
    progressBlock.style.display = "none";

    const progressLabel = document.createElement("div");
    progressLabel.id = "scan-status-text";
    progressLabel.style.fontSize = "12px";
    progressLabel.style.marginBottom = "5px";
    progressLabel.style.color = "#ccc";
    progressLabel.textContent = "Ready";

    const progressContainer = document.createElement("div");
    progressContainer.style.background = "#444";
    progressContainer.style.borderRadius = "4px";
    progressContainer.style.height = "8px";
    progressContainer.style.width = "100%";
    progressContainer.style.overflow = "hidden";

    const bar = document.createElement("div");
    bar.style.height = "100%";
    bar.style.width = "0%";
    bar.style.background = "#a855f7";
    bar.style.transition = "width 0.3s ease";

    progressContainer.appendChild(bar);
    progressBlock.appendChild(progressLabel);
    progressBlock.appendChild(progressContainer);

    userWrapper.appendChild(inputGroup);
    userWrapper.appendChild(progressBlock);
    userWrapper.appendChild(resultsArea);


    searchBtn.addEventListener("click", async () => {
        const username = userInput.value.trim();
        if (!username) {
            flashButton(searchBtn, "Empty!", true);
            return;
        }

        searchBtn.disabled = true;
        searchBtn.textContent = "Scanning...";
        progressBlock.style.display = "block";
        resultsArea.style.display = "block";
        resultsArea.textContent = "";
        lastResults = [];
        bar.style.width = "0%";
        bar.style.background = "#a855f7";

        let checkedCount = 0;

        for (let i = 0; i < searchList.length; i++) {
            const site = searchList[i];
            progressLabel.textContent = `Checking ${site.name}...`;

            const res = await checkSite(site, username);
            checkedCount++;

            if (res.exists) {
                lastResults.push({ name: res.site.name, url: res.url, details: res.details });

                const card = document.createElement("div");
                card.className = "tool-card";
                card.style.display = "flex";
                card.style.justifyContent = "space-between";
                card.style.alignItems = "center";
                card.style.marginBottom = "8px";
                card.style.borderLeft = "4px solid #2ecc71";

                const infoDiv = document.createElement("div");
                const nameDiv = document.createElement("div");
                nameDiv.textContent = res.site.name;
                nameDiv.style.fontWeight = "bold";
                nameDiv.style.color = "#fff";

                const methodDiv = document.createElement("div");
                methodDiv.textContent = `${res.details}`;
                methodDiv.style.fontSize = "10px";
                methodDiv.style.color = "#aaa";

                infoDiv.appendChild(nameDiv);
                infoDiv.appendChild(methodDiv);

                const link = document.createElement("a");
                link.href = res.url;
                link.target = "_blank";
                link.textContent = "OPEN";
                link.style.background = "transparent";
                link.style.border = "1px solid #2ecc71";
                link.style.color = "#2ecc71";
                link.style.padding = "4px 10px";
                link.style.borderRadius = "4px";
                link.style.textDecoration = "none";
                link.style.fontSize = "12px";
                link.style.fontWeight = "bold";

                link.onmouseover = () => { link.style.background = "#2ecc71"; link.style.color = "#000"; };
                link.onmouseout = () => { link.style.background = "transparent"; link.style.color = "#2ecc71"; };

                card.appendChild(infoDiv);
                card.appendChild(link);
                resultsArea.appendChild(card);
            }

            bar.style.width = `${(checkedCount / searchList.length) * 100}%`;
        }

        bar.style.background = "#2ecc71";
        progressLabel.textContent = "Complete.";

        if (lastResults.length === 0) {
            resultsArea.innerHTML = `<div style="text-align:center;color:#aaa;padding:20px;">No profile found for Facebook (Strict Verification).</div>`;
        }

        saveState(userWrapper);
        searchBtn.disabled = false;
        searchBtn.textContent = "Search";
    });
}

async function checkSite(site, username) {
    const url = site.uri.replace("{account}", username);
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(url, {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
            headers: {
                "Accept": "text/html"
            }
        });
        clearTimeout(id);

        if (site.check_type === 'status_and_content') {
            if (response.status === 200) {
                const text = await response.text();
                let checkString = site.valid_text;
                if (checkString.includes("{account}")) {
                    checkString = checkString.replace("{account}", username);
                }

                if (text.toLowerCase().includes(checkString.toLowerCase())) {
                    return { site, exists: true, url, details: "Verified (Status+Content)" };
                }
            }
            return { site, exists: false, url };
        }

        if (site.check_type === 'header_check') {
            const hasHeader = response.headers.has(site.valid_header);

            if (hasHeader) {
                return { site, exists: true, url, details: `Header: ${site.valid_header}` };
            } else {
                return { site, exists: false, url };
            }
        }

        if (site.check_type === 'json_check') {
            if (response.status === 200) {
                try {
                    const data = await response.json();
                    const path = site.valid_json_path.split('.');
                    let current = data;
                    for (const key of path) {
                        if (current === undefined || current === null) break;
                        current = current[key];
                    }

                    if (current === site.valid_json_value) {
                        const targetUrl = site.display_uri ? site.display_uri.replace("{account}", username) : url;
                        return { site, exists: true, url: targetUrl, details: "Verified (API)" };
                    }
                } catch (e) { }
            }
            return { site, exists: false, url };
        }

        if (site.check_type === 'url_match') {
            if (response.status === 200 && response.url.includes(site.valid_match)) {
                return { site, exists: true, url: response.url, details: "Verified (URL Match)" };
            }
            return { site, exists: false, url };
        }
    } catch (e) {
    }
    return { site, exists: false, url };
}
