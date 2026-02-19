const express = require('express');
const router = express.Router();
const PricingService = require('../services/pricing-service');

router.post('/estimate', (req, res) => {
    try {
        const { tokens } = req.body;
        if (!tokens || !Array.isArray(tokens)) {
            return res.status(400).json({ error: 'tokens array is required' });
        }
        const result = PricingService.estimate(tokens);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/pricing', (req, res) => {
    try {
        const info = PricingService.getPricingInfo();
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
