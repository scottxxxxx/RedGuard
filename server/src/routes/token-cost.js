const express = require('express');
const router = express.Router();
const axios = require('axios');

const TOKEN_COST_SERVICE_URL = process.env.TOKEN_COST_SERVICE_URL || `http://localhost:${process.env.TOKEN_COST_SERVICE_PORT || 3006}`;

router.post('/estimate', async (req, res) => {
    try {
        const response = await axios.post(`${TOKEN_COST_SERVICE_URL}/api/token-cost/estimate`, req.body, { timeout: 5000 });
        res.json(response.data);
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return res.status(503).json({
                error: `Token cost service unavailable. Make sure it is running on port ${process.env.TOKEN_COST_SERVICE_PORT || 3006}`
            });
        }
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || error.message
        });
    }
});

router.get('/pricing', async (req, res) => {
    try {
        const response = await axios.get(`${TOKEN_COST_SERVICE_URL}/api/token-cost/pricing`, { timeout: 5000 });
        res.json(response.data);
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return res.status(503).json({ error: 'Token cost service unavailable' });
        }
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || error.message
        });
    }
});

module.exports = router;
