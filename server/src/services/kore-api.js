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
        // Support separate credentials for Inspector
        const { host = "platform.kore.ai", botId, clientId, clientSecret, inspectorClientId, inspectorClientSecret } = config;

        // Use Inspector credentials if provided, otherwise fallback to Chat credentials
        const effectiveClientId = inspectorClientId || clientId;
        const effectiveClientSecret = inspectorClientSecret || clientSecret;

        if (!botId || !effectiveClientId || !effectiveClientSecret) {
            throw new Error("Missing Bot Configuration (Bot ID, Client ID, Secret)");
        }

        const token = this.generateJWT(effectiveClientId, effectiveClientSecret);

        // Ensure host format
        const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const url = `https://${cleanHost}/api/1.1/public/bot/${botId}/getLLMUsageLogs`;

        const payload = {
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            limit: filters.limit ? String(filters.limit) : "50",
            // featureName: ["Agent Node", "Guardrails"],
            isDeveloper: true
        };

        // Add channelUserIds filter if provided
        if (filters.channelUserIds && Array.isArray(filters.channelUserIds) && filters.channelUserIds.length > 0) {
            payload.channelUserIds = filters.channelUserIds;
        }

        // Add sessionIds filter if provided (for filtering by Kore session ID)
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
}

module.exports = new KoreApiService();
