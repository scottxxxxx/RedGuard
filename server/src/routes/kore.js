const express = require('express');
const router = express.Router();
const koreApiService = require('../services/kore-api');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// Debug available models
console.log('Prisma models:', Object.keys(prisma));

router.post('/llm-logs', async (req, res) => {
    try {
        const { botConfig, filters } = req.body;

        // Basic Validation
        if (!botConfig || !botConfig.host || !botConfig.botId || !botConfig.clientId || !botConfig.clientSecret) {
            return res.status(400).json({
                error: "Incomplete Bot Configuration. Host, Bot ID, Client ID, and Secret are required."
            });
        }

        if (!filters || !filters.dateFrom || !filters.dateTo) {
            return res.status(400).json({ error: "Date Range (From/To) is required." });
        }

        // Call service with config object and filters
        const logs = await koreApiService.getLLMUsageLogs(botConfig, filters);

        // Store logs in DB (Async, don't block response too much, but good to await for consistency in this context)
        if (logs && Array.isArray(logs)) {
            const savePromises = logs.map(log => {
                // Map Kore API response to our Schema
                // Adjust field names based on actual Kore API response
                const koreId = log._id || log.id || `${log.sessionId}-${log.timestamp}`;

                return prisma.koreLLMLog.upsert({
                    where: { koreId: koreId },
                    update: {}, // Don't update if exists, just skip
                    create: {
                        koreId: koreId,
                        timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
                        sessionId: log.sessionId,
                        featureName: log.featureName,
                        model: log.model,
                        status: log.status,
                        description: log.description || log.desc,
                        requestPayload: log.requestPayload ? JSON.stringify(log.requestPayload) : null,
                        responsePayload: log.responsePayload ? JSON.stringify(log.responsePayload) : null,
                        inputTokens: log.inputTokens || 0,
                        outputTokens: log.outputTokens || 0,
                        totalTokens: log.totalTokens || 0,
                        botId: botConfig.botId,
                        userId: botConfig.userId, // Storing who requested it or the user in the log? 'userId' in schema is RedGuard user.
                        // The log itself might have channelUserId
                        channelUserId: log.channelUserId || log.userId // Kore sometimes uses userId for channel user
                    }
                }).catch(err => {
                    console.error("Failed to save log:", err.message);
                    return null;
                });
            });

            await Promise.all(savePromises);
        }

        res.json(logs);
    } catch (error) {
        console.error("Kore API Error:", error.message);
        res.status(500).json({
            error: error.message,
            details: error.response?.data
        });
    }
});

router.post('/validate', async (req, res) => {
    try {
        const { botConfig } = req.body;

        if (!botConfig) {
            return res.status(400).json({ error: "No configuration provided." });
        }

        const info = await koreApiService.getBotInfo(botConfig);
        res.json(info);
    } catch (error) {
        console.error("Kore Validation Error:", error.message);
        res.status(401).json({
            error: error.message
        });
    }
});

module.exports = router;
