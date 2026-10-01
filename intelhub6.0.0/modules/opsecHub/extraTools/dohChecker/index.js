// Tool: DNS-over-HTTPS (DoH) Leak & Resolver Checker (dohChecker)
function initDohCheckerTool() {
    const runBtn = document.getElementById('btn-run-doh-test');
    const resultBox = document.getElementById('result-doh-checker');
    const badgeStatus = document.getElementById('badge-doh-status');
    const summaryText = document.getElementById('text-doh-summary');
    const detailsContainer = document.getElementById('container-doh-details');

    if (!runBtn || !resultBox) return;

    function escapeHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // Comprehensive list of all 14 DoH providers from our Secure DNS Guide
    const dohProviders = [
        { name: 'Cloudflare (Default)', provider: 'Cloudflare', tag: 'Fast & Private', url: 'https://cloudflare-dns.com/dns-query' },
        { name: 'Cloudflare (Security Filter)', provider: 'Cloudflare', tag: 'Malware Block', url: 'https://security.cloudflare-dns.com/dns-query' },
        { name: 'Cloudflare (Family Shield)', provider: 'Cloudflare', tag: 'Adult + Malware', url: 'https://family.cloudflare-dns.com/dns-query' },
        { name: 'Quad9 (Swiss High-Security)', provider: 'Quad9', tag: 'Malware Block', url: 'https://dns.quad9.net/dns-query' },
        { name: 'AdGuard (Ad & Tracker Block)', provider: 'AdGuard', tag: 'Ads & Trackers', url: 'https://dns.adguard-dns.com/dns-query' },
        { name: 'AdGuard (Family Protection)', provider: 'AdGuard', tag: 'Family Shield', url: 'https://family.adguard-dns.com/dns-query' },
        { name: 'Control D (Ad & Tracker Block)', provider: 'Control D', tag: 'Ads & Trackers', url: 'https://freedns.controld.com/p2' },
        { name: 'Control D (Unfiltered)', provider: 'Control D', tag: 'Pure Speed', url: 'https://freedns.controld.com/uncensored' },
        { name: 'Mullvad (Ad & Tracker Block)', provider: 'Mullvad', tag: 'Swedish Privacy', url: 'https://adblock.doh.mullvad.net/dns-query' },
        { name: 'Mullvad (Pure No-Logs)', provider: 'Mullvad', tag: 'Swedish Privacy', url: 'https://doh.mullvad.net/dns-query' },
        { name: 'NextDNS (Public Default)', provider: 'NextDNS', tag: 'Smart Filtering', url: 'https://dns.nextdns.io' },
        { name: 'CleanBrowsing (Security Filter)', provider: 'CleanBrowsing', tag: 'Security Filter', url: 'https://doh.cleanbrowsing.org/doh/security-filter/' },
        { name: 'Google Public DNS', provider: 'Google', tag: 'Global Speed', url: 'https://dns.google/resolve' },
        { name: 'DNS.SB (European No-Logs)', provider: 'DNS.SB', tag: 'EU Privacy', url: 'https://doh.dns.sb/dns-query' }
    ];

    const runDohTest = async () => {
        resultBox.style.display = 'block';
        badgeStatus.textContent = '';
        badgeStatus.style.background = 'rgba(91, 157, 255, 0.2)';
        badgeStatus.style.color = '#5B9DFF';
        summaryText.textContent = `Probing all ${dohProviders.length} Secure DNS Guide DoH resolvers...`;
        detailsContainer.innerHTML = '';
        runBtn.disabled = true;

        try {
            const { fetchPublic } = await import(chrome.runtime.getURL('modules/publicFetchUrl.js'));
            let activeCount = 0;
            const probeResults = [];

            // Probe all 14 DoH endpoints in parallel
            const probePromises = dohProviders.map(async (p) => {
                // RFC 8484 binary wireformat query for example.com (Type A)
                const wireformatQuery = 'dns=AAABAAABAAAAAAAAB2V4YW1wbGUDY29tAAABAAE';
                const jsonQuery = 'name=example.com&type=A';
                
                const targetQueryUrl = p.url.includes('?') 
                    ? `${p.url}&${wireformatQuery}` 
                    : `${p.url}?${wireformatQuery}`;
                
                const jsonTargetUrl = p.url.includes('?') 
                    ? `${p.url}&${jsonQuery}` 
                    : `${p.url}?${jsonQuery}`;

                const startMs = performance.now();

                // First try background service worker fetch to bypass CORS
                let bgRes = await new Promise((resolve) => {
                    try {
                        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                            chrome.runtime.sendMessage({ action: 'probeDohEndpoint', targetUrl: targetQueryUrl }, (res) => {
                                if (res && res.success) resolve(res);
                                else {
                                    chrome.runtime.sendMessage({ action: 'probeDohEndpoint', targetUrl: jsonTargetUrl }, (res2) => {
                                        resolve(res2 || null);
                                    });
                                }
                            });
                        } else {
                            resolve(null);
                        }
                    } catch (_) {
                        resolve(null);
                    }
                });

                const elapsedMs = Math.round(performance.now() - startMs);

                if (bgRes && bgRes.success && (bgRes.status === 200 || bgRes.status === 400 || bgRes.status === 405)) {
                    return {
                        name: p.name,
                        tag: p.tag,
                        status: 'ACTIVE',
                        latencyMs: elapsedMs,
                        latency: `${elapsedMs} ms`,
                        dnssec: bgRes.isDnssec ? 'DNSSEC Verified' : 'Standard (DoH)',
                        details: `Connected to ${p.provider} DoH endpoint.`
                    };
                }

                // Direct fetch fallback
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3500);

                try {
                    let result = await fetchPublic(targetQueryUrl, {
                        method: 'GET',
                        headers: { Accept: 'application/dns-json, application/json' },
                        signal: controller.signal
                    });
                    if (!result.ok || !(result.response.ok || result.response.status === 400 || result.response.status === 405)) {
                        result = await fetchPublic(p.url, { method: 'HEAD', signal: controller.signal });
                    }
                    clearTimeout(timeoutId);
                    const fallbackMs = Math.round(performance.now() - startMs);
                    const res = result.ok ? result.response : null;

                    if (res && (res.ok || res.status === 400 || res.status === 405)) {
                        return {
                            name: p.name,
                            tag: p.tag,
                            status: 'ACTIVE',
                            latencyMs: fallbackMs,
                            latency: `${fallbackMs} ms`,
                            dnssec: 'Standard (DoH)',
                            details: `Connected to ${p.provider} DoH endpoint.`
                        };
                    } else {
                        return {
                            name: p.name,
                            tag: p.tag,
                            status: 'BLOCKED',
                            latencyMs: 99999,
                            latency: 'N/A',
                            dnssec: 'N/A',
                            details: `Endpoint unreachable or blocked by network.`
                        };
                    }
                } catch (err) {
                    clearTimeout(timeoutId);
                    return {
                        name: p.name,
                        tag: p.tag,
                        status: 'FAILED',
                        latencyMs: 99999,
                        latency: 'N/A',
                        dnssec: 'N/A',
                        details: err.name === 'AbortError' ? 'Connection timed out' : `Network error: ${err.message}`
                    };
                }
            });

            const rawResults = await Promise.all(probePromises);
            
            // Sort results by speed: ACTIVE sorted ascending by latencyMs, followed by BLOCKED/FAILED
            rawResults.sort((a, b) => {
                if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
                if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
                return a.latencyMs - b.latencyMs;
            });

            rawResults.forEach(r => {
                if (r.status === 'ACTIVE') activeCount++;
                probeResults.push(r);
            });

            // Fetch Resolver & IP Leaks via Public edns test
            let ipInfo = null;
            try {
                const ipRes = await fetch('https://edns.ip-api.com/json', { cache: 'no-store' });
                if (ipRes.ok) {
                    ipInfo = await ipRes.json();
                }
            } catch (_) {}

            // Determine OPSEC Leak Verdict
            let verdictTitle = 'SECURE: DoH Encryption Available';
            let badgeBg = '#30d158';
            let badgeLetter = 'PASS';

            if (activeCount === 0) {
                verdictTitle = 'WARNING: All Encrypted DoH Endpoints Blocked!';
                badgeBg = '#ff453a';
                badgeLetter = 'LEAK';
            } else if (activeCount < dohProviders.length) {
                verdictTitle = `ACTIVE: ${activeCount}/${dohProviders.length} DoH Resolvers Operational`;
                badgeBg = '#5B9DFF';
                badgeLetter = 'PASS';
            }

            badgeStatus.textContent = badgeLetter;
            badgeStatus.style.background = badgeBg;
            badgeStatus.style.color = '#000';

            summaryText.innerHTML = `<strong style="color:${badgeBg}">${verdictTitle}</strong><br>` +
                `<span style="font-size: 12px; color: #b0bec5;">Successfully probed ${activeCount} out of ${dohProviders.length} DoH endpoints from the Secure DNS Guide.</span>`;

            // Build detailed output cards
            let html = '';

            if (ipInfo && ipInfo.dns) {
                html += `
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 14px; border-radius: 8px; margin-bottom: 15px;">
                        <h4 style="font-size: 13px; font-weight: bold; color: #60a5fa; margin-bottom: 8px;">Active System DNS Resolver (EDNS Probe):</h4>
                        <div style="font-size: 12.5px; color: #fff; font-family: monospace; line-height: 1.6;">
                            <div><strong>Resolver IP:</strong> ${escapeHtml(ipInfo.dns.ip || 'N/A')}</div>
                            <div><strong>Operator / ISP:</strong> ${escapeHtml(ipInfo.dns.geo || 'Unknown Operator')}</div>
                        </div>
                    </div>
                `;
            }

            html += `
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr>
                            <th style="padding: 8px; color: #60a5fa; text-align: left; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">DoH Provider (From Guide)</th>
                            <th style="padding: 8px; color: #60a5fa; text-align: left; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Status</th>
                            <th style="padding: 8px; color: #60a5fa; text-align: left; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Latency</th>
                            <th style="padding: 8px; color: #60a5fa; text-align: left; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Validation</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            probeResults.forEach(r => {
                let badge = '';
                if (r.status === 'ACTIVE') badge = '<span style="background: rgba(61,220,132,0.2); color: #30d158; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">ACTIVE</span>';
                else if (r.status === 'BLOCKED') badge = '<span style="background: rgba(255,159,10,0.2); color: #ff9f0a; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">BLOCKED</span>';
                else badge = '<span style="background: rgba(255,69,58,0.2); color: #ff453a; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">FAILED</span>';

                html += `
                    <tr>
                        <td style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 12.5px; font-weight: bold; color: #fff;">
                            ${escapeHtml(r.name)}
                            <span style="display: inline-block; margin-left: 6px; font-size: 10px; color: #5B9DFF; background: rgba(91,157,255,0.1); padding: 1px 6px; border-radius: 8px;">${escapeHtml(r.tag)}</span>
                        </td>
                        <td style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">${badge}</td>
                        <td style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 12px; color: #5B9DFF; font-family: monospace;">${escapeHtml(r.latency)}</td>
                        <td style="padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 12px; color: #b0bec5;">${escapeHtml(r.dnssec)}</td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            detailsContainer.innerHTML = html;

        } catch (err) {
            console.error('DoH test error:', err);
            badgeStatus.textContent = 'ERR';
            badgeStatus.style.background = '#ff453a';
            badgeStatus.style.color = '#fff';
            summaryText.textContent = 'Failed to execute DoH leak test: ' + err.message;
        } finally {
            runBtn.disabled = false;
        }
    };

    runBtn.addEventListener('click', runDohTest);
}
