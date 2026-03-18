const BaseProvider = require('./base-provider');

class AnthropicProvider extends BaseProvider {
    constructor() {
        super('anthropic');
    }

    getEndpoint(apiKey) {
        return {
            url: 'https://api.anthropic.com/v1/messages',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            }
        };
    }

    constructPayload(model, prompt, params, { systemPrompt = null } = {}) {
        const payload = {
            model,
            max_tokens: params.max_tokens
        };

        // Anthropic doesn't allow both temperature and top_p
        if (params.top_p !== undefined && params.top_p !== 1.0) {
            payload.top_p = params.top_p;
        } else {
            payload.temperature = params.temperature !== undefined ? params.temperature : 0.0;
        }

        if (params.top_k !== undefined && params.top_k > 0) {
            payload.top_k = params.top_k;
        }

        if (systemPrompt) {
            payload.system = systemPrompt;
        }

        // Messages last for readability
        payload.messages = [{ role: 'user', content: prompt }];

        return payload;
    }

    extractRawText(responseData) {
        // Find the text content block (may not be content[0] if thinking blocks are present)
        const textBlock = responseData.content?.find(c => c.type === 'text');
        return textBlock?.text || responseData.content?.[0]?.text || '';
    }

    getFinishReasonMessage(responseData) {
        return `Stop reason: ${responseData.stop_reason || 'unknown'}`;
    }

    _extractTokensFromResponse(responseData) {
        const usage = responseData.usage;
        if (usage) {
            return (usage.input_tokens || 0) + (usage.output_tokens || 0);
        }
        return null;
    }

    get logEndpoint() {
        return 'api.anthropic.com';
    }
}

module.exports = new AnthropicProvider();
