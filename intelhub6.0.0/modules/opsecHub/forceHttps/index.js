/**
 * OPSECHub - Force HTTPS Module
 * Upgrades all HTTP connections to HTTPS, excluding local networks and Tor/I2P.
 */

const brw = typeof browser !== 'undefined' ? browser : chrome;

const RULE_IDS = [500000];

async function enable() {
    try {
        await brw.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: RULE_IDS,
            addRules: [
                {
                    // Main Upgrade Rule
                    id: 500000,
                    priority: 1,
                    action: { type: 'upgradeScheme' },
                    condition: {
                        urlFilter: 'http://*',
                        excludedRequestDomains: ['localhost', '127.0.0.1', 'onion', 'i2p', 'local', 'ip-api.com'],
                        resourceTypes: [
                            'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font',
                            'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other'
                        ]
                    }
                }
            ]
        });
        console.log('[OPSECHub] Force HTTPS ENABLED');
    } catch (e) {
        console.error('[OPSECHub:ForceHTTPS] Failed to enable:', e);
    }
}

async function disable() {
    try {
        await brw.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: RULE_IDS
        });
        console.log('[OPSECHub] Force HTTPS DISABLED');
    } catch (e) {
        console.error('[OPSECHub:ForceHTTPS] Failed to disable:', e);
    }
}

export default {
    toggle: (enabled) => enabled ? enable() : disable()
};
