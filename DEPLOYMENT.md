# RedGuard Deployment Guide

## Overview
RedGuard uses GitHub Actions to automatically deploy to Google Cloud Platform (GCP) when code is pushed to the `main` branch. This deployment was set up after the previous environment managed by Google and Digravity was shut down.

---

## Quick Start

### To Deploy to Production:
```bash
# 1. Commit your changes
git add .
git commit -m "Your changes"

# 2. Push to main (triggers automatic deployment)
git push origin main

# 3. Monitor deployment
# Go to: https://github.com/scottguida/redguard/actions
```

**Timeline**: ~5-10 minutes for complete deployment

---

## Architecture

- **Source Control**: GitHub
- **Container Registry**: GitHub Container Registry (GHCR)
- **Production Server**: GCP Compute Engine VM @ ***REMOVED_IP***
- **Deployment Method**: SSH-based Docker Compose
- **Client Port**: 80 (standard HTTP, no port needed in URL)
- **Server Port**: 3001

---

## Versioning Strategy

We follow **Semantic Versioning** (MAJOR.MINOR.PATCH):
- **PATCH** (x.x.1): Bug fixes, small UI tweaks, non-breaking changes
- **MINOR** (x.1.x): New features (e.g., Batch Tester, new API integration)
- **MAJOR** (1.x.x): Significant milestones or breaking changes

**Before pushing to main:**
1. Update `"version"` in `client/package.json`
2. Ensure the version badge in `client/app/page.tsx` matches the new version
3. The version appears in the top-right corner of the production app

---

## Automated Deployment Process

### How It Works

1. **Code Push** → Push to `main` branch triggers GitHub Actions
2. **Build Phase** → Docker images built for client and server
3. **Push to Registry** → Images pushed to GitHub Container Registry (GHCR)
4. **Deploy Phase** → SSH into GCP VM, pull images, restart services
5. **Verification** → Services automatically restart with new version

### Workflow File
Location: `.github/workflows/deploy.yml`

### What Gets Deployed
- **Server**: Express.js API + SQLite database
- **Client**: Next.js production build
- **Environment**: Production mode with `.env.production` values

---

## Prerequisites & Configuration

### 1. GitHub Repository Secrets

Configure in **GitHub → Settings → Secrets and variables → Actions**:

| Secret Name | Description | Current Value/Notes |
|------------|-------------|---------------------|
| `GCP_HOST` | GCP VM IP address | `***REMOVED_IP***` |
| `GCP_USERNAME` | SSH username | Your GCP VM username |
| `GCP_SSH_KEY` | Private SSH key | Must match public key on VM |
| `GITHUB_TOKEN` | Auto-provided by GitHub | No setup needed |

### 2. GCP VM Requirements
- Docker installed: `sudo apt install docker.io`
- Docker Compose installed: `sudo apt install docker-compose`
- SSH access enabled
- Firewall rules: Allow TCP ports 80, 3001
- Sufficient disk space: 20GB minimum recommended

### 3. Environment Variables

**Production Client** (`.env.production`):
```bash
NEXT_PUBLIC_API_URL=http://***REMOVED_IP***:3001/api
```

**Production Server**:
```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=file:/data/prod.db
```

---

## Deployment Methods

### Method 1: Automatic Deployment (Recommended)

**Trigger**: Push to `main` branch

```bash
# Make your changes
git add .
git commit -m "feat: add new feature"
git push origin main
```

**Monitor Progress**:
1. Go to https://github.com/scottguida/redguard/actions
2. Click on the latest "Build and Deploy to GCP" workflow
3. Watch each step complete:
   - ✅ Checkout code
   - ✅ Build and push server image (~2-3 min)
   - ✅ Build and push client image (~2-3 min)
   - ✅ Deploy via SSH (~1-2 min)

**Verification**:
```bash
# Check client
curl http://***REMOVED_IP***

# Check server API
curl http://***REMOVED_IP***:3001/api/health

# View in browser
open http://***REMOVED_IP***
```

### Method 2: Manual Trigger

**Use Case**: Deploy without pushing new code (e.g., environment changes)

1. Go to GitHub → Actions → "Build and Deploy to GCP"
2. Click "Run workflow" button
3. Select "main" branch
4. Click "Run workflow"

### Method 3: Emergency Manual Deployment

**Use Case**: GitHub Actions is down or SSH debugging needed

```bash
# 1. SSH into production server
ssh -i ~/.ssh/your-key your-username@***REMOVED_IP***

# 2. Login to container registry
echo "YOUR_GITHUB_TOKEN" | sudo docker login ghcr.io -u YOUR_USERNAME --password-stdin

# 3. Pull latest images
sudo docker compose -f docker-compose.prod.yml pull

# 4. Restart services
sudo docker compose -f docker-compose.prod.yml up -d

# 5. Verify containers are running
sudo docker ps
```

---

## Critical: Disk Space Management

**⚠️ IMPORTANT**: The GCP VM has limited disk space. Docker images can quickly fill storage, causing deployments to fail with `no space left on device`.

### Automatic Cleanup (Built-in)

The deployment workflow includes automatic cleanup:
```yaml
# Prune old images to free up space
sudo docker system prune -af
```

**Do not remove this step** from `.github/workflows/deploy.yml`. It is essential for deployment stability.

### Manual Cleanup (If Needed)

```bash
# SSH into VM
ssh your-username@***REMOVED_IP***

# Check disk usage
df -h

# Clean up Docker system
sudo docker system prune -af

# Remove unused volumes (CAREFUL - only if safe)
sudo docker volume prune

# Remove specific old images
sudo docker images
sudo docker rmi <image-id>
```

### Monitoring Disk Space

```bash
# Check available space
ssh your-username@***REMOVED_IP*** "df -h"

# Expected: At least 5GB free after cleanup
```

---

## Monitoring & Verification

### 1. GitHub Actions Dashboard

**During Deployment**:
- URL: https://github.com/scottguida/redguard/actions
- Shows real-time build and deployment progress
- Click on workflow run to see detailed logs

**Status Indicators**:
- 🟢 Green checkmark: Success
- 🔴 Red X: Failed (check logs)
- 🟡 Yellow dot: In progress

### 2. Production Health Checks

```bash
# Client (Next.js app)
curl http://***REMOVED_IP***
# Expected: HTML response

# Server API health
curl http://***REMOVED_IP***:3001/api/health
# Expected: { "status": "ok" } or similar

# Full API test
curl http://***REMOVED_IP***:3001/api/prompts
# Expected: JSON array of prompts
```

### 3. Check Running Containers

```bash
ssh your-username@***REMOVED_IP***
sudo docker ps

# Expected output:
# CONTAINER ID   IMAGE                              STATUS          PORTS
# xxxx           ghcr.io/.../client:latest         Up 5 minutes    0.0.0.0:80->3000/tcp
# xxxx           ghcr.io/.../server:latest         Up 5 minutes    0.0.0.0:3001->3001/tcp
```

### 4. View Application Logs

```bash
# SSH into VM
ssh your-username@***REMOVED_IP***

# Client logs (real-time)
sudo docker compose -f docker-compose.prod.yml logs -f client

# Server logs (real-time)
sudo docker compose -f docker-compose.prod.yml logs -f server

# All logs (real-time)
sudo docker compose -f docker-compose.prod.yml logs -f

# Last 100 lines
sudo docker compose -f docker-compose.prod.yml logs --tail=100
```

### 5. Version Verification

Check the version number in the app:
1. Open http://***REMOVED_IP***
2. Look for version badge in top-right corner
3. Should match `version` in `client/package.json`

---

## Rollback Procedures

### Quick Rollback (Previous Image)

```bash
# 1. SSH into production
ssh your-username@***REMOVED_IP***

# 2. List available images
sudo docker images | grep redguard

# 3. Find the previous image digest/tag
# Docker tags images before pruning, so you can roll back to "previous"

# 4. Edit docker-compose.prod.yml
sudo nano docker-compose.prod.yml

# 5. Change image tags from :latest to specific version
# Example:
#   image: ghcr.io/scottguida/redguard/client:sha-abc123
#   image: ghcr.io/scottguida/redguard/server:sha-abc123

# 6. Restart with specific version
sudo docker compose -f docker-compose.prod.yml up -d
```

### Git-Based Rollback

```bash
# 1. Identify problematic commit
git log --oneline

# 2. Revert the bad commit (creates new commit)
git revert <bad-commit-hash>

# 3. Push to main (triggers redeployment)
git push origin main

# Alternative: Reset to previous commit (destructive)
git reset --hard <good-commit-hash>
git push origin main --force
```

### Emergency Rollback Checklist

- [ ] Identify issue and confirm rollback needed
- [ ] Note current version number
- [ ] SSH into production server
- [ ] Stop current containers
- [ ] Pull or specify previous image version
- [ ] Restart containers
- [ ] Verify services are running
- [ ] Test critical functionality
- [ ] Document incident and resolution

---

## Troubleshooting

### Deployment Fails: Build Stage

**Symptom**: GitHub Actions fails during Docker build

**Check**:
1. Build logs in GitHub Actions
2. Dockerfile syntax errors
3. Missing dependencies in package.json
4. Build environment issues

**Solutions**:
```bash
# Test build locally first
cd client && docker build .
cd server && docker build .

# Check for syntax errors
npm run lint
```

### Deployment Fails: SSH Stage

**Symptom**: "Permission denied" or "Host key verification failed"

**Check**:
1. `GCP_HOST` secret is correct: `***REMOVED_IP***`
2. `GCP_SSH_KEY` secret contains correct private key
3. Public key is in VM's `~/.ssh/authorized_keys`
4. VM is running and accessible

**Solutions**:
```bash
# Test SSH connection locally
ssh -i ~/.ssh/your-key your-username@***REMOVED_IP***

# Regenerate SSH keys if needed
ssh-keygen -t ed25519 -C "github-actions"
# Add public key to VM
# Update GCP_SSH_KEY secret with private key
```

### Services Won't Start

**Symptom**: Deployment succeeds but containers crash immediately

**Check**:
```bash
ssh your-username@***REMOVED_IP***
sudo docker compose -f docker-compose.prod.yml logs

# Common issues to look for:
# - Port already in use
# - Environment variable missing
# - Database migration failed
# - Permission errors
```

**Solutions**:
```bash
# Stop conflicting processes
sudo docker compose -f docker-compose.prod.yml down

# Clean up and restart
sudo docker system prune -f
sudo docker compose -f docker-compose.prod.yml up -d

# Check port conflicts
sudo netstat -tulpn | grep -E '80|3001'
```

### Out of Disk Space

**Symptom**: "no space left on device" error

**Immediate Fix**:
```bash
ssh your-username@***REMOVED_IP***

# Nuclear option - clean everything
sudo docker system prune -af
sudo docker volume prune -f

# Check space
df -h

# Expected: At least 5GB free
```

**Prevention**:
- Ensure `docker system prune -af` is in deployment workflow
- Monitor disk usage weekly
- Consider increasing VM disk size if frequently full

### Database Issues

**Symptom**: Server starts but API returns 500 errors

**Check**:
```bash
# View server logs
sudo docker compose -f docker-compose.prod.yml logs server

# Check database file
sudo docker exec -it <container-id> ls -lh /data/
```

**Solutions**:
```bash
# Backup current database
ssh your-username@***REMOVED_IP***
sudo docker cp <container-id>:/data/prod.db ./prod.db.backup

# Restart with fresh database (DESTRUCTIVE)
sudo docker compose -f docker-compose.prod.yml down
sudo docker volume rm <volume-name>
sudo docker compose -f docker-compose.prod.yml up -d
```

---

## Development vs Production

### Development (Local)

**How to Run**:
```bash
# Terminal 1: Server
cd server
npm install
npm run dev

# Terminal 2: Client
cd client
npm install
npm run dev
```

**Characteristics**:
- Uses `.env.local` files
- Hot module reloading
- Dev tools enabled (Next.js inspector)
- Debug logging
- Source maps enabled
- Not optimized

**URLs**:
- Client: http://localhost:3000
- Server: http://localhost:3001

### Production (GCP)

**How to Run**:
```bash
# Automatic via GitHub Actions
git push origin main
```

**Characteristics**:
- Uses `.env.production` and Dockerfile ENV vars
- Optimized builds
- No dev tools
- Production logging only
- Minified code
- Docker containerized
- NODE_ENV=production

**URLs**:
- Client: http://***REMOVED_IP***
- Server: http://***REMOVED_IP***:3001

---

## Security Best Practices

### GitHub Secrets Management

- ✅ All secrets stored in GitHub Secrets (encrypted)
- ✅ Never commit secrets to repository
- ✅ `.env.local` files in `.gitignore`
- ✅ Secrets only accessible to GitHub Actions runners
- ⚠️ Rotate SSH keys periodically
- ⚠️ Use service accounts instead of personal credentials

### SSH Security

- Use key-based authentication (no passwords)
- Keep private keys secure
- Add passphrase to SSH keys
- Restrict SSH access by IP if possible
- Use fail2ban on production server
- Monitor SSH logs for unauthorized access

### Docker Security

- Images are private in GHCR
- Require GitHub authentication to pull
- Run containers as non-root user (TODO)
- Scan images for vulnerabilities
- Keep base images updated

### API Security

- Use HTTPS in production (TODO)
- Implement rate limiting
- Validate all inputs
- Use CORS restrictions
- Keep API keys secure
- Monitor for suspicious activity

---

## Performance Optimization

### Build Optimization

Already implemented in Dockerfile:
- Multi-stage builds (TODO for optimization)
- Layer caching
- Production builds (`npm run build`)
- Optimized Next.js output

### Runtime Optimization

- Docker Compose resource limits (TODO)
- Database query optimization
- CDN for static assets (TODO)
- Gzip compression enabled

---

## Maintenance Tasks

### Weekly
- [ ] Check disk space: `df -h`
- [ ] Review server logs for errors
- [ ] Verify automated backups (TODO)

### Monthly
- [ ] Update dependencies: `npm update`
- [ ] Security audit: `npm audit`
- [ ] Review GitHub Actions logs
- [ ] Clean up old Docker images

### Quarterly
- [ ] Rotate SSH keys
- [ ] Review and update secrets
- [ ] Performance analysis
- [ ] Disaster recovery drill

---

## Quick Reference

### Access URLs
```bash
# Production client (Port 80 - standard HTTP, no port needed)
http://***REMOVED_IP***

# Production server API
http://***REMOVED_IP***:3001/api

# GitHub Actions
https://github.com/scottguida/redguard/actions

# GCP Console
https://console.cloud.google.com/
# Project: redguard-dev-scottguida
```

### Common Commands

```bash
# Deploy to production
git push origin main

# SSH into production
ssh your-username@***REMOVED_IP***

# View logs
sudo docker compose -f docker-compose.prod.yml logs -f

# Restart services
sudo docker compose -f docker-compose.prod.yml restart

# Check status
sudo docker ps

# Clean up disk space
sudo docker system prune -af
```

### File Locations

```bash
# Deployment workflow
.github/workflows/deploy.yml

# Client Dockerfile
client/Dockerfile

# Server Dockerfile
server/Dockerfile

# Production environment
client/.env.production

# Docker Compose (on VM)
~/docker-compose.prod.yml
```

---

## Support & Resources

### Internal Documentation
- This file: `DEPLOYMENT.md`
- Architecture: `README.md` (TODO)
- API docs: `server/API.md` (TODO)

### External Resources
- GitHub Actions: https://docs.github.com/actions
- Docker Compose: https://docs.docker.com/compose/
- Next.js Production: https://nextjs.org/docs/deployment
- GCP Compute Engine: https://cloud.google.com/compute/docs

### Contacts
- GitHub Repository: https://github.com/scottguida/redguard
- GCP Project: redguard-dev-scottguida

---

## Change History

### Current Setup (February 2025)
- ✅ Automated GitHub Actions deployment
- ✅ GHCR for container registry
- ✅ Docker Compose on GCP Compute Engine
- ✅ SSH-based deployment
- ✅ Production environment flagged
- ✅ Automatic disk cleanup

### Previous Setup (Before February 2025)
- Managed by Google and Digravity
- Environment shut down and migrated to current setup

---

## TODO / Future Improvements

- [ ] Add HTTPS/SSL certificate
- [ ] Implement automated database backups
- [ ] Add staging environment
- [ ] Set up monitoring/alerting (Sentry, DataDog, etc.)
- [ ] Add health check endpoints
- [ ] Implement blue-green deployments
- [ ] Add smoke tests after deployment
- [ ] Document database migration process
- [ ] Add API documentation
- [ ] Set up CDN for static assets
