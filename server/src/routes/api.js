const express = require('express');
const router = express.Router();
const testSuitesRouter = require('./testSuites');
const chatRouter = require('./chat');
const evaluateRouter = require('./evaluate');
const runsRouter = require('./runs');

// Register routes
router.use('/', testSuitesRouter);
router.use('/chat', chatRouter);
router.use('/evaluate', evaluateRouter);
router.use('/runs', runsRouter);
router.use('/garak', require('./garak'));
router.use('/prompts', require('./prompts'));
router.use('/logs', require('./logs'));
router.use('/kore', require('./kore'));

router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

module.exports = router;
