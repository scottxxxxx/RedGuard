const express = require('express');
const router = express.Router();
const platforms = require('../services/bot-platforms');
const apiLogger = require('../services/api-logger');

/**
 * Resolve the platform instance from the request body.
 * Falls back to the default (Kore.ai) when no platform is specified.
 */
function resolvePlatform(body) {
    const platformName = body.platform || body.botConfig?.platform;
    if (platformName) {
        const p = platforms.get(platformName);
        if (!p) throw new Error(`Unknown platform: "${platformName}". Available: ${platforms.list().join(', ')}`);
        return p;
    }
    return platforms.getDefault();
}

router.post('/send', async (req, res) => {
    const { message, userId, botConfig } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    const explicitUserId = userId || "test_user_dashboard";
    const startTime = Date.now();

    let platform;
    try {
        platform = resolvePlatform(req.body);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    try {
        const result = await platform.sendMessage(explicitUserId, message, botConfig);

        await apiLogger.log({
            userId: explicitUserId,
            logType: `${platform.providerName}_chat`,
            method: 'POST',
            endpoint: botConfig?.webhookUrl || `${platform.providerName}/chat`,
            requestBody: { message, userId: explicitUserId },
            statusCode: 200,
            responseBody: result.raw,
            latencyMs: Date.now() - startTime,
            isError: false,
            provider: platform.providerName
        });

        // Return the raw platform response for backward compatibility
        res.json(result.raw);

    } catch (error) {
        console.error("Chat Error:", error.message);

        await apiLogger.log({
            userId: explicitUserId,
            logType: `${platform.providerName}_chat`,
            method: 'POST',
            endpoint: botConfig?.webhookUrl || `${platform.providerName}/chat`,
            requestBody: { message, userId: explicitUserId },
            statusCode: error.response?.status || 500,
            responseBody: error.response?.data,
            latencyMs: Date.now() - startTime,
            isError: true,
            errorMessage: error.message,
            provider: platform.providerName
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

    let platform;
    try {
        platform = resolvePlatform(req.body);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    try {
        const result = await platform.connect(explicitUserId, botConfig);

        console.log(`[Connection] Bot Name extracted: ${result.botName || 'Not found'}`);
        console.log(`[Connection] Session ID: ${result.sessionId || 'Not found'}`);

        await apiLogger.log({
            userId: explicitUserId,
            logType: `${platform.providerName}_connect`,
            method: 'POST',
            endpoint: botConfig?.webhookUrl || `${platform.providerName}/connect`,
            requestBody: {
                userId: explicitUserId,
                action: "initial_connect",
                botConfig: platform.redactConfig(botConfig)
            },
            statusCode: 200,
            responseBody: result.raw,
            latencyMs: Date.now() - startTime,
            isError: false,
            provider: platform.providerName
        });

        // Enrich the raw response with extracted metadata for backward compatibility
        const enrichedResponse = {
            ...result.raw,
            _metadata: {
                botName: result.botName,
                sessionId: result.sessionId,
                platform: platform.providerName,
                extractedAt: new Date().toISOString()
            }
        };

        res.json(enrichedResponse);
    } catch (error) {
        console.error("Connect Error:", error.message);

        await apiLogger.log({
            userId: explicitUserId,
            logType: `${platform.providerName}_connect`,
            method: 'POST',
            endpoint: botConfig?.webhookUrl || `${platform.providerName}/connect`,
            requestBody: {
                userId: explicitUserId,
                action: "initial_connect",
                botConfig: platform.redactConfig(botConfig)
            },
            statusCode: error.response?.status || 500,
            responseBody: error.response?.data || { error: error.message },
            latencyMs: Date.now() - startTime,
            isError: true,
            errorMessage: error.message,
            provider: platform.providerName
        });

        res.status(500).json({
            error: "Failed to connect to bot",
            details: error.response ? error.response.data : error.message
        });
    }
});

module.exports = router;
