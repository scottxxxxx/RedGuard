const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all test suites
router.get('/test-suites', async (req, res) => {
    try {
        const suites = await prisma.testSuite.findMany({
            include: {
                _count: {
                    select: { runs: true, conversations: true }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(suites);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new test suite
router.post('/test-suites', async (req, res) => {
    const { name, description } = req.body;
    try {
        const suite = await prisma.testSuite.create({
            data: { name, description }
        });
        res.status(201).json(suite);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get specific test suite
router.get('/test-suites/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const suite = await prisma.testSuite.findUnique({
            where: { id },
            include: {
                conversations: true,
                executions: {
                    orderBy: { startedAt: 'desc' },
                    take: 5
                }
            }
        });
        if (!suite) {
            return res.status(404).json({ error: 'Test suite not found' });
        }
        res.json(suite);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
