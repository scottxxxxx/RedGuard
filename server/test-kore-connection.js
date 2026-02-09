require('dotenv').config();
const koreService = require('./src/services/kore-webhook');

async function testConnection() {
    console.log('Testing Kore.AI Connection...');
    console.log(`Bot ID: ${process.env.KORE_BOT_ID}`);
    console.log(`Client ID: ${process.env.KORE_CLIENT_ID ? 'Present' : 'Missing'}`);

    try {
        const userId = "test_user_" + Math.floor(Math.random() * 1000);
        const message = { type: "text", val: "Hello from RedGuard" };

        console.log(`Sending message as ${userId}...`);
        const response = await koreService.sendMessage(userId, message);

        console.log('Response received:');
        console.log(JSON.stringify(response, null, 2));

    } catch (error) {
        console.error('Connection failed:', error.message);
        if (error.response) {
            console.error('API Error Data:', error.response.data);
        }
    }
}

testConnection();
