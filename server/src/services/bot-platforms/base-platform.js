/**
 * Base class for all bot platform integrations.
 *
 * Each platform (Kore.ai, Dialogflow CX, Amazon Lex, etc.) extends this class
 * and implements the abstract methods below. The chat routes and evaluation
 * pipeline interact with platforms exclusively through this interface.
 *
 * Standardized response shapes:
 *
 *   ConnectResult  = { sessionId, botName, raw }
 *   MessageResult  = { messages: [{ text }], sessionId, raw }
 *   LogEntry       = { id, timestamp, sessionId, featureName, model, status,
 *                      description, requestPayload, responsePayload,
 *                      inputTokens, outputTokens, totalTokens, channelUserId }
 *   GuardrailConfig = { enabledGuardrails, topics, regexPatterns, descriptions, featureDetails }
 *   ValidationResult = { valid, message, steps: [{ name, passed, error? }] }
 */
class BasePlatform {
    constructor(name) {
        this.name = name;
    }

    // ── Authentication ───────────────────────────────────────────────────

    /**
     * Validate that the provided botConfig has all required fields for this platform.
     * Returns { valid: true } or { valid: false, error: "..." }.
     * @param {Object} botConfig - Platform-specific configuration
     */
    validateConfig(botConfig) {
        throw new Error(`${this.name}: validateConfig() not implemented`);
    }

    /**
     * Run a multi-step validation (credentials, connectivity, API scopes).
     * Returns a ValidationResult.
     * @param {Object} botConfig
     */
    async validate(botConfig) {
        throw new Error(`${this.name}: validate() not implemented`);
    }

    // ── Messaging ────────────────────────────────────────────────────────

    /**
     * Initialize a conversation session with the bot.
     * Returns a ConnectResult: { sessionId, botName, raw }.
     * @param {string} userId - RedGuard user identifier
     * @param {Object} botConfig - Platform-specific configuration
     */
    async connect(userId, botConfig) {
        throw new Error(`${this.name}: connect() not implemented`);
    }

    /**
     * Send a text message to the bot and return the response.
     * Returns a MessageResult: { messages: [{ text }], sessionId, raw }.
     * @param {string} userId
     * @param {string} message - User message text
     * @param {Object} botConfig
     * @param {Object} [sessionContext] - Platform-specific session state
     */
    async sendMessage(userId, message, botConfig, sessionContext) {
        throw new Error(`${this.name}: sendMessage() not implemented`);
    }

    // ── Execution Logs ───────────────────────────────────────────────────

    /**
     * Fetch LLM/execution logs from the platform.
     * Returns an array of LogEntry objects.
     * @param {Object} botConfig
     * @param {Object} filters - { dateFrom, dateTo, limit, sessionIds?, channelUserIds? }
     */
    async fetchLogs(botConfig, filters) {
        throw new Error(`${this.name}: fetchLogs() not implemented`);
    }

    /**
     * Save fetched logs to the local database.
     * @param {Array} logs - Array of LogEntry objects
     * @param {Object} botConfig
     * @param {Object} prisma - Prisma client instance
     */
    async saveLogs(logs, botConfig, prisma) {
        throw new Error(`${this.name}: saveLogs() not implemented`);
    }

    // ── Bot Definition / Guardrail Extraction ────────────────────────────

    /**
     * Start an async export/backup of the bot definition.
     * Returns a jobId string for polling.
     * @param {Object} botConfig
     */
    async startExport(botConfig) {
        throw new Error(`${this.name}: startExport() not implemented`);
    }

    /**
     * Check export job status. Returns job data with status field.
     * @param {string} jobId
     */
    async getExportStatus(jobId) {
        throw new Error(`${this.name}: getExportStatus() not implemented`);
    }

    /**
     * Download and analyze a completed export to extract guardrail config.
     * Returns a GuardrailConfig object.
     * @param {string} jobId
     * @param {string} downloadUrl
     */
    async downloadAndAnalyze(jobId, downloadUrl) {
        throw new Error(`${this.name}: downloadAndAnalyze() not implemented`);
    }

    /**
     * Analyze a bot definition object (already parsed JSON) for guardrail config.
     * Returns a GuardrailConfig object.
     * @param {Object} botDefinition - The parsed bot definition JSON
     */
    analyzeConfig(botDefinition) {
        throw new Error(`${this.name}: analyzeConfig() not implemented`);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    /**
     * Redact sensitive fields from botConfig for logging.
     * @param {Object} botConfig
     */
    redactConfig(botConfig) {
        if (!botConfig) return null;
        return { ...botConfig, clientSecret: '[REDACTED]' };
    }

    /**
     * The platform name used in ApiLog.provider field.
     */
    get providerName() {
        return this.name;
    }
}

module.exports = BasePlatform;
