const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Get all evaluation runs (most recent first)
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const runs = await prisma.evaluationRun.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit
        });
        res.json(runs);
    } catch (error) {
        console.error('Error fetching runs:', error);
        res.status(500).json({ error: 'Failed to fetch runs' });
    }
});

// Create a new evaluation run
router.post('/', async (req, res) => {
    try {
        const {
            sessionId,
            userInput,
            botResponse,
            promptSent,
            llmOutput,
            toxicityPass,
            topicsPass,
            injectionPass,
            regexPass,
            overallPass,
            isAttack,
            inputTokens,
            outputTokens,
            totalTokens,
            latencyMs,
            model
        } = req.body;

        const run = await prisma.evaluationRun.create({
            data: {
                sessionId: sessionId || null,
                userInput,
                botResponse,
                promptSent,
                llmOutput,
                toxicityPass,
                topicsPass,
                injectionPass,
                regexPass,
                overallPass,
                isAttack: isAttack || false,
                inputTokens: inputTokens || null,
                outputTokens: outputTokens || null,
                totalTokens,
                latencyMs: latencyMs || null,
                model: model || null
            }
        });

        res.status(201).json(run);
    } catch (error) {
        console.error('Error creating run:', error);
        res.status(500).json({ error: 'Failed to create run' });
    }
});

// Delete a run
router.delete('/:id', async (req, res) => {
    try {
        await prisma.evaluationRun.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting run:', error);
        res.status(500).json({ error: 'Failed to delete run' });
    }
});

// Clear all runs
router.delete('/', async (req, res) => {
    try {
        await prisma.evaluationRun.deleteMany();
        res.json({ success: true });
    } catch (error) {
        console.error('Error clearing runs:', error);
        res.status(500).json({ error: 'Failed to clear runs' });
    }
});

module.exports = router;
