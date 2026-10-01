// Tool 9: SSL Certificate Inspector (live TLS when available, otherwise CT dates)
function initSslCheckerTool() {
    const inputDomain = document.getElementById('inp-ssl-domain');
    const btnAnalyze = document.getElementById('btn-ssl-analyze');
    const containerResults = document.getElementById('ssl-results-container');

    if (!btnAnalyze || !containerResults) return;

    const UNKNOWN = 'Not in this source';

    btnAnalyze.addEventListener('click', () => {
        let domain = (inputDomain.value || '').trim();
        if (!domain) return;
        domain = domain.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
        analyzeDomain(domain);
    });

    if (inputDomain) {
        inputDomain.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                btnAnalyze.click();
            }
        });
    }

    function parseDate(value) {
        if (value == null || value === '') return null;
        const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function issuerFromName(raw, fallback) {
        let issuerStr = String(raw || '').trim();
        if (!issuerStr) return fallback || '';
        if (issuerStr.includes('O=')) {
            const m = issuerStr.match(/O=([^,]+)/);
            if (m) issuerStr = m[1].replace(/"/g, '');
        }
        return issuerStr;
    }

    function formatDay(date) {
        return date ? date.toISOString().split('T')[0] : 'N/A';
    }

    async function analyzeDomain(domain) {
        btnAnalyze.disabled = true;
        btnAnalyze.textContent = 'Looking up certificate…';
        containerResults.style.display = 'block';
        containerResults.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                <div>Looking up certificate records for <strong>${escapeHtml(domain)}</strong>…</div>
            </div>
        `;

        try {
            let certData = null;

            try {
                const resp1 = await fetch(`https://networkcalc.com/api/security/certificate/${encodeURIComponent(domain)}`);
                if (resp1.ok) {
                    const json1 = await resp1.json();
                    if (json1 && json1.status === 'OK' && json1.certificate) {
                        const cert = json1.certificate;
                        const issuer = cert.issuer
                            ? (cert.issuer.organization || cert.issuer.common_name || cert.issuer.organization_unit || '')
                            : '';
                        certData = {
                            validFrom: parseDate(cert.valid_from),
                            validTo: parseDate(cert.valid_to),
                            issuer,
                            keySize: cert.key_size ? `${cert.key_size} bits` : '',
                            signature: cert.signature_algorithm || '',
                            protocol: cert.protocol || '',
                            source: 'live',
                            sourceLabel: 'Live TLS handshake (NetworkCalc)'
                        };
                    }
                }
            } catch (e) {}

            if (!certData || !certData.validTo) {
                try {
                    const resp2 = await fetch(`https://api.certspotter.com/v0/certs?domain=${encodeURIComponent(domain)}&duplicate_filtering=true`);
                    if (resp2.ok) {
                        const json2 = await resp2.json();
                        if (Array.isArray(json2) && json2.length > 0) {
                            json2.sort((a, b) => new Date(b.not_after) - new Date(a.not_after));
                            const newest = json2[0];
                            certData = {
                                validFrom: parseDate(newest.not_before),
                                validTo: parseDate(newest.not_after),
                                issuer: issuerFromName(newest.issuer && newest.issuer.name, ''),
                                keySize: '',
                                signature: '',
                                protocol: '',
                                source: 'ct',
                                sourceLabel: 'Certificate Transparency (logged cert, not a live handshake)'
                            };
                        }
                    }
                } catch (e) {}
            }

            if (!certData || !certData.validTo) {
                try {
                    const resp3 = await fetch(`https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`);
                    if (resp3.ok) {
                        const json3 = await resp3.json();
                        if (Array.isArray(json3) && json3.length > 0) {
                            json3.sort((a, b) => new Date(b.not_after) - new Date(a.not_after));
                            const newest = json3[0];
                            certData = {
                                validFrom: parseDate(newest.not_before),
                                validTo: parseDate(newest.not_after),
                                issuer: issuerFromName(newest.issuer_name, ''),
                                keySize: '',
                                signature: '',
                                protocol: '',
                                source: 'ct',
                                sourceLabel: 'Certificate Transparency (logged cert, not a live handshake)'
                            };
                        }
                    }
                } catch (e) {}
            }

            if (!certData || !certData.validTo) {
                throw new Error('Could not retrieve certificate details for domain');
            }

            const now = Date.now();
            const fromMs = certData.validFrom ? certData.validFrom.getTime() : null;
            const toMs = certData.validTo.getTime();
            const notYetValid = fromMs != null && now < fromMs;
            const expired = now > toMs;
            const isValid = !notYetValid && !expired;
            const daysRemaining = expired ? 0 : Math.max(0, Math.floor((toMs - now) / (1000 * 60 * 60 * 24)));

            renderSslReport(domain, {
                isValid,
                notYetValid,
                expired,
                daysRemaining,
                validFrom: formatDay(certData.validFrom),
                validTo: formatDay(certData.validTo),
                issuer: certData.issuer || UNKNOWN,
                protocol: certData.protocol || UNKNOWN,
                keySize: certData.keySize || UNKNOWN,
                signature: certData.signature || UNKNOWN,
                sourceLabel: certData.sourceLabel,
                live: certData.source === 'live',
                subject: domain
            });

        } catch (e) {
            containerResults.innerHTML = `
                <div style="padding: 20px; background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3); border-radius: 8px; color: #FF6B6B; text-align: center;">
                     Failed to inspect TLS certificate for ${escapeHtml(domain)}. Verify domain availability or internet connection.
                </div>
            `;
        } finally {
            btnAnalyze.disabled = false;
            btnAnalyze.textContent = 'Inspect Target Domain';
        }
    }

    function checkItem(state, title, detail) {
        const color = state === 'ok' ? '#3DDC84' : state === 'warn' ? '#FF9F43' : state === 'miss' ? '#78909c' : '#FF6B6B';
        const mark = state === 'ok' ? '✓' : state === 'warn' ? '!' : state === 'miss' ? '–' : '×';
        return `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: ${color}; font-weight: 700;">${mark}</span>
                <div>
                    <strong style="color: #fff;">${escapeHtml(title)}</strong>
                    <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(detail)}</div>
                </div>
            </div>
        `;
    }

    function specRow(label, value, emphasize) {
        const known = value && value !== UNKNOWN;
        const color = known && emphasize ? '#3DDC84' : '#fff';
        return `<tr><td style="padding: 5px 0; color: var(--text-muted);">${escapeHtml(label)}:</td><td style="text-align: right; color: ${color}; font-weight: ${emphasize && known ? 600 : 400};">${escapeHtml(value)}</td></tr>`;
    }

    function renderSslReport(domain, data) {
        const isExpiringSoon = data.isValid && data.daysRemaining < 30;
        const progressPct = data.expired ? 0 : Math.min(100, Math.max(0, (data.daysRemaining / 365) * 100));
        const statusLabel = data.notYetValid ? 'Not yet valid' : data.expired ? 'Expired' : 'Valid & Active';
        const statusColor = data.isValid ? '#3DDC84' : '#FF6B6B';
        const daysColor = data.expired || data.notYetValid ? '#FF6B6B' : isExpiringSoon ? '#FF9F43' : '#3DDC84';
        const daysCaption = data.notYetValid
            ? 'Until this certificate starts'
            : data.expired
                ? 'Already expired'
                : 'Remaining until expiration';

        const validityState = data.isValid ? 'ok' : 'fail';
        const validityTitle = data.notYetValid ? 'Not yet valid' : data.expired ? 'Certificate expired' : 'Certificate valid';
        const validityDetail = data.notYetValid
            ? `Not valid until ${data.validFrom}`
            : data.expired
                ? `Expired on ${data.validTo}`
                : 'Dates fall within the current time';

        const expiryState = data.expired || data.notYetValid ? 'fail' : isExpiringSoon ? 'warn' : 'ok';
        const expiryTitle = data.expired
            ? 'Expired'
            : data.notYetValid
                ? 'Not yet valid'
                : isExpiringSoon
                    ? 'Expiring soon'
                    : 'Not expiring soon';
        const expiryDetail = `${data.daysRemaining} days until expiration`;

        const protocolState = data.live && data.protocol !== UNKNOWN ? 'ok' : 'miss';
        const keyState = data.live && data.keySize !== UNKNOWN ? 'ok' : 'miss';
        const sigState = data.live && data.signature !== UNKNOWN ? 'ok' : 'miss';

        containerResults.innerHTML = `
            <div style="background: rgba(91, 157, 255, 0.05); border: 1px solid rgba(91, 157, 255, 0.2); border-radius: 10px; padding: 18px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div>
                    <div style="font-size: 18px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
                        <span style="color: ${statusColor};">●</span> Certificate ${statusLabel}
                    </div>
                    <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                        Target Domain: <strong style="color: #5B9DFF;">${escapeHtml(domain)}</strong>
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${escapeHtml(data.sourceLabel)}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 22px; font-weight: 800; color: ${daysColor};">
                        ${data.daysRemaining} Days
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted);">${daysCaption}</div>
                </div>
            </div>

            <div style="margin-bottom: 25px;">
                <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: var(--text-muted); margin-bottom: 6px;">
                    <span>Valid From: ${escapeHtml(data.validFrom)}</span>
                    <span>Valid Until: ${escapeHtml(data.validTo)}</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${progressPct}%; height: 100%; background: ${data.isValid ? '#3DDC84' : '#FF6B6B'}; border-radius: 3px;"></div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px;">
                    <h4 style="margin: 0 0 14px; font-size: 13px; font-weight: 700; color: #5B9DFF; text-transform: uppercase; letter-spacing: 0.5px;">Certificate Details</h4>
                    <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                        ${specRow('Domain', data.subject, false)}
                        ${specRow('Issuer', data.issuer, false)}
                        ${specRow('Valid From', data.validFrom, false)}
                        ${specRow('Valid To', data.validTo, false)}
                        ${specRow('Protocol', data.protocol, data.live)}
                        ${specRow('Key Size', data.keySize, false)}
                        ${specRow('Signature', data.signature, false)}
                    </table>
                </div>

                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px;">
                    <h4 style="margin: 0 0 14px; font-size: 13px; font-weight: 700; color: #3DDC84; text-transform: uppercase; letter-spacing: 0.5px;">Checks</h4>
                    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px;">
                        ${checkItem(validityState, validityTitle, validityDetail)}
                        ${checkItem(expiryState, expiryTitle, expiryDetail)}
                        ${checkItem(protocolState, 'TLS protocol', data.live ? data.protocol : 'Only available from a live handshake')}
                        ${checkItem(keyState, 'Key length', data.live ? data.keySize : 'Only available from a live handshake')}
                        ${checkItem(sigState, 'Signature algorithm', data.live ? data.signature : 'Only available from a live handshake')}
                    </div>
                </div>
            </div>
        `;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}
