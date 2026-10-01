// Runs in the page's MAIN world context
(function() {
    console.log('[OPSECHub] clipboardGuard.js INJECTED AND RUNNING!');

    function installClipboardPatches(win) {
        if (!win || win.__opsechub_clipboard_patched) return;
        try {
            win.__opsechub_clipboard_patched = true;

            function notifyBlock(action) {
                try {
                    const event = new win.CustomEvent('opsechub-block-event', {
                        detail: { module: 'clipboardGuard', action: action }
                    });
                    win.dispatchEvent(event);
                } catch(e) {}
            }

            // 1. Clean data on copy event to strip zero-width characters and homoglyphs
            if (win.DataTransfer && win.DataTransfer.prototype.setData) {
                const originalSetData = win.DataTransfer.prototype.setData;
                win.DataTransfer.prototype.setData = function(format, data) {
                    if (format === 'text/plain' || format === 'text') {
                        if (typeof data === 'string') {
                            data = data.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E]/g, '');
                        }
                    }
                    return originalSetData.call(this, format, data);
                };
            }

            // 2. Protect clipboard reading via Navigator.prototype.clipboard
            const originalClipboardDesc = win.Object.getOwnPropertyDescriptor(win.Navigator.prototype, 'clipboard');
            if (originalClipboardDesc && originalClipboardDesc.get) {
                const originalClipboard = originalClipboardDesc.get.call(win.navigator);
                const clipboardProxy = new win.Proxy(originalClipboard, {
                    get(target, prop) {
                        if (prop === 'readText') {
                            return function() {
                                notifyBlock('read clipboard text');
                                return win.Promise.reject(
                                    new win.DOMException('Clipboard read blocked by OPSEC', 'NotAllowedError')
                                );
                            };
                        }
                        if (prop === 'read') {
                            return function() {
                                notifyBlock('read clipboard data');
                                return win.Promise.reject(
                                    new win.DOMException('Clipboard read blocked by OPSEC', 'NotAllowedError')
                                );
                            };
                        }
                        const val = target[prop];
                        if (typeof val === 'function') {
                            return val.bind(target);
                        }
                        return val;
                    }
                });

                win.Object.defineProperty(win.Navigator.prototype, 'clipboard', {
                    get: function() { return clipboardProxy; },
                    configurable: true,
                    enumerable: true
                });
            }

            // 3. Block document.execCommand('paste')
            if (win.Document && win.Document.prototype.execCommand) {
                const originalExecCommand = win.Document.prototype.execCommand;
                win.Document.prototype.execCommand = function(command, showUI, value) {
                    if (command && command.toLowerCase() === 'paste') {
                        notifyBlock('paste text');
                        return false;
                    }
                    return originalExecCommand.call(this, command, showUI, value);
                };
            }

        } catch(e) {}
    }

    // Apply to current main window
    installClipboardPatches(window);

    // Apply to dynamically created iframes
    try {
        const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow').get;
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
            get: function() {
                const win = originalContentWindow.call(this);
                try {
                    if (win && !win.__opsechub_clipboard_patched) {
                        installClipboardPatches(win);
                    }
                } catch(e) {}
                return win;
            },
            configurable: true,
            enumerable: true
        });
    } catch(e) {}
})();
