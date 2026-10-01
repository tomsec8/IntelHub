// Runs in the page's MAIN world context
console.log('[OPSECHub] mediaBlock.js (Camera & Mic Guard) INJECTED AND RUNNING!');
(function() {
    function installMediaBlockPatches(win) {
        if (!win || win.__patched_mb) return;
        try {
            win.__patched_mb = true;

            // Shared proxyMap so toString covers all patches.
            let proxyMap;
            try {
                let topWin;
                try { topWin = win.top || win; } catch(e) { topWin = win; }
                const sym = topWin.Symbol.for('__opsechub_proxymap');
                try {
                    void topWin.document;
                    if (!topWin[sym]) {
                        topWin[sym] = new topWin.WeakMap();
                    }
                    proxyMap = topWin[sym];
                } catch(e) {
                    if (!win[sym]) win[sym] = new win.WeakMap();
                    proxyMap = win[sym];
                }
            } catch(e) {
                proxyMap = new win.WeakMap(); // fallback
            }

            let toStringProxy;
            try {
                const toStringFlag = win.Symbol.for('__opsechub_toString_installed');
                if (!win[toStringFlag]) {
                    win[toStringFlag] = true;
                    const nativeToString = win.Function.prototype.toString;
                    toStringProxy = new win.Proxy(nativeToString, {
                        apply(target, thisArg, args) {
                            if (proxyMap.has(thisArg)) {
                                const name = thisArg.name || '';
                                if (name.startsWith('get ') || name.startsWith('set ')) {
                                    return 'function () { [native code] }';
                                }
                                return 'function ' + name + '() { [native code] }';
                            }
                            if (thisArg === toStringProxy) {
                                return 'function toString() { [native code] }';
                            }
                            return win.Reflect.apply(target, thisArg, args);
                        }
                    });
                
                    win.Object.defineProperty(win.Function.prototype, 'toString', {
                        value: toStringProxy,
                        configurable: true,
                        enumerable: false,
                        writable: true
                    });
                }
            } catch(e) {}

            function createProxyTrap(targetObj, methodName, handler) {
                try {
                    const descriptor = win.Object.getOwnPropertyDescriptor(targetObj, methodName);
                    const originalFn = descriptor ? descriptor.value : targetObj[methodName];
                    if (!originalFn) return originalFn;

                    const proxy = new win.Proxy(originalFn, handler);
                    win.Object.defineProperty(proxy, 'name', { value: originalFn.name, configurable: true });
                    win.Object.defineProperty(proxy, 'length', { value: originalFn.length, configurable: true });
                    proxyMap.set(proxy, true);

                    if (descriptor) {
                        win.Object.defineProperty(targetObj, methodName, {
                            value: proxy,
                            configurable: descriptor.configurable,
                            enumerable: descriptor.enumerable,
                            writable: descriptor.writable
                        });
                    } else {
                        win.Object.defineProperty(targetObj, methodName, {
                            value: proxy,
                            configurable: true,
                            writable: true
                        });
                    }
                    return originalFn; 
                } catch(e) {
                    return targetObj[methodName];
                }
            }

            function notifyBlock(action) {
                try {
                    const event = new win.CustomEvent('opsechub-block-event', {
                        detail: { module: 'mediaBlock', action: action }
                    });
                    win.dispatchEvent(event);
                } catch(e) {}
            }

            // 1. Intercept navigator.mediaDevices.enumerateDevices & getUserMedia
            if (win.navigator && win.navigator.mediaDevices) {
                createProxyTrap(win.navigator.mediaDevices, 'enumerateDevices', {
                    apply() {
                        return win.Promise.resolve([]); // Returns empty list of media devices silently
                    }
                });

                createProxyTrap(win.navigator.mediaDevices, 'getUserMedia', {
                    apply() {
                        notifyBlock('access camera/microphone');
                        return win.Promise.reject(
                            new win.DOMException('Camera & microphone blocked by OPSEC', 'NotAllowedError')
                        );
                    }
                });
            }

            // 2. Intercept legacy navigator.getUserMedia functions
            if (win.Navigator) {
                const legacyMethods = ['getUserMedia', 'webkitGetUserMedia', 'mozGetUserMedia', 'msGetUserMedia'];
                legacyMethods.forEach(method => {
                    if (win.navigator[method] || win.Navigator.prototype[method]) {
                        const target = win.navigator[method] ? win.navigator : win.Navigator.prototype;
                        createProxyTrap(target, method, {
                            apply(targetFn, thisArg, args) {
                                notifyBlock('access camera/microphone (legacy)');
                                const errorCallback = args[2] || args[1]; // usually getUserMedia(constraints, success, error)
                                if (typeof errorCallback === 'function') {
                                    const err = new win.DOMException(
                                        'Camera & microphone blocked by OPSEC',
                                        'NotAllowedError'
                                    );
                                    setTimeout(() => errorCallback(err), 0);
                                }
                                return undefined;
                            }
                        });
                    }
                });
            }

            // --- IFrame Getters (Realm Poisoning for Statically Defined Iframes) ---
            if (win.HTMLIFrameElement) {
                function hookIframeGetter(prop) {
                    try {
                        const desc = win.Object.getOwnPropertyDescriptor(win.HTMLIFrameElement.prototype, prop);
                        if (desc && desc.get) {
                            const proxyGet = new win.Proxy(desc.get, {
                                apply(target, thisArg, args) {
                                    const result = win.Reflect.apply(target, thisArg, args);
                                    if (result) {
                                        try {
                                            const targetWin = prop === 'contentWindow' ? result : result.defaultView;
                                            if (targetWin) installMediaBlockPatches(targetWin);
                                        } catch(e) {}
                                    }
                                    return result;
                                }
                            });
                            win.Object.defineProperty(proxyGet, 'name', { value: desc.get.name, configurable: true });
                            win.Object.defineProperty(proxyGet, 'length', { value: desc.get.length, configurable: true });
                            proxyMap.set(proxyGet, true);
                            win.Object.defineProperty(win.HTMLIFrameElement.prototype, prop, {
                                get: proxyGet,
                                set: desc.set,
                                enumerable: desc.enumerable,
                                configurable: desc.configurable
                            });
                        }
                    } catch(e) {}
                }
                hookIframeGetter('contentWindow');
                hookIframeGetter('contentDocument');
            }

            // --- DOM Methods (Realm Poisoning for Dynamically Appended Iframes) ---
            if (win.Node) {
                ['appendChild', 'insertBefore', 'replaceChild'].forEach(method => {
                    createProxyTrap(win.Node.prototype, method, {
                        apply(target, thisArg, args) {
                            const result = win.Reflect.apply(target, thisArg, args);
                            const node = args[0];
                            if (node && node.tagName === 'IFRAME') {
                                try { if (node.contentWindow) installMediaBlockPatches(node.contentWindow); } catch(e) {}
                                node.addEventListener('load', () => {
                                    try { if (node.contentWindow) installMediaBlockPatches(node.contentWindow); } catch(e) {}
                                });
                            }
                            return result;
                        }
                    });
                });
            }

            if (win.Document && win.Document.prototype.write) {
                createProxyTrap(win.Document.prototype, 'write', {
                    apply(target, thisArg, args) {
                        const result = win.Reflect.apply(target, thisArg, args);
                        try { if (thisArg.defaultView) installMediaBlockPatches(thisArg.defaultView); } catch(e) {}
                        return result;
                    }
                });
            }

        } catch(e) {
            console.error('[OPSECHub:MediaBlock] Error applying media block patches:', e);
        }
    }

    installMediaBlockPatches(window);
})();
