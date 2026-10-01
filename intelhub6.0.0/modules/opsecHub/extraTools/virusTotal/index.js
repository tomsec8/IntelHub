// Tool: VirusTotal lookup (URL, domain, IP, or file hash — files hashed locally)
function initVirusTotalTool() {
    const fileInput = document.getElementById('input-vt-file');
    const hashInput = document.getElementById('txt-vt-hash');
    const searchBtn = document.getElementById('btn-vt-search');
    const statusEl = document.getElementById('status-vt-tool');

    if (!searchBtn || !hashInput) return;

    const sha256Bytes = async (buffer) => {
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
    };

    const sha256Text = async (text) => sha256Bytes(new TextEncoder().encode(text));

    const isFileHash = (value) =>
        /^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/.test(value);

    const isIPv4 = (value) => {
        const parts = value.split('.');
        if (parts.length !== 4) return false;
        return parts.every((part) => {
            if (!/^\d{1,3}$/.test(part)) return false;
            const n = Number(part);
            return n >= 0 && n <= 255;
        });
    };

    const isIPv6 = (value) => {
        if (!value.includes(':') || /\s/.test(value)) return false;
        try {
            return Boolean(new URL(`http://[${value}]`).hostname);
        } catch {
            return false;
        }
    };

    const isHttpUrl = (value) => {
        try {
            const parsed = new URL(value);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    };

    const coerceHttpUrl = (value) => {
        if (isHttpUrl(value)) return value;
        if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[:/?#]/.test(value)) {
            const withScheme = `https://${value}`;
            return isHttpUrl(withScheme) ? withScheme : '';
        }
        return '';
    };

    const isDomain = (value) => {
        const host = value.replace(/\.$/, '');
        if (!host || /\s/.test(host) || host.includes('/')) return false;
        return /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(host);
    };

    const resolveVtReport = async (raw) => {
        const value = String(raw || '').trim();
        if (!value) return null;

        if (isFileHash(value)) {
            return { href: `https://www.virustotal.com/gui/file/${value}`, kind: 'file hash' };
        }
        if (isIPv4(value) || isIPv6(value)) {
            return {
                href: `https://www.virustotal.com/gui/ip-address/${encodeURIComponent(value)}`,
                kind: 'IP'
            };
        }

        const url = coerceHttpUrl(value);
        if (url) {
            const id = await sha256Text(url);
            return { href: `https://www.virustotal.com/gui/url/${id}`, kind: 'URL' };
        }

        if (isDomain(value)) {
            const host = value.replace(/\.$/, '').toLowerCase();
            return {
                href: `https://www.virustotal.com/gui/domain/${encodeURIComponent(host)}`,
                kind: 'domain'
            };
        }

        return null;
    };

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            statusEl.textContent = 'Computing file hash locally...';
            statusEl.style.color = '#5B9DFF';

            try {
                const sha256 = await sha256Bytes(await file.arrayBuffer());
                hashInput.value = sha256;
                statusEl.textContent = 'Hash computed. Click to open the VirusTotal file report.';
                statusEl.style.color = '#30d158';
            } catch (err) {
                console.error(err);
                statusEl.textContent = 'Failed to compute file hash.';
                statusEl.style.color = '#ff453a';
            }
        });
    }

    const runLookup = async () => {
        const report = await resolveVtReport(hashInput.value);
        if (!report) {
            statusEl.textContent = 'Paste a URL, domain, IP, or file hash (MD5, SHA-1, SHA-256).';
            statusEl.style.color = '#ff453a';
            return;
        }

        statusEl.textContent = `Opening VirusTotal ${report.kind} report...`;
        statusEl.style.color = '#30d158';
        chrome.tabs.create({ url: report.href }).catch(() => {});
    };

    searchBtn.addEventListener('click', () => {
        runLookup().catch((err) => {
            console.error(err);
            statusEl.textContent = 'Could not open VirusTotal.';
            statusEl.style.color = '#ff453a';
        });
    });

    hashInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchBtn.click();
        }
    });
}
