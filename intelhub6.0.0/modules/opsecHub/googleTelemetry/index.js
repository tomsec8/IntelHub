const brw = typeof browser !== 'undefined' ? browser : chrome;

const DNR_RULE_ID = 900002;

export default {
    async toggle(enabled) {
        try {
            if (!enabled) {
                await brw.declarativeNetRequest.updateSessionRules({ removeRuleIds: [DNR_RULE_ID] });
                console.log('[OPSECHub:GoogleTelemetry] Disabled');
                return;
            }

            const globalRule = {
                id: DNR_RULE_ID,
                priority: 200,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        { header: 'X-Client-Data', operation: 'remove' },
                        { header: 'X-Browser-Channel', operation: 'remove' },
                        { header: 'X-Browser-Copyright', operation: 'remove' },
                        { header: 'X-Browser-Validation', operation: 'remove' },
                        { header: 'X-Browser-Year', operation: 'remove' },
                        { header: 'X-Chrome-Id-Consistency-Request', operation: 'remove' },
                        { header: 'X-Chrome-Connected', operation: 'remove' }
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
                addRules: [globalRule]
            });
            console.log('[OPSECHub:GoogleTelemetry] Enabled - X-Client-Data stripped globally');
        } catch (e) {
            console.error('[OPSECHub:GoogleTelemetry] Error:', e);
        }
    }
};
