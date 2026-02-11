require('dotenv').config();
const express = require('express');
const cors = require('cors');
const packageJson = require('../package.json');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/', (req, res) => {
  res.send('RedGuard API is running');
});

// Version endpoint for deployment troubleshooting
app.get('/api/version', (req, res) => {
  res.json({
    version: packageJson.version,
    name: packageJson.name,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development'
  });
});

const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
