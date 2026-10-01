/**
 * WebRTC IP Leak Prevention Module
 * Forces WebRTC traffic to use TCP and only via a proxy,
 * effectively blocking local and public IP leaks.
 */

const brw = typeof browser !== 'undefined' ? browser : chrome;

export default {
    /**
     * Toggles the WebRTC IP handling policy.
     * @param {boolean} enabled 
     */
    async toggle(enabled) {
        if (brw.privacy && brw.privacy.network) {
            if (enabled) {
                brw.storage.local.get({ webrtcPolicy: 'disable_non_proxied_udp' }, (data) => {
                    brw.privacy.network.webRTCIPHandlingPolicy.set({
                        value: data.webrtcPolicy
                    }, () => {
                        if (brw.runtime.lastError) {
                            console.error('[OPSECHub:WebRTC] Failed to set policy:', brw.runtime.lastError);
                        } else {
                            console.log(`[OPSECHub:WebRTC] Policy set to: ${data.webrtcPolicy}`);
                        }
                    });
                });
            } else {
                brw.privacy.network.webRTCIPHandlingPolicy.set({
                    value: 'default'
                }, () => {
                    if (brw.runtime.lastError) {
                        console.error('[OPSECHub:WebRTC] Failed to reset policy:', brw.runtime.lastError);
                    } else {
                        console.log('[OPSECHub:WebRTC] Policy reset to default');
                    }
                });
            }
        } else {
            console.warn('[OPSECHub:WebRTC] privacy.network API is not available.');
        }

        try {
            const existing = await brw.scripting.getRegisteredContentScripts({ ids: ['webrtcBlock'] });
            if (enabled) {
                if (existing.length === 0) {
                    await brw.scripting.registerContentScripts([{
                        id: 'webrtcBlock',
                        matches: ["<all_urls>"],
                        js: ['modules/opsecHub/webrtc/inject.js'],
                        runAt: 'document_start',
                        world: 'MAIN',
                        allFrames: true,
                        matchOriginAsFallback: true
                    }]);
                    console.log(`[OPSECHub:WebRTC] Inject script ENABLED`);
                }
            } else {
                if (existing.length > 0) {
                    await brw.scripting.unregisterContentScripts({ ids: ['webrtcBlock'] });
                    console.log(`[OPSECHub:WebRTC] Inject script DISABLED`);
                }
            }
        } catch (e) {
            console.warn(`[OPSECHub:WebRTC] Error toggling inject script:`, e);
        }
    }
};
