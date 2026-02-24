const jwt = require('jsonwebtoken');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Load from environment variables or pass as CLI args
const clientId = process.env.KORE_CLIENT_ID || "";
const clientSecret = process.env.KORE_CLIENT_SECRET || "";
const botId = process.env.KORE_BOT_ID || "";
const host = process.env.KORE_HOST || "platform.kore.ai";

async function test() {
    console.log("Generating JWT...");
    const payload = {
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: uuidv4(),
        iss: clientId,
        sub: "test_verifier",
        aud: "https://idproxy.kore.ai/authorize"
    };
    const token = jwt.sign(payload, clientSecret, { algorithm: 'HS256' });
    console.log("Token Generated for platform.kore.ai");
    console.log("Token:", token);

    const url = `https://${host}/api/1.1/public/bot/${botId}/getLLMUsageLogs`;
    console.log("Testing POST to:", url);

    try {
        const res = await axios.post(url, {
            dateFrom: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
            dateTo: new Date().toISOString().split('T')[0], // Today
            limit: "1",
            featureName: ["Agent Node"],
            isDeveloper: true
        }, {
            headers: { 'auth': token, 'Content-Type': 'application/json' }
        });

        console.log("SUCCESS on platform.kore.ai! Status:", res.status);
        if (Array.isArray(res.data)) {
            console.log(`Found ${res.data.length} logs.`);
        } else if (res.data.hits) {
            console.log(`Found ${res.data.hits.length} logs.`);
        } else {
            console.log("Response data:", JSON.stringify(res.data).substring(0, 200));
        }

    } catch (error) {
        console.error("FAILURE on platform.kore.ai. details:");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data));
            if (error.response.status === 401) {
                console.error("HINT: Ensure 'Fetch Gen AI Logs' scope is enabled for this app!");
            }
        } else {
            console.error(error.message);
        }
    }
}

test();
