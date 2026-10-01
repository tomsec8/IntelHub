import { brw } from './utils.js';
import { extraUsernameSites } from './usernameSites.js';

const coreUsernameSites = [
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

const ownedNames = new Set(coreUsernameSites.map((site) => site.name.toLowerCase()));
const searchList = [
    ...coreUsernameSites,
    ...extraUsernameSites.filter((site) => !ownedNames.has(site.name.toLowerCase()))
];

const SCAN_CONCURRENCY = 8;

function runtimeSend(message) {
    return new Promise((resolve) => {
        try {
            brw.runtime.sendMessage(message, (response) => {
                void brw.runtime.lastError;
                resolve(response || { success: false });
            });
        } catch {
            resolve({ success: false });
        }
    });
}

export async function ensureUsernameScanPermission() {
    const api = globalThis.chrome || globalThis.browser;
    if (!api?.permissions?.request) return true;
    return new Promise((resolve) => {
        api.permissions.contains({ origins: ['<all_urls>'] }, (hasPerm) => {
            if (hasPerm) {
                resolve(true);
                return;
            }
            api.permissions.request({ origins: ['<all_urls>'] }, resolve);
        });
    });
}


export async function searchUsername(username, { onProgress, onHit, signal } = {}) {
    const found = [];
    const total = searchList.length;
    let next = 0;
    let done = 0;
    const scanId = `username-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const abortScan = () => {
        runtimeSend({ action: 'usernameAbortScan', scanId });
    };
    if (signal?.aborted) {
        abortScan();
        return found;
    }
    signal?.addEventListener('abort', abortScan, { once: true });

    async function worker() {
        while (next < total) {
            if (signal?.aborted) return;
            const index = next++;
            const site = searchList[index];
            const res = await runtimeSend({
                action: 'usernameCheckSite',
                scanId,
                site,
                username
            });
            done++;
            onProgress?.({ site: site.name, index: done - 1, total });
            if (res?.exists) {
                const hit = {
                    name: site.name,
                    url: res.url,
                    details: res.details,
                    category: site.category || ''
                };
                found.push(hit);
                onHit?.(hit);
            }
        }
    }

    try {
        const workers = Array.from(
            { length: Math.min(SCAN_CONCURRENCY, total) },
            () => worker()
        );
        await Promise.all(workers);
    } finally {
        signal?.removeEventListener('abort', abortScan);
        abortScan();
    }
    return found;
}
