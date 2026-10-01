// modules/socialIdExtractor.js

import { brw, getCurrentTab, flashButton, createSection, saveViewState, resetViewState, createPopupSelect, insertToolResult } from './utils.js';
import { withPageAccess } from './opsecHub/js/optional-permissions.mjs';

export async function extractSocialIdFromPage(tabId) {
    const results = await brw.scripting.executeScript({
        target: { tabId },
        func: () => {
            const raw = document.documentElement.innerHTML;
            const hostname = location.hostname.toLowerCase();
            const path = location.pathname;
            const params = new URLSearchParams(location.search);
            const url = location.href;
            let platform = 'Unknown';
            let name = document.title || '';
            let username = '';
            let userId = '';

            const isHost = (domain) => hostname === domain || hostname.endsWith('.' + domain);
            const firstSeg = (path.split('/').filter(Boolean)[0] || '').replace(/^@/, '');
            const decodeJson = (value) => {
                try { return JSON.parse('"' + String(value).replace(/"/g, '\\"') + '"'); }
                catch { return value; }
            };
            const firstMatch = (patterns) => {
                for (const pattern of patterns) {
                    const match = raw.match(pattern);
                    if (match?.[1]) return match[1];
                }
                return '';
            };
            const skipSeg = (seg, names) => names.test(seg || '');

            if (isHost('facebook.com') || isHost('fb.com') || isHost('fb.watch')) {
                platform = 'Facebook';
                const people = path.match(/^\/people\/[^/]+\/(\d+)/);
                userId = params.get('id')
                    || people?.[1]
                    || firstMatch([
                        /"userID":"(\d+)"/,
                        /"userID":(\d+)/,
                        /"entity_id":"(\d+)"/,
                        /"profile_id":"(\d+)"/,
                        /fb:\/\/profile\/(\d+)/,
                        /content="fb:\/\/page\/\?id=(\d+)"/,
                        /"pageID":"(\d+)"/
                    ]);
                if (firstSeg === 'profile.php') {
                    username = firstMatch([/"userVanity":"([^"]+)"/, /"vanity":"([^"]+)"/]);
                } else if (!skipSeg(firstSeg, /^(watch|reels|stories|marketplace|groups|events|login|photo\.php|permalink\.php|pages|privacy|help|settings|share|dialog|plugins|reel|stories)$/i)) {
                    username = firstSeg;
                }
                const nameMatch = firstMatch([
                    /"__isProfile":"User","name":"(.*?)"/,
                    /"profile_owner":\{"id":"[^"]+","name":"(.*?)"/,
                    /<title>(.*?)<\/title>/
                ]);
                if (nameMatch) name = decodeJson(nameMatch);
            } else if (isHost('instagram.com')) {
                platform = 'Instagram';
                if (!skipSeg(firstSeg, /^(p|reel|reels|stories|explore|accounts|direct|tv|ads|legal|about)$/i)) {
                    username = firstSeg;
                }
                username = username || firstMatch([
                    /"username":"([A-Za-z0-9._]+)"/,
                    /property="og:title" content="([^"(@]+)/
                ]);
                userId = firstMatch([
                    /"profile_id":"(\d+)"/,
                    /"profilePage_(\d+)"/,
                    /"user_id":"(\d+)"/,
                    /"pk":"(\d+)"/,
                    /"pk":(\d+)/,
                    /"id":"(\d+)","username":"/,
                    /"instagram:\/\/user\?username=[^"]+&user_id=(\d+)"/
                ]);
            } else if (isHost('twitter.com') || isHost('x.com')) {
                platform = 'Twitter';
                if (!skipSeg(firstSeg, /^(home|explore|search|i|intent|compose|notifications|messages|settings|login|signup|hashtag|more)$/i)) {
                    username = firstSeg;
                }

                const blob = [
                    raw,
                    [...document.images].map((img) => img.src).join('\n'),
                    [...document.querySelectorAll('a[href]')].map((a) => a.href).join('\n'),
                    (performance.getEntriesByType('resource') || []).map((entry) => entry.name).join('\n')
                ].join('\n');

                const pickNearUsername = (body, handle) => {
                    if (!handle) return '';
                    const escaped = handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const patterns = [
                        new RegExp(`"screen_name"\\s*:\\s*"${escaped}"[\\s\\S]{0,20000}?"rest_id"\\s*:\\s*"(\\d+)"`, 'i'),
                        new RegExp(`"rest_id"\\s*:\\s*"(\\d+)"[\\s\\S]{0,20000}?"screen_name"\\s*:\\s*"${escaped}"`, 'i'),
                        new RegExp(`"id_str"\\s*:\\s*"(\\d+)"[\\s\\S]{0,8000}?"screen_name"\\s*:\\s*"${escaped}"`, 'i'),
                        new RegExp(`"screen_name"\\s*:\\s*"${escaped}"[\\s\\S]{0,8000}?"id_str"\\s*:\\s*"(\\d+)"`, 'i')
                    ];
                    for (const pattern of patterns) {
                        const match = body.match(pattern);
                        if (match?.[1]) return match[1];
                    }
                    return '';
                };

                const fromGraphqlId = (body, handle) => {
                    const matches = body.match(/"id"\s*:\s*"(VXNlcjo[A-Za-z0-9+/=]+)"/g) || [];
                    for (const token of matches) {
                        const payload = (token.match(/VXNlcjo[A-Za-z0-9+/=]+/) || [''])[0];
                        try {
                            const decoded = atob(payload);
                            const id = (decoded.match(/^User:(\d+)$/) || [])[1];
                            if (!id) continue;
                            if (!handle) return id;
                            const idx = body.indexOf(token);
                            const nearby = body.slice(Math.max(0, idx - 12000), idx + 12000);
                            if (nearby.toLowerCase().includes(`"screen_name":"${handle.toLowerCase()}"`)
                                || nearby.toLowerCase().includes(`"screen_name": "${handle.toLowerCase()}"`)) {
                                return id;
                            }
                        } catch {
                            /* ignore bad base64 */
                        }
                    }
                    return '';
                };

                userId = pickNearUsername(blob, username)
                    || fromGraphqlId(blob, username)
                    || (blob.match(/pbs\.twimg\.com\/profile_banners\/(\d+)/) || [])[1]
                    || (blob.match(/\/i\/user\/(\d+)/) || [])[1];

                const nameNode = document.querySelector('[data-testid="UserName"]');
                if (nameNode?.innerText) {
                    name = nameNode.innerText.split('\n')[0].trim() || name;
                }
            } else if (isHost('tiktok.com')) {
                platform = 'TikTok';
                if (!skipSeg(firstSeg, /^(foryou|explore|following|live|search|login|signup|video|music|tag|place|effect|find)$/i)) {
                    username = firstSeg;
                }
                username = username || firstMatch([/"uniqueId":"([^"]+)"/, /"unique_id":"([^"]+)"/]);
                userId = firstMatch([
                    /"authorId":"(\d+)"/,
                    /"authorId":(\d+)/,
                    /"uid":"(\d+)"/,
                    /"id":"(\d+)","uniqueId":"/,
                    /\/share\/user\/(\d+)/
                ]);
            } else if (isHost('linkedin.com')) {
                platform = 'LinkedIn';
                const parts = path.split('/').filter(Boolean);
                if (parts[0] === 'in' && parts[1]) username = parts[1];
                else if (parts[0] === 'company' && parts[1]) username = parts[1];
                userId = firstMatch([
                    /urn:li:fsd_profile:([A-Za-z0-9_-]+)/,
                    /urn:li:member:(\d+)/,
                    /urn:li:organization:(\d+)/,
                    /"entityUrn":"urn:li:fsd_company:(\d+)"/
                ]);
            }

            return { platform, name, username, userId, url };
        }
    });

    const result = results[0]?.result || { platform: 'Unknown', name: '', username: '', userId: '', url: '' };
    if (result.name) {
        try {
            if (result.name.includes('\\u')) result.name = JSON.parse('"' + result.name + '"');
        } catch {
            /* keep raw */
        }
    }
    result.username = String(result.username || '').replace(/^@+/, '').trim();
    result.userId = String(result.userId || '').trim();
    return result;
}

let lastSocialResult = null;
let lastGotoState = { platform: 'facebook', input: '' };

const PLATFORM_KEY = {
    facebook: 'facebook',
    instagram: 'instagram',
    twitter: 'twitter',
    'twitter / x': 'twitter',
    x: 'twitter',
    tiktok: 'tiktok',
    linkedin: 'linkedin'
};

const GOTO_HINT = {
    facebook: 'Numeric ID or username',
    instagram: 'Username — not the numeric ID',
    twitter: 'Username or numeric ID',
    tiktok: 'Username — not the numeric ID',
    linkedin: 'Profile slug, or company ID'
};

export function platformKey(value) {
    return PLATFORM_KEY[String(value || '').trim().toLowerCase()] || '';
}

export function profileUrlFor(platform, input) {
    const key = platformKey(platform) || String(platform || '').toLowerCase();
    const value = String(input || '').trim().replace(/^@+/, '');
    if (!value) return '';
    const numeric = /^\d+$/.test(value);
    switch (key) {
        case 'facebook':
            return numeric
                ? `https://www.facebook.com/profile.php?id=${value}`
                : `https://www.facebook.com/${encodeURIComponent(value)}`;
        case 'instagram':
            if (numeric) return '';
            return `https://www.instagram.com/${encodeURIComponent(value)}/`;
        case 'twitter':
            return numeric
                ? `https://x.com/i/user/${value}`
                : `https://x.com/${encodeURIComponent(value)}`;
        case 'tiktok':
            if (numeric) return '';
            return `https://www.tiktok.com/@${encodeURIComponent(value)}`;
        case 'linkedin':
            return numeric
                ? `https://www.linkedin.com/company/${encodeURIComponent(value)}`
                : `https://www.linkedin.com/in/${encodeURIComponent(value)}`;
        default:
            return '';
    }
}

export function navigableProfileUrl(result) {
    const key = platformKey(result?.platform);
    if (!key) return '';
    if (key === 'facebook' || key === 'twitter') {
        return profileUrlFor(key, result.userId || result.username);
    }
    return profileUrlFor(key, result.username);
}

function saveSocialState(wrapper) {
    const isMainOpen = wrapper?.classList.contains('open');
    if (!isMainOpen) {
        resetViewState('socialIdExtractor');
        return;
    }
    saveViewState('socialIdExtractor', {
        mainOpen: true,
        lastResult: lastSocialResult,
        gotoOpen: true,
        gotoPlatform: lastGotoState.platform,
        gotoInput: lastGotoState.input
    });
}

function addCopyRow(table, label, value, { copy = true } = {}) {
    if (!value) return;
    const row = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.textContent = label;
    const td2 = document.createElement('td');
    td2.textContent = value;
    row.append(td1, td2);
    if (copy) {
        row.title = 'Click to copy';
        row.addEventListener('click', () => {
            navigator.clipboard.writeText(value).then(() => {
                td2.textContent = 'Copied';
                setTimeout(() => { td2.textContent = value; }, 800);
            });
        });
    }
    table.appendChild(row);
}

function renderSocialResult(wrapper, result) {
    lastSocialResult = result;
    const oldBox = wrapper.querySelector('#extraction-result-box');
    if (oldBox) oldBox.remove();
    if (!result) return;

    const box = document.createElement('div');
    box.id = 'extraction-result-box';
    box.className = 'tool-result';

    const head = document.createElement('div');
    head.className = 'tool-result-head';
    const titleWrap = document.createElement('div');
    const kicker = document.createElement('div');
    kicker.className = 'tool-result-kicker';
    kicker.textContent = result.platform || 'Profile';
    const hint = document.createElement('div');
    hint.className = 'tool-result-meta';
    hint.style.margin = '2px 0 0';
    hint.textContent = 'ID verifies it is the same account. Instagram and TikTok open by username only.';
    titleWrap.append(kicker, hint);

    const headActions = document.createElement('div');
    headActions.className = 'tool-result-actions';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'tool-result-copy';
    copyBtn.textContent = 'Copy ID';
    copyBtn.disabled = !result.userId;
    copyBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        navigator.clipboard.writeText(result.userId || '').then(() => flashButton(copyBtn, 'Copied!'));
    });
    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'tool-result-copy';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const url = navigableProfileUrl(result);
        if (!url) {
            flashButton(openBtn, 'Need username', true);
            return;
        }
        window.open(url, '_blank');
    });
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'tool-result-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
        lastSocialResult = null;
        wrapper.querySelector('#social-tool-slot')?.replaceChildren();
        saveSocialState(wrapper);
    });
    headActions.append(copyBtn, openBtn, closeBtn);
    head.append(titleWrap, headActions);

    const table = document.createElement('table');
    addCopyRow(table, 'Name', result.name || '', { copy: Boolean(result.name) });
    addCopyRow(table, 'Username', result.username || '');
    addCopyRow(table, 'ID', result.userId || 'Not found', { copy: Boolean(result.userId) });

    box.append(head, table);
    const slot = wrapper.querySelector('#social-tool-slot');
    if (slot) slot.replaceChildren(box);
    else {
        const anchor = wrapper.querySelector('[data-tool="social-extract"]') || wrapper.firstElementChild;
        insertToolResult(anchor, box);
    }
}

function mountGotoForm(wrapper, prefill = {}) {
    lastGotoState = {
        platform: prefill.platform || lastGotoState.platform || 'facebook',
        input: prefill.input ?? lastGotoState.input ?? ''
    };

    const form = document.createElement('div');
    form.id = 'goto-profile-form';
    form.className = 'tool-result goto-profile';

    const label = document.createElement('div');
    label.className = 'goto-profile-label';
    label.textContent = 'Open a profile';

    const hint = document.createElement('p');
    hint.className = 'tool-result-meta';
    hint.style.margin = '0 0 8px';

    const row = document.createElement('div');
    row.className = 'goto-profile-row';

    const persistGoto = () => {
        lastGotoState.platform = platformSelect.value;
        lastGotoState.input = profileInput.value;
        applyGotoHint();
        saveSocialState(wrapper);
    };

    const platformSelect = createPopupSelect({
        className: 'goto-platform-select',
        options: [
            { value: 'facebook', label: 'Facebook' },
            { value: 'instagram', label: 'Instagram' },
            { value: 'twitter', label: 'Twitter / X' },
            { value: 'tiktok', label: 'TikTok' },
            { value: 'linkedin', label: 'LinkedIn' }
        ],
        value: lastGotoState.platform,
        onChange: persistGoto
    });

    const profileInput = document.createElement('input');
    profileInput.id = 'profile-id-input';
    profileInput.type = 'text';
    profileInput.value = lastGotoState.input;
    profileInput.addEventListener('input', persistGoto);

    function applyGotoHint() {
        const key = platformSelect.value;
        hint.textContent = GOTO_HINT[key] || GOTO_HINT.facebook;
        profileInput.placeholder = GOTO_HINT[key] || GOTO_HINT.facebook;
    }

    const goBtn = document.createElement('button');
    goBtn.id = 'open-profile-btn';
    goBtn.type = 'button';
    goBtn.className = 'sub-category-button goto-profile-go';
    goBtn.textContent = 'Open';
    goBtn.addEventListener('click', () => {
        persistGoto();
        const input = profileInput.value.trim();
        if (!input) {
            flashButton(goBtn, 'Enter a value', true);
            return;
        }
        const url = profileUrlFor(platformSelect.value, input);
        if (!url) {
            flashButton(goBtn, 'Needs username', true);
            return;
        }
        window.open(url, '_blank');
    });
    profileInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') goBtn.click();
    });

    applyGotoHint();
    row.append(platformSelect.el, profileInput, goBtn);
    form.append(label, hint, row);
    wrapper.appendChild(form);
}

export function restoreSocialIdExtractorView(container, state) {
    const socialBtn = container.querySelector('[data-section="social-id-extractor"]');
    if (!socialBtn) return;
    const socialWrapper = socialBtn.nextElementSibling;
    if (!socialWrapper) return;

    if (state.mainOpen) {
        socialWrapper.classList.add('open');
        socialBtn.classList.add('is-open');
    }

    if (state.gotoPlatform || state.gotoInput) {
        lastGotoState = {
            platform: state.gotoPlatform || lastGotoState.platform,
            input: state.gotoInput || lastGotoState.input
        };
        socialWrapper.querySelector('#goto-profile-form')?.remove();
        mountGotoForm(socialWrapper, lastGotoState);
    }

    if (state.lastResult) {
        lastSocialResult = state.lastResult;
        renderSocialResult(socialWrapper, state.lastResult);
    }
}

export function initializeSocialIdExtractor(container) {
    const { wrapper: socialWrapper } = createSection(container, 'Social ID', {
        id: 'social-id-extractor',
        subtitle: 'Read username and ID from this tab, or open a profile',
        onToggle: (open) => {
            if (open) saveSocialState(socialWrapper);
            else resetViewState('socialIdExtractor');
        }
    });

    const socialAutoBtn = document.createElement('button');
    socialAutoBtn.className = 'sub-category-button tool-action';
    socialAutoBtn.dataset.tool = 'social-extract';
    socialAutoBtn.textContent = 'Read ID from this page';
    socialAutoBtn.addEventListener('click', async () => {
        const tab = await getCurrentTab();
        if (!tab?.id || !/^https?:/i.test(tab.url || '')) {
            flashButton(socialAutoBtn, 'Open a profile', true);
            return;
        }
        socialAutoBtn.disabled = true;
        socialAutoBtn.textContent = 'Reading…';
        try {
            const result = await withPageAccess(tab.url, () => extractSocialIdFromPage(tab.id));
            renderSocialResult(socialWrapper, result);
            saveSocialState(socialWrapper);
        } catch (error) {
            console.error('Failed to extract social ID:', error);
            socialAutoBtn.textContent = 'Read ID from this page';
            const label = error?.code === 'cancelled' ? 'Not now' : error?.code === 'denied' ? 'Blocked' : 'No ID found';
            flashButton(socialAutoBtn, label, true);
        } finally {
            socialAutoBtn.disabled = false;
            if (socialAutoBtn.dataset.isFlashing !== 'true') socialAutoBtn.textContent = 'Read ID from this page';
        }
    });

    const slot = document.createElement('div');
    slot.id = 'social-tool-slot';
    slot.className = 'tool-result-slot';
    socialWrapper.append(socialAutoBtn, slot);
    mountGotoForm(socialWrapper);
}
