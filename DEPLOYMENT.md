
## Deployment Guide & Best Practices

This document outlines the standard procedures for deploying RedGuard to the GCP Production environment.

### Versioning Strategy
We follow **Semantic Versioning** (MAJOR.MINOR.PATCH):
- **PATCH** (x.x.1): Bug fixes, small UI tweaks, non-breaking changes.
- **MINOR** (x.1.x): New features (e.g., Batch Tester, new API integration).
- **MAJOR** (1.x.x): Significant milestones or breaking changes.

**Before pushing to main:**
1. Update `"version"` in `client/package.json`.
2. Ensure the version badge component in `client/app/page.tsx` matches the new version.

### Disk Space Management (CRITICAL)
The GCP instance has limited disk space. Docker images can quickly fill up the storage, causing deployments to fail with `no space left on device`.

**The Deployment Workflow (`.github/workflows/deploy.yml`) MUST include a prune step:**
```yaml
- name: Deploy via SSH
  script: |
    # ... login and setup steps ...
    
    # CRITICAL: Prune old images to free up space before pulling new ones
    sudo docker system prune -af

    # ... pull and up steps ...
```
**Do not remove this step.** It is essential for the stability of the deployment pipeline.

### Deployment Process
1. Commit your changes to the `main` branch.
2. The GitHub Action **"Build and Deploy to GCP"** will automatically trigger.
3. Monitor the action in the [GitHub Actions tab](https://github.com/scottxxxxx/RedGuard/actions).
4. Once green, verify the new version text in the app header at `http://***REMOVED_IP***:3000`.
