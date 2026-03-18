const axios = require('axios');
const { generateKoreJwt } = require('./kore-jwt');

// In-memory job store (replace with Redis/DB for production persistence)
const jobs = new Map();

class BackupService {

    static async startBackup(botId, clientId, clientSecret, platformHost = "platform.kore.ai", botsHost = "bots.kore.ai") {
        const jobId = `job-${Date.now()}`;

        // Store job metadata
        jobs.set(jobId, {
            id: jobId,
            status: 'initializing',
            botId,
            clientId,
            clientSecret, // In production, don't store secrets in memory like this
            platformHost,
            botsHost,
            exportId: null,
            downloadUrl: null,
            startTime: Date.now(),
            error: null
        });

        // Start async process
        this.processBackup(jobId);

        return jobId;
    }

    static async processBackup(jobId) {
        const job = jobs.get(jobId);
        if (!job) return;

        try {
            // 1. Generate JWT
            const token = this.generateJwt(job.clientId, job.clientSecret);
            job.status = 'authenticating';

            // 2. Initiate Export
            console.log(`[${jobId}] Initiating export for bot ${job.botId}...`);
            const initiateUrl = `https://${job.platformHost}/api/public/bot/${job.botId}/export`;

            const initRes = await axios.post(initiateUrl, {
                exportType: "published",
                // exportOptions: { botTasks: ["dialog"] } // Removed based on testing findings
            }, {
                headers: { "auth": token, "Content-Type": "application/json" }
            });

            // Handle ID variations
            const exportId = initRes.data.exportId || initRes.data._id;
            if (!exportId) {
                throw new Error("No exportId returned from initiation");
            }

            job.exportId = exportId;
            job.status = 'exporting'; // initial wait state
            console.log(`[${jobId}] Export initiated with ID: ${exportId}`);

            // 3. Poll Status (Async loop)
            this.pollStatus(jobId, token);

        } catch (error) {
            console.error(`[${jobId}] Error:`, error.message);
            job.status = 'failed';
            job.error = error.message;
            if (error.response) {
                job.error += ` (API: ${JSON.stringify(error.response.data)})`;
            }
            jobs.set(jobId, job);
        }
    }

    static async pollStatus(jobId, token) {
        const job = jobs.get(jobId);
        if (!job) return;

        // Based on user requirements: Initial wait 30s
        console.log(`[${jobId}] Waiting 30s before first poll...`);
        await new Promise(resolve => setTimeout(resolve, 30000));

        const maxRetries = 60; // 10 minutes
        let attempts = 0;

        while (attempts < maxRetries) {
            attempts++;

            try {
                // Use the successful endpoint found in testing:
                // GET https://bots.kore.ai/api/public/bot/{botId}/export/status?exportId={exportId}
                // Try primary host first, fall back to bots host if needed?
                // Testing showed platform host with query param worked? No, testing showed bots.kore.ai worked for status?
                // Actually, the successful python script used:
                // url = f"https://{KORE_BOTS_HOST}/api/public/bot/${BOT_ID}/export/status" with params={"exportId": export_id}

                // Let's iterate hosts if one fails, similar to python script logic or stick to 'bots' host for status
                const statusUrl = `https://${job.botsHost}/api/public/bot/${job.botId}/export/status`;

                const statusRes = await axios.get(statusUrl, {
                    headers: { "auth": token },
                    params: { exportId: job.exportId }
                });

                const status = statusRes.data.status || statusRes.data.exportStatus;
                console.log(`[${jobId}] Poll ${attempts}: Status = ${status}`);

                if (status === 'success' || status === 'completed') {
                    job.status = 'completed';
                    job.downloadUrl = statusRes.data.downloadURL || statusRes.data.fileId;
                    console.log(`[${jobId}] Export completed! URL available.`);
                    jobs.set(jobId, job);
                    return;
                } else if (status === 'failed' || status === 'error') {
                    throw new Error(`Kore API reported failure: ${JSON.stringify(statusRes.data)}`);
                }

            } catch (error) {
                console.log(`[${jobId}] Poll ${attempts} failed: ${error.message}. Retrying...`);
                // Continue loop unless critical error?
            }

            // Wait 10s between polls
            await new Promise(resolve => setTimeout(resolve, 10000));
        }

        job.status = 'timeout';
        job.error = 'Max retries exceeded waiting for export';
        jobs.set(jobId, job);
    }

    static generateJwt(clientId, clientSecret) {
        return generateKoreJwt(clientId, clientSecret, {
            sub: clientId,
            includeAppId: true,
            includeJti: false,
            includeExpiry: true
        });
    }

    static async getJobStatus(jobId) {
        return jobs.get(jobId) || { status: 'not_found' };
    }

    static updateJob(jobId, updates) {
        const job = jobs.get(jobId);
        if (job) {
            Object.assign(job, updates);
            jobs.set(jobId, job);
        }
    }

    /**
     * Download a completed export zip, extract the App Definition JSON,
     * and run it through the bot-config-analyzer.
     * Returns { guardrails } on success, throws on failure.
     */
    static async downloadAndAnalyze(jobId, downloadUrl) {
        const AdmZip = require('adm-zip');
        const botConfigAnalyzer = require('./bot-config-analyzer');

        console.log(`[Backup Guardrails] Job ${jobId} completed. Downloading zip...`);

        const zipResponse = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 60000
        });

        const zip = new AdmZip(Buffer.from(zipResponse.data));
        const zipEntries = zip.getEntries();

        // Find the App Definition JSON file
        let targetEntry = zipEntries.find(entry =>
            !entry.isDirectory &&
            entry.entryName.endsWith('.json') &&
            (entry.entryName.toLowerCase().includes('botdefinition') ||
             entry.entryName.toLowerCase().includes('appdefinition'))
        );

        // Fallback: largest JSON file
        if (!targetEntry) {
            const jsonEntries = zipEntries.filter(entry =>
                !entry.isDirectory && entry.entryName.endsWith('.json')
            );
            if (jsonEntries.length > 0) {
                targetEntry = jsonEntries.reduce((largest, entry) =>
                    entry.header.size > largest.header.size ? entry : largest
                );
            }
        }

        if (!targetEntry) {
            throw new Error('No JSON file found in the exported zip');
        }

        console.log(`[Backup Guardrails] Extracting: ${targetEntry.entryName}`);
        const jsonContent = JSON.parse(zip.readAsText(targetEntry));
        const analysis = botConfigAnalyzer.analyze(jsonContent);

        const guardrails = {
            enabledGuardrails: analysis.enabledGuardrails,
            topics: analysis.topics,
            regexPatterns: analysis.regexPatterns,
            descriptions: analysis.descriptions,
            featureDetails: analysis.featureDetails
        };

        // Cache result so subsequent polls don't re-download
        this.updateJob(jobId, {
            status: 'analyzed',
            guardrails,
            downloadUrl: null
        });

        return guardrails;
    }

    /**
     * Derive platform and bots hosts from a generic Kore host string.
     */
    static deriveHosts(host) {
        let platformHost = 'platform.kore.ai';
        let botsHost = 'bots.kore.ai';

        if (host) {
            const hostClean = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
            if (hostClean.includes('bots.')) {
                botsHost = hostClean;
                platformHost = hostClean.replace('bots.', 'platform.');
            } else if (hostClean.includes('platform.')) {
                platformHost = hostClean;
                botsHost = hostClean.replace('platform.', 'bots.');
            } else {
                platformHost = hostClean;
                botsHost = hostClean;
            }
        }

        return { platformHost, botsHost };
    }
}

module.exports = BackupService;
