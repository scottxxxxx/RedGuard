const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { v4: uuidv4 } = require('uuid');

class ApiLogger {
    constructor() {
        this.sessionId = null;
    }

    /**
     * Start a new session for grouping related requests
     */
    startSession() {
        this.sessionId = uuidv4();
        return this.sessionId;
    }

    /**
     * Log an API request/response
     * @param {object} params
     * @param {string} params.logType - 'kore_chat', 'llm_evaluate', 'garak'
     * @param {string} params.method - HTTP method
     * @param {string} params.endpoint - URL or endpoint
     * @param {object} params.requestBody - Request body (will be stringified)
     * @param {object} params.requestHeaders - Headers (will be sanitized)
     * @param {number} params.statusCode - Response status code
     * @param {object} params.responseBody - Response body (will be stringified)
     * @param {number} params.latencyMs - Request duration
     * @param {boolean} params.isError - Whether this is an error
     * @param {string} params.errorMessage - Error message if applicable
     * @param {string} params.provider - LLM provider
     * @param {string} params.model - Model used
     * @param {string} params.sessionId - Optional session ID override
     */
    async log({
        logType,
        method,
        endpoint,
        requestBody,
        requestHeaders,
        statusCode,
        responseBody,
        latencyMs,
        isError = false,
        errorMessage,
        provider,
        model,
        sessionId,
        totalTokens
    }) {
        try {
            // Sanitize headers (remove sensitive info)
            const sanitizedHeaders = this.sanitizeHeaders(requestHeaders);

            // Truncate large bodies to prevent DB bloat
            const truncatedRequest = this.truncateBody(requestBody, 10000);
            const truncatedResponse = this.truncateBody(responseBody, 10000);

            const logEntry = await prisma.apiLog.create({
                data: {
                    logType,
                    method,
                    endpoint: endpoint?.substring(0, 500), // Limit URL length
                    requestBody: truncatedRequest,
                    requestHeaders: sanitizedHeaders,
                    statusCode,
                    responseBody: truncatedResponse,
                    latencyMs,
                    // totalTokens, // Column missing in DB
                    isError,
                    errorMessage: errorMessage?.substring(0, 1000),
                    provider,
                    model,
                    sessionId: sessionId || this.sessionId
                }
            });

            return logEntry;
        } catch (error) {
            // Don't let logging errors affect the main application
            console.error('ApiLogger Error:', error.message);
            return null;
        }
    }

    /**
     * Helper to log a complete request/response cycle
     */
    async logRequest(logType, method, endpoint, requestBody, requestHeaders, provider, model) {
        const startTime = Date.now();

        return {
            startTime,
            complete: async (statusCode, responseBody, isError = false, errorMessage = null) => {
                const latencyMs = Date.now() - startTime;
                return this.log({
                    logType,
                    method,
                    endpoint,
                    requestBody,
                    requestHeaders,
                    statusCode,
                    responseBody,
                    latencyMs,
                    isError,
                    errorMessage,
                    provider,
                    model
                });
            }
        };
    }

    /**
     * Sanitize headers to remove sensitive information
     */
    sanitizeHeaders(headers) {
        if (!headers) return null;

        const sanitized = { ...headers };
        const sensitiveKeys = ['authorization', 'x-api-key', 'api-key', 'bearer', 'token', 'secret'];

        for (const key of Object.keys(sanitized)) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                sanitized[key] = '[REDACTED]';
            }
        }

        return JSON.stringify(sanitized);
    }

    /**
     * Truncate body to prevent DB bloat
     */
    truncateBody(body, maxLength = 10000) {
        if (!body) return null;

        let stringified;
        if (typeof body === 'string') {
            stringified = body;
        } else {
            try {
                stringified = JSON.stringify(body, null, 2);
            } catch {
                stringified = String(body);
            }
        }

        if (stringified.length > maxLength) {
            return stringified.substring(0, maxLength) + '\n... [TRUNCATED]';
        }

        return stringified;
    }

    /**
     * Fetch logs with filtering
     */
    async getLogs({
        logType,
        isError,
        provider,
        startDate,
        endDate,
        limit = 100,
        offset = 0
    } = {}) {
        const where = {};

        if (logType) where.logType = logType;
        if (isError !== undefined) where.isError = isError;
        if (provider) where.provider = provider;
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) where.timestamp.gte = new Date(startDate);
            if (endDate) where.timestamp.lte = new Date(endDate);
        }

        const [logs, total] = await Promise.all([
            prisma.apiLog.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                take: limit,
                skip: offset
            }),
            prisma.apiLog.count({ where })
        ]);

        return { logs, total };
    }

    /**
     * Get logs grouped by session
     */
    async getLogsBySession(sessionId) {
        return prisma.apiLog.findMany({
            where: { sessionId },
            orderBy: { timestamp: 'asc' }
        });
    }

    /**
     * Get summary statistics
     */
    async getStats(startDate, endDate) {
        const where = {};
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) where.timestamp.gte = new Date(startDate);
            if (endDate) where.timestamp.lte = new Date(endDate);
        }

        const [totalLogs, errorLogs, byType, byProvider] = await Promise.all([
            prisma.apiLog.count({ where }),
            prisma.apiLog.count({ where: { ...where, isError: true } }),
            prisma.apiLog.groupBy({
                by: ['logType'],
                where,
                _count: true
            }),
            prisma.apiLog.groupBy({
                by: ['provider'],
                where,
                _count: true,
                _avg: { latencyMs: true }
            })
        ]);

        return {
            totalLogs,
            errorLogs,
            errorRate: totalLogs > 0 ? (errorLogs / totalLogs * 100).toFixed(2) : 0,
            byType: byType.reduce((acc, item) => {
                acc[item.logType] = item._count;
                return acc;
            }, {}),
            byProvider: byProvider.map(item => ({
                provider: item.provider || 'unknown',
                count: item._count,
                avgLatencyMs: Math.round(item._avg.latencyMs || 0)
            }))
        };
    }

    /**
     * Clear old logs (retention policy)
     */
    async clearOldLogs(daysToKeep = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await prisma.apiLog.deleteMany({
            where: {
                timestamp: { lt: cutoffDate }
            }
        });

        return result.count;
    }
}

module.exports = new ApiLogger();
