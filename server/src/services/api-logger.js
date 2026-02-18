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
     * @param {string} params.userId - User ID (email from Google auth)
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
        userId,
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
                    userId,
                    logType,
                    method,
                    endpoint: endpoint?.substring(0, 500), // Limit URL length
                    requestBody: truncatedRequest,
                    requestHeaders: sanitizedHeaders,
                    statusCode,
                    responseBody: truncatedResponse,
                    latencyMs,
                    totalTokens,
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
            complete: async (statusCode, responseBody, isError = false, errorMessage = null, totalTokens = null) => {
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
                    model,
                    totalTokens
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
        userId,
        startDate,
        endDate,
        limit = 100,
        offset = 0
    } = {}) {
        const where = {};

        if (logType) where.logType = logType;
        if (isError !== undefined) where.isError = isError;
        if (provider) where.provider = provider;
        if (userId) where.userId = { contains: userId };
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) where.timestamp.gte = new Date(startDate);
            if (endDate) {
                // Date-only strings (e.g. "2026-02-18") parse to midnight UTC.
                // Set to end of day so the selected date is fully included.
                const end = new Date(endDate);
                end.setUTCHours(23, 59, 59, 999);
                where.timestamp.lte = end;
            }
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
    async getStats({ logType, isError, provider, userId, startDate, endDate, last24h: isLast24h = false } = {}) {
        const where = {};

        if (logType) where.logType = logType;
        if (isError !== undefined) where.isError = isError;
        if (provider) where.provider = provider;
        if (userId) where.userId = { contains: userId };
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) where.timestamp.gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setUTCHours(23, 59, 59, 999);
                where.timestamp.lte = end;
            }
        }

        // Compute previous period for trend comparison
        let prevPeriodWhere = null;
        const currentStart = where.timestamp?.gte;
        const currentEnd = where.timestamp?.lte;
        if (currentStart && currentEnd) {
            const durationMs = currentEnd.getTime() - currentStart.getTime();
            const prevStart = new Date(currentStart.getTime() - durationMs);
            const prevEnd = new Date(currentStart.getTime() - 1); // 1ms before current start
            prevPeriodWhere = { ...where, timestamp: { gte: prevStart, lte: prevEnd } };
        } else if (currentEnd && !currentStart) {
            // Only endDate: compare vs same duration ending before earliest log
            // Skip — not enough info for meaningful comparison
        }
        // No date filter: compute last 24h vs daily average instead of prev period
        const isUnfiltered = !currentStart && !currentEnd;

        const [totalLogs, errorLogs, byType, byProvider, tokensSum, latencyAvg, chatLatency, chatErrors, evalTokensSum, errorsByType, lastError] = await Promise.all([
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
                _avg: { latencyMs: true },
                _sum: { totalTokens: true }
            }),
            prisma.apiLog.aggregate({
                where,
                _sum: { totalTokens: true }
            }),
            prisma.apiLog.aggregate({
                where,
                _avg: { latencyMs: true },
                _max: { latencyMs: true }
            }),
            // Chat-specific latency
            prisma.apiLog.aggregate({
                where: { ...where, logType: 'kore_chat' },
                _avg: { latencyMs: true },
                _max: { latencyMs: true }
            }),
            // Chat error count
            prisma.apiLog.count({ where: { ...where, logType: 'kore_chat', isError: true } }),
            // Eval-specific token sum
            prisma.apiLog.aggregate({
                where: { ...where, logType: 'llm_evaluate' },
                _sum: { totalTokens: true }
            }),
            // Errors grouped by logType
            prisma.apiLog.groupBy({
                by: ['logType'],
                where: { ...where, isError: true },
                _count: true
            }),
            // Most recent error
            prisma.apiLog.findFirst({
                where: { ...where, isError: true },
                orderBy: { timestamp: 'desc' },
                select: { timestamp: true, logType: true, errorMessage: true }
            })
        ]);

        // Fetch comparison data
        let prevTotal = null;
        let last24h = null;
        let dailyAvg = null;

        if (isLast24h && totalLogs > 0) {
            // Last 24h mode: compute daily average from ALL logs for comparison
            const now = new Date();
            const baseWhere = { ...where };
            delete baseWhere.timestamp; // Remove date filter to get all-time stats
            const [allTimeCount, oldest] = await Promise.all([
                prisma.apiLog.count({ where: baseWhere }),
                prisma.apiLog.findFirst({ where: baseWhere, orderBy: { timestamp: 'asc' }, select: { timestamp: true } })
            ]);
            last24h = totalLogs; // current filtered count IS the last 24h
            if (oldest) {
                const daySpan = Math.max(1, Math.ceil((now.getTime() - oldest.timestamp.getTime()) / (24 * 60 * 60 * 1000)));
                dailyAvg = Math.round(allTimeCount / daySpan);
            }
        } else if (prevPeriodWhere && !isUnfiltered) {
            prevTotal = await prisma.apiLog.count({ where: prevPeriodWhere });
        }

        // Eval outcome stats from EvaluationRun table
        const evalWhere = {};
        if (userId) evalWhere.userId = { contains: userId };
        if (where.timestamp) {
            evalWhere.createdAt = {};
            if (where.timestamp.gte) evalWhere.createdAt.gte = where.timestamp.gte;
            if (where.timestamp.lte) evalWhere.createdAt.lte = where.timestamp.lte;
        }
        const [evalPassed, evalFailed, evalTotal] = await Promise.all([
            prisma.evaluationRun.count({ where: { ...evalWhere, overallPass: true } }),
            prisma.evaluationRun.count({ where: { ...evalWhere, overallPass: false } }),
            prisma.evaluationRun.count({ where: evalWhere })
        ]);

        return {
            totalLogs,
            errorLogs,
            totalTokens: tokensSum._sum.totalTokens || 0,
            avgLatencyMs: Math.round(latencyAvg._avg.latencyMs || 0),
            maxLatencyMs: Math.round(latencyAvg._max.latencyMs || 0),
            errorRate: totalLogs > 0 ? (errorLogs / totalLogs * 100).toFixed(2) : 0,
            prevPeriodTotal: prevTotal,
            last24h,
            dailyAvg,
            evalTokens: evalTokensSum._sum.totalTokens || 0,
            evalOutcome: { passed: evalPassed, failed: evalFailed, total: evalTotal },
            chatStats: {
                avgLatencyMs: Math.round(chatLatency._avg.latencyMs || 0),
                maxLatencyMs: Math.round(chatLatency._max.latencyMs || 0),
                errorCount: chatErrors
            },
            byType: byType.reduce((acc, item) => {
                acc[item.logType] = item._count;
                return acc;
            }, {}),
            byProvider: byProvider.map(item => ({
                provider: item.provider || 'unknown',
                count: item._count,
                avgLatencyMs: Math.round(item._avg.latencyMs || 0),
                totalTokens: item._sum.totalTokens || 0
            })),
            errorsByType: errorsByType.reduce((acc, item) => {
                acc[item.logType] = item._count;
                return acc;
            }, {}),
            lastError: lastError ? {
                timestamp: lastError.timestamp,
                logType: lastError.logType,
                errorMessage: lastError.errorMessage?.substring(0, 100)
            } : null
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
