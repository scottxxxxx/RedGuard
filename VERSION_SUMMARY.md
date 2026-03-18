# RedGuard v0.4.2 - Release Summary

**Release Date:** March 17, 2026
**Previous Version:** 0.4.1

## Key Highlights

### 1. Full-Screen Prompt Editor Modal
- Expand button opens a **full-screen modal** (95vw x 90vh, max 1400px wide) instead of the old narrow inline editor
- Inline editor **hides completely** when modal is open — no more dual-panel conflict
- Fixed flickering caused by backdrop mouse event leaking through to the modal
- System Instructions textarea is resizable up to 40% viewport height

### 2. Production Deployment
- Live at **https://redguard.scottguida.com** on GCP (e2-medium, Docker)
- Nginx Proxy Manager handles SSL/HTTPS with auto-provisioned Let's Encrypt certificates
- HSTS enabled for all connections
- Google OAuth published to production — any Google account can sign in

### 3. Bug Fixes
- **Build failure** — `BotSettings.tsx` had wrong import path for `NotificationContext` (`contexts` → `context`)
- **LogViewer crash** — `stats.byType` was undefined on fresh databases with no logs
- **Database tables missing** — `prisma db push` required after fresh container deployments

## What Changed

| Component | Change | Impact |
|-----------|--------|--------|
| PromptEditorModal | Full-screen with inline styles | Reliable, no Tailwind JIT issues |
| EvaluationSettings | Card hides when modal open | No dual-panel flickering |
| BotSettings | Fixed import path | Build succeeds |
| LogViewer | Optional chaining on stats | No crash on empty DB |
| Infrastructure | GCP + NPM + Docker | Production deployment |
| OAuth | Published to production | Public access |

## Technical Details

### Infrastructure
- **GCP VM:** `web-gateway` (e2-medium, us-central1-a), static IP `35.239.227.192`
- **Docker Compose:** `docker-compose.gateway.yml` with `proxy-tier` network
- **Containers:** `redguard_server` (port 3001), `redguard_client` (port 3000)
- **Reverse Proxy:** Nginx Proxy Manager routes `redguard.scottguida.com` → `redguard_client:3000`
- **Auth env vars:** Stored in `.env` file on server (not in repo)

### Component Updates
- `PromptEditorModal.tsx` — Pure inline styles for modal container, z-index 9999/10000
- `EvaluationSettings.tsx` — Fragment wrapper, card hidden via `display: none` when modal open
- `BotSettings.tsx` — Import path fix
- `LogViewer.tsx` — Optional chaining on `stats.byType`

## Upgrade Path

No breaking changes. Existing configurations work as-is. The prompt editor expand button now opens a proper full-screen modal.

For fresh deployments, run `npx prisma db push` inside the server container after first start.

---

**Live:** https://redguard.scottguida.com
**Source:** https://github.com/scottxxxxx/RedGuard
