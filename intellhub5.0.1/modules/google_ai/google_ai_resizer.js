// This script is injected into the Google AI iframe to measure its height
// and send it back to the parent extension popup. This allows the popup
// to resize the iframe dynamically, eliminating double scrollbars.

let lastSentHeight = 0;
let lastSentContentHeight = 0;
let debounceTimer;
let isInitialLoad = true;

function sendHeight() {
    clearTimeout(debounceTimer);

    // During initial page load, wait longer before sending height to prevent jitter
    const delay = isInitialLoad ? 800 : 200;

    debounceTimer = setTimeout(() => {
        // Full page height (for iframe sizing)
        const fullHeight = Math.max(
            document.documentElement.offsetHeight,
            document.body.offsetHeight
        );

        // Content height EXCLUDING sources section (for auto-scroll target).
        // We find #botstuff or #bres (sources containers) and subtract their height.
        let sourcesHeight = 0;
        const botstuff = document.getElementById('botstuff');
        const bres = document.getElementById('bres');
        const rhs = document.getElementById('rhs');
        if (botstuff) sourcesHeight = Math.max(sourcesHeight, botstuff.offsetHeight);
        if (bres) sourcesHeight = Math.max(sourcesHeight, bres.offsetHeight);
        if (rhs) sourcesHeight = Math.max(sourcesHeight, rhs.offsetHeight);

        const contentHeight = Math.max(fullHeight - sourcesHeight, 200);

        // Only send if height changed meaningfully
        if (Math.abs(fullHeight - lastSentHeight) > 10 || Math.abs(contentHeight - lastSentContentHeight) > 10) {
            // If the browser suspends the tab or hides the iframe, offsetHeight can drop to 0.
            // Ignore these artificial shrinking events to prevent scroll jumping.
            if (fullHeight < 100) {
                return;
            }

            // During initial load, only allow height to GROW (prevents wild shrinking)
            if (isInitialLoad && fullHeight < lastSentHeight) {
                return;
            }
            lastSentHeight = fullHeight;
            lastSentContentHeight = contentHeight;
            window.parent.postMessage({
                type: 'RESIZE_IFRAME',
                height: fullHeight,
                contentHeight: contentHeight
            }, '*');
        }
    }, delay);
}

// Mark initial load as done after page fully settles
function markLoadComplete() {
    setTimeout(() => {
        isInitialLoad = false;
    }, 2000);
}

// Send initial height
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        sendHeight();
        markLoadComplete();
    });
} else {
    sendHeight();
    markLoadComplete();
}

// Use ResizeObserver to track dimension changes
const resizeObserver = new ResizeObserver(() => {
    sendHeight();
});

// Start observing
if (document.body) {
    resizeObserver.observe(document.body);
} else {
    document.addEventListener('DOMContentLoaded', () => {
        resizeObserver.observe(document.body);
    });
}

// Intercept all link and image clicks to ensure a clean experience
document.addEventListener('click', function (e) {
    const link = e.target.closest('a');
    
    if (link && link.href && link.href.startsWith('http')) {
        try {
            const url = new URL(link.href);
            // Check if the link contains visible text (like follow-up questions)
            const hasText = link.textContent.trim().length > 0;
            
            // Allow internal Google Search links ONLY if they have text
            // The 3-dots menu is just an SVG icon without text, so it will bypass this and open outside!
            if (url.hostname.includes('google.com') && url.pathname.startsWith('/search')) {
                if (hasText) {
                    return; // Let Google handle it internally
                }
            }

            // For all other links (sources, external sites, /url redirects, and 3-dots menu), force a new tab
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            window.open(link.href, '_blank');
        } catch (err) {
            console.error('Error handling link click', err);
        }
        return; // Stop processing further if it was a link
    }

    // Handle clicks on images (like uploaded images) to prevent Google's broken full-height modal
    const img = e.target.closest('img');
    if (img && img.src) {
        // Ignore tiny UI icons, only target actual thumbnails/images (larger than 30x30)
        if (img.clientWidth > 30 && img.clientHeight > 30) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Open the image cleanly in a custom dark-mode preview tab
            const newWindow = window.open('', '_blank');
            if (newWindow) {
                newWindow.document.write(`
                    <html style="background:#1e1e2e; height:100%; font-family:sans-serif;">
                    <head><title>Image Preview</title></head>
                    <body style="margin:0; display:flex; align-items:center; justify-content:center; height:100%; width:100%;">
                        <img src="${img.src}" style="max-width:90vw; max-height:90vh; object-fit:contain; border-radius:8px; box-shadow:0 10px 40px rgba(0,0,0,0.6);">
                    </body>
                    </html>
                `);
                newWindow.document.close();
            }
        }
    }
}, true); // Use capture phase to intercept before Google's React/JS handlers


