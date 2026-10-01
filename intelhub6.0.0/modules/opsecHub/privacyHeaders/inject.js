// Runs in the page's MAIN world context
(function () {
    function installPrivacyPatches(win) {
        if (!win || win.__opsechub_privacy_patched) return;
        try {
            win.__opsechub_privacy_patched = true;

            // Enforce Do Not Track
            win.Object.defineProperty(win.navigator, 'doNotTrack', {
                get: () => "1",
                configurable: true,
                enumerable: true
            });

            // Enforce Global Privacy Control
            win.Object.defineProperty(win.navigator, 'globalPrivacyControl', {
                get: () => true,
                configurable: true,
                enumerable: true
            });
        } catch (e) {}
    }

    // Patch current main window
    installPrivacyPatches(window);

    // Patch dynamic iframes when their windows or documents are accessed
    try {
        const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow').get;
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
            get: function() {
                const win = originalContentWindow.call(this);
                try {
                    if (win && !win.__opsechub_privacy_patched) {
                        installPrivacyPatches(win);
                    }
                } catch(e) {}
                return win;
            },
            configurable: true,
            enumerable: true
        });
    } catch(e) {}

    try {
        const originalContentDoc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument').get;
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
            get: function() {
                const doc = originalContentDoc.call(this);
                try {
                    if (doc && doc.defaultView && !doc.defaultView.__opsechub_privacy_patched) {
                        installPrivacyPatches(doc.defaultView);
                    }
                } catch(e) {}
                return doc;
            },
            configurable: true,
            enumerable: true
        });
    } catch(e) {}
})();
