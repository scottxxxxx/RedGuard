const axios = require('axios');
const BasePlatform = require('./base-platform');

/**
 * Generic REST Platform — works with ANY chatbot that has a REST API.
 *
 * Instead of hardcoding a specific vendor's endpoints and auth, users
 * configure the connection details in botConfig:
 *
 *   botConfig = {
 *     platform:     'generic',
 *     name:         'My Botpress Bot',          // Display name (optional)
 *
 *     // ── Endpoint ──────────────────────────────────────────────
 *     chatEndpoint: 'https://api.example.com/v1/chat',
 *     chatMethod:   'POST',                      // Default: POST
 *
 *     // ── Authentication ────────────────────────────────────────
 *     authType:     'bearer',                     // 'none' | 'bearer' | 'api-key' | 'basic'
 *     authToken:    'sk-xxx',                     // For bearer / api-key
 *     authHeader:   'Authorization',              // Custom header name (api-key only, default: X-API-Key)
 *     authUser:     '',                           // For basic auth
 *     authPass:     '',                           // For basic auth
 *
 *     // ── Request Body Template ─────────────────────────────────
 *     // JSON template with {{message}}, {{userId}}, {{sessionId}} placeholders.
 *     // If omitted, sends { message, userId, sessionId } as default.
 *     requestTemplate: '{"input":{"text":"{{message}}"},"userId":"{{userId}}"}',
 *
 *     // ── Response Mapping (dot-notation paths) ─────────────────
 *     responsePath:    'output.text',             // Path to bot reply text (or array of texts)
 *     sessionIdPath:   'sessionId',               // Path to session ID in response (optional)
 *
 *     // ── Extra Headers ─────────────────────────────────────────
 *     extraHeaders:    { 'X-Custom': 'value' },   // Additional headers (optional)
 *   }
 *
 * This immediately supports: Botpress, Voiceflow, Rasa, Cognigy, Yellow.ai,
 * Microsoft Bot Framework (Direct Line), custom Flask/FastAPI/Express bots,
 * and any other service with a REST chat endpoint.
 */
class GenericRESTPlatform extends BasePlatform {
    constructor() {
        super('generic');
    }

    // ── Authentication ───────────────────────────────────────────────────

    validateConfig(botConfig) {
        if (!botConfig) {
            return { valid: false, error: 'No configuration provided.' };
        }
        if (!botConfig.chatEndpoint) {
            return { valid: false, error: 'Chat Endpoint URL is required.' };
        }
        try {
            new URL(botConfig.chatEndpoint);
        } catch {
            return { valid: false, error: 'Chat Endpoint URL is not a valid URL.' };
        }
        if (!botConfig.responsePath) {
            return { valid: false, error: 'Response Path is required (dot-notation to bot reply text, e.g., "output.text").' };
        }
        return { valid: true };
    }

    async validate(botConfig) {
        const steps = [];

        // Step 1: Config validation
        const configCheck = this.validateConfig(botConfig);
        if (!configCheck.valid) {
            steps.push({ name: 'config', passed: false, error: configCheck.error });
            return { valid: false, message: configCheck.error, steps };
        }
        steps.push({ name: 'config', passed: true });

        // Step 2: Connectivity test — send a test message
        try {
            const result = await this.sendMessage('validation-test', 'hello', botConfig);
            if (result.messages.length === 0) {
                steps.push({ name: 'connectivity', passed: true });
                steps.push({
                    name: 'response_mapping',
                    passed: false,
                    error: `Endpoint responded but no text found at path "${botConfig.responsePath}". Check your Response Path.`
                });
                return {
                    valid: false,
                    message: `Response mapping failed — no text at "${botConfig.responsePath}"`,
                    steps
                };
            }
            steps.push({ name: 'connectivity', passed: true });
            steps.push({ name: 'response_mapping', passed: true });
        } catch (err) {
            const status = err.response?.status;
            let error = err.message;
            if (status === 401 || status === 403) {
                error = `Authentication failed (${status}). Check your auth credentials.`;
            } else if (status === 404) {
                error = `Endpoint not found (404). Check the Chat Endpoint URL.`;
            } else if (err.code === 'ENOTFOUND') {
                error = 'Cannot resolve hostname. Check the Chat Endpoint URL.';
            } else if (err.code === 'ECONNREFUSED') {
                error = 'Connection refused. The server is not accepting connections.';
            }
            steps.push({ name: 'connectivity', passed: false, error });
            return { valid: false, message: error, steps };
        }

        return {
            valid: true,
            message: 'Endpoint is reachable and response mapping works',
            steps
        };
    }

    // ── Messaging ────────────────────────────────────────────────────────

    async connect(userId, botConfig) {
        // Generic REST bots don't have a formal connect step.
        // Generate a session ID and optionally send a greeting.
        const sessionId = `session-${userId}-${Date.now()}`;

        return {
            sessionId,
            botName: botConfig.name || 'Generic Bot',
            raw: { platform: 'generic', sessionId, name: botConfig.name }
        };
    }

    async sendMessage(userId, message, botConfig, sessionContext) {
        const url = botConfig.chatEndpoint;
        const method = (botConfig.chatMethod || 'POST').toUpperCase();
        const headers = this._buildHeaders(botConfig);
        const sessionId = sessionContext?.sessionId || `session-${userId}-${Date.now()}`;

        // Build request body from template or default
        let body;
        if (botConfig.requestTemplate) {
            const templateStr = typeof botConfig.requestTemplate === 'string'
                ? botConfig.requestTemplate
                : JSON.stringify(botConfig.requestTemplate);

            const filled = templateStr
                .replace(/\{\{message\}\}/g, this._escapeJsonString(message))
                .replace(/\{\{userId\}\}/g, this._escapeJsonString(userId))
                .replace(/\{\{sessionId\}\}/g, this._escapeJsonString(sessionId));

            body = JSON.parse(filled);
        } else {
            body = { message, userId, sessionId };
        }

        const config = { headers, timeout: 15000 };

        let response;
        if (method === 'GET') {
            response = await axios.get(url, { ...config, params: body });
        } else {
            response = await axios({ method: method.toLowerCase(), url, data: body, ...config });
        }

        // Extract bot reply using responsePath
        const rawText = this._resolvePath(response.data, botConfig.responsePath);
        const messages = this._normalizeMessages(rawText);

        // Extract session ID if path provided
        let responseSessionId = sessionId;
        if (botConfig.sessionIdPath) {
            const sid = this._resolvePath(response.data, botConfig.sessionIdPath);
            if (sid && typeof sid === 'string') responseSessionId = sid;
        }

        return {
            messages,
            sessionId: responseSessionId,
            raw: response.data
        };
    }

    // ── Execution Logs ───────────────────────────────────────────────────

    /**
     * Generic platforms typically don't expose execution logs via API.
     * Users can still run evaluations by chatting and evaluating the
     * conversation inline, without needing execution logs.
     */
    async fetchLogs() {
        return [];
    }

    async saveLogs() {
        // No-op for generic platform
    }

    // ── Bot Definition / Guardrail Extraction ────────────────────────────

    /**
     * Generic platforms don't support bot export.
     * Users configure guardrails manually in the RedGuard UI.
     */
    async startExport() {
        throw new Error('Bot export is not available for generic REST bots. Configure guardrails manually in RedGuard.');
    }

    async getExportStatus() {
        return { status: 'not_supported' };
    }

    async downloadAndAnalyze() {
        throw new Error('Bot export is not available for generic REST bots.');
    }

    /**
     * If a user uploads a config JSON, attempt to extract anything that
     * looks like guardrail settings. This is best-effort since we don't
     * know the schema.
     */
    analyzeConfig(botDefinition) {
        const enabledGuardrails = [];
        const topics = [];
        const regexPatterns = [];
        const descriptions = {};
        const featureDetails = {};

        if (!botDefinition) {
            return { enabledGuardrails, topics, regexPatterns, descriptions, featureDetails };
        }

        // Best-effort: look for common guardrail-like keys
        const json = JSON.stringify(botDefinition).toLowerCase();

        if (json.includes('toxicity') || json.includes('content_filter') || json.includes('safety_filter')) {
            enabledGuardrails.push('toxicity_input', 'toxicity_output');
            featureDetails.toxicity = ['Detected in bot configuration (generic match)'];
        }
        if (json.includes('banned_phrase') || json.includes('blocked_topic') || json.includes('blacklist')) {
            enabledGuardrails.push('topics_input', 'topics_output');
            featureDetails.topics = ['Detected in bot configuration (generic match)'];
        }
        if (json.includes('prompt_injection') || json.includes('injection_detection') || json.includes('prompt_security')) {
            enabledGuardrails.push('injection_input');
            featureDetails.injection = ['Detected in bot configuration (generic match)'];
        }

        return { enabledGuardrails, topics, regexPatterns, descriptions, featureDetails };
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    redactConfig(botConfig) {
        if (!botConfig) return null;
        const redacted = { ...botConfig };
        if (redacted.authToken) redacted.authToken = '[REDACTED]';
        if (redacted.authPass) redacted.authPass = '[REDACTED]';
        return redacted;
    }

    /**
     * Build HTTP headers from botConfig auth settings.
     * @private
     */
    _buildHeaders(botConfig) {
        const headers = {
            'Content-Type': 'application/json',
            ...(botConfig.extraHeaders || {})
        };

        switch (botConfig.authType) {
            case 'bearer':
                if (botConfig.authToken) {
                    headers['Authorization'] = `Bearer ${botConfig.authToken}`;
                }
                break;
            case 'api-key':
                if (botConfig.authToken) {
                    headers[botConfig.authHeader || 'X-API-Key'] = botConfig.authToken;
                }
                break;
            case 'basic':
                if (botConfig.authUser && botConfig.authPass) {
                    const encoded = Buffer.from(`${botConfig.authUser}:${botConfig.authPass}`).toString('base64');
                    headers['Authorization'] = `Basic ${encoded}`;
                }
                break;
            // 'none' or unset — no auth headers
        }

        return headers;
    }

    /**
     * Resolve a dot-notation path on an object.
     * Supports array indexing: "data[0].text" or "data.*.text" (collect all).
     * @private
     */
    _resolvePath(obj, path) {
        if (!obj || !path) return undefined;

        const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
        let current = obj;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            if (current === null || current === undefined) return undefined;

            if (part === '*' && Array.isArray(current)) {
                // Collect from all array elements using remaining path
                const remainingPath = parts.slice(i + 1).join('.');
                if (!remainingPath) return current;
                return current
                    .map(item => this._resolvePath(item, remainingPath))
                    .filter(v => v !== undefined && v !== null);
            }

            current = current[part];
        }

        return current;
    }

    /**
     * Normalize extracted response into an array of { text } objects.
     * Handles: string, array of strings, array of objects with text fields.
     * @private
     */
    _normalizeMessages(raw) {
        if (!raw) return [];

        if (typeof raw === 'string') {
            return [{ text: raw }];
        }

        if (Array.isArray(raw)) {
            return raw
                .map(item => {
                    if (typeof item === 'string') return { text: item };
                    if (item && typeof item === 'object') {
                        const text = item.text || item.val || item.message || item.content || String(item);
                        return { text };
                    }
                    return null;
                })
                .filter(Boolean);
        }

        if (typeof raw === 'object') {
            const text = raw.text || raw.val || raw.message || raw.content;
            if (text) return [{ text: typeof text === 'string' ? text : String(text) }];
        }

        return [{ text: String(raw) }];
    }

    /**
     * Escape a string for safe embedding in a JSON template.
     * @private
     */
    _escapeJsonString(str) {
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }
}

module.exports = new GenericRESTPlatform();
