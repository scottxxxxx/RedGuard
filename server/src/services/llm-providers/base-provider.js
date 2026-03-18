const axios = require('axios');

/**
 * Base class for all LLM providers.
 * Handles the common call → parse → extract tokens flow.
 * Subclasses override specific methods for provider differences.
 */
class BaseProvider {
    constructor(name) {
        this.name = name;
    }

    /**
     * Make the API call and return a standardized result.
     * Most providers follow: build payload → POST → extract text → strip fences → parse JSON → extract tokens.
     */
    async call(apiKey, model, prompt, params, overridePayload, templateOpts) {
        const requestPayload = overridePayload || this.constructPayload(model, prompt, params, templateOpts);
        const { url, headers } = this.getEndpoint(apiKey, model);

        const response = await axios.post(url, requestPayload, { headers });

        const rawText = this.extractRawText(response.data);

        if (!rawText) {
            throw new Error(`Empty response from ${this.name}. ${this.getFinishReasonMessage(response.data)}`);
        }

        const cleanedText = this.stripMarkdownFences(rawText);
        const totalTokens = this.extractTokens(response.data);

        return {
            parsed: JSON.parse(cleanedText),
            rawText,
            fullResponse: JSON.stringify(response.data, null, 2),
            requestPayload: JSON.stringify(requestPayload, null, 2),
            totalTokens
        };
    }

    /**
     * Build the request payload. Must be overridden by subclasses.
     */
    constructPayload(model, prompt, params, templateOpts) {
        throw new Error(`${this.name}: constructPayload() not implemented`);
    }

    /**
     * Return { url, headers } for the API call. Must be overridden by subclasses.
     */
    getEndpoint(apiKey, model) {
        throw new Error(`${this.name}: getEndpoint() not implemented`);
    }

    /**
     * Extract the raw text content from the API response. Must be overridden by subclasses.
     */
    extractRawText(responseData) {
        throw new Error(`${this.name}: extractRawText() not implemented`);
    }

    /**
     * Return a human-readable finish reason message for error reporting.
     */
    getFinishReasonMessage(responseData) {
        return 'Finish reason: unknown';
    }

    /**
     * Extract total token count from provider response.
     */
    extractTokens(responseData) {
        if (!responseData) return null;

        let tokens = null;

        // Try provider-specific paths first
        tokens = this._extractTokensFromResponse(responseData);

        // Fallback: generic search
        if (tokens === null || tokens === undefined) {
            const usage = responseData.usage || responseData.usageMetadata || responseData.usage_metadata;
            if (usage) {
                tokens = usage.total_tokens || usage.totalTokenCount || usage.total_token_count ||
                    ((usage.input_tokens || 0) + (usage.output_tokens || 0));
            }
        }

        return typeof tokens === 'number' ? tokens : null;
    }

    /**
     * Provider-specific token extraction. Override in subclasses.
     */
    _extractTokensFromResponse(responseData) {
        return null;
    }

    /**
     * Strip markdown JSON fences from LLM output.
     */
    stripMarkdownFences(text) {
        return text.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    /**
     * The API endpoint hostname used for logging.
     */
    get logEndpoint() {
        return this.name;
    }
}

module.exports = BaseProvider;
