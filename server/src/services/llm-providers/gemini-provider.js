const BaseProvider = require('./base-provider');

class GeminiProvider extends BaseProvider {
    constructor() {
        super('gemini');
    }

    getEndpoint(apiKey, model) {
        return {
            url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            headers: {}
        };
    }

    constructPayload(model, prompt, params, { systemPrompt = null } = {}) {
        const config = {
            temperature: params.temperature,
            maxOutputTokens: params.max_tokens,
            topP: params.top_p
        };

        if (params.top_k !== undefined && params.top_k > 0) {
            config.topK = params.top_k;
        }
        if (params.presence_penalty !== undefined && params.presence_penalty !== 0) {
            config.presencePenalty = params.presence_penalty;
        }
        if (params.frequency_penalty !== undefined && params.frequency_penalty !== 0) {
            config.frequencyPenalty = params.frequency_penalty;
        }

        const payload = { generationConfig: config };

        if (systemPrompt) {
            payload.systemInstruction = { parts: [{ text: systemPrompt }] };
        }

        payload.contents = [{
            parts: [{ text: prompt + "\n\nReturn JSON output." }]
        }];

        return payload;
    }

    extractRawText(responseData) {
        return responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    getFinishReasonMessage(responseData) {
        return `Finish reason: ${responseData.candidates?.[0]?.finishReason || 'unknown'}`;
    }

    _extractTokensFromResponse(responseData) {
        return responseData.usageMetadata?.totalTokenCount;
    }

    get logEndpoint() {
        return 'generativelanguage.googleapis.com';
    }
}

module.exports = new GeminiProvider();
