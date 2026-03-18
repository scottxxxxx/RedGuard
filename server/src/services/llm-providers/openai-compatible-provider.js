const BaseProvider = require('./base-provider');
const openaiProvider = require('./openai-provider');

/**
 * Base class for providers that use the OpenAI Chat Completions API format
 * (DeepSeek, Qwen, Kimi, etc.) but have different endpoints.
 */
class OpenAICompatibleProvider extends BaseProvider {
    constructor(name, endpoint, logHost) {
        super(name);
        this._endpoint = endpoint;
        this._logHost = logHost;
    }

    getEndpoint(apiKey) {
        return {
            url: this._endpoint,
            headers: { 'Authorization': `Bearer ${apiKey}` }
        };
    }

    /**
     * Reuse OpenAI's Chat Completions payload construction.
     */
    constructPayload(model, prompt, params, templateOpts) {
        return openaiProvider.constructPayload(model, prompt, params, templateOpts);
    }

    extractRawText(responseData) {
        return responseData.choices?.[0]?.message?.content || '';
    }

    getFinishReasonMessage(responseData) {
        return `Finish reason: ${responseData.choices?.[0]?.finish_reason || 'unknown'}`;
    }

    _extractTokensFromResponse(responseData) {
        return responseData.usage?.total_tokens;
    }

    get logEndpoint() {
        return this._logHost;
    }
}

module.exports = OpenAICompatibleProvider;
