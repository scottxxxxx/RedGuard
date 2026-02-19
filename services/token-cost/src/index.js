const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.TOKEN_COST_SERVICE_PORT || 3006;

app.use(cors());
app.use(express.json());

const tokenCostRoutes = require('./routes/token-cost');
app.use('/api/token-cost', tokenCostRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'token-cost' });
});

app.listen(PORT, () => {
    console.log(`Token Cost Service running on port ${PORT}`);
});
