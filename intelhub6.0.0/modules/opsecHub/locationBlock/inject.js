// Runs in the page's MAIN world context
(function() {
    console.log('[OPSECHub] locationBlock.js INJECTED AND RUNNING!');

    function installLocationPatches(win) {
        if (!win || win.__opsechub_location_patched) return;
        try {
            win.__opsechub_location_patched = true;

            function notifyBlock(action) {
                try {
                    const event = new win.CustomEvent('opsechub-block-event', {
                        detail: { module: 'locationBlock', action: action }
                    });
                    win.dispatchEvent(event);
                } catch(e) {}
            }

            // Real Error (not a plain {}) so sites show a readable message
            // instead of trailing "Object" from constructor.name / String(obj).
            function createGeoDeniedError(win) {
                const message = 'Location access blocked by OPSEC';
                const err = new win.Error(message);
                try {
                    win.Object.defineProperties(err, {
                        name: { value: 'GeolocationPositionError', configurable: true },
                        code: { value: 1, configurable: true },
                        message: { value: message, configurable: true },
                        PERMISSION_DENIED: { value: 1 },
                        POSITION_UNAVAILABLE: { value: 2 },
                        TIMEOUT: { value: 3 }
                    });
                } catch (e) {
                    err.name = 'GeolocationPositionError';
                    err.code = 1;
                }
                return err;
            }

            const originalGeolocation = win.Object.getOwnPropertyDescriptor(win.Navigator.prototype, 'geolocation');
            if (originalGeolocation && originalGeolocation.get) {
                const originalGeoObj = originalGeolocation.get.call(win.navigator);
                const spoofedGeo = win.Object.create(originalGeoObj);
                
                spoofedGeo.getCurrentPosition = function(successCallback, errorCallback, options) {
                    notifyBlock('access geolocation location');
                    win.setTimeout(() => {
                        if (errorCallback) {
                            errorCallback(createGeoDeniedError(win));
                        }
                    }, 50);
                };

                spoofedGeo.watchPosition = function(successCallback, errorCallback, options) {
                    notifyBlock('access geolocation location');
                    const watchId = win.Math.floor(win.Math.random() * 100000) + 1;
                    
                    const triggerWatch = () => {
                        if (errorCallback) {
                            errorCallback(createGeoDeniedError(win));
                        }
                    };

                    win.setTimeout(triggerWatch, 50);
                    const intervalId = win.setInterval(triggerWatch, 10000);
                    
                    if (!win.__opsechub_watches) win.__opsechub_watches = {};
                    win.__opsechub_watches[watchId] = intervalId;

                    return watchId;
                };

                spoofedGeo.clearWatch = function(watchId) {
                    if (win.__opsechub_watches && win.__opsechub_watches[watchId]) {
                        win.clearInterval(win.__opsechub_watches[watchId]);
                        delete win.__opsechub_watches[watchId];
                    } else if (originalGeoObj.clearWatch) {
                        originalGeoObj.clearWatch(win.navigator.geolocation, watchId);
                    }
                };

                win.Object.defineProperty(win.Navigator.prototype, 'geolocation', {
                    get: function() { return spoofedGeo; },
                    configurable: true,
                    enumerable: true
                });
            }
        } catch(e) {}
    }

    // Apply to current main window
    installLocationPatches(window);

    // Apply to dynamically created iframes
    try {
        const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow').get;
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
            get: function() {
                const win = originalContentWindow.call(this);
                try {
                    if (win && !win.__opsechub_location_patched) {
                        installLocationPatches(win);
                    }
                } catch(e) {}
                return win;
            },
            configurable: true,
            enumerable: true
        });
    } catch(e) {}
})();
