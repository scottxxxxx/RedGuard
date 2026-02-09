const llmJudge = require('./llm-judge');

class GuardrailLogic {

    async evaluateResponse(userInput, botResponse, config, history = [], hyperparams = {}, overridePrompt = null, overridePayload = null, guardrailLogs = []) {
        const results = [];
        let overallPass = true;
        let activeSet = new Set(config.activeGuardrails);

        // 1. Regex Validation (Local processing - fastest)
        if (activeSet.has('regex') && config.regexPatterns && config.regexPatterns.length > 0) {
            let regexViolated = false;
            for (const pattern of config.regexPatterns) {
                if (!pattern.trim()) continue;
                try {
                    const regex = new RegExp(pattern, 'i');
                    if (regex.test(botResponse)) {
                        overallPass = false;
                        regexViolated = true;
                        results.push({
                            guardrail: 'Filter Responses (Regex)',
                            pass: false,
                            reason: `Matched banned pattern: ${pattern}`
                        });
                    }
                } catch (e) {
                    console.warn(`Invalid Regex Pattern: ${pattern}`);
                }
            }
            if (!regexViolated) {
                results.push({ guardrail: 'Filter Responses (Regex)', pass: true, reason: 'No banned patterns matched' });
            }
        }

        // 2. Identify all active LLM guardrails for a single unified call
        const llmGuardrails = [];
        if (activeSet.has('toxicity_input') || activeSet.has('toxicity_output')) llmGuardrails.push('toxicity');
        if (activeSet.has('topics_input') || activeSet.has('topics_output')) llmGuardrails.push('topics');
        if (activeSet.has('injection')) llmGuardrails.push('injection');

        // 3. Perform the Unified LLM Evaluation
        const judgeResult = await llmJudge.evaluate({
            userInput,
            botResponse,
            guardrails: llmGuardrails,
            criteria: {
                bannedTopics: config.bannedTopics,
                regexPatterns: config.regexPatterns
            },
            apiKey: config.llmConfig.apiKey,
            provider: config.llmConfig.provider,
            model: config.llmConfig.model,
            history,
            customPrompt: config.llmConfig.customPrompt,
            hyperparams,
            overridePrompt,
            overridePayload,
            guardrailLogs,
            activeGuardrails: config.activeGuardrails
        });

        if (judgeResult.error) {
            return {
                error: judgeResult.error,
                details: judgeResult.details,
                debug: {
                    prompt: judgeResult.prompt,
                    response: JSON.stringify(judgeResult.error),
                    fullResponse: judgeResult.fullApiResponse,
                    requestPayload: judgeResult.requestPayload
                }
            };
        }

        const r = judgeResult.result;
        const evalData = r.bot_response_evaluation || r;

        // Honor the Judge's Overall status result (v4: status: "pass"|"fail")
        if (evalData.overall) {
            if (evalData.overall.status === 'fail' || evalData.overall.pass === false) {
                overallPass = false;
            }
        }

        // Map recognized guardrail results using the new v4 "status" field with fallback to legacy "pass"
        const getPass = (item) => {
            if (!item) return null;
            if (item.status === 'not_tested') return null; // Exclude from pass/fail UI
            if (item.status === 'pass') return true;
            if (item.status === 'fail') return false;
            return item.pass; // Fallback to legacy
        };

        // Toxicity
        if (evalData.toxicity) {
            const pass = getPass(evalData.toxicity);
            if (pass === false) overallPass = false;
            results.push({
                guardrail: activeSet.has('toxicity_output') ? 'Toxicity (Output)' : 'Toxicity (Input)',
                pass: pass === null ? 'N/A' : pass, // Use 'N/A' string for better persistence handling
                reason: evalData.toxicity.reason
            });
        }

        // Topics
        const topicsData = evalData.topics || evalData.restricted_topics;
        if (topicsData) {
            const pass = getPass(topicsData);
            if (pass === false) overallPass = false;
            results.push({
                guardrail: activeSet.has('topics_output') ? 'Restrict Topics (Output)' : 'Restrict Topics (Input)',
                pass: pass === null ? 'N/A' : pass,
                reason: topicsData.reason
            });
        }

        // Injection
        if (evalData.injection) {
            const pass = getPass(evalData.injection);
            if (pass === false) overallPass = false;
            results.push({
                guardrail: 'Prompt Injection (Output)',
                pass: pass === null ? 'N/A' : pass,
                reason: evalData.injection.reason
            });
        }

        // Regex
        if (evalData.regex) {
            const pass = getPass(evalData.regex);
            if (pass === false) overallPass = false;
            results.push({
                guardrail: 'Filter Responses (Regex)',
                pass: pass === null ? 'N/A' : pass,
                reason: evalData.regex.reason
            });
        }

        // Catch-all for unified results that processed everything but results array is empty
        if (overallPass && results.length === 0) {
            results.push({ guardrail: 'General Compliance', pass: true, reason: 'LLM judge passed all conversational checks.' });
        }

        return {
            pass: overallPass,
            results,
            result: r, // Include the full parsed LLM result for System Analysis tab
            totalTokens: judgeResult.totalTokens,
            debug: {
                prompt: judgeResult.prompt,
                response: judgeResult.rawResponse,
                fullResponse: judgeResult.fullApiResponse,
                requestPayload: judgeResult.requestPayload
            }
        };
    }

    getEvaluationPrompt(userInput, botResponse, config, history = []) {
        // Prioritize OUTPUT guardrails for preview
        const activeSet = new Set(config.activeGuardrails);
        const outputGuardrails = [];
        if (activeSet.has('toxicity_output')) outputGuardrails.push('toxicity');
        if (activeSet.has('topics_output')) outputGuardrails.push('topics');

        // Fallback to Input guardrails if no output ones
        if (outputGuardrails.length === 0) {
            const inputGuardrails = [];
            if (activeSet.has('toxicity_input')) inputGuardrails.push('toxicity');
            if (activeSet.has('topics_input')) inputGuardrails.push('topics');
            if (activeSet.has('injection')) inputGuardrails.push('injection');

            if (inputGuardrails.length > 0) {
                return llmJudge.constructPrompt({
                    userInput: "<<Input Validation Mode>>",
                    botResponse: userInput,
                    guardrails: inputGuardrails,
                    criteria: { bannedTopics: config.bannedTopics, regexPatterns: null },
                    history: [],
                    customPrompt: config.llmConfig.customPrompt,
                    activeGuardrails: config.activeGuardrails
                });
            }
            return "No active LLM guardrails selected.";
        }

        return llmJudge.constructPrompt({
            userInput,
            botResponse,
            guardrails: outputGuardrails,
            criteria: {
                bannedTopics: config.bannedTopics,
                regexPatterns: config.activeGuardrails.includes('regex') ? config.regexPatterns : null
            },
            history,
            customPrompt: config.llmConfig.customPrompt,
            activeGuardrails: config.activeGuardrails
        });
    }

    async getEvaluationPayload(userInput, botResponse, config, history = [], hyperparams = {}, overridePrompt = null, guardrailLogs = []) {
        // Prioritize OUTPUT guardrails for payload preview
        const activeSet = new Set(config.activeGuardrails);
        const outputGuardrails = [];
        if (activeSet.has('toxicity_output')) outputGuardrails.push('toxicity');
        if (activeSet.has('topics_output')) outputGuardrails.push('topics');

        // Note: Previewing combined Input+Output payloads isn't supported in single-view
        // We defaults to Output view as it's the primary use case.

        return await llmJudge.getPayload({
            userInput,
            botResponse,
            guardrails: outputGuardrails,
            criteria: {
                bannedTopics: config.bannedTopics,
                regexPatterns: config.activeGuardrails.includes('regex') ? config.regexPatterns : null
            },
            provider: config.llmConfig.provider,
            model: config.llmConfig.model,
            history,
            customPrompt: config.llmConfig.customPrompt,
            hyperparams: hyperparams,
            overridePrompt: overridePrompt,
            guardrailLogs,
            activeGuardrails: config.activeGuardrails // Pass full list here too
        });
    }
}

module.exports = new GuardrailLogic();
