const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

class KoreApiService {
    generateJWT(clientId, clientSecret, userId) {
        const payload = {
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
            jti: uuidv4(),
            iss: clientId,
            sub: userId || "redguard_admin",
            aud: "https://idproxy.kore.ai/authorize",
        };
        return jwt.sign(payload, clientSecret, { algorithm: 'HS256' });
    }

    async getLLMUsageLogs(config, filters) {
        // ... (existing code remains mostly same, just adding context)
        const { host = "platform.kore.ai", botId, clientId, clientSecret, inspectorClientId, inspectorClientSecret } = config;
        const effectiveClientId = inspectorClientId || clientId;
        const effectiveClientSecret = inspectorClientSecret || clientSecret;

        if (!botId || !effectiveClientId || !effectiveClientSecret) {
            throw new Error("Missing Bot Configuration (Bot ID, Client ID, Secret)");
        }

        const token = this.generateJWT(effectiveClientId, effectiveClientSecret);
        const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const url = `https://${cleanHost}/api/1.1/public/bot/${botId}/getLLMUsageLogs`;

        const payload = {
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            limit: filters.limit ? String(filters.limit) : "50",
            isDeveloper: true
        };

        if (filters.channelUserIds && Array.isArray(filters.channelUserIds) && filters.channelUserIds.length > 0) {
            payload.channelUserIds = filters.channelUserIds;
        }

        if (filters.sessionIds && Array.isArray(filters.sessionIds) && filters.sessionIds.length > 0) {
            payload.sessionIds = filters.sessionIds;
        }

        try {
            console.log(`Fetching LLM Logs from ${url} with ClientID: ${effectiveClientId.substring(0, 5)}...`);
            const response = await axios.post(url, payload, {
                headers: {
                    'auth': token,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            console.error("Kore API Error for:", effectiveClientId.substring(0, 5), error.response?.data || error.message);

            if (error.response?.status === 401 || error.response?.status === 403) {
                throw new Error(`Authentication Failed: ${error.response.data?.errors?.[0]?.msg || 'Invalid Credentials. Ensure your App has the "App Builder: Fetch Gen AI and LLM Usage Logs" scope.'}`);
            }
            throw new Error(`Failed to fetch logs: ${error.message}`);
        }
    }

    async getBotInfo(config) {
        const { host = "platform.kore.ai", botId, clientId, clientSecret, inspectorClientId, inspectorClientSecret } = config;

        // Use inspector credentials if available, otherwise fallback to chat credentials
        const effectiveClientId = inspectorClientId || clientId;
        const effectiveClientSecret = inspectorClientSecret || clientSecret;

        if (!effectiveClientId || !effectiveClientSecret) {
            throw new Error("Missing Client ID or Secret");
        }

        const token = this.generateJWT(effectiveClientId, effectiveClientSecret);
        const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');

        try {
            // Kore Public API to list bots
            // Note: This requires "Admin API Context" and "Role Management" scope usually
            const url = `https://${cleanHost}/api/public/bots`;

            console.log(`Attempting to fetch bot name for ${botId} from ${url}...`);
            const response = await axios.get(url, {
                headers: {
                    'auth': token,
                    'Content-Type': 'application/json'
                }
            });

            const bots = response.data.bots || [];
            const bot = bots.find(b => b._id === botId || b.id === botId);

            if (bot) {
                return {
                    name: bot.name,
                    id: bot._id,
                    valid: true
                };
            } else {
                return {
                    name: null,
                    id: botId,
                    valid: true, // Auth worked, but bot not in list (maybe different account?)
                    message: "Connection valid, but bot name not found in account list."
                };
            }
        } catch (error) {
            const status = error.response?.status;
            console.warn(`Kore Bot Info fetch failed (${status}):`, error.message);

            // If it's a 401/403, we know auth failed
            if (status === 401 || status === 403) {
                throw new Error("Authentication failed with provided credentials.");
            }

            // For other errors (like 404 or just scope restriction on /bots), 
            // we try a minimal "ping" to the logs API to at least verify credentials for the actual work we do
            try {
                const now = new Date().toISOString();
                await this.getLLMUsageLogs(config, { dateFrom: now, dateTo: now, limit: 1 });
                return {
                    name: null,
                    id: botId,
                    valid: true,
                    message: "Connection verified, but bot name retrieval restricted by scope."
                };
            } catch (pingError) {
                throw new Error(`Connection failed: ${pingError.message}`);
            }
        }
    }
}

module.exports = new KoreApiService();
