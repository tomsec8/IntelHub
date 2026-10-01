const TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me', 'telegram.dog']);

function parseTelegramTarget(input) {
    const raw = String(input || '').trim();
    if (!raw) return null;

    let path = '';
    if (/^https?:\/\//i.test(raw) || /^\/\//.test(raw) || /^(?:t\.me|telegram\.me|telegram\.dog)\//i.test(raw)) {
        try {
            const href = raw.startsWith('//') ? `https:${raw}` : /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
            const parsed = new URL(href);
            const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
            if (!TELEGRAM_HOSTS.has(host)) return null;
            path = decodeURIComponent(parsed.pathname || '').replace(/^\/+/, '');
        } catch {
            return null;
        }
    } else {
        path = raw.replace(/^@/, '').replace(/^\/+/, '');
    }

    path = path.split(/[?#]/)[0].replace(/\/+$/, '');
    if (!path) return null;

    const segments = path.split('/').filter(Boolean);
    if (!segments.length) return null;

    if (segments[0] === 's' && segments[1]) {
        const username = segments[1].replace(/^@/, '');
        return { username, url: `https://t.me/${username}` };
    }

    if (segments[0].startsWith('+')) {
        const token = segments[0];
        return { username: '', url: `https://t.me/${token}` };
    }

    const username = segments[0].replace(/^@/, '');
    if (!username) return null;
    return { username, url: `https://t.me/${username}` };
}

export const TelegramScraper = {
    async analyze(input) {
        const target = parseTelegramTarget(input);
        if (!target) {
            return { success: false, error: 'Enter a username or t.me link.' };
        }

        try {
            const response = await fetch(target.url, {
                method: 'GET',
                cache: 'no-cache'
            });

            if (!response.ok) throw new Error('Failed to fetch page');

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const title = doc.querySelector('meta[property="og:title"]')?.content || 'Unknown';
            const description = doc.querySelector('meta[property="og:description"]')?.content || '';
            const image = doc.querySelector('meta[property="og:image"]')?.content || '';

            let extraInfo = '';
            let type = target.username.startsWith('+') || !target.username ? 'Invite' : 'User';

            const extraEl = doc.querySelector('.tgme_page_extra');
            if (extraEl) {
                extraInfo = extraEl.textContent.trim();
                if (extraInfo.includes('subscribers')) type = 'Channel';
                else if (extraInfo.includes('members')) type = 'Group';
                else if (extraInfo.includes('bot')) type = 'Bot';
            }

            const isVerified = !!doc.querySelector('.tgme_page_title i.verified-icon');

            if (title === 'Telegram: Contact @undefined' || (!extraInfo && !description && title === 'Telegram')) {
                return { success: false, error: 'User/Channel not found' };
            }

            return {
                success: true,
                data: {
                    username: target.username,
                    title,
                    description,
                    image,
                    type,
                    stats: extraInfo,
                    verified: isVerified,
                    url: target.url
                }
            };
        } catch (e) {
            console.error(e);
            return { success: false, error: 'Connection Error (CORS/Network)' };
        }
    }
};
