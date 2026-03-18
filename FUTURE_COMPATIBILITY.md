# RedGuard — Future Compatibility Plan

**Created:** February 21, 2026
**Last Updated:** February 21, 2026

> This document captures the multi-platform strategy for RedGuard — how the architecture supports platforms beyond Kore.ai and what's needed to add each one. For implementation tracking, see [`REFACTORING.md`](REFACTORING.md) items RF-011 through RF-016.

---

## Architecture Overview

RedGuard's bot interaction layer uses a **platform registry pattern** (identical to the LLM provider pattern). Each platform implements a standard interface defined in `BasePlatform`:

```
server/src/services/bot-platforms/
├── index.js                    # Registry: register(), get(), list(), getDefault()
├── base-platform.js            # Abstract interface (11 methods)
├── kore-platform.js            # Kore.ai XO Platform (fully implemented)
├── dialogflow-cx-platform.js   # Google Dialogflow CX (skeleton + API docs)
└── generic-rest-platform.js    # Universal REST connector (fully implemented)
```

### Platform Interface

Every platform implements these methods:

| Method | Purpose | Required? |
|---|---|---|
| `validateConfig(botConfig)` | Check required fields before connecting | Yes |
| `validate(botConfig)` | Multi-step validation (credentials, connectivity, scopes) | Yes |
| `connect(userId, botConfig)` | Initialize session → `{ sessionId, botName, raw }` | Yes |
| `sendMessage(userId, message, botConfig)` | Send text → `{ messages: [{text}], sessionId, raw }` | Yes |
| `fetchLogs(botConfig, filters)` | Get execution/LLM logs → `LogEntry[]` | Optional |
| `saveLogs(logs, botConfig, prisma)` | Persist logs to database | Optional |
| `startExport(botConfig)` | Begin async bot definition export → jobId | Optional |
| `getExportStatus(jobId)` | Poll export progress | Optional |
| `downloadAndAnalyze(jobId, url)` | Extract guardrails from export → `GuardrailConfig` | Optional |
| `analyzeConfig(botDefinition)` | Parse uploaded config for guardrails | Optional |
| `redactConfig(botConfig)` | Strip secrets for logging | Yes |

"Optional" methods gracefully degrade — `fetchLogs` returns `[]`, export methods explain the limitation.

### How Platforms Are Selected

The `chat.js` route resolves the platform from the request:

```javascript
// Client sends: { platform: "generic", botConfig: { ... }, message: "Hello" }
// If no platform field → defaults to Kore.ai (backward compatible)
const platform = platforms.get(req.body.platform) || platforms.getDefault();
```

---

## Platform Status

### Kore.ai XO Platform — Fully Implemented
- **Status:** Production
- **Auth:** Custom JWT signed with Client ID/Secret
- **Messaging:** Async webhook (POST to Kore, response in same call)
- **Logs:** Gen AI & LLM Usage Logs API (`getLLMUsageLogs`)
- **Guardrails:** Rich per-scanner config (toxicity, topics, prompt injection, regex) extracted from App Definition export
- **Export:** Async export → poll → download zip → extract JSON → analyze

### Generic REST — Fully Implemented
- **Status:** Production
- **Auth:** Bearer, API key, Basic, or None
- **Messaging:** Configurable endpoint + request template + response path mapping
- **Logs:** Not available (most generic bots don't expose execution logs)
- **Guardrails:** Best-effort keyword detection in uploaded configs; manual configuration in RedGuard UI
- **Export:** Not available (configure guardrails manually)

**Supported platforms (zero additional code):**
- Botpress Cloud (REST API)
- Voiceflow (Dialog Manager API)
- Rasa Open Source (`/webhooks/rest/webhook`)
- Cognigy.AI (REST endpoint)
- Yellow.ai (API connector)
- Microsoft Bot Framework (Direct Line REST API)
- Any custom chatbot with a REST endpoint (Flask, FastAPI, Express, etc.)

**Generic REST Configuration Example:**
```json
{
  "platform": "generic",
  "name": "My Rasa Bot",
  "chatEndpoint": "https://my-rasa.example.com/webhooks/rest/webhook",
  "authType": "none",
  "requestTemplate": "{\"sender\":\"{{userId}}\",\"message\":\"{{message}}\"}",
  "responsePath": "[0].text",
  "sessionIdPath": null
}
```

### Google Dialogflow CX — Skeleton Ready
- **Status:** Skeleton with API docs and TODO markers
- **Implementation effort:** ~6-8 hours
- **Blocker:** Requires `google-auth-library` npm package + GCP service account

**Key differences from Kore.ai:**

| Aspect | Kore.ai | Dialogflow CX |
|---|---|---|
| Auth | JWT from Client ID/Secret | OAuth 2.0 from GCP service account |
| Messaging | Async webhook POST | Synchronous `detectIntent` API |
| Logs | Single API endpoint | Cloud Logging + Conversations API (v3beta1) |
| Guardrails | Per-scanner config (toxicity, topics, regex, injection) | Category-level RAI filters + banned phrases + prompt security toggle |
| Export | App Definition zip | JSON Package zip (different schema) |

**API Endpoints (already documented in skeleton):**
- Auth: `google-auth-library` → `GoogleAuth` with Dialogflow scope
- Chat: `POST https://{region}-dialogflow.googleapis.com/v3/{session}:detectIntent`
- Export: `POST https://{region}-dialogflow.googleapis.com/v3/{agent}:export`
- Logs: `GET https://{region}-dialogflow.googleapis.com/v3beta1/{agent}/conversations`
- Safety: `GET/PATCH https://{region}-dialogflow.googleapis.com/v3/{agent}` (genAppBuilderSettings)

### Amazon Lex — Not Started
- **Status:** Queued (RF-015)
- **Implementation effort:** ~6-8 hours
- **Blocker:** Requires `@aws-sdk/client-lex-runtime-v2` + AWS credentials

**Key integration points:**
- Auth: AWS IAM (access key + secret or assume role)
- Chat: `RecognizeText` API
- Logs: CloudWatch Logs (conversation logs must be enabled)
- Guardrails: Amazon Bedrock Guardrails (if configured as backend)
- Export: Lex `CreateExport` API

### Microsoft Copilot Studio — Not Started
- **Status:** Not tracked yet
- **Implementation effort:** ~8-10 hours (complex auth)

**Key integration points:**
- Auth: Azure AD / Microsoft Entra ID (OAuth 2.0)
- Chat: Direct Line API (`POST /v3/directline/conversations/{id}/activities`)
- Logs: Azure Application Insights
- Guardrails: Copilot Studio content moderation settings
- Export: Power Platform solution export

---

## Adding a New Platform

### Using the Generic REST Connector (5 minutes)

If the platform has a REST API, users can connect immediately:

1. Find the platform's chat endpoint URL
2. Determine the auth method (bearer token, API key, etc.)
3. Build a request template matching the platform's expected body format
4. Identify the response path to the bot's reply text
5. Configure in RedGuard's BotSettings UI (once RF-013 is implemented)

### Building a Dedicated Platform Provider (~1-2 days)

For deeper integration (execution logs, guardrail import, validation):

1. Create `server/src/services/bot-platforms/{name}-platform.js`
2. Extend `BasePlatform`
3. Implement the required methods (`validateConfig`, `validate`, `connect`, `sendMessage`)
4. Implement optional methods as the platform supports them
5. Register in `server/src/services/bot-platforms/index.js`
6. Add platform-specific fields to BotSettings UI

**Template for a new platform:**
```javascript
const BasePlatform = require('./base-platform');

class MyPlatform extends BasePlatform {
    constructor() {
        super('my-platform'); // This becomes the registry key
    }

    validateConfig(botConfig) {
        if (!botConfig?.apiKey) return { valid: false, error: 'API Key is required.' };
        return { valid: true };
    }

    async validate(botConfig) {
        // Test credentials, connectivity, etc.
        return { valid: true, message: 'Connected', steps: [{ name: 'auth', passed: true }] };
    }

    async connect(userId, botConfig) {
        return { sessionId: `session-${Date.now()}`, botName: 'My Bot', raw: {} };
    }

    async sendMessage(userId, message, botConfig) {
        // Call platform API, return normalized response
        return { messages: [{ text: 'Response from bot' }], sessionId: '...', raw: {} };
    }

    // Optional: implement fetchLogs, startExport, analyzeConfig, etc.
}

module.exports = new MyPlatform();
```

---

## Guardrail Mapping Across Platforms

RedGuard's evaluation model uses 4 guardrail types. Here's how they map:

| RedGuard Type | Kore.ai | Dialogflow CX | Amazon Lex/Bedrock | Generic |
|---|---|---|---|---|
| **Toxicity** | `restrict_toxicity` scanner | RAI safety filters (hate, dangerous, sexual, harassment) | Bedrock content filters | Manual config |
| **Topics** | `blacklist_topics` scanner | Banned phrases | Bedrock denied topics | Manual config |
| **Prompt Injection** | `prompt_injection` scanner | Prompt security toggle | Bedrock prompt attack filter | Manual config |
| **Regex** | `filter_responses` scanner | _(not available)_ | _(not available)_ | Manual config |

The evaluation pipeline itself is **platform-agnostic** — it evaluates `{ userInput, botResponse, guardrailConfig }` regardless of where the conversation happened.

---

## Open Source Strategy

The multi-platform support is RedGuard's key differentiator for open source:

1. **Generic REST connector** — immediate value for anyone with a chatbot, no vendor lock-in
2. **Platform provider pattern** — low barrier for community contributions (one file per platform)
3. **Evaluation pipeline independence** — guardrail evaluation works the same regardless of platform
4. **Tiered support model:**
   - **Tier 1 (full):** Kore.ai — chat, logs, guardrail import, validation
   - **Tier 2 (chat + eval):** Generic REST — chat and evaluate, manual guardrail config
   - **Tier 3 (planned):** Dialogflow CX, Amazon Lex — full integration when contributed

Community contributors can start with Tier 2 (use generic connector) and upgrade to Tier 1 by building a dedicated provider.
