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

## Cost Management: Starting & Stopping the VM

To save costs, you can stop the GCP VM when not in use and start it when needed.

### Stop the VM (Save Money)
```bash
# Stop the production server
gcloud compute instances stop redguard-server --zone=us-central1-a

# Verify it's stopped
gcloud compute instances list --filter="name=redguard-server"
# STATUS should show: TERMINATED
```

**Cost Impact**: Stopping the VM stops billing for compute resources. You only pay for disk storage (~$0.40/month for 10GB).

### Start the VM
```bash
# Start the server
gcloud compute instances start redguard-server --zone=us-central1-a

# Verify it's running
gcloud compute instances list --filter="name=redguard-server"
# STATUS should show: RUNNING
# EXTERNAL_IP should show: ***REMOVED_IP***
```

**Important Notes:**
- After starting, **wait 1-2 minutes** for SSH service to be fully ready
- GitHub Actions deployments will fail if the VM is stopped
- Docker containers automatically restart when the VM boots up
- Your data persists in the `redguard_data` volume

### Via Google Cloud Console (GUI)

1. Go to **Compute Engine** → **VM instances**:
   https://console.cloud.google.com/compute/instances
2. Click the **three dots** (⋮) next to `redguard-server`.
3. Select **Start / Resume** or **Stop**.
4. **Graceful Shutdown**: Clicking "Stop" in the console sends the same safe shutdown signal as the command line. It shuts down Docker containers and the OS gracefully before powering off.

### Check VM Status Anytime
```bash
gcloud compute instances describe redguard-server --zone=us-central1-a --format="value(status)"
```

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
4. **Deploy Phase** → SSH into GCP VM:
   - **Step 0: Aggressive Cleanup** → Stops containers and prunes ALL unused images/volumes to free space
   - **Step 1: Pull & Restart** → Pulls new images and restarts services
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
| `GCP_SSH_PASSPHRASE` | SSH Key Passphrase | Required if key has a passphrase |
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

### 4. GCP Firewall Configuration

Ensure the firewall allows incoming traffic on the required ports:

```bash
# Check current firewall rules
gcloud compute firewall-rules list --filter="name~redguard"

# The rule should allow: tcp:80,tcp:3000,tcp:3001
# If port 80 is missing, update it:
gcloud compute firewall-rules update allow-redguard-ports \
  --allow=tcp:80,tcp:3000,tcp:3001

# Verify the update
gcloud compute firewall-rules describe allow-redguard-ports --format="value(allowed[].ports.flatten())"
# Should output: 80,3000,3001
```

**Port Usage:**
- **Port 80**: Client (HTTP) - Primary access point
- **Port 3000**: Client (alternative) - Legacy, can be removed
- **Port 3001**: Server API - Required for backend

**Note**: Port 22 (SSH) should be allowed via the default `default-allow-ssh` rule. Verify with:
```bash
gcloud compute firewall-rules list --filter="allowed[].ports:22"
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

**⚠️ IMPORTANT**: The GCP VM has limited disk space (20-30GB). To prevent "no space left on device" errors, we must aggressively clean up Docker artifacts *before* pulling new images.

### Automatic Cleanup (Built-in)

The deployment workflow now includes an **Aggressive Cleanup Step** that runs first:
```bash
# Stops all containers
# Removes all containers
# Prunes ALL images, networks, and build cache
# Prunes unused volumes (EXCEPT critical data in named volumes)
sudo docker system prune -af --volumes
```

**Do not remove this step** from `.github/workflows/deploy.yml`. It is essential for deployment succeess.

### Manual Cleanup (If Needed)

```bash
# SSH into VM
ssh your-username@***REMOVED_IP***

# 1. Stop all containers
sudo docker stop $(sudo docker ps -aq)

# 2. Remove all containers
sudo docker rm $(sudo docker ps -aq)

# 3. Clean up EVERYTHING (images, networks, build cache, volumes)
# WARNING: Only safe because we use a named volume 'redguard_data' for the DB
sudo docker system prune -af --volumes

# Check disk usage
df -h
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

**Symptom**: "Permission denied", "Host key verification failed", or "dial tcp :22: i/o timeout"

**Common Causes**:
1. VM was recently started and SSH service isn't ready yet
2. SSH keys haven't propagated after VM restart
3. VM is stopped/terminated
4. GitHub Actions SSH key not authorized on VM

**Check**:
1. Verify VM is running: `gcloud compute instances list --filter="name=redguard-server"`
2. Check if SSH is ready: `gcloud compute ssh redguard-server --zone=us-central1-a --command="uptime"`
3. Verify firewall allows port 22: `gcloud compute firewall-rules list --filter="allowed[].ports:22"`
4. Check `GCP_HOST` secret is correct: `***REMOVED_IP***`
5. Ensure `GCP_SSH_KEY` secret contains correct private key
6. Verify public key is in VM's `~/.ssh/authorized_keys`

**Solutions**:

**Quick Fix - Manual Deployment via GCP Console:**
If GitHub Actions SSH fails, use the GCP Console's browser SSH (bypasses key issues):

1. Open GCP Console: https://console.cloud.google.com/compute/instancesDetail/zones/us-central1-a/instances/redguard-server?project=redguard-dev-scottguida
2. Click the **SSH** button (opens browser terminal)
3. Run deployment commands:
   ```bash
   # Login to GHCR (create token at https://github.com/settings/tokens)
   echo "YOUR_GITHUB_TOKEN" | sudo docker login ghcr.io -u scottguida --password-stdin

   # Download or update docker-compose.prod.yml
   wget -O docker-compose.prod.yml https://raw.githubusercontent.com/scottguida/RedGuard/main/docker-compose.prod.yml

   # Pull and start latest images
   sudo docker compose -f docker-compose.prod.yml pull
   sudo docker compose -f docker-compose.prod.yml up -d

   # Verify
   sudo docker ps
   ```

**Long-term Fix - Regenerate SSH Keys:**

If you encounter `ssh: handshake failed: ssh: unable to authenticate`, the key in GitHub Secrets likely doesn't match the VM's authorized keys.

1. **Generate a new key pair (no passphrase):**
   ```bash
   ssh-keygen -t ed25519 -C "github-actions" -f keys/deploy_key -N ""
   ```

2. **Authorize the key on the VM:**
   ```bash
   # Add the PUBLIC key to the VM's metadata for user 'github-actions'
   gcloud compute instances add-metadata redguard-server \
     --zone=us-central1-a \
     --metadata ssh-keys="github-actions:$(cat keys/deploy_key.pub)"
   ```

3. **Update GitHub Secrets:**
   Go to **Settings** → **Secrets and variables** → **Actions** and update:
   - `GCP_USERNAME`: Set to `github-actions`
   - `GCP_SSH_KEY`: Paste the entire content of `keys/deploy_key` (Private Key)
   - `GCP_SSH_PASSPHRASE`: **Delete** this secret or make it empty (new key has no password)

4. **Test Connection (Optional):**
   ```bash
   ssh -i keys/deploy_key github-actions@***REMOVED_IP***
   ```

**Wait After VM Start:**
If you just started the VM, wait 2-3 minutes before deploying:
```bash
# Start VM
gcloud compute instances start redguard-server --zone=us-central1-a

# Wait for SSH to be ready
sleep 120

# Then deploy
git push origin main
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
