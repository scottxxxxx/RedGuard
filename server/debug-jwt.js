require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Implicitly uses values from .env which we just updated.
const WEBHOOK_URL = process.env.KORE_WEBHOOK_URL;
const CLIENT_ID = process.env.KORE_CLIENT_ID;
const CLIENT_SECRET = process.env.KORE_CLIENT_SECRET;

console.log("Debug using:", {
    URL: WEBHOOK_URL,
    ClientID: CLIENT_ID,
    SecretSuffix: CLIENT_SECRET ? CLIENT_SECRET.slice(-5) : 'None'
});

const variants = [
    {
        name: "Standard Web SDK Payload",
        payload: {
            iat: Math.floor(Date.now() / 1000),
            jti: uuidv4(),
            aud: "https://idproxy.kore.ai/authorize",
            iss: CLIENT_ID,
            isAnonymous: false,
            sub: "test_debug_jwt_1"
        }
    },
    {
        name: "No Audience (aud)",
        payload: {
            iat: Math.floor(Date.now() / 1000),
            jti: uuidv4(),
            iss: CLIENT_ID,
            sub: "test_debug_jwt_2"
        }
    },
    {
        name: "Anonymous User",
        payload: {
            iat: Math.floor(Date.now() / 1000),
            jti: uuidv4(),
            aud: "https://idproxy.kore.ai/authorize",
            iss: CLIENT_ID,
            isAnonymous: true,
            sub: "test_debug_jwt_3"
        }
    },
    {
        name: "Different Algorithm (HS256 is default, check others?)",
        // Logic handled in loop
        payload: {
            iat: Math.floor(Date.now() / 1000),
            jti: uuidv4(),
            iss: CLIENT_ID,
            sub: "test_debug_jwt_4"
        }
    }
];

async function runTests() {
    console.log(`Testing against: ${WEBHOOK_URL}`);
    console.log(`Client ID: ${CLIENT_ID}`);

    for (const test of variants) {
        const token = jwt.sign(test.payload, CLIENT_SECRET, { algorithm: 'HS256' });
        console.log(`\n--- Testing: ${test.name} ---`);

        try {
            const response = await axios.post(WEBHOOK_URL, {
                session: { new: true },
                message: { type: "text", val: "Debug JWT" },
                from: { id: test.payload.sub },
                to: { id: "bot" }
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log("SUCCESS ✅");
            console.log("Response:", JSON.stringify(response.data));
            return; // Stop on success
        } catch (error) {
            console.log("FAILED ❌");
            console.log("Status:", error.response ? error.response.status : "Network Error");
            console.log("Error:", error.response ? JSON.stringify(error.response.data) : error.message);
        }
    }
}

runTests();
