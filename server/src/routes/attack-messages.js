const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/attack-messages
 * Save a generated attack message
 */
router.post('/', async (req, res) => {
  try {
    const { sessionId, messageContent, category, turnIndex, botId, userId } = req.body;

    if (!sessionId || !messageContent || !category) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, messageContent, category'
      });
    }

    const attackMessage = await prisma.attackMessage.create({
      data: {
        sessionId,
        messageContent,
        category,
        turnIndex: turnIndex || null,
        botId: botId || null,
        userId: userId || null
      }
    });

    res.json(attackMessage);
  } catch (error) {
    console.error('[attack-messages] Error saving attack message:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/attack-messages/:sessionId
 * Get all attack messages for a session
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const attackMessages = await prisma.attackMessage.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' }
    });

    res.json(attackMessages);
  } catch (error) {
    console.error('[attack-messages] Error fetching attack messages:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
