const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const router = express.Router();

/**
 * POST /api/garak/scan
 * Start a Garak security scan.
 * Streams output via Server-Sent Events (SSE) or simple chunked response.
 */
router.post('/scan', (req, res) => {
    const { config: bodyConfig, guardrail } = req.body;

    if (!guardrail) {
        return res.status(400).json({ error: 'Missing guardrail type' });
    }

    // Merge config from body with environment variables
    const config = {
        webhookUrl: bodyConfig?.webhookUrl || process.env.KORE_WEBHOOK_URL,
        clientId: bodyConfig?.clientId || process.env.KORE_CLIENT_ID,
        clientSecret: bodyConfig?.clientSecret || process.env.KORE_CLIENT_SECRET,
        botId: bodyConfig?.botId || process.env.KORE_BOT_ID
    };

    if (!config.webhookUrl || !config.clientId || !config.clientSecret || !config.botId) {
        return res.status(500).json({ error: 'Missing Kore.AI configuration. Check .env file or provide in request body.' });
    }

    // Set headers for streaming response
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    const pythonScript = path.join(__dirname, '../garak/run_scan.py');

    // Arguments for the python script
    const args = [
        pythonScript,
        '--url', config.webhookUrl,
        '--client_id', config.clientId,
        '--client_secret', config.clientSecret,
        '--bot_id', config.botId,
        '--guardrail', guardrail
    ];

    console.log(`Starting Garak scan for guardrail: ${guardrail}`);
    res.write(`Starting Garak scan for guardrail: ${guardrail}\n`);

    // Spawn the python process
    const pythonProcess = spawn('python3', args);

    pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        res.write(output);
    });

    pythonProcess.stderr.on('data', (data) => {
        const error = data.toString();
        console.error(`Garak Error: ${error}`);
        res.write(`[ERROR] ${error}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`Garak process exited with code ${code}`);
        if (code === 0) {
            res.write('\nScan Completed Successfully.');
        } else {
            res.write(`\nScan Failed with exit code ${code}`);
        }
        res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
        pythonProcess.kill();
    });
});

/**
 * GET /api/garak/probes
 * List available probe mappings
 */
router.get('/probes', (req, res) => {
    const mappings = {
        "restrict_toxicity": { label: "Toxicity & Hate Speech", description: "Tests for toxic output, slurs, and hate speech generation." },
        "blacklist_topics": { label: "Restricted Topics", description: "Tests if the bot talks about forbidden subjects." },
        "prompt_injection": { label: "Prompt Injection (DAN/Jailbreak)", description: "Attempts to override system instructions using DAN, Base64, and other jailbreaks." },
        "filter_responses": { label: "Response Filtering", description: "Tests if the bot filters out bad signatures or specific patterns." },
        "hallucination": { label: "Hallucination", description: "Tests for factuality and misleading claims." },
        "all": { label: "Comprehensive Scan", description: "Runs all available security probes." }
    };
    res.json(mappings);
});

/**
 * GET /api/garak/prompt
 * Fetch a single adversarial prompt from Garak's library suitable for manual testing.
 * Query: ?category=toxicity|injection|topics|encoding
 */
router.get('/prompt', (req, res) => {
    const category = req.query.category || 'toxicity';
    const count = 1;

    const pythonScript = path.join(__dirname, '../garak/get_prompts.py');
    const args = [pythonScript, '--category', category, '--count', count.toString()];

    const pyProc = spawn('python3', args);

    let output = '';

    pyProc.stdout.on('data', (data) => output += data.toString());

    pyProc.stderr.on('data', (err) => console.error(`Garak Prompt Error: ${err}`));

    pyProc.on('close', (code) => {
        if (code !== 0) {
            return res.status(500).json({ error: 'Failed to fetch prompt' });
        }
        try {
            const prompts = JSON.parse(output.trim());
            // Return first prompt or fallback
            res.json({ prompt: prompts[0] || "Could not generate prompt." });
        } catch (e) {
            res.status(500).json({ error: 'Invalid output from script' });
        }
    });
});

module.exports = router;
