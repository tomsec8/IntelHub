const brw = typeof browser !== 'undefined' ? browser : chrome;

export default {
    async toggle(enabled) {
        try {
            const existing = await brw.scripting.getRegisteredContentScripts({ ids: ['clipboardGuard'] });
            if (enabled) {
                if (existing.length === 0) {
                    await brw.scripting.registerContentScripts([{
                        id: 'clipboardGuard',
                        matches: ["<all_urls>"],
                        js: ['modules/opsecHub/clipboardGuard/inject.js'],
                        runAt: 'document_start',
                        world: 'MAIN',
                        allFrames: true,
                        matchOriginAsFallback: true
                    }]);
                    console.log(`[OPSECHub:ClipboardGuard] Inject script ENABLED`);
                }
            } else {
                if (existing.length > 0) {
                    await brw.scripting.unregisterContentScripts({ ids: ['clipboardGuard'] });
                    console.log(`[OPSECHub:ClipboardGuard] Inject script DISABLED`);
                }
            }
        } catch (e) {
            console.warn(`[OPSECHub:ClipboardGuard] Error toggling inject script:`, e);
        }
    }
};
