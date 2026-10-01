// Tool: Short Link Tracer (CORS-immune background redirect resolver)
function initLinkTracerTool() {
    const txtUrl = document.getElementById('txt-tracer-url');
    const traceBtn = document.getElementById('btn-trace-url');
    const resultBox = document.getElementById('result-link-tracer');
    const listHops = document.getElementById('list-tracer-hops');
    const statusEl = document.getElementById('status-link-tracer');

    if (!traceBtn || !txtUrl) return;

    // Security: Escape HTML entities to prevent XSS via malicious redirect URLs
    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    traceBtn.addEventListener('click', () => {
        let url = txtUrl.value.trim();
        if (!url) {
            statusEl.textContent = 'Please enter a valid URL.';
            statusEl.style.color = '#ff453a';
            return;
        }

        if (!/^https?:\/\//i.test(url)) {
            url = 'http://' + url;
        }

        statusEl.textContent = 'Checking permission…';
        statusEl.style.color = '#5B9DFF';
        resultBox.style.display = 'block';
        listHops.innerHTML = '';

        const runTrace = () => {
            statusEl.textContent = 'Tracing each HTTP redirect hop…';
            chrome.runtime.sendMessage({
                action: 'trace_redirects_background',
                url: url
            }, (res) => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                    statusEl.textContent = 'Background connection lost.';
                    statusEl.style.color = '#ff453a';
                    return;
                }

                if (res && res.success && Array.isArray(res.hops) && res.hops.length) {
                    const hops = res.hops.map((hop) =>
                        typeof hop === 'string' ? { url: hop, status: 0 } : hop
                    );
                    const last = hops[hops.length - 1];
                    const lastIsRedirect = last.status >= 300 && last.status < 400;

                    hops.forEach((hop, idx) => {
                        const li = document.createElement('li');
                        li.style.cssText = 'padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); font-family: monospace; font-size: 12px; color: #b0bec5; word-break: break-all;';
                        const url = escapeHtml(hop.url || '');
                        const statusLabel = hop.status
                            ? `<span style="color:#9aa7b2;"> [${hop.status}]</span>`
                            : '';
                        const note = hop.note
                            ? ` <span style="color:#ff9f43;">(${escapeHtml(hop.note)})</span>`
                            : '';
                        const isLast = idx === hops.length - 1;

                        if (idx === 0 && !isLast) {
                            li.innerHTML = `<strong>Start:</strong>${statusLabel} <span style="color: #FF9F43;">${url}</span>${note}`;
                        } else if (isLast && !lastIsRedirect && hops.length > 1) {
                            li.innerHTML = `<strong>Final Destination:</strong>${statusLabel} <span style="color: #30d158; font-weight: bold;">${url}</span>${note}`;
                        } else if (isLast && lastIsRedirect) {
                            li.innerHTML = `<strong>Stopped:</strong>${statusLabel} <span style="color: #FF9F43;">${url}</span>${note}`;
                        } else if (isLast) {
                            li.innerHTML = `<strong>Reached:</strong>${statusLabel} <span style="color: #30d158; font-weight: bold;">${url}</span>${note}`;
                        } else {
                            li.innerHTML = `<strong>Hop ${idx}:</strong>${statusLabel} → <span style="color: #5B9DFF;">${url}</span>${note}`;
                        }
                        listHops.appendChild(li);
                    });

                    if (hops.length === 1 && !lastIsRedirect) {
                        statusEl.textContent = last.status
                            ? `No HTTP redirect (${last.status}). JavaScript or meta-refresh hops are not followed.`
                            : 'Trace finished with a single URL.';
                    } else {
                        statusEl.textContent = `Redirect trace complete (${hops.length} hop${hops.length === 1 ? '' : 's'}).`;
                    }
                    statusEl.style.color = '#30d158';
                } else {
                    statusEl.textContent = 'Redirection trace failed. Host offline or unreachable.';
                    statusEl.style.color = '#ff453a';

                    const li = document.createElement('li');
                    li.style.cssText = 'padding: 8px; font-family: monospace; font-size: 12px; color: #ff453a;';
                    li.textContent = `Error details: ${res ? res.error : 'No response from service worker.'}`;
                    listHops.appendChild(li);
                }
            });
        };

        import(chrome.runtime.getURL('modules/opsecHub/js/optional-permissions.mjs'))
            .then(({ ensureFeaturePermissions, showPermToast }) =>
                ensureFeaturePermissions('linkTracer').then((result) => {
                    if (!result.granted) {
                        statusEl.textContent = 'Permission declined — tracer stays off. Try again anytime.';
                        statusEl.style.color = '#ff453a';
                        showPermToast('Link tracer permission declined. Try again anytime.', { isError: true });
                        return;
                    }
                    runTrace();
                })
            )
            .catch((err) => {
                console.error(err);
                statusEl.textContent = 'Could not request permission.';
                statusEl.style.color = '#ff453a';
            });
    });
}
