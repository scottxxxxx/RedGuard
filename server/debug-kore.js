require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const CLIENT_ID = process.env.KORE_CLIENT_ID;
const CLIENT_SECRET = process.env.KORE_CLIENT_SECRET;
const BOT_ID = process.env.KORE_BOT_ID; // st-fc...

// Generate JWT
const payload = {
    iat: Math.floor(Date.now() / 1000),
    jti: uuidv4(),
    aud: "https://idproxy.kore.ai/authorize",
    iss: CLIENT_ID,
    isAnonymous: false,
    sub: "test_debug_user"
};
const token = jwt.sign(payload, CLIENT_SECRET, { algorithm: 'HS256' });

console.log("Generated Token Length:", token.length);

const WEB_CLIENT_ID = "699eb2dc885645a1947e8b5727176f7f3b1fbc5f36934a2c8cb04685e9965419stfc";

const variants = [
    // Standard Platform Public API
    {
        name: "Platform / Users Messages (Bot ID)",
        method: "POST",
        url: `https://platform.kore.ai/api/1.1/public/users/test_debug_user/messages`,
        headers: { 'auth': token },
        data: { message: { body: "Debug Test" }, from: { id: "test_debug_user" } }
    },
    // Standard Bots Public API
    {
        name: "Bots / Users Messages (Bot ID)",
        method: "POST",
        url: `https://bots.kore.ai/api/1.1/public/users/test_debug_user/messages`,
        headers: { 'auth': token },
        data: { message: { body: "Debug Test" }, from: { id: "test_debug_user" } }
    },
    // Platform Stream with Bot ID
    {
        name: "Platform / Stream (Bot ID)",
        method: "POST",
        url: `https://platform.kore.ai/api/1.1/public/stream/${BOT_ID}/incoming`,
        headers: { 'auth': token },
        data: { message: { body: "Debug Test" }, from: { id: "test_debug_user" } }
    },
    // Platform Stream with Web Client ID
    {
        name: "Platform / Stream (Web Client ID)",
        method: "POST",
        url: `https://platform.kore.ai/api/1.1/public/stream/${WEB_CLIENT_ID}/incoming`,
        headers: { 'auth': token },
        data: { message: { body: "Debug Test" }, from: { id: "test_debug_user" } }
    },
    // Bots Stream with Web Client ID
    {
        name: "Bots / Stream (Web Client ID)",
        method: "POST",
        url: `https://bots.kore.ai/api/1.1/public/stream/${WEB_CLIENT_ID}/incoming`,
        headers: { 'auth': token },
        data: { message: { body: "Debug Test" }, from: { id: "test_debug_user" } }
    }
];

async function runTests() {
    for (const test of variants) {
        console.log(`\n--- Testing: ${test.name} ---`);
        console.log(`URL: ${test.url}`);
        try {
            const response = await axios({
                method: test.method,
                url: test.url,
                headers: { ...test.headers, 'Content-Type': 'application/json' },
                data: test.data
            });
            console.log("SUCCESS ✅");
            console.log("Status:", response.status);
            console.log("Data:", response.data);
        } catch (error) {
            console.log("FAILED ❌");
            console.log("Status:", error.response ? error.response.status : "Network Error");
            console.log("Error:", error.response ? JSON.stringify(error.response.data) : error.message);
        }
    }
}

runTests();
