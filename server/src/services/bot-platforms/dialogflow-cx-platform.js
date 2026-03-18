const BasePlatform = require('./base-platform');

/**
 * Google Dialogflow CX platform integration.
 *
 * Authentication: Google Cloud service account (JSON key file) → OAuth 2.0 access token.
 * Messaging:      Synchronous detectIntent API (no webhook polling needed).
 * Logs:           Cloud Logging API + Conversations API (v3beta1).
 * Guardrails:     RAI safety filters, banned phrases, prompt security toggle.
 * Export:         Agent export API → JSON Package zip.
 *
 * Required npm packages (install when activating this platform):
 *   npm install google-auth-library
 *
 * Required botConfig fields:
 *   - projectId:       GCP project ID
 *   - location:        Agent location (e.g., "us-central1", "global")
 *   - agentId:         Dialogflow CX agent ID
 *   - serviceAccountKey: Parsed JSON key object or path to key file
 *
 * API Reference:
 *   https://cloud.google.com/dialogflow/cx/docs/reference/rest/v3
 */
class DialogflowCXPlatform extends BasePlatform {
    constructor() {
        super('dialogflow-cx');
    }

    // ── Authentication ───────────────────────────────────────────────────

    validateConfig(botConfig) {
        if (!botConfig) {
            return { valid: false, error: 'No configuration provided.' };
        }
        if (!botConfig.projectId) {
            return { valid: false, error: 'GCP Project ID is required.' };
        }
        if (!botConfig.location) {
            return { valid: false, error: 'Agent location is required (e.g., "us-central1").' };
        }
        if (!botConfig.agentId) {
            return { valid: false, error: 'Dialogflow CX Agent ID is required.' };
        }
        if (!botConfig.serviceAccountKey) {
            return { valid: false, error: 'Service account key is required.' };
        }
        return { valid: true };
    }

    /**
     * Get an OAuth 2.0 access token from a service account key.
     * @private
     */
    async _getAccessToken(serviceAccountKey) {
        // TODO: Implement with google-auth-library
        // const { GoogleAuth } = require('google-auth-library');
        // const auth = new GoogleAuth({
        //     credentials: serviceAccountKey,
        //     scopes: ['https://www.googleapis.com/auth/dialogflow']
        // });
        // const client = await auth.getClient();
        // const { token } = await client.getAccessToken();
        // return token;
        throw new Error('Dialogflow CX: _getAccessToken() not yet implemented. Install google-auth-library and provide a service account key.');
    }

    /**
     * Build the base API URL for this agent's location.
     * @private
     */
    _baseUrl(botConfig) {
        const { location } = botConfig;
        const regionPrefix = location === 'global' ? '' : `${location}-`;
        return `https://${regionPrefix}dialogflow.googleapis.com/v3`;
    }

    /**
     * Build the full agent resource path.
     * @private
     */
    _agentPath(botConfig) {
        return `projects/${botConfig.projectId}/locations/${botConfig.location}/agents/${botConfig.agentId}`;
    }

    async validate(botConfig) {
        const steps = [];

        // Step 1: Validate service account credentials
        try {
            const token = await this._getAccessToken(botConfig.serviceAccountKey);
            steps.push({ name: 'credentials', passed: true });
        } catch (err) {
            steps.push({ name: 'credentials', passed: false, error: `Service account auth failed: ${err.message}` });
            return { valid: false, message: err.message, steps };
        }

        // Step 2: Verify agent exists (GET agent)
        // TODO: GET {baseUrl}/{agentPath}
        // const axios = require('axios');
        // const url = `${this._baseUrl(botConfig)}/${this._agentPath(botConfig)}`;
        // const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        steps.push({ name: 'agent_exists', passed: false, error: 'Not yet implemented' });

        // Step 3: Test detectIntent
        // TODO: POST {baseUrl}/{agentPath}/sessions/test-session:detectIntent
        steps.push({ name: 'detect_intent', passed: false, error: 'Not yet implemented' });

        return {
            valid: false,
            message: 'Dialogflow CX validation not yet fully implemented',
            steps
        };
    }

    // ── Messaging ────────────────────────────────────────────────────────

    /**
     * Dialogflow CX connect is a no-op for session initialization.
     * Sessions are created implicitly on the first detectIntent call.
     * We generate a session ID and optionally fetch agent metadata.
     */
    async connect(userId, botConfig) {
        // Generate a session ID (Dialogflow sessions are developer-managed)
        const sessionId = `redguard-${userId}-${Date.now()}`;

        // TODO: Optionally fetch agent displayName via GET {baseUrl}/{agentPath}
        // const token = await this._getAccessToken(botConfig.serviceAccountKey);
        // const axios = require('axios');
        // const url = `${this._baseUrl(botConfig)}/${this._agentPath(botConfig)}`;
        // const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        // const botName = res.data.displayName;

        return {
            sessionId,
            botName: null, // Will be populated when implemented
            raw: { platform: 'dialogflow-cx', sessionId }
        };
    }

    /**
     * Send a message via the synchronous detectIntent API.
     * Unlike Kore.ai's async webhook, Dialogflow returns the response inline.
     */
    async sendMessage(userId, message, botConfig, sessionContext) {
        // TODO: Implement detectIntent call
        //
        // const token = await this._getAccessToken(botConfig.serviceAccountKey);
        // const axios = require('axios');
        // const sessionId = sessionContext?.sessionId || `redguard-${userId}-${Date.now()}`;
        // const sessionPath = `${this._agentPath(botConfig)}/sessions/${sessionId}`;
        // const url = `${this._baseUrl(botConfig)}/${sessionPath}:detectIntent`;
        //
        // const response = await axios.post(url, {
        //     queryInput: {
        //         text: { text: message },
        //         languageCode: botConfig.languageCode || 'en'
        //     }
        // }, {
        //     headers: {
        //         Authorization: `Bearer ${token}`,
        //         'Content-Type': 'application/json'
        //     }
        // });
        //
        // const queryResult = response.data.queryResult;
        // const messages = (queryResult.responseMessages || [])
        //     .filter(m => m.text)
        //     .map(m => ({ text: m.text.text.join('\n') }));
        //
        // return { messages, sessionId, raw: response.data };

        throw new Error('Dialogflow CX: sendMessage() not yet implemented.');
    }

    // ── Execution Logs ───────────────────────────────────────────────────

    /**
     * Fetch conversation logs from Dialogflow CX.
     *
     * Two possible sources:
     * 1. Conversations API (v3beta1) — structured conversation history
     * 2. Cloud Logging API — raw request/response logs
     *
     * The Conversations API is more suitable for evaluation since it provides
     * turn-by-turn data with matched intents and agent responses.
     */
    async fetchLogs(botConfig, filters) {
        // TODO: Implement Conversations API call
        //
        // const token = await this._getAccessToken(botConfig.serviceAccountKey);
        // const axios = require('axios');
        // const baseUrl = this._baseUrl(botConfig).replace('/v3', '/v3beta1');
        // const parent = this._agentPath(botConfig);
        // const url = `${baseUrl}/${parent}/conversations`;
        //
        // Build filter string from date range:
        // const filterStr = `createTime>"${filters.dateFrom}" AND createTime<"${filters.dateTo}"`;
        //
        // const res = await axios.get(url, {
        //     headers: { Authorization: `Bearer ${token}` },
        //     params: { filter: filterStr, pageSize: filters.limit || 50 }
        // });
        //
        // Map to standardized LogEntry format:
        // return (res.data.conversations || []).map(conv => ({
        //     id: conv.name,
        //     timestamp: conv.startTime,
        //     sessionId: conv.name.split('/').pop(),
        //     featureName: 'detect_intent',
        //     model: null,
        //     status: conv.metrics?.hasEndInteraction ? 'completed' : 'active',
        //     description: null,
        //     requestPayload: null,
        //     responsePayload: null,
        //     inputTokens: 0,
        //     outputTokens: 0,
        //     totalTokens: 0,
        //     channelUserId: null
        // }));

        throw new Error('Dialogflow CX: fetchLogs() not yet implemented.');
    }

    async saveLogs(logs, botConfig, prisma) {
        // TODO: Implement log persistence
        // Would need a generic log table or a platform-specific one
        // For now, the KoreLLMLog table is Kore-specific
        throw new Error('Dialogflow CX: saveLogs() not yet implemented.');
    }

    // ── Bot Definition / Guardrail Extraction ────────────────────────────

    /**
     * Export a Dialogflow CX agent as a JSON Package zip.
     *
     * Unlike Kore.ai's separate initiate/poll/download flow, Dialogflow's
     * export returns a long-running Operation that resolves to the export content.
     */
    async startExport(botConfig) {
        // TODO: Implement agent export
        //
        // const token = await this._getAccessToken(botConfig.serviceAccountKey);
        // const axios = require('axios');
        // const url = `${this._baseUrl(botConfig)}/${this._agentPath(botConfig)}:export`;
        //
        // const res = await axios.post(url, {
        //     dataFormat: 'JSON_PACKAGE'
        //     // omit agentUri to get content inline
        // }, {
        //     headers: {
        //         Authorization: `Bearer ${token}`,
        //         'Content-Type': 'application/json'
        //     }
        // });
        //
        // Returns an Operation: { name: "projects/.../operations/OP_ID", ... }
        // const operationName = res.data.name;
        // return operationName; // Use as jobId for polling

        throw new Error('Dialogflow CX: startExport() not yet implemented.');
    }

    async getExportStatus(jobId) {
        // TODO: Poll operation status
        // GET https://{region}-dialogflow.googleapis.com/v3/{operationName}
        // When done: result.agentContent contains base64-encoded zip
        throw new Error('Dialogflow CX: getExportStatus() not yet implemented.');
    }

    async downloadAndAnalyze(jobId, downloadUrl) {
        // TODO: Decode base64 agentContent, extract agent.json, parse safety settings
        throw new Error('Dialogflow CX: downloadAndAnalyze() not yet implemented.');
    }

    /**
     * Analyze a Dialogflow CX agent definition for guardrail settings.
     *
     * Dialogflow CX guardrails map to RedGuard types as follows:
     *   - RAI safety filters (hate, dangerous, sexual, harassment) → toxicity
     *   - Banned phrases → topics / regex
     *   - Prompt security toggle → injection
     *
     * @param {Object} agentDefinition - Parsed agent.json from export
     */
    analyzeConfig(agentDefinition) {
        const enabledGuardrails = [];
        const topics = [];
        const regexPatterns = [];
        const descriptions = {};
        const featureDetails = {};

        if (!agentDefinition) {
            return { enabledGuardrails, topics, regexPatterns, descriptions, featureDetails };
        }

        // TODO: Parse generativeSettings for RAI filters
        //
        // const genSettings = agentDefinition.genAppBuilderSettings ||
        //                     agentDefinition.advancedSettings?.speechSettings; // varies by export format
        //
        // RAI safety filters → toxicity guardrail
        // if (genSettings?.safetySettings) {
        //     const hasFilters = genSettings.safetySettings.some(s =>
        //         s.threshold !== 'BLOCK_NONE'
        //     );
        //     if (hasFilters) {
        //         enabledGuardrails.push('toxicity_input', 'toxicity_output');
        //         featureDetails.toxicity = genSettings.safetySettings.map(s =>
        //             `${s.category}: ${s.threshold}`
        //         );
        //     }
        // }
        //
        // Banned phrases → topics guardrail
        // if (genSettings?.bannedPhrases?.length > 0) {
        //     enabledGuardrails.push('topics_input', 'topics_output');
        //     topics.push(...genSettings.bannedPhrases.map(p => p.value || p));
        //     featureDetails.topics = [`${topics.length} banned phrases configured`];
        // }
        //
        // Prompt security → injection guardrail
        // if (genSettings?.llmSecuritySettings?.promptSecurityEnabled) {
        //     enabledGuardrails.push('injection_input');
        //     featureDetails.injection = ['Dialogflow prompt security enabled'];
        // }

        return { enabledGuardrails, topics, regexPatterns, descriptions, featureDetails };
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    redactConfig(botConfig) {
        if (!botConfig) return null;
        return {
            ...botConfig,
            serviceAccountKey: '[REDACTED]'
        };
    }
}

module.exports = new DialogflowCXPlatform();
