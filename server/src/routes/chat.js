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
            userId: explicitUserId,
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
            userId: explicitUserId,
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
        // Send the explicit ON_CONNECT event as per Kore.ai Webhook V2.0 spec
        const kResponse = await koreService.sendMessage(explicitUserId, { type: "event", val: "ON_CONNECT" }, { new: true }, botConfig);

        // Try to extract bot name from response metadata
        let botName = null;
        let sessionId = null;

        // Check various possible locations for bot metadata
        if (kResponse.botInfo) {
            botName = kResponse.botInfo.name || kResponse.botInfo.chatBot || kResponse.botInfo.botName;
        }
        if (kResponse.metadata) {
            botName = botName || kResponse.metadata.botName || kResponse.metadata.name;
        }
        if (kResponse.context) {
            botName = botName || kResponse.context.botName;
        }

        // Extract session ID
        if (kResponse.sessionId) {
            sessionId = kResponse.sessionId;
        } else if (kResponse.session?.id) {
            sessionId = kResponse.session.id;
        }

        console.log(`[Connection] Bot Name extracted: ${botName || 'Not found'}`);
        console.log(`[Connection] Session ID: ${sessionId || 'Not found'}`);
        console.log(`[Connection] Response keys:`, Object.keys(kResponse));

        await apiLogger.log({
            userId: explicitUserId,
            logType: 'kore_connect',
            method: 'POST',
            endpoint: botConfig?.webhookUrl || 'kore.ai/webhook',
            requestBody: {
                userId: explicitUserId,
                action: "initial_connect",
                botConfig: {
                    webhookUrl: botConfig?.webhookUrl,
                    botId: botConfig?.botId,
                    clientId: botConfig?.clientId,
                    clientSecret: '[REDACTED]',
                    host: botConfig?.host
                }
            },
            statusCode: 200,
            responseBody: kResponse,
            latencyMs: Date.now() - startTime,
            isError: false,
            provider: 'kore'
        });

        // Add extracted metadata to response
        const enrichedResponse = {
            ...kResponse,
            _metadata: {
                botName,
                sessionId,
                extractedAt: new Date().toISOString()
            }
        };

        res.json(enrichedResponse);
    } catch (error) {
        console.error("Connect Error:", error.message);

        // Log connection error
        await apiLogger.log({
            userId: explicitUserId,
            logType: 'kore_connect',
            method: 'POST',
            endpoint: botConfig?.webhookUrl || 'kore.ai/webhook',
            requestBody: {
                userId: explicitUserId,
                action: "initial_connect",
                botConfig: botConfig ? {
                    webhookUrl: botConfig.webhookUrl,
                    botId: botConfig.botId,
                    clientId: botConfig.clientId,
                    clientSecret: '[REDACTED]',
                    host: botConfig.host
                } : null
            },
            statusCode: error.response?.status || 500,
            responseBody: error.response?.data || { error: error.message },
            latencyMs: Date.now() - startTime,
            isError: true,
            errorMessage: error.message,
            provider: 'kore'
        });

        res.status(500).json({
            error: "Failed to connect to bot",
            details: error.response ? error.response.data : error.message
        });
    }
});

module.exports = router;
