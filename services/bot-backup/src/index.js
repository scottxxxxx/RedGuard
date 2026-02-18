const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.BOT_BACKUP_SERVICE_PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const backupRoutes = require('./routes/backup');
app.use('/api/backup', backupRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'bot-backup' });
});

app.listen(PORT, () => {
    console.log(`Bot Backup Service running on port ${PORT}`);
});
