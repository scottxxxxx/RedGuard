/**
 * Bot Platform Registry
 *
 * Central registry for all bot platform integrations. To add a new platform:
 * 1. Create a new file (e.g., `amazon-lex-platform.js`) extending BasePlatform
 * 2. Register it here with platforms.register()
 * 3. That's it — chat and kore routes will pick it up automatically.
 *
 * Usage:
 *   const platforms = require('./bot-platforms');
 *   const platform = platforms.get('kore');           // KorePlatform instance
 *   const platform = platforms.get('dialogflow-cx');  // DialogflowCXPlatform instance
 *   const platform = platforms.get('generic');        // GenericRESTPlatform instance
 *   const all = platforms.list();                     // ['kore', 'dialogflow-cx', 'generic']
 */

const korePlatform = require('./kore-platform');
const dialogflowCXPlatform = require('./dialogflow-cx-platform');
const genericRESTPlatform = require('./generic-rest-platform');

const registry = new Map();

function register(platform) {
    registry.set(platform.name, platform);
}

function get(name) {
    return registry.get(name) || null;
}

function has(name) {
    return registry.has(name);
}

function list() {
    return Array.from(registry.keys());
}

/**
 * Get the default platform. Currently Kore.ai.
 * Used when no platform is explicitly specified in the request.
 */
function getDefault() {
    return korePlatform;
}

// Register built-in platforms
register(korePlatform);
register(dialogflowCXPlatform);
register(genericRESTPlatform);

module.exports = { register, get, has, list, getDefault };
