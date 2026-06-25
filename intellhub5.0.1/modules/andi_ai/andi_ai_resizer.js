let lastSentHeight = 0;
let debounceTimer;

function sendHeight() {
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
        const fullHeight = Math.max(
            document.documentElement.offsetHeight,
            document.body.offsetHeight
        );

        if (Math.abs(fullHeight - lastSentHeight) > 10) {
            if (fullHeight < 100) return; // ignore artificial shrinking when hidden

            lastSentHeight = fullHeight;
            window.parent.postMessage({
                type: 'RESIZE_ANDI_IFRAME',
                height: fullHeight
            }, '*');
        }
    }, 200);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendHeight);
} else {
    sendHeight();
}

const resizeObserver = new ResizeObserver(sendHeight);
if (document.body) {
    resizeObserver.observe(document.body);
} else {
    document.addEventListener('DOMContentLoaded', () => {
        resizeObserver.observe(document.body);
    });
}

// Intercept all link clicks to ensure external links open in a new tab
document.addEventListener('click', function (e) {
    const link = e.target.closest('a');
    if (link && link.href && link.href.startsWith('http')) {
        try {
            const url = new URL(link.href);
            // Allow internal links to work normally
            if (url.hostname.includes('andisearch.com')) {
                return; // Let it handle internal navigation natively
            }

            // For all external sources, force a new tab
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            window.open(link.href, '_blank');
        } catch (err) {
            console.error('Error handling link click', err);
        }
    }
}, true); // Use capture phase

// Intercept wheel events to allow scrolling parent window
window.addEventListener('wheel', function(e) {
    const isTextInput = e.target.closest('textarea, input, [contenteditable="true"], [role="textbox"], pre, code');
    if (!isTextInput && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        e.stopPropagation();
        
        window.parent.postMessage({
            type: 'FORCE_SCROLL_PARENT_ANDI',
            deltaY: e.deltaY
        }, '*');
    }
}, { passive: false, capture: true });
