// Runs in the page's MAIN world context
console.log('[OPSECHub] webrtc.js (WebRTC Leak Block Notification) INJECTED AND RUNNING!');
(function() {
    function installWebRTCPatches(win) {
        if (!win || win.__patched_rtc) return;
        try {
            win.__patched_rtc = true;

            const OriginalRTCPeerConnection = win.RTCPeerConnection || win.webkitRTCPeerConnection || win.mozRTCPeerConnection;
            if (OriginalRTCPeerConnection) {
                const proxyHandler = {
                    construct(target, args) {
                        try {
                            const event = new win.CustomEvent('opsechub-block-event', {
                                detail: { module: 'webrtcBlock', action: 'leak IP address via WebRTC' }
                            });
                            win.dispatchEvent(event);
                        } catch(e) {}
                        return win.Reflect.construct(target, args);
                    }
                };

                const proxy = new win.Proxy(OriginalRTCPeerConnection, proxyHandler);
                
                if (win.RTCPeerConnection) win.RTCPeerConnection = proxy;
                if (win.webkitRTCPeerConnection) win.webkitRTCPeerConnection = proxy;
                if (win.mozRTCPeerConnection) win.mozRTCPeerConnection = proxy;
            }
        } catch(e) {}
    }

    installWebRTCPatches(window);
})();
