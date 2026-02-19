const pricingData = require('../data/pricing.json');

class PricingService {
    static #compiledPatterns = null;
    static #inputRatio = pricingData.defaultInputOutputRatio.input;
    static #outputRatio = pricingData.defaultInputOutputRatio.output;

    static _getPatterns() {
        if (!this.#compiledPatterns) {
            this.#compiledPatterns = {};
            for (const [provider, models] of Object.entries(pricingData.providers)) {
                this.#compiledPatterns[provider] = models.map(m => ({
                    ...m,
                    regex: new RegExp(m.modelPattern, 'i')
                }));
            }
        }
        return this.#compiledPatterns;
    }

    static _findRate(provider, model) {
        const patterns = this._getPatterns();
        const providerPatterns = patterns[provider];

        if (providerPatterns && model) {
            for (const entry of providerPatterns) {
                if (entry.regex.test(model)) {
                    return {
                        inputPer1M: entry.inputPer1M,
                        outputPer1M: entry.outputPer1M,
                        matchedModel: entry.modelLabel
                    };
                }
            }
        }

        const fallback = pricingData.fallbackRates[provider];
        if (fallback) {
            return { ...fallback, matchedModel: `${provider} (avg)` };
        }

        return null;
    }

    static _blendedRate(inputPer1M, outputPer1M) {
        return (inputPer1M * this.#inputRatio) + (outputPer1M * this.#outputRatio);
    }

    static estimate(tokens) {
        let totalEstimate = 0;
        const breakdown = [];

        for (const entry of tokens) {
            if (!entry.provider || entry.provider === 'kore') continue;
            if (!entry.totalTokens || entry.totalTokens <= 0) continue;

            const rate = this._findRate(entry.provider, entry.model);
            if (!rate) {
                breakdown.push({
                    provider: entry.provider,
                    model: entry.model || 'unknown',
                    totalTokens: entry.totalTokens,
                    cost: null,
                    note: 'Unknown provider — no pricing available'
                });
                continue;
            }

            let cost;
            if (entry.inputTokens && entry.outputTokens) {
                cost = (entry.inputTokens / 1_000_000 * rate.inputPer1M) +
                       (entry.outputTokens / 1_000_000 * rate.outputPer1M);
            } else {
                const blended = this._blendedRate(rate.inputPer1M, rate.outputPer1M);
                cost = entry.totalTokens / 1_000_000 * blended;
            }

            totalEstimate += cost;
            breakdown.push({
                provider: entry.provider,
                model: entry.model || 'unknown',
                matchedPricing: rate.matchedModel,
                totalTokens: entry.totalTokens,
                inputTokens: entry.inputTokens || null,
                outputTokens: entry.outputTokens || null,
                cost: Math.round(cost * 1_000_000) / 1_000_000
            });
        }

        return {
            totalEstimate: Math.round(totalEstimate * 100) / 100,
            totalEstimatePrecise: Math.round(totalEstimate * 1_000_000) / 1_000_000,
            currency: pricingData.currency,
            breakdown,
            pricingDate: pricingData.lastUpdated,
            disclaimer: 'Cost is estimated using published list prices and a blended input/output ratio. Actual costs may vary.'
        };
    }

    static getPricingInfo() {
        return {
            currency: pricingData.currency,
            lastUpdated: pricingData.lastUpdated,
            defaultRatio: pricingData.defaultInputOutputRatio,
            providers: Object.entries(pricingData.providers).map(([provider, models]) => ({
                provider,
                models: models.map(m => ({
                    label: m.modelLabel,
                    inputPer1M: m.inputPer1M,
                    outputPer1M: m.outputPer1M
                }))
            })),
            fallbacks: pricingData.fallbackRates
        };
    }
}

module.exports = PricingService;
