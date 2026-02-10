# RedGuard - Kore.AI Guardrail Testing Platform

RedGuard is a comprehensive testing and evaluation platform for Kore.AI chatbot guardrails. It enables you to:
- **Test chatbot guardrails** in real-time against live bots
- **Inspect Kore GenAI Logs** to see exactly what prompts are sent to LLMs
- **Evaluate responses** using custom LLM-based evaluation prompts
- **Run batch tests** using CSV files for comprehensive coverage
- **Integrate Garak security scans** for adversarial testing

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Next.js)                         │
│                        localhost:3000                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Bot Settings  │  │ Guardrail Config│  │ Evaluation Model│  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │           Live Verification Console (Chat)                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Kore GenAI Logs                           │ │
│  │   (Displays LLM prompts/responses from Kore.AI platform)     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SERVER (Express.js)                       │
│                        localhost:3001                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  /api/chat   │  │ /api/evaluate│  │ /api/kore/llm-logs   │   │
│  │ (Kore Chat)  │  │ (LLM Eval)   │  │ (GenAI Log Fetch)    │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  /api/garak  │  │  /api/runs   │  │     /api/logs        │   │
│  │(Security Scan)│ │ (Run History)│  │   (API Logging)      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                              │                                   │
│                     ┌────────┴────────┐                         │
│                     │   SQLite DB     │                         │
│                     │   (Prisma ORM)  │                         │
│                     └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│      Kore.AI Platform   │     │   LLM Provider (Claude, │
│    platform.kore.ai     │     │   OpenAI, etc.)         │
│  - Webhook Chat API     │     │   - Evaluation API      │
│  - GenAI Logs API       │     │                         │
└─────────────────────────┘     └─────────────────────────┘
```

## Quick Start

### Local Development (Recommended)

See [LOCAL_DEV_GUIDE.md](./LOCAL_DEV_GUIDE.md) for detailed instructions.

```bash
# One-time setup
./setup_local_dev.sh

# Start Server (Terminal 1)
cd server && source venv/bin/activate && npm run dev

# Start Client (Terminal 2)
cd client && npm run dev
```

Open http://localhost:3000 in your browser.

### Docker

```bash
docker-compose up
```

## Key Components

### Client (`/client`)

| Component | Description |
|-----------|-------------|
| `BotSettings.tsx` | Configure Kore.AI bot connection (Host, Bot ID, Credentials) |
| `GuardrailSettings.tsx` | Define guardrail policies to test |
| `EvaluationSettings.tsx` | Configure LLM for response evaluation |
| `ChatConsole.tsx` | Live chat with the Kore.AI bot |
| `LLMInspectorNew.tsx` | **Kore GenAI Logs** - View actual prompts/responses from Kore |
| `EvaluationInspector.tsx` | View and edit evaluation prompts |
| `BatchTester.tsx` | Run batch tests from CSV files |
| `GarakTester.tsx` | Run Garak security scans |

### Server (`/server`)

| Route | Description |
|-------|-------------|
| `/api/chat` | Proxies messages to Kore.AI webhook |
| `/api/evaluate` | Sends prompts to configured LLM for evaluation |
| `/api/kore/llm-logs` | Fetches GenAI logs from Kore.AI platform |
| `/api/garak/*` | Runs Garak security scans |
| `/api/runs` | CRUD for evaluation run history |
| `/api/logs` | API call logging and diagnostics |

### Database Schema (Prisma)

- `EvaluationRun` - Stores evaluation results
- `ApiLog` - Tracks all API calls for debugging
- `KoreLLMLog` - Cached Kore GenAI logs
- Test suite models for batch testing

## Configuration

### Environment Variables

**Server (`server/.env`)**
```env
PORT=3001
DATABASE_URL="file:../dev.db"
KORE_WEBHOOK_URL="https://platform.kore.ai/chatbot/v2/webhook/YOUR_BOT_ID"
KORE_CLIENT_ID="cs-..."
KORE_CLIENT_SECRET="..."
KORE_BOT_ID="st-..."
ANTHROPIC_API_KEY="sk-ant-..."  # For LLM evaluation
```

**Client (`client/.env.local`)**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## API Documentation

### Kore GenAI Logs (`POST /api/kore/llm-logs`)

Fetches LLM usage logs from the Kore.AI platform.

**Request:**
```json
{
  "botConfig": {
    "host": "platform.kore.ai",
    "botId": "st-...",
    "clientId": "cs-...",
    "clientSecret": "..."
  },
  "filters": {
    "dateFrom": "2026-02-01",
    "dateTo": "2026-02-08",
    "limit": "50"
  }
}
```

**Response:**
Returns an array of log entries with:
- `start Date`, `End Date`, `Time Taken`
- `Feature Name` (e.g., "Agent Node", "Guardrails - LLM Input")
- `Request Payload` - The exact prompt sent to the LLM
- `Response Payload` - The LLM's response
- `Model Name`, `Integration`, etc.

## Troubleshooting

### "Table does not exist" errors
```bash
cd server
npx prisma db push
```

### Kore GenAI Logs not showing
1. Ensure your App has the **"App Builder: Fetch Gen AI and LLM Usage Logs"** scope enabled in the Kore.AI platform
2. Check the date range - logs may not be from today
3. Click the "Fetch Logs" button manually

### Garak not working
```bash
cd server
source venv/bin/activate
pip install garak requests pyjwt
```

## Development Notes

- **Hot Reload**: Both client (Next.js) and server (nodemon) support hot reload
- **TypeScript**: Client uses TypeScript; server uses JavaScript
- **Styling**: Tailwind CSS with dark mode support
- **Database**: SQLite via Prisma ORM (file: `server/dev.db`)

## 📚 Documentation

RedGuard maintains comprehensive documentation to support development, deployment, and operations.

### Core Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| **[README.md](./README.md)** (this file) | Project overview, architecture, quick start | Everyone |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Production deployment guide, GitHub Actions, GCP | DevOps, Developers |
| **[LOCAL_DEV_GUIDE.md](./LOCAL_DEV_GUIDE.md)** | Local development setup | Developers |
| **[CONTRIBUTING.md](./CONTRIBUTING.md)** | Contribution guidelines, standards | Contributors, External teams |

### Technical Guides

| Document | Purpose |
|----------|---------|
| **[koreai_curl_test_guide.md](./koreai_curl_test_guide.md)** | Testing Kore.AI API with curl |
| **[koreai_llm_prompt_inspection_guide.md](./koreai_llm_prompt_inspection_guide.md)** | Inspecting LLM prompts in Kore.AI |
| **[guardrail_evaluation_prompt_v3.md](./guardrail_evaluation_prompt_v3.md)** | Evaluation prompt templates |

### Quick Links

- **Deploy to Production**: See [DEPLOYMENT.md](./DEPLOYMENT.md#quick-start)
- **Setup Local Dev**: See [LOCAL_DEV_GUIDE.md](./LOCAL_DEV_GUIDE.md)
- **Report Issues**: See [CONTRIBUTING.md](./CONTRIBUTING.md#reporting-issues)
- **API Reference**: See [API Documentation](#api-documentation) below

---

## For External Collaborators

If you're working with RedGuard (Google, Antigravity, contractors):

1. **Start here**: Read this README completely
2. **Development**: Follow [LOCAL_DEV_GUIDE.md](./LOCAL_DEV_GUIDE.md)
3. **Contributing**: Read [CONTRIBUTING.md](./CONTRIBUTING.md) for standards
4. **Deployment**: Never deploy without reading [DEPLOYMENT.md](./DEPLOYMENT.md)
5. **Questions**: Check docs first, then create GitHub issue

**⚠️ Important**: Always reference documentation in:
- Pull requests
- Issues
- Code comments
- Commit messages

Example: `"Fixes deployment issue - see DEPLOYMENT.md#troubleshooting"`

---

## License

Internal use only.
 
 
