const express = require('express');
const router = express.Router();
const platforms = require('../services/bot-platforms');
const apiLogger = require('../services/api-logger');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// All routes in this file use the Kore platform
const korePlatform = platforms.get('kore');

router.post('/llm-logs', async (req, res) => {
    const startTime = Date.now();
    const { botConfig, filters, userId } = req.body;
    const explicitUserId = userId || botConfig?.userId || 'unknown';

    try {
        if (!botConfig || !botConfig.host || !botConfig.botId || !botConfig.clientId || !botConfig.clientSecret) {
            return res.status(400).json({
                error: "Incomplete Bot Configuration. Host, Bot ID, Client ID, and Secret are required."
            });
        }

        if (!filters || !filters.dateFrom || !filters.dateTo) {
            return res.status(400).json({ error: "Date Range (From/To) is required." });
        }

        const logs = await korePlatform.fetchLogs(botConfig, filters);
        await korePlatform.saveLogs(logs, botConfig, prisma);

        await apiLogger.log({
            userId: explicitUserId,
            logType: 'kore_genAI_logs',
            method: 'POST',
            endpoint: '/api/kore/llm-logs',
            requestBody: { filters, botConfig: korePlatform.redactConfig(botConfig) },
            statusCode: 200,
            responseBody: { count: logs?.length || 0 },
            latencyMs: Date.now() - startTime,
            isError: false,
            provider: 'kore'
        });

        res.json(logs);
    } catch (error) {
        console.error("Kore API Error:", error.message);

        await apiLogger.log({
            userId: explicitUserId,
            logType: 'kore_genAI_logs',
            method: 'POST',
            endpoint: '/api/kore/llm-logs',
            requestBody: { filters, botConfig: korePlatform.redactConfig(botConfig) },
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
        const koreApi = require('../services/kore-api');
        const botDefinition = await koreApi.exportBot(botConfig);
        console.log(`[Export Bot] Successfully exported App Definition`);

        await apiLogger.log({
            userId: explicitUserId,
            logType: 'kore_export_bot',
            method: 'POST',
            endpoint: '/api/kore/export-bot',
            requestBody: { botConfig: korePlatform.redactConfig(botConfig) },
            statusCode: 200,
            responseBody: { exported: true },
            latencyMs: Date.now() - startTime,
            isError: false,
            provider: 'kore'
        });

        res.json({ success: true, botDefinition });
    } catch (error) {
        console.error("Bot Export Error:", error.message);

        const isScopeError = error.message.includes('Bot Export scope') ||
                            error.message.includes('Permission denied') ||
                            error.message.includes('403') ||
                            error.message.includes('401');
        const statusCode = isScopeError ? 403 : 500;

        await apiLogger.log({
            userId: explicitUserId,
            logType: 'kore_export_bot',
            method: 'POST',
            endpoint: '/api/kore/export-bot',
            requestBody: { botConfig: korePlatform.redactConfig(botConfig) },
            statusCode,
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

        const result = await korePlatform.validate(botConfig);

        await apiLogger.log({
            userId: explicitUserId,
            logType: 'kore_validate',
            method: 'POST',
            endpoint: '/api/kore/validate',
            requestBody: { botConfig: korePlatform.redactConfig(botConfig) },
            statusCode: result.valid ? 200 : 400,
            responseBody: result,
            latencyMs: 0,
            isError: !result.valid,
            errorMessage: result.valid ? undefined : result.message,
            provider: 'kore'
        });

        if (result.valid) {
            res.json({ valid: true, message: result.message });
        } else {
            // Determine status code from validation failure
            let statusCode = 500;
            const msg = result.message || '';
            if (msg.includes('Gen AI Logs API access denied')) {
                statusCode = 403;
            } else if (msg.includes('Invalid credentials') || msg.includes('401') || msg.includes('403')) {
                statusCode = 401;
            } else if (msg.includes('not found') || msg.includes('404')) {
                statusCode = 404;
            } else if (msg.includes('unreachable') || msg.includes('ENOTFOUND')) {
                statusCode = 503;
            }

            res.status(statusCode).json({ error: result.message });
        }
    } catch (error) {
        console.error("Kore Validation Error:", error.message);

        await apiLogger.log({
            userId: explicitUserId,
            logType: 'kore_validate',
            method: 'POST',
            endpoint: '/api/kore/validate',
            requestBody: { botConfig: korePlatform.redactConfig(botConfig) },
            statusCode: 500,
            responseBody: { error: error.message },
            latencyMs: 0,
            isError: true,
            errorMessage: error.message,
            provider: 'kore'
        });

        res.status(500).json({ error: error.message });
    }
});

// ── Bot Backup / Fetch Guardrails from Bot ──────────────────────────────

router.post('/backup-guardrails', async (req, res) => {
    const { botConfig } = req.body;

    try {
        const validation = korePlatform.validateConfig(botConfig);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        console.log(`[Backup Guardrails] Starting backup for bot ${botConfig.botId}`);
        const jobId = await korePlatform.startExport(botConfig);

        res.json({ jobId, status: 'started' });
    } catch (error) {
        console.error("[Backup Guardrails] Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

router.get('/backup-guardrails/:jobId', async (req, res) => {
    const { jobId } = req.params;

    try {
        const jobData = await korePlatform.getExportStatus(jobId);

        if (jobData.status === 'not_found') {
            return res.status(404).json({ error: 'Job not found' });
        }

        // If already analyzed, return cached guardrails
        if (jobData.status === 'analyzed' && jobData.guardrails) {
            return res.json({ status: 'completed', guardrails: jobData.guardrails });
        }

        // If completed, download, extract, and analyze
        if (jobData.status === 'completed' && jobData.downloadUrl) {
            try {
                const guardrails = await korePlatform.downloadAndAnalyze(jobId, jobData.downloadUrl);
                return res.json({ status: 'completed', guardrails });
            } catch (extractError) {
                console.error("[Backup Guardrails] Extract/analyze error:", extractError.message);
                const BackupService = require('../services/backup-service');
                BackupService.updateJob(jobId, {
                    status: 'failed',
                    error: `Failed to process exported bot: ${extractError.message}`,
                    downloadUrl: null
                });
                return res.json({
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

        // In progress
        res.json({
            status: jobData.status || 'exporting',
            progress: jobData.progress
        });
    } catch (error) {
        console.error("[Backup Guardrails] Status check error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
