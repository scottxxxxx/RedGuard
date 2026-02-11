const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const util = require('util');
const packageJson = require('../../package.json');

const execPromise = util.promisify(exec);

// Store recent logs in memory (last 500 lines)
const logBuffer = [];
const MAX_LOGS = 500;

// Override console.log to capture logs
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    logBuffer.push({ timestamp, level: 'INFO', message });
    if (logBuffer.length > MAX_LOGS) logBuffer.shift();

    originalLog.apply(console, args);
};

console.error = function(...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    logBuffer.push({ timestamp, level: 'ERROR', message });
    if (logBuffer.length > MAX_LOGS) logBuffer.shift();

    originalError.apply(console, args);
};

// Health check endpoint with full system info
router.get('/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: packageJson.version,
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                unit: 'MB'
            },
            environment: {
                NODE_ENV: process.env.NODE_ENV || 'development',
                PORT: process.env.PORT || 3001,
                HAS_DATABASE_URL: !!process.env.DATABASE_URL,
                HAS_OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
                HAS_GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
                HAS_GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
                HAS_NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
                HAS_NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
            },
            node: process.version,
            platform: process.platform,
            arch: process.arch
        };

        res.json(health);
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// Get recent application logs
router.get('/logs', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const level = req.query.level?.toUpperCase();

    let logs = logBuffer;

    // Filter by level if specified
    if (level && ['INFO', 'ERROR'].includes(level)) {
        logs = logs.filter(log => log.level === level);
    }

    // Get last N logs
    const recentLogs = logs.slice(-limit);

    res.json({
        total: logs.length,
        returned: recentLogs.length,
        logs: recentLogs
    });
});

// Get Docker container status (if running in Docker)
router.get('/docker-status', async (req, res) => {
    try {
        // Check if we're running in Docker
        const { stdout: dockerCheck } = await execPromise('cat /proc/1/cgroup 2>/dev/null | grep docker || echo "not-docker"');
        const inDocker = !dockerCheck.includes('not-docker');

        if (!inDocker) {
            return res.json({
                inDocker: false,
                message: 'Not running in Docker container'
            });
        }

        // Try to get docker ps output (requires docker command in container)
        try {
            const { stdout } = await execPromise('docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Image}}"');
            res.json({
                inDocker: true,
                containers: stdout
            });
        } catch (dockerError) {
            res.json({
                inDocker: true,
                message: 'Running in Docker but cannot access Docker daemon',
                error: dockerError.message
            });
        }
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Get environment variables (sanitized - no secrets)
router.get('/env', (req, res) => {
    const safeEnv = {};

    // Only expose non-sensitive env vars
    const safeKeys = [
        'NODE_ENV',
        'PORT',
        'NEXT_PUBLIC_API_URL',
        'DATABASE_URL', // Just show it exists, not the value
        'NEXTAUTH_URL'
    ];

    for (const key of safeKeys) {
        if (process.env[key]) {
            // For sensitive URLs, just show if they're set
            if (key.includes('DATABASE') || key.includes('URL')) {
                safeEnv[key] = '***SET***';
            } else {
                safeEnv[key] = process.env[key];
            }
        } else {
            safeEnv[key] = null;
        }
    }

    // Check for presence of secrets without exposing values
    const secretKeys = [
        'OPENAI_API_KEY',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'NEXTAUTH_SECRET'
    ];

    for (const key of secretKeys) {
        safeEnv[key] = process.env[key] ? '***SET***' : null;
    }

    res.json(safeEnv);
});

module.exports = router;
