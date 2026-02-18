const express = require('express');
const router = express.Router();
const axios = require('axios');
const AdmZip = require('adm-zip');
const koreApiService = require('../services/kore-api');
const apiLogger = require('../services/api-logger');
const botConfigAnalyzer = require('../services/bot-config-analyzer');

const BOT_BACKUP_SERVICE_URL = `http://localhost:${process.env.BOT_BACKUP_SERVICE_PORT || 3005}`;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// Debug available models
console.log('Prisma models:', Object.keys(prisma));

router.post('/llm-logs', async (req, res) => {
    const startTime = Date.now();
    const { botConfig, filters, userId } = req.body;
    const explicitUserId = userId || botConfig?.userId || 'unknown';

    try {
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
                        timestamp: log['start Date'] ? new Date(log['start Date']) : new Date(),
                        sessionId: log['Session ID'],
                        featureName: log['Feature Name '] || log.Feature,
                        model: log.Integration || log['Model Name'] || log.Model,
                        status: log.Status,
                        description: log.Description,
                        requestPayload: log['Payload Details']?.['Request Payload'] ? JSON.stringify(log['Payload Details']['Request Payload']) : null,
                        responsePayload: log['Payload Details']?.['Response Payload'] ? JSON.stringify(log['Payload Details']['Response Payload']) : null,
                        inputTokens: 0, // Kore API doesn't provide token counts in these logs
                        outputTokens: 0,
                        totalTokens: 0,
                        botId: botConfig.botId,
                        userId: botConfig.userId,
                        channelUserId: log['User ID']
                    }
                }).catch(err => {
                    console.error("Failed to save log:", err.message);
                    return null;
                });
            });

            await Promise.all(savePromises);
        }

        // Log successful Gen AI logs retrieval
        await apiLogger.log({
            userId: explicitUserId,
            logType: 'kore_genAI_logs',
            method: 'POST',
            endpoint: '/api/kore/llm-logs',
            requestBody: { filters, botConfig: { ...botConfig, clientSecret: '[REDACTED]' } },
            statusCode: 200,
            responseBody: { count: logs?.length || 0 },
            latencyMs: Date.now() - startTime,
            isError: false,
            provider: 'kore'
        });

        res.json(logs);
    } catch (error) {
        console.error("Kore API Error:", error.message);

        // Log failed Gen AI logs retrieval
        await apiLogger.log({
            userId: explicitUserId,
            logType: 'kore_genAI_logs',
            method: 'POST',
            endpoint: '/api/kore/llm-logs',
            requestBody: { filters, botConfig: botConfig ? { ...botConfig, clientSecret: '[REDACTED]' } : null },
            statusCode: error.response?.status || 500,
            responseBody: error.response?.data || { error: error.message },
            latencyMs: Date.now() - startTime,
            isError: true,
            errorMessage: error.message,
            provider: 'kore'
        });

        res.status(500).json({
            error: error.message,
            details: error.response?.data
        });
    }
});

router.post('/export-bot', async (req, res) => {
    const startTime = Date.now();
    const { botConfig, userId } = req.body;
    const explicitUserId = userId || 'unknown';

    try {
        if (!botConfig) {
            return res.status(400).json({ error: "No configuration provided." });
        }

        console.log(`[Export Bot] Attempting to export App Definition for ${botConfig.botId}...`);

        const botDefinition = await koreApiService.exportBot(botConfig);

        console.log(`[Export Bot] Successfully exported App Definition`);

        // Log successful bot export
        await apiLogger.log({
            userId: explicitUserId,
            logType: 'kore_export_bot',
            method: 'POST',
            endpoint: '/api/kore/export-bot',
            requestBody: { botConfig: { ...botConfig, clientSecret: '[REDACTED]' } },
            statusCode: 200,
            responseBody: { exported: true },
            latencyMs: Date.now() - startTime,
            isError: false,
            provider: 'kore'
        });

        res.json({
            success: true,
            botDefinition: botDefinition
        });
    } catch (error) {
        console.error("Bot Export Error:", error.message);

        // Determine if it's a scope/permission error
        const isScopeError = error.message.includes('Bot Export scope') ||
                            error.message.includes('Permission denied') ||
                            error.message.includes('403') ||
                            error.message.includes('401');

        const statusCode = isScopeError ? 403 : 500;

        // Log failed bot export
        await apiLogger.log({
            userId: explicitUserId,
            logType: 'kore_export_bot',
            method: 'POST',
            endpoint: '/api/kore/export-bot',
            requestBody: { botConfig: botConfig ? { ...botConfig, clientSecret: '[REDACTED]' } : null },
            statusCode: statusCode,
            responseBody: { error: error.message },
            latencyMs: Date.now() - startTime,
            isError: true,
            errorMessage: error.message,
            provider: 'kore'
        });

        res.status(statusCode).json({
            error: error.message,
            scopeRequired: isScopeError
        });
    }
});

router.post('/validate', async (req, res) => {
    const { botConfig, userId } = req.body;
    const explicitUserId = userId || 'unknown';

    try {
        if (!botConfig) {
            return res.status(400).json({ error: "No configuration provided." });
        }

        // Step 1: Validate credentials and bot existence (independent of webhook)
        try {
            const botInfo = await koreApiService.getBotInfo(botConfig);
            console.log(`[Validation] Credentials valid, bot found: ${botInfo.name || botInfo.id}`);
        } catch (credentialError) {
            // Credentials are invalid or bot doesn't exist in account
            console.error("Credential validation failed:", credentialError.message);

            if (credentialError.message.includes('401') || credentialError.message.includes('403')) {
                throw new Error("Invalid credentials - Client ID or Secret is incorrect");
            } else if (credentialError.message.includes('not found')) {
                throw new Error("Bot not found - Bot ID does not exist in your Kore.ai account");
            } else {
                throw new Error(`Credential validation failed: ${credentialError.message}`);
            }
        }

        // Step 2: Validate webhook URL by attempting connection
        const koreWebhook = require('../services/kore-webhook');
        try {
            const testUserId = `validation-${Date.now()}`;
            await koreWebhook.sendMessage(
                testUserId,
                { type: "event", val: "ON_CONNECT" },
                { new: true },
                botConfig
            );
            console.log(`[Validation] Webhook connection successful`);
        } catch (webhookError) {
            // Credentials are good, but webhook connection failed
            console.error("Webhook connection failed:", webhookError.message);

            if (webhookError.response?.status === 404) {
                throw new Error("Webhook URL not found (404) - The webhook endpoint does not exist. Check the URL format.");
            } else if (webhookError.code === 'ENOTFOUND') {
                throw new Error("Webhook URL unreachable - Cannot resolve hostname. Check if the URL is correct.");
            } else if (webhookError.code === 'ECONNREFUSED') {
                throw new Error("Webhook connection refused - The server is not accepting connections.");
            } else {
                throw new Error(`Webhook validation failed (credentials are valid): ${webhookError.message}`);
            }
        }

        // Step 3: Validate Gen AI Logs API access (REQUIRED for RedGuard evaluation)
        try {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

            // Test with minimal date range - we don't care about results, just API access
            await koreApiService.getLLMUsageLogs(botConfig, {
                dateFrom: oneHourAgo.toISOString(),
                dateTo: now.toISOString(),
                limit: 1
            });
            console.log(`[Validation] Gen AI Logs API access confirmed`);

            // Log successful validation
            await apiLogger.log({
                userId: explicitUserId,
                logType: 'kore_validate',
                method: 'POST',
                endpoint: '/api/kore/validate',
                requestBody: { botConfig: { ...botConfig, clientSecret: '[REDACTED]' } },
                statusCode: 200,
                responseBody: { valid: true, message: "All validations passed" },
                latencyMs: 0,
                isError: false,
                provider: 'kore'
            });

            // If we got here, everything works
            res.json({
                valid: true,
                message: "All validations passed: credentials, webhook, and Gen AI Logs API"
            });
        } catch (logsError) {
            console.error("Gen AI Logs API validation failed:", logsError.message);

            if (logsError.message.includes('401') || logsError.message.includes('403') || logsError.message.includes('Authentication Failed')) {
                throw new Error("Gen AI Logs API access denied - Please go to your Kore.ai App settings → API Scopes and enable 'Gen AI and LLM Usage Logs'. This scope is REQUIRED for RedGuard to evaluate bot responses.");
            } else {
                throw new Error(`Gen AI Logs API validation failed: ${logsError.message}`);
            }
        }
    } catch (error) {
        console.error("Kore Validation Error:", error.message);

        // Return appropriate status code based on error type
        let statusCode = 500; // Default to server error

        if (error.message.includes('Gen AI Logs API access denied')) {
            statusCode = 403; // Forbidden - API scope not provisioned
        } else if (error.message.includes('Invalid credentials') || error.message.includes('401') || error.message.includes('403')) {
            statusCode = 401;
        } else if (error.message.includes('not found') || error.message.includes('404')) {
            statusCode = 404;
        } else if (error.message.includes('unreachable') || error.message.includes('ENOTFOUND')) {
            statusCode = 503; // Service Unavailable
        }

        // Log failed validation
        await apiLogger.log({
            userId: explicitUserId,
            logType: 'kore_validate',
            method: 'POST',
            endpoint: '/api/kore/validate',
            requestBody: { botConfig: botConfig ? { ...botConfig, clientSecret: '[REDACTED]' } : null },
            statusCode: statusCode,
            responseBody: { error: error.message },
            latencyMs: 0,
            isError: true,
            errorMessage: error.message,
            provider: 'kore'
        });

        res.status(statusCode).json({
            error: error.message
        });
    }
});

// ── Bot Backup / Fetch Guardrails from Bot ──────────────────────────────

router.post('/backup-guardrails', async (req, res) => {
    const { botConfig, userId } = req.body;
    const explicitUserId = userId || 'unknown';

    try {
        if (!botConfig || !botConfig.botId || !botConfig.clientId || !botConfig.clientSecret) {
            return res.status(400).json({ error: "Bot ID, Client ID, and Client Secret are required." });
        }

        // Derive platform and bots hosts from botConfig.host
        let platformHost = 'platform.kore.ai';
        let botsHost = 'bots.kore.ai';

        if (botConfig.host) {
            const hostClean = botConfig.host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
            if (hostClean.includes('bots.')) {
                botsHost = hostClean;
                platformHost = hostClean.replace('bots.', 'platform.');
            } else if (hostClean.includes('platform.')) {
                platformHost = hostClean;
                botsHost = hostClean.replace('platform.', 'bots.');
            } else {
                platformHost = hostClean;
                botsHost = hostClean;
            }
        }

        console.log(`[Backup Guardrails] Starting backup for bot ${botConfig.botId} via ${BOT_BACKUP_SERVICE_URL}`);

        const response = await axios.post(`${BOT_BACKUP_SERVICE_URL}/api/backup/start`, {
            botId: botConfig.botId,
            clientId: botConfig.clientId,
            clientSecret: botConfig.clientSecret,
            platformHost,
            botsHost
        });

        res.json({
            jobId: response.data.jobId,
            status: response.data.status || 'started'
        });
    } catch (error) {
        console.error("[Backup Guardrails] Error:", error.message);

        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return res.status(503).json({
                error: "Backup service unavailable. Make sure the bot-backup microservice is running on port " + (process.env.BOT_BACKUP_SERVICE_PORT || 3005)
            });
        }

        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || error.message
        });
    }
});

router.get('/backup-guardrails/:jobId', async (req, res) => {
    const { jobId } = req.params;

    try {
        const response = await axios.get(`${BOT_BACKUP_SERVICE_URL}/api/backup/status/${jobId}`);
        const jobData = response.data;

        // If completed, download zip, extract, and analyze
        if (jobData.status === 'completed' && jobData.downloadUrl) {
            console.log(`[Backup Guardrails] Job ${jobId} completed. Downloading zip...`);

            try {
                const zipResponse = await axios.get(jobData.downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 60000
                });

                const zip = new AdmZip(Buffer.from(zipResponse.data));
                const zipEntries = zip.getEntries();

                // Find the App Definition JSON file
                let targetEntry = null;

                // First try: look for botDefinition or AppDefinition pattern
                targetEntry = zipEntries.find(entry =>
                    !entry.isDirectory &&
                    entry.entryName.endsWith('.json') &&
                    (entry.entryName.toLowerCase().includes('botdefinition') ||
                     entry.entryName.toLowerCase().includes('appdefinition'))
                );

                // Fallback: largest JSON file
                if (!targetEntry) {
                    const jsonEntries = zipEntries.filter(entry =>
                        !entry.isDirectory && entry.entryName.endsWith('.json')
                    );
                    if (jsonEntries.length > 0) {
                        targetEntry = jsonEntries.reduce((largest, entry) =>
                            entry.header.size > largest.header.size ? entry : largest
                        );
                    }
                }

                if (!targetEntry) {
                    return res.status(500).json({
                        status: 'failed',
                        error: 'No JSON file found in the exported zip'
                    });
                }

                console.log(`[Backup Guardrails] Extracting: ${targetEntry.entryName}`);
                const jsonContent = JSON.parse(zip.readAsText(targetEntry));

                // Run through analyzer
                const analysis = botConfigAnalyzer.analyze(jsonContent);

                return res.json({
                    status: 'completed',
                    guardrails: {
                        enabledGuardrails: analysis.enabledGuardrails,
                        topics: analysis.topics,
                        regexPatterns: analysis.regexPatterns,
                        descriptions: analysis.descriptions,
                        featureDetails: analysis.featureDetails
                    }
                });
            } catch (extractError) {
                console.error("[Backup Guardrails] Extract/analyze error:", extractError.message);
                return res.status(500).json({
                    status: 'failed',
                    error: `Failed to process exported bot: ${extractError.message}`
                });
            }
        }

        // If failed, check for scope errors
        if (jobData.status === 'failed') {
            const isScopeError = jobData.error &&
                (jobData.error.includes('403') || jobData.error.includes('401') ||
                 jobData.error.includes('scope') || jobData.error.includes('permission'));

            return res.json({
                status: 'failed',
                error: isScopeError
                    ? "App Export scope not enabled. Go to your Kore.ai App settings and add the 'Bot Export' API scope."
                    : (jobData.error || 'Export failed'),
                scopeRequired: isScopeError
            });
        }

        // In progress — pass through
        res.json({
            status: jobData.status || 'exporting',
            progress: jobData.progress
        });
    } catch (error) {
        console.error("[Backup Guardrails] Status check error:", error.message);

        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return res.status(503).json({
                error: "Backup service unavailable"
            });
        }

        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || error.message
        });
    }
});

module.exports = router;
