const express = require('express');
const router = express.Router();
const axios = require('axios');
const apiLogger = require('../services/api-logger');

const TOKEN_COST_SERVICE_URL = process.env.TOKEN_COST_SERVICE_URL || `http://localhost:${process.env.TOKEN_COST_SERVICE_PORT || 3006}`;

// Get logs with filtering
router.get('/', async (req, res) => {
    try {
        const { logType, isError, provider, userId, startDate, endDate, limit, offset } = req.query;

        const result = await apiLogger.getLogs({
            logType,
            isError: isError === 'true' ? true : isError === 'false' ? false : undefined,
            provider,
            userId,
            startDate,
            endDate,
            limit: parseInt(limit) || 100,
            offset: parseInt(offset) || 0
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Get log statistics
router.get('/stats', async (req, res) => {
    try {
        const { logType, isError, provider, userId, startDate, endDate, last24h } = req.query;
        const stats = await apiLogger.getStats({
            logType,
            isError: isError === 'true' ? true : isError === 'false' ? false : undefined,
            provider,
            userId,
            startDate,
            endDate,
            last24h: last24h === 'true'
        });

        // Enrich with cost estimate if token-cost microservice is available
        if (stats.byProviderModel && stats.byProviderModel.length > 0) {
            try {
                const costRes = await axios.post(
                    `${TOKEN_COST_SERVICE_URL}/api/token-cost/estimate`,
                    { tokens: stats.byProviderModel },
                    { timeout: 3000 }
                );
                stats.costEstimate = costRes.data;
            } catch {
                stats.costEstimate = null;
            }
        } else {
            stats.costEstimate = null;
        }

        res.json(stats);
    } catch (error) {
        console.error('Error fetching log stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Get logs for a specific session
router.get('/session/:sessionId', async (req, res) => {
    try {
        const logs = await apiLogger.getLogsBySession(req.params.sessionId);
        res.json(logs);
    } catch (error) {
        console.error('Error fetching session logs:', error);
        res.status(500).json({ error: 'Failed to fetch session logs' });
    }
});

// Export logs as CSV
router.get('/export', async (req, res) => {
    try {
        const { logType, isError, provider, startDate, endDate } = req.query;

        const { logs } = await apiLogger.getLogs({
            logType,
            isError: isError === 'true' ? true : isError === 'false' ? false : undefined,
            provider,
            startDate,
            endDate,
            limit: 10000 // Max export
        });

        // Build CSV
        const headers = [
            'Timestamp',
            'Log Type',
            'Provider',
            'Model',
            'Method',
            'Endpoint',
            'Status Code',
            'Total Tokens',
            'Latency (ms)',
            'Is Error',
            'Error Message',
            'Request Body',
            'Response Body'
        ];

        const rows = logs.map(log => [
            log.timestamp.toISOString(),
            log.logType,
            log.provider || '',
            log.model || '',
            log.method || '',
            log.endpoint || '',
            log.statusCode || '',
            log.totalTokens || '',
            log.latencyMs || '',
            log.isError ? 'Yes' : 'No',
            (log.errorMessage || '').replace(/"/g, '""'),
            (log.requestBody || '').replace(/"/g, '""').substring(0, 500),
            (log.responseBody || '').replace(/"/g, '""').substring(0, 500)
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=api_logs_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Error exporting logs:', error);
        res.status(500).json({ error: 'Failed to export logs' });
    }
});

// Clear old logs
router.delete('/cleanup', async (req, res) => {
    try {
        const { daysToKeep = 30 } = req.query;
        const deleted = await apiLogger.clearOldLogs(parseInt(daysToKeep));
        res.json({ deleted, message: `Cleared ${deleted} logs older than ${daysToKeep} days` });
    } catch (error) {
        console.error('Error cleaning up logs:', error);
        res.status(500).json({ error: 'Failed to cleanup logs' });
    }
});

module.exports = router;
