const BasePlatform = require('./base-platform');
const koreWebhook = require('../kore-webhook');
const koreApi = require('../kore-api');
const BackupService = require('../backup-service');
const botConfigAnalyzer = require('../bot-config-analyzer');

/**
 * Kore.ai XO Platform integration.
 *
 * Delegates to existing service modules (kore-webhook, kore-api,
 * backup-service, bot-config-analyzer) so no Kore-specific logic is
 * duplicated. This class simply maps the BasePlatform interface onto
 * the existing Kore services.
 */
class KorePlatform extends BasePlatform {
    constructor() {
        super('kore');
    }

    // ── Authentication ───────────────────────────────────────────────────

    validateConfig(botConfig) {
        if (!botConfig) {
            return { valid: false, error: 'No configuration provided.' };
        }
        if (!botConfig.host && !botConfig.webhookUrl) {
            return { valid: false, error: 'Host or Webhook URL is required.' };
        }
        if (!botConfig.botId) {
            return { valid: false, error: 'Bot ID is required.' };
        }
        if (!botConfig.clientId || !botConfig.clientSecret) {
            return { valid: false, error: 'Client ID and Client Secret are required.' };
        }
        return { valid: true };
    }

    async validate(botConfig) {
        const steps = [];

        // Step 1: Validate credentials and bot existence
        try {
            const botInfo = await koreApi.getBotInfo(botConfig);
            console.log(`[Validation] Credentials valid, bot found: ${botInfo.name || botInfo.id}`);
            steps.push({ name: 'credentials', passed: true });
        } catch (err) {
            let error = err.message;
            if (error.includes('401') || error.includes('403')) {
                error = 'Invalid credentials - Client ID or Secret is incorrect';
            } else if (error.includes('not found')) {
                error = 'Bot not found - Bot ID does not exist in your Kore.ai account';
            } else {
                error = `Credential validation failed: ${error}`;
            }
            steps.push({ name: 'credentials', passed: false, error });
            return { valid: false, message: error, steps };
        }

        // Step 2: Validate webhook URL
        try {
            const testUserId = `validation-${Date.now()}`;
            await koreWebhook.sendMessage(
                testUserId,
                { type: 'event', val: 'ON_CONNECT' },
                { new: true },
                botConfig
            );
            console.log(`[Validation] Webhook connection successful`);
            steps.push({ name: 'webhook', passed: true });
        } catch (err) {
            let error = err.message;
            if (err.response?.status === 404) {
                error = 'Webhook URL not found (404) - The webhook endpoint does not exist. Check the URL format.';
            } else if (err.code === 'ENOTFOUND') {
                error = 'Webhook URL unreachable - Cannot resolve hostname. Check if the URL is correct.';
            } else if (err.code === 'ECONNREFUSED') {
                error = 'Webhook connection refused - The server is not accepting connections.';
            } else {
                error = `Webhook validation failed (credentials are valid): ${error}`;
            }
            steps.push({ name: 'webhook', passed: false, error });
            return { valid: false, message: error, steps };
        }

        // Step 3: Validate Gen AI Logs API access
        try {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            await koreApi.getLLMUsageLogs(botConfig, {
                dateFrom: oneHourAgo.toISOString(),
                dateTo: now.toISOString(),
                limit: 1
            });
            console.log(`[Validation] Gen AI Logs API access confirmed`);
            steps.push({ name: 'logs_api', passed: true });
        } catch (err) {
            let error = err.message;
            if (error.includes('401') || error.includes('403') || error.includes('Authentication Failed')) {
                error = "Gen AI Logs API access denied - Please go to your Kore.ai App settings → API Scopes and enable 'Gen AI and LLM Usage Logs'. This scope is REQUIRED for RedGuard to evaluate bot responses.";
            } else {
                error = `Gen AI Logs API validation failed: ${error}`;
            }
            steps.push({ name: 'logs_api', passed: false, error });
            return { valid: false, message: error, steps };
        }

        return {
            valid: true,
            message: 'All validations passed: credentials, webhook, and Gen AI Logs API',
            steps
        };
    }

    // ── Messaging ────────────────────────────────────────────────────────

    async connect(userId, botConfig) {
        const response = await koreWebhook.sendMessage(
            userId,
            { type: 'event', val: 'ON_CONNECT' },
            { new: true },
            botConfig
        );

        // Extract bot name from various response locations
        let botName = null;
        if (response.botInfo) {
            botName = response.botInfo.name || response.botInfo.chatBot || response.botInfo.botName;
        }
        if (!botName && response.metadata) {
            botName = response.metadata.botName || response.metadata.name;
        }
        if (!botName && response.context) {
            botName = response.context.botName;
        }

        // Extract session ID
        let sessionId = null;
        if (response.sessionId) {
            sessionId = response.sessionId;
        } else if (response.session?.id) {
            sessionId = response.session.id;
        }

        return { sessionId, botName, raw: response };
    }

    async sendMessage(userId, message, botConfig) {
        const response = await koreWebhook.sendMessage(
            userId,
            { type: 'text', val: message },
            { new: true },
            botConfig
        );

        // Normalize response messages
        let messages = [];
        if (response.data && Array.isArray(response.data)) {
            messages = response.data.map(m => ({ text: m.val || m.text || '' }));
        } else if (response.text) {
            messages = [{ text: response.text }];
        }

        const sessionId = response.sessionId || response.session?.id || null;

        return { messages, sessionId, raw: response };
    }

    // ── Execution Logs ───────────────────────────────────────────────────

    async fetchLogs(botConfig, filters) {
        return koreApi.getLLMUsageLogs(botConfig, filters);
    }

    async saveLogs(logs, botConfig, prisma) {
        return koreApi.saveLLMLogs(logs, botConfig, prisma);
    }

    // ── Bot Definition / Guardrail Extraction ────────────────────────────

    async startExport(botConfig) {
        if (!botConfig.botId || !botConfig.clientId || !botConfig.clientSecret) {
            throw new Error('Bot ID, Client ID, and Client Secret are required.');
        }

        const { platformHost, botsHost } = BackupService.deriveHosts(botConfig.host);

        return BackupService.startBackup(
            botConfig.botId,
            botConfig.clientId,
            botConfig.clientSecret,
            platformHost,
            botsHost
        );
    }

    async getExportStatus(jobId) {
        return BackupService.getJobStatus(jobId);
    }

    async downloadAndAnalyze(jobId, downloadUrl) {
        return BackupService.downloadAndAnalyze(jobId, downloadUrl);
    }

    analyzeConfig(botDefinition) {
        return botConfigAnalyzer.analyze(botDefinition);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    redactConfig(botConfig) {
        if (!botConfig) return null;
        return {
            ...botConfig,
            clientSecret: '[REDACTED]',
            inspectorClientSecret: botConfig.inspectorClientSecret ? '[REDACTED]' : undefined
        };
    }
}

module.exports = new KorePlatform();
