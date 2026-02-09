const express = require('express');
const router = express.Router();
const koreService = require('../services/kore-webhook');
const guardrailService = require('../services/guardrail-logic');
const apiLogger = require('../services/api-logger');

router.post('/send', async (req, res) => {
    const { message, userId, guardrailConfig, botConfig } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    const explicitUserId = userId || "test_user_dashboard";
    const startTime = Date.now();

    try {
        // 1. Send message to Kore.AI (passing dynamic config if present)
        const kResponse = await koreService.sendMessage(explicitUserId, { type: "text", val: message }, { new: true }, botConfig);

        // 2. Extract Bot Text for evaluation
        let botText = "";
        if (kResponse.data && Array.isArray(kResponse.data)) {
            botText = kResponse.data.map(m => m.val || m.text).join('\n');
        } else if (kResponse.text) {
            botText = kResponse.text;
        }

        // Log successful request
        await apiLogger.log({
            logType: 'kore_chat',
            method: 'POST',
            endpoint: botConfig?.webhookUrl || 'kore.ai/webhook',
            requestBody: { message, userId: explicitUserId },
            statusCode: 200,
            responseBody: kResponse,
            latencyMs: Date.now() - startTime,
            isError: false,
            provider: 'kore'
        });

        // 4. Return response (Evaluation is now manual)
        res.json(kResponse);

    } catch (error) {
        console.error("Chat Error:", error.message);

        // Log error
        await apiLogger.log({
            logType: 'kore_chat',
            method: 'POST',
            endpoint: botConfig?.webhookUrl || 'kore.ai/webhook',
            requestBody: { message, userId: explicitUserId },
            statusCode: error.response?.status || 500,
            responseBody: error.response?.data,
            latencyMs: Date.now() - startTime,
            isError: true,
            errorMessage: error.message,
            provider: 'kore'
        });

        res.status(500).json({
            error: "Failed to send message to bot",
            details: error.response ? error.response.data : error.message
        });
    }
});

router.post('/connect', async (req, res) => {
    const { userId, botConfig } = req.body;
    const explicitUserId = userId || "test_user_dashboard";
    const startTime = Date.now();

    try {
        // Send a blank message to trigger 'On Connect' or 'Welcome' intent in Kore
        const kResponse = await koreService.sendMessage(explicitUserId, { type: "text", val: "" }, { new: true }, botConfig);

        await apiLogger.log({
            logType: 'kore_connect',
            method: 'POST',
            endpoint: botConfig?.webhookUrl || 'kore.ai/webhook',
            requestBody: { userId: explicitUserId, action: "initial_connect" },
            statusCode: 200,
            responseBody: kResponse,
            latencyMs: Date.now() - startTime,
            isError: false,
            provider: 'kore'
        });

        res.json(kResponse);
    } catch (error) {
        console.error("Connect Error:", error.message);
        res.status(500).json({
            error: "Failed to connect to bot",
            details: error.response ? error.response.data : error.message
        });
    }
});

module.exports = router;
