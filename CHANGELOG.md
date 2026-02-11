# RedGuard Changelog

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
