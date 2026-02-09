const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

class KoreService {
    constructor() {
        this.webhookUrl = process.env.KORE_WEBHOOK_URL;
        this.clientId = process.env.KORE_CLIENT_ID;
        this.clientSecret = process.env.KORE_CLIENT_SECRET;
        this.botId = process.env.KORE_BOT_ID;

        if (!this.webhookUrl || !this.clientId || !this.clientSecret || !this.botId) {
            console.warn('Missing Kore.AI configuration. Check .env file.');
        }
    }

    generateJWT(configOverride = {}) {
        const clientId = configOverride.clientId || this.clientId;
        const clientSecret = configOverride.clientSecret || this.clientSecret;

        if (!clientId || !clientSecret) {
            throw new Error("Missing Kore.AI Client ID or Secret");
        }

        // Standard JWT payload for Kore.AI
        const payload = {
            iat: Math.floor(Date.now() / 1000),
            jti: uuidv4(),
            aud: "https://idproxy.kore.ai/authorize",
            iss: clientId,
            isAnonymous: false
        };

        // We sign with the client secret
        return (userId) => {
            const tokenPayload = { ...payload, sub: userId };
            return jwt.sign(tokenPayload, clientSecret, { algorithm: 'HS256' });
        };
    }

    async sendMessage(userId, messageDetails, sessionDetails = { new: true }, configOverride = null) {
        try {
            const tokenGenerator = this.generateJWT(configOverride);
            const token = tokenGenerator(userId);

            const botId = configOverride?.botId || this.botId;
            const webhookUrl = configOverride?.webhookUrl || this.webhookUrl;

            const payload = {
                session: sessionDetails,
                message: messageDetails, // e.g., { "type": "text", "val": "Hello" }
                from: {
                    id: userId,
                    userInfo: {
                        firstName: "Test",
                        lastName: "User"
                    }
                },
                to: {
                    id: botId
                }
            };

            let url = webhookUrl;
            // Standard Webhook V2 logic:
            if (url.endsWith('/v2')) {
                url = `${url}/users/${userId}/messages`;
            }

            // Restore standard Authorization header for Webhook Channel (JWT)
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };

            const response = await axios.post(url, payload, { headers });

            return response.data;
        } catch (error) {
            console.error('Error sending message to Kore.AI:', error.response ? error.response.data : error.message);
            throw error;
        }
    }
}

module.exports = new KoreService();
