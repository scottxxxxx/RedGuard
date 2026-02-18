# RedGuard Project Instructions

## Service: Bot Backup Microservice
Located in: `/services/bot-backup`

### Description
A standalone Node.js microservice that handles the asynchronous backup/export of Kore.ai bots. It encapsulates the complex polling logic required by the Kore.ai API.

### Starting the Service
1. Navigate to the service directory:
   ```bash
   cd services/bot-backup
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
   Runs on port `3005` by default.

### API Usage
The main application calls this service to initiate backups without blocking the UI.

**1. Start Backup Job**
- **Endpoint**: `POST http://localhost:3005/api/backup/start`
- **Body**:
  ```json
  {
    "botId": "st-...",
    "clientId": "cs-...",
    "clientSecret": "...",
    "platformHost": "platform.kore.ai",
    "botsHost": "bots.kore.ai"
  }
  ```
- **Response**: `{ "jobId": "job-12345...", "status": "started" }`

**2. Check Job Status**
- **Endpoint**: `GET http://localhost:3005/api/backup/status/:jobId`
- **Response**:
  ```json
  {
    "id": "job-12345...",
    "status": "completed", // or "exporting", "failed"
    "downloadUrl": "https://..."
  }
  ```

### Integration Notes
- The service handles JWT generation internally using the provided client credentials.
- It implements a **30-second initial wait** and **10-second polling interval** to respect API limits and processing time.
- Use `BOT_BACKUP_SERVICE_PORT` env var to change the port if needed.
