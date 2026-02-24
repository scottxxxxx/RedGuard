<p align="center">
  <img src="client/public/logo-transparent.png" alt="RedGuard" width="200" />
</p>

<h1 align="center">RedGuard</h1>

<p align="center">
  AI safety verification platform for Kore.ai XO Platform chatbots.<br/>
  Connect your bot, define guardrail policies, chat with it live, and have an LLM judge evaluate every response against your configured guardrails.
</p>

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

## Features

- **Multi-provider LLM Judge** -- Evaluate bot responses using Anthropic (Claude), OpenAI (GPT-4/5), Google Gemini, DeepSeek, Qwen, or Kimi
- **Guardrail Configuration** -- Define safety policies: toxicity, topic restrictions, prompt injection detection, regex filters
- **Live Chat Testing** -- Interactive verification console with real-time bot communication
- **GenAI Log Inspection** -- Pull and analyze Kore.ai GenAI logs with log numbering that maps to evaluation references
- **Evaluation Prompt Editor** -- Model-specific prompt templates with structured output support
- **Metrics Dashboard** -- Evaluation run pass rates, latency tracking, token costs by provider, error breakdowns
- **Batch Testing** -- Run scripted test conversations against your bot
- **Bot Config Analysis** -- Export and analyze bot guardrail configurations from Kore.ai

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     CLIENT (Next.js)                         │
│                      localhost:3000                           │
│  ┌────────────────┐ ┌────────────────┐ ┌─────────────────┐  │
│  │  Bot Settings   │ │Guardrail Config│ │Evaluation Model │  │
│  └────────────────┘ └────────────────┘ └─────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐│
│  │          Live Verification Console (Chat)                ││
│  └──────────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────────┐│
│  │                  Kore GenAI Logs                         ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    SERVER (Express.js)                        │
│                      localhost:3001                           │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────────────┐ │
│  │  /api/chat   │ │ /api/evaluate│ │ /api/kore/llm-logs    │ │
│  └─────────────┘ └──────────────┘ └───────────────────────┘ │
│                          │                                    │
│                  ┌───────┴───────┐                            │
│                  │   SQLite DB   │                            │
│                  │  (Prisma ORM) │                            │
│                  └───────────────┘                            │
└──────────────────────────────────────────────────────────────┘
                             │
             ┌───────────────┴───────────────┐
             ▼                               ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│    Kore.ai Platform     │   │    LLM Provider          │
│   - Webhook Chat API    │   │   (Claude, GPT, Gemini)  │
│   - GenAI Logs API      │   │   - Evaluation API       │
└─────────────────────────┘   └─────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Client | Next.js 16, React 19, TypeScript 5 |
| Server | Express 5, Node.js 20+ |
| Database | SQLite with Prisma ORM 6 |
| Testing | Jest + Supertest (API), Playwright (E2E) |
| Deployment | Docker, GitHub Actions, GCP Compute Engine |

## Quick Start

### Prerequisites

- Node.js 20+
- npm
- A Kore.ai XO Platform bot with webhook configured
- At least one LLM API key (Anthropic, OpenAI, or Gemini)

### 1. Clone the repo

```bash
git clone https://github.com/your-username/RedGuard.git
cd RedGuard
```

### 2. Set up the server

```bash
cd server
npm install
npx prisma db push
npm run dev
```

The server starts on http://localhost:3001.

### 3. Set up the client

```bash
cd client
cp .env.example .env.local
# Edit .env.local if using Google OAuth -- see Authentication section below
npm install
npm run dev
```

The client starts on http://localhost:3000. Kore.ai bot credentials and LLM API keys are configured in the UI.

## Docker

### Development

```bash
docker compose up
```

Starts the client (port 3000) and server (port 3001) with hot-reload volume mounts. You still need `.env` files in `server/` and `client/` directories.

### Production

```bash
docker compose -f docker-compose.prod.yml up -d
```

The production compose includes a Caddy reverse proxy on ports 80/443 with automatic HTTPS.

## Environment Variables

Kore.ai bot credentials and LLM API keys are all configured through the UI — no `.env` setup needed for those.

### Server (`server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: `3001`) |
| `DATABASE_URL` | No | SQLite path (default: `file:../dev.db`) |

### Client (`client/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL (`http://localhost:3001/api` for dev) |
| `NEXTAUTH_SECRET` | If using auth | JWT secret -- generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | If using auth | App URL for OAuth callbacks (`http://localhost:3000` for dev) |
| `GOOGLE_CLIENT_ID` | If using auth | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | If using auth | Google OAuth client secret |

## Authentication

RedGuard supports Google OAuth for user identification. This is **required by default** but can be disabled for simpler self-hosted setups.

### Option A: With Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Go to **APIs & Services > Credentials**
4. Click **+ Create Credentials > OAuth client ID**
5. Select **Web application**
6. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://your-domain.com/api/auth/callback/google` (production)
7. Copy the **Client ID** and **Client Secret**
8. Go to **OAuth consent screen**, select **External**, fill in required fields, and add your email as a test user
9. Update `client/.env.local`:

```env
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<your client id>
GOOGLE_CLIENT_SECRET=<your client secret>
```

See [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md) for detailed instructions.

### Option B: Without Authentication

To run RedGuard without Google OAuth, make two changes:

**1. Update `client/contexts/UserContext.tsx`** -- Replace the session-based user ID with a localStorage UUID:

```typescript
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UserContextType {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState('anonymous');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let id = localStorage.getItem('redguard_user_id');
    if (!id) {
      id = generateId();
      localStorage.setItem('redguard_user_id', id);
    }
    setUserId(id);
    setIsLoading(false);
  }, []);

  return (
    <UserContext.Provider value={{
      userId,
      userName: null,
      userEmail: null,
      userImage: null,
      isLoading,
      isAuthenticated: true,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
```

**2. Remove the `SessionProvider` wrapper** from your app's providers, or simply leave the NextAuth environment variables empty. The modified `UserContext` above bypasses NextAuth entirely, and every browser gets a unique persistent user ID without Google OAuth.

## Production Deployment (GCP)

The included GitHub Actions workflow (`.github/workflows/deploy.yml`) automates deployment to a GCP Compute Engine VM.

### How it works

1. On push to `main`, GitHub Actions builds Docker images for client and server
2. Images are pushed to GitHub Container Registry (GHCR)
3. The workflow SSHes into the GCP VM and runs `docker compose up`
4. Caddy reverse proxy handles HTTPS termination and routing

### GitHub Secrets required

| Secret | Description |
|--------|-------------|
| `GCP_HOST` | VM external IP or hostname |
| `GCP_USERNAME` | SSH username on the VM |
| `GCP_SSH_KEY` | SSH private key for VM access |
| `GCP_SSH_PASSPHRASE` | SSH key passphrase (if applicable) |
| `NEXTAUTH_SECRET` | Same as client env var |
| `GOOGLE_CLIENT_ID` | Same as client env var |
| `GOOGLE_CLIENT_SECRET` | Same as client env var |

### Manual GCP setup

1. Create a Compute Engine VM (e.g. `e2-small`, Ubuntu)
2. Install Docker and Docker Compose on the VM
3. Open ports 80 and 443 in the firewall
4. Add the secrets above to your GitHub repository settings
5. Push to `main` to trigger deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## Supported LLM Providers

| Provider | Models | Notes |
|----------|--------|-------|
| Anthropic | Claude Sonnet, Opus | Recommended for evaluation accuracy |
| OpenAI | GPT-4o, GPT-5, o3, o4 | Supports structured output via JSON Schema |
| Google Gemini | Gemini 2.0, 2.5 | |
| DeepSeek | DeepSeek V3, R1 | OpenAI-compatible API |
| Qwen | Qwen 2.5, QwQ | OpenAI-compatible API |
| Kimi | Moonshot models | OpenAI-compatible API |

## Testing

```bash
# From the root directory -- runs API tests then E2E tests
npm run test:all

# API tests only (Jest + Supertest)
npm run test

# E2E tests only (Playwright)
npm run test:e2e
```

## Project Structure

```
RedGuard/
  client/                  # Next.js frontend
    app/                   # App router pages
    components/            # React components
    contexts/              # React contexts (UserContext)
    e2e/                   # Playwright E2E tests
  server/                  # Express backend
    src/
      routes/              # API route handlers
      services/            # Business logic
        llm-providers/     # LLM provider implementations
        bot-platforms/     # Bot platform integrations
      prompts/             # Evaluation prompt templates
    prisma/                # Database schema
    tests/                 # Jest API tests
  services/
    token-cost/            # Token cost estimation microservice
  .github/workflows/       # CI/CD pipeline
```

## Documentation

| Document | Description |
|----------|-------------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment guide |
| [LOCAL_DEV_GUIDE.md](LOCAL_DEV_GUIDE.md) | Local development setup |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |
| [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md) | Google OAuth setup details |

## License

[Apache License 2.0](LICENSE)
