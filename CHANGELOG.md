# RedGuard Changelog

---

## [0.4.2] - 2026-03-17

### Full-Screen Prompt Editor & Production Deployment

#### Fixed
- **NotificationContext import path** — `BotSettings.tsx` imported from `../contexts/` (plural) instead of `../context/` (singular), causing build failures
- **Prompt Editor modal flickering** — backdrop click handler was firing on mouse move, causing rapid open/close cycles. Fixed with `onMouseDown` + `stopPropagation` pattern
- **Dual editor conflict** — inline prompt editor and modal were both rendering simultaneously, fighting for focus. Inline editor now hides (`display: none`) when modal is open
- **LogViewer crash on empty database** — `stats.byType` was undefined when no logs existed. Added optional chaining (`stats.byType?.[]`)

#### Changed
- **Prompt Editor modal is now full-screen** — expanded from `max-w-4xl` (896px) to `max-width: 1400px`, `95vw` wide, `90vh` tall. Uses inline styles instead of Tailwind classes for reliable rendering
- **System Instructions textarea** — increased from fixed `h-24` to `min-h-[120px]` with `max-h-[40vh]` for longer prompts
- **Modal uses z-index 9999/10000** — guaranteed to render above all other UI elements

#### Infrastructure
- **Production deployment on GCP** — deployed to `e2-medium` VM at `35.239.227.192` via Docker
- **Nginx Proxy Manager** routing `redguard.scottguida.com` → container
- **SSL/HTTPS** with Let's Encrypt auto-provisioning + HSTS enabled
- **Google OAuth published to production** — any Google account can now sign in
- **Database initialization** — `prisma db push` required on fresh deployments

---

## [0.3.6] - 2026-02-13

### Major Evaluation Engine Upgrade

#### Added
- **Model-Specific Default Evaluation Prompts**
  - Automatic loading of optimized templates for model families (GPT-5.x, GPT-5.x Flash, Opus)
  - Auto-fallback to universal template if no specific match found
  - Preservation of custom user templates during model switching
- **GPT-5.x Structured Output Support**
  - Dedicated templates using strict JSON Schema enforcement via `text.format`
  - Concise prompt structure with dynamic data sections
  - "Flash" variant optimized for speed and token efficiency
- **Structured Evaluation Results UI**
  - New 2x2 grid view for Guardrail Results (Toxicity, Topics, Injection, Regex)
  - Rich status badges, reason text, and summary statistics
  - Consistent visualization across "Evaluation Results" tab and expanded "Evaluation History" rows
- **Enhanced Evaluation History**
  - Full structured data view in expanded rows
  - New columns: Model, Prompt Template Name, Turns Badge
  - Column configuration (visibility, reorder, resize) persisted in local storage
- **Model-Aware Hyperparameters**
  - Per-model parameter definitions in `model-hyperparams.ts`
  - Auto-reset to defaults when switching providers

#### Changed
- **Template System Architecture**
  - Split templates into `system_prompt` (static framework) and `prompt_text` (dynamic data)
  - `system_prompt` cached by Anthropic; used as `system`/`systemInstruction` for other providers
- **Evaluation Inspector**
  - Simplified to 3 read-only tabs (Raw Request, Results, Raw Response)
  - Removed redundant editor/sync logic
- **API Updates**
  - `GET /api/prompts/default` accepts `?provider=&model=` queries
  - `GET /api/prompts/defaults` lists all available templates

#### Fixed
- OpenAI Responses API payload structure (`text.format` flattening)
- Conversation parsing for GPT-5.x (merged turns bug)
- Tab auto-switching race condition during prompt edits

---

## [0.3.3] - 2026-02-11

### Authentication & Authorization Improvements

#### Added
- **Clean Auth Overlay System**: Transparent blocking overlay for unauthenticated users
  - Semi-transparent (80% main, 70% sidebar) preview of app content
  - Single "Sign in with Google" button - no confusing multi-layer dialogs
  - Complete interaction blocking until authenticated
  - Auto-disappears after successful Google OAuth

- **Production Troubleshooting API**: Server debugging endpoints at `/api/troubleshoot/*`
  - `/health` - System health, uptime, memory, environment status
  - `/logs` - Recent application logs with filtering
  - `/env` - Safe environment variables (secrets masked)
  - `/docker-status` - Container information
  
- **Version Endpoint**: `/api/version` returns app version, Node version, environment

- **Gen AI Logs API Validation**: Mandatory check during bot connection
  - Tests API access before allowing chat
  - Clear error directing to enable "Gen AI and LLM Usage Logs" scope

#### Fixed
- OAuth redirect_uri_mismatch errors
- Credential validation fallback issues
- Connection state management in chat console
- Light mode styling in BatchTester

#### Changed
- Streamlined authentication UX (removed double-layer modal)
- Sidebar completely blocked when not authenticated
- Deployment workflow includes NextAuth secrets

---

## Deployment Process (for Antigravity)

### Infrastructure
- **Platform**: GCP Compute Engine
- **Instance**: redguard-server (us-central1-a)
- **Domain**: redguard.scottguida.com
- **Ports**: 80 (client), 3001 (server)

### CI/CD
- **Pipeline**: GitHub Actions (`.github/workflows/deploy.yml`)
- **Trigger**: Push to main or manual dispatch
- **Duration**: ~4-6 minutes

### Verification
```bash
curl http://***REMOVED_IP***:3001/api/version
curl http://***REMOVED_IP***:3001/api/troubleshoot/health
```

### Required Secrets
- NEXTAUTH_SECRET, NEXTAUTH_URL
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- GCP_HOST, GCP_USERNAME, GCP_SSH_KEY
