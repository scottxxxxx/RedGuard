const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

/**
 * Shared Kore.ai JWT generation.
 *
 * Three usage patterns exist in the codebase:
 * 1. API calls (kore-api.js) — needs appId, sub=userId, jti, exp
 * 2. Webhook (kore-webhook.js) — needs isAnonymous, jti, sub=userId (factory pattern)
 * 3. Backup (backup-service.js) — needs appId, sub=clientId, exp
 *
 * This module provides a single function that covers all three via options.
 */

const KORE_AUDIENCE = 'https://idproxy.kore.ai/authorize';

/**
 * Generate a signed JWT for Kore.ai APIs.
 *
 * @param {string} clientId - The Kore.ai app client ID
 * @param {string} clientSecret - The Kore.ai app client secret
 * @param {object} [options]
 * @param {string} [options.sub] - Subject claim (defaults to clientId)
 * @param {boolean} [options.includeAppId] - Include appId field (for Platform API calls)
 * @param {boolean} [options.includeJti] - Include jti (unique token ID) field
 * @param {boolean} [options.includeExpiry] - Include exp claim (1 hour)
 * @param {boolean} [options.includeIsAnonymous] - Include isAnonymous: false (for Webhook)
 * @returns {string} Signed JWT token
 */
function generateKoreJwt(clientId, clientSecret, options = {}) {
    const {
        sub = clientId,
        includeAppId = false,
        includeJti = true,
        includeExpiry = true,
        includeIsAnonymous = false
    } = options;

    const now = Math.floor(Date.now() / 1000);

    const payload = {
        iat: now,
        iss: clientId,
        sub,
        aud: KORE_AUDIENCE
    };

    if (includeAppId) payload.appId = clientId;
    if (includeJti) payload.jti = uuidv4();
    if (includeExpiry) payload.exp = now + 3600;
    if (includeIsAnonymous) payload.isAnonymous = false;

    return jwt.sign(payload, clientSecret, { algorithm: 'HS256' });
}

/**
 * Create a JWT factory that generates user-specific tokens (for Webhook).
 * Returns a function: (userId) => token
 */
function createKoreJwtFactory(clientId, clientSecret) {
    return (userId) => generateKoreJwt(clientId, clientSecret, {
        sub: userId,
        includeJti: true,
        includeExpiry: false,
        includeIsAnonymous: true
    });
}

module.exports = { generateKoreJwt, createKoreJwtFactory };
