const BaseProvider = require('./base-provider');

class OpenAIProvider extends BaseProvider {
    constructor() {
        super('openai');
    }

    getEndpoint(apiKey, model) {
        // Detect Responses API models (GPT-5.x, o-series)
        const isOSeries = model.startsWith('o3') || model.startsWith('o4');
        const isGPT5 = model.startsWith('gpt-5');
        const useResponsesAPI = isGPT5 || isOSeries;

        return {
            url: useResponsesAPI
                ? 'https://api.openai.com/v1/responses'
                : 'https://api.openai.com/v1/chat/completions',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        };
    }

    constructPayload(model, prompt, params, { systemPrompt = null, responseFormat = null } = {}) {
        const isOSeries = model.startsWith('o3') || model.startsWith('o4');
        const isGPT5 = model.startsWith('gpt-5');
        const useResponsesAPI = isGPT5 || isOSeries;

        const payload = { model };

        // Reasoning effort (GPT-5.x and o-series — Responses API only)
        if (useResponsesAPI && params.reasoning_effort) {
            payload.reasoning = { effort: params.reasoning_effort };
        }

        // Temperature & Top P: not for o-series, not for GPT-5.x with reasoning enabled
        if (!isOSeries && !(isGPT5 && params.reasoning_effort && params.reasoning_effort !== 'none')) {
            if (params.temperature !== undefined) payload.temperature = params.temperature;
            if (params.top_p !== undefined) payload.top_p = params.top_p;
        }

        // Max tokens key differs between APIs
        if (useResponsesAPI) {
            payload.max_output_tokens = params.max_tokens;
        } else {
            payload.max_tokens = params.max_tokens;
        }

        // Seed for reproducibility (Chat Completions only)
        if (!useResponsesAPI && params.seed !== undefined && params.seed !== null) {
            payload.seed = params.seed;
        }

        // Penalty params (Chat Completions only)
        if (!useResponsesAPI) {
            if (params.frequency_penalty !== undefined && params.frequency_penalty !== 0) {
                payload.frequency_penalty = params.frequency_penalty;
            }
            if (params.presence_penalty !== undefined && params.presence_penalty !== 0) {
                payload.presence_penalty = params.presence_penalty;
            }
        }

        // Truncation (Responses API only)
        if (useResponsesAPI) {
            payload.truncation = "disabled";
        }

        // Response format
        if (useResponsesAPI) {
            let format = responseFormat || { type: "json_object" };
            // Transform Chat Completions json_schema format to Responses API format
            if (format.type === 'json_schema' && format.json_schema) {
                format = {
                    type: 'json_schema',
                    name: format.json_schema.name,
                    schema: format.json_schema.schema
                };
                if (format.schema) format.strict = true;
            }
            payload.text = { format };
        } else {
            payload.response_format = responseFormat || { type: "json_object" };
        }

        // Messages/input (last for readability in Raw Request preview)
        if (useResponsesAPI) {
            payload.input = [
                { role: "system", content: systemPrompt || "You are a helpful assistant that outputs JSON." },
                { role: "user", content: prompt }
            ];
        } else {
            payload.messages = [
                { role: "system", content: systemPrompt || "You are a helpful assistant that outputs JSON." },
                { role: "user", content: prompt }
            ];
        }

        return payload;
    }

    extractRawText(responseData) {
        // Check if this is a Responses API response (has output array)
        if (responseData.output) {
            const msgOutput = responseData.output.find(o => o.type === 'message');
            const textContent = msgOutput?.content?.find(c => c.type === 'output_text');
            return textContent?.text || '';
        }
        // Chat Completions API
        return responseData.choices?.[0]?.message?.content || '';
    }

    getFinishReasonMessage(responseData) {
        return `Finish reason: ${responseData.choices?.[0]?.finish_reason || 'unknown'}`;
    }

    _extractTokensFromResponse(responseData) {
        return responseData.usage?.total_tokens;
    }

    get logEndpoint() {
        return 'api.openai.com';
    }
}

module.exports = new OpenAIProvider();
