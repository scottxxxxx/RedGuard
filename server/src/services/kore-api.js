const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

class KoreApiService {
    generateJWT(clientId, clientSecret, userId) {
        const payload = {
            appId: clientId,  // Required for API authentication
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
            jti: uuidv4(),
            iss: clientId,
            sub: userId || "redguard_admin",
            aud: "https://idproxy.kore.ai/authorize",
        };
        console.log(`[DEBUG] JWT Payload:`, JSON.stringify(payload, null, 2));
        const token = jwt.sign(payload, clientSecret, { algorithm: 'HS256' });
        return token;
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

    async exportBot(config) {
        const { host = "platform.kore.ai", botId, clientId, clientSecret } = config;

        if (!botId || !clientId || !clientSecret) {
            throw new Error("Missing Bot Configuration (Bot ID, Client ID, Secret)");
        }

        const token = this.generateJWT(clientId, clientSecret);
        const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');

        try {
            // Initiate bot export
            const exportUrl = `https://${cleanHost}/api/public/bot/${botId}/export`;

            console.log(`[DEBUG] Initiating App Definition export from ${exportUrl}...`);
            const exportResponse = await axios.post(exportUrl, {
                exportType: 'published', // or 'inDevelopment'
            }, {
                headers: {
                    'auth': token,
                    'Content-Type': 'application/json'
                }
            });

            const exportId = exportResponse.data.exportId || exportResponse.data._id;
            console.log(`[DEBUG] App Definition export initiated with ID: ${exportId}`);

            // Poll for export completion (max 30 seconds)
            const maxAttempts = 30;
            let attempt = 0;

            while (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

                const statusUrl = `https://${cleanHost}/api/public/bot/${botId}/export/${exportId}`;
                const statusResponse = await axios.get(statusUrl, {
                    headers: {
                        'auth': token,
                        'Content-Type': 'application/json'
                    }
                });

                const status = statusResponse.data.status || statusResponse.data.exportStatus;
                console.log(`[DEBUG] Export status check ${attempt + 1}/${maxAttempts}: ${status}`);

                if (status === 'success' || status === 'completed') {
                    // Download the exported App Definition
                    const downloadUrl = statusResponse.data.downloadURL || statusResponse.data.fileId;

                    if (downloadUrl) {
                        console.log(`[DEBUG] Downloading App Definition from: ${downloadUrl}`);
                        const botDefResponse = await axios.get(downloadUrl, {
                            headers: { 'auth': token }
                        });

                        return botDefResponse.data; // Return the App Definition
                    } else {
                        throw new Error("App Definition export completed but no download URL provided");
                    }
                } else if (status === 'failed' || status === 'error') {
                    throw new Error(`App Definition export failed: ${statusResponse.data.message || 'Unknown error'}`);
                }

                attempt++;
            }

            throw new Error("App Definition export timed out after 30 seconds");
        } catch (error) {
            const status = error.response?.status;
            const errorData = error.response?.data;

            console.error(`[DEBUG] App Definition export failed (${status}):`, error.message);
            console.log(`[DEBUG] Kore.ai Error Response:`, JSON.stringify(errorData, null, 2));

            if (status === 401 || status === 403) {
                const errorMsg = errorData?.errors?.[0]?.msg || errorData?.message || "Permission denied";
                throw new Error(`Bot/App Export scope not enabled: ${errorMsg}`);
            }

            throw new Error(`Failed to export App Definition: ${error.message}`);
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

            console.log(`[DEBUG] Attempting to fetch bot name for ${botId} from ${url}...`);
            console.log(`[DEBUG] Using Client ID: ${effectiveClientId}`);
            console.log(`[DEBUG] JWT Token (first 50 chars): ${token.substring(0, 50)}...`);

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
            const errorData = error.response?.data;
            console.warn(`Kore Bot Info fetch failed (${status}):`, error.message);
            console.log(`[DEBUG] Kore.ai Error Response:`, JSON.stringify(errorData, null, 2));

            // Bot Info API might require different scopes than Gen AI Logs API
            // Try Gen AI Logs API as fallback to verify credentials work for what we actually need
            console.log(`[DEBUG] Bot Info API failed, trying Gen AI Logs API as fallback...`);
            try {
                const now = new Date().toISOString();
                await this.getLLMUsageLogs(config, { dateFrom: now, dateTo: now, limit: 1 });
                console.log(`[DEBUG] Gen AI Logs API works! Credentials are valid for evaluation.`);
                return {
                    name: null,
                    id: botId,
                    valid: true,
                    message: "Connection verified via Gen AI Logs API (Bot Info API requires different scopes)"
                };
            } catch (pingError) {
                console.error(`[DEBUG] Gen AI Logs API also failed:`, pingError.message);
                // Both APIs failed - credentials are truly invalid
                const errorMsg = errorData?.errors?.[0]?.msg || errorData?.message || "Authentication failed with provided credentials.";
                throw new Error(`Credential validation failed: ${errorMsg}. Gen AI Logs API also failed: ${pingError.message}`);
            }
        }
    }
}

module.exports = new KoreApiService();
