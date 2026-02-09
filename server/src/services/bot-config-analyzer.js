const fs = require('fs');
const path = require('path');

class BotConfigAnalyzer {

    /**
     * Analyzes a Kore.ai bot configuration export (JSON)
     * Extracts guardrail settings from llmConfiguration.guardrailsList
     * @param {Object} config - The JSON object of the bot definition
     * @returns {Object} { topics, regexPatterns, descriptions, enabledGuardrails }
     */
    analyze(config) {
        // console.log("Analyze called with config keys:", Object.keys(config || {}));

        const topics = [];
        const regexPatterns = [];
        const descriptions = {};
        const enabledGuardrails = [];
        const featureDetails = {}; // Maps guardrail type -> feature list

        if (!config) {
            return { topics, regexPatterns, descriptions, enabledGuardrails, featureDetails };
        }

        // Get guardrailsList from llmConfiguration[0].guardrailsList
        let guardrailsList = null;

        if (config.llmConfiguration && Array.isArray(config.llmConfiguration) && config.llmConfiguration[0]) {
            guardrailsList = config.llmConfiguration[0].guardrailsList;
        } else if (config.guardrailsList) {
            guardrailsList = config.guardrailsList;
        }

        if (!guardrailsList || !Array.isArray(guardrailsList)) {
            return { topics, regexPatterns, descriptions, enabledGuardrails, featureDetails };
        }

        // Feature mapping from ID to human-readable name (provided by user)
        const FEATURE_MAP = {
            'taxonomy_classification': 'Advanced Topic Discovery based on Custom Taxonomy and Resolution Detection',
            'agent_intent': 'Agent Empathy Identification',
            'customer_intent': 'Agent Node', // Index 8 match
            'answerGeneration': 'Answer Generation',
            'by_hold_adherence': 'By Hold Adherence',
            'by_transfer_adherence': 'By Transfer Adherence',
            'by_value_adherence': 'By Value Adherence validation for Quality AI',
            'by_value_extraction': 'By Value metric extraction for Quality AI',
            'dynamicEntity': 'Churn & Escalation Identification',
            'dialogGPT': 'Conversation Manager - DialogGPT',
            'qm_sentiment_phase': 'Conversation Phase Identification',
            'crutch_analytics': 'Crutch Word Usage Detection',
            'script_adherence': 'Default Script Adherence',
            'llmStageChunk': 'Enriching Chunks with LLM',
            'by_question_adherence': 'GenAI based agent answer adherence and customer trigger detection',
            'qm_utterances': 'Generating Similar QM Utterance Suggestions',
            'metadataExtraction': 'Metadata Extractor Agent',
            'qm_sentiment_insights': 'Post conversation Sentiment analysis',
            'rephraseQueryAgentic': 'Query Rephrase for Advanced Search API',
            'queryTransformation': 'Query Transformation',
            'paraphrase': 'Rephrase Responses',
            'resultTypeClassification': 'Result Type Classification',
            'sentiment_analytics': 'Sentiment Analysis',
            'topic_modelling': 'Topic Modelling',
            'llmStageDoc': 'Transform Documents with LLM'
        };

        const getFeatureName = (fid) => FEATURE_MAP[fid] || fid;

        guardrailsList.forEach(guardrail => {
            if (!guardrail) return;
            const id = guardrail.id || '';
            const featureList = guardrail.features || [];

            // Determine guardrail type
            let type = null;
            if (id === 'restrict_toxicity' || id.includes('toxic')) type = 'toxicity';
            else if (id === 'blacklist_topics' || id.includes('topic')) type = 'topics';
            else if (id === 'prompt_injection' || id.includes('injection')) type = 'injection';
            else if (id === 'filter_responses' || id.includes('regex')) type = 'regex';

            if (type) {
                // Initialize feature lists
                if (!featureDetails[type]) featureDetails[type] = [];

                // Check features for input/output application
                let hasInput = false;
                let hasOutput = false;

                featureList.forEach((f, i) => {
                    if (!f) return;

                    const fid = f.featureId || f.feature_id || f.feature || f.id || f.name;
                    const fname = getFeatureName(fid) || 'Unknown Feature';

                    let rawApplyAt = f.featureApplyAt;
                    let applyAtStr = '';

                    if (typeof rawApplyAt === 'object' && rawApplyAt !== null) {
                        try {
                            if (Array.isArray(rawApplyAt)) {
                                applyAtStr = rawApplyAt.join(', ');
                            } else {
                                // Check for common flags if it's an object (including Kore specific keys)
                                const parts = [];
                                if (rawApplyAt.input || rawApplyAt.request || rawApplyAt.llm_req) parts.push('input');
                                if (rawApplyAt.output || rawApplyAt.response || rawApplyAt.llm_res) parts.push('output');

                                if (parts.length > 0) applyAtStr = parts.join(', ');
                                else applyAtStr = JSON.stringify(rawApplyAt);
                            }
                        } catch (e) {
                            applyAtStr = String(rawApplyAt);
                        }
                    } else {
                        applyAtStr = String(rawApplyAt || '');
                    }

                    const applyAt = applyAtStr.toLowerCase();

                    featureDetails[type].push(`${fname} (${applyAt})`);

                    if (applyAt.includes('input') || applyAt === 'both') hasInput = true;
                    if (applyAt.includes('output') || applyAt === 'both') hasOutput = true;
                });

                // Enable granular guardrails
                if (hasInput) enabledGuardrails.push(`${type}_input`);
                if (hasOutput) enabledGuardrails.push(`${type}_output`);

                // Fallback for Regex/Topics lists extraction if they exist in serviceMeta
                if (type === 'topics' && Array.isArray(guardrail.serviceMeta?.topics)) {
                    guardrail.serviceMeta.topics.forEach(t => topics.push(t));
                }
                if (type === 'regex' && Array.isArray(guardrail.serviceMeta?.regex)) {
                    guardrail.serviceMeta.regex.forEach(r => regexPatterns.push(r));
                }

                if (guardrail.description) descriptions[type] = guardrail.description;
            }
        });

        // Sort features alphabetically by name for each type
        Object.keys(featureDetails).forEach(type => {
            featureDetails[type].sort();
        });

        return {
            topics,
            regexPatterns,
            descriptions,
            enabledGuardrails,
            featureDetails
        };
    }
}

module.exports = new BotConfigAnalyzer();
