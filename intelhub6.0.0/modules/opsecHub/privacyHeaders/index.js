const brw = typeof browser !== 'undefined' ? browser : chrome;

const DNR_RULE_ID = 900003;

export default {
    async toggle(enabled) {
        try {
            if (!enabled) {
                await brw.declarativeNetRequest.updateSessionRules({ removeRuleIds: [DNR_RULE_ID] });
                try { await brw.scripting.unregisterContentScripts({ ids: ['privacyDOM'] }); } catch (e) { }
                console.log('[OPSECHub:PrivacyHeaders] Disabled');
                return;
            }

            const rule = {
                id: DNR_RULE_ID,
                priority: 150,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        { header: 'DNT', operation: 'set', value: '1' },
                        { header: 'Sec-GPC', operation: 'set', value: '1' }
                    ]
                },
                condition: {
                    resourceTypes: [
                        'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font',
                        'object', 'xmlhttprequest', 'ping', 'websocket', 'other'
                    ]
                }
            };

            await brw.declarativeNetRequest.updateSessionRules({
                removeRuleIds: [DNR_RULE_ID],
                addRules: [rule]
            });
            try {
                const registered = await brw.scripting.getRegisteredContentScripts({ ids: ['privacyDOM'] });
                if (registered.length > 0) {
                    console.log('[OPSECHub:PrivacyHeaders] Enabled - DNT & Sec-GPC active');
                    return;
                }
            } catch {
                /* Firefox may not list the script; registration below settles it. */
            }
            try {
                await brw.scripting.registerContentScripts([{
                    id: 'privacyDOM',
                    js: ['modules/opsecHub/privacyHeaders/inject.js'],
                    matches: ['<all_urls>'],
                    world: 'MAIN',
                    runAt: 'document_start',
                    allFrames: true,
                    matchOriginAsFallback: true
                }]);
            } catch (err) {
                if (!/already registered/i.test(err?.message || '')) throw err;
            }
            console.log('[OPSECHub:PrivacyHeaders] Enabled - DNT & Sec-GPC active');
        } catch (e) {
            console.error('[OPSECHub:PrivacyHeaders] Error:', e);
        }
    }
};
