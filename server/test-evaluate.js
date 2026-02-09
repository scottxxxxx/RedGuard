const axios = require('axios');

async function testEvaluate() {
    const url = 'http://localhost:3001/api/evaluate';
    const payload = {
        userInput: "Hello",
        botResponse: "Hi there",
        guardrailConfig: {
            activeGuardrails: ['regex'],
            regexPatterns: ['banned'],
            llmConfig: {
                apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || "dummy",
                provider: process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai',
                model: process.env.ANTHROPIC_API_KEY ? 'claude-3-haiku-20240307' : 'gpt-3.5-turbo'
            }
        }
    };

    try {
        console.log('Testing /api/evaluate with dummy keys if none found...');
        // We skip if no keys found to avoid erroring out the test
        if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
            console.log('No API keys found in env. This test requires a valid key to verify actual token counting.');
            return;
        }

        const res = await axios.post(url, payload);
        console.log('Response Pass:', res.data.pass);
        console.log('Response totalTokens:', res.data.totalTokens);
    } catch (e) {
        console.error('Error:', e.response?.data || e.message);
    }
}

testEvaluate();
