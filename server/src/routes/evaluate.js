const express = require('express');
const router = express.Router();
const guardrailService = require('../services/guardrail-logic');

router.post('/', async (req, res) => {
    let { userInput, botResponse, guardrailConfig, history, hyperparams, overridePrompt, overridePayload, guardrailLogs } = req.body;

    if (overridePayload && typeof overridePayload === 'string') {
        try {
            overridePayload = JSON.parse(overridePayload);
        } catch (e) {
            console.warn("Invalid JSON in overridePayload", e);
            overridePayload = null;
        }
    }

    if (!userInput || !botResponse || !guardrailConfig) {
        return res.status(400).json({ error: "Missing required fields: userInput, botResponse, or guardrailConfig" });
    }

    try {
        const evaluation = await guardrailService.evaluateResponse(userInput, botResponse, guardrailConfig, history, hyperparams, overridePrompt, overridePayload, guardrailLogs);
        res.json(evaluation);
    } catch (error) {
        console.error("Evaluation Route Error:", error);
        res.status(500).json({ error: "Evaluation failed", details: error.message });
    }
});

router.post('/preview', async (req, res) => {
    const { userInput, botResponse, guardrailConfig, history, hyperparams, overridePrompt, guardrailLogs } = req.body;

    if (!userInput || !botResponse || !guardrailConfig) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const result = await guardrailService.getEvaluationPayload(userInput, botResponse, guardrailConfig, history, hyperparams, overridePrompt, guardrailLogs);
        res.json({
            prompt: result.prompt,
            payload: result.payload
        });
    } catch (error) {
        console.error("Preview Route Error:", error);
        res.status(500).json({ error: "Preview generation failed", details: error.message });
    }
});

const botConfigAnalyzer = require('../services/bot-config-analyzer');

const fs = require('fs');
const path = require('path');

router.post('/analyze-config', async (req, res) => {
    const { botConfig } = req.body;

    if (!botConfig) {
        return res.status(400).json({ error: "Missing required field: botConfig" });
    }

    try {
        const analysis = botConfigAnalyzer.analyze(botConfig);
        res.json(analysis);
    } catch (error) {
        const logPath = path.join(__dirname, '../../server_debug.log');
        const errorLog = `[${new Date().toISOString()}] Analysis Error: ${error.message}\nStack: ${error.stack}\nConfig Keys: ${Object.keys(botConfig || {}).join(', ')}\n\n`;
        try {
            fs.appendFileSync(logPath, errorLog);
        } catch (e) {
            console.error("Failed to write to log file", e);
        }

        console.error("Config Analysis Error:", error);
        res.status(500).json({ error: "Analysis failed", details: error.message });
    }
});

module.exports = router;
