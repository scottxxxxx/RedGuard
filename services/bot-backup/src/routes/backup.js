const express = require('express');
const router = express.Router();
const BackupService = require('../services/backup-service');

// Start backup
router.post('/start', async (req, res) => {
    try {
        const { botId, clientId, clientSecret, platformHost, botsHost } = req.body;
        const jobId = await BackupService.startBackup(botId, clientId, clientSecret, platformHost, botsHost);
        res.json({ jobId, status: 'started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Check status
router.get('/status/:jobId', async (req, res) => {
    try {
        const status = await BackupService.getJobStatus(req.params.jobId);
        res.json(status);
    } catch (error) {
        res.status(404).json({ error: 'Job not found' });
    }
});

module.exports = router;
