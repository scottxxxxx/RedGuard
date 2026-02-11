# RedGuard Development Guide

## Overview
This document outlines development workflows, branching strategies, and best practices for RedGuard development. Follow these guidelines to maintain code quality and enable safe rollbacks.

---

## Table of Contents
1. [Git Workflow](#git-workflow)
2. [Branch Strategy](#branch-strategy)
3. [Version Management](#version-management)
4. [Pull Request Process](#pull-request-process)
5. [Rollback Procedures](#rollback-procedures)
6. [Collaboration with Antigravity](#collaboration-with-antigravity)
7. [Development Environment](#development-environment)

---

## Git Workflow

### Branch Types

**Main Branch (`main`)**
- Production-ready code only
- Always deployable
- Protected branch (requires PR approval)
- Deploys automatically to GCP via GitHub Actions

**Feature Branches (`feature/*`)**
- New features and enhancements
- Branch from `main`
- Merge back to `main` via PR
- Naming: `feature/batch-testing-system`

**Bugfix Branches (`bugfix/*`)**
- Bug fixes for production issues
- Branch from `main`
- Merge back to `main` via PR
- Naming: `bugfix/log-pagination-error`

**Hotfix Branches (`hotfix/*`)**
- Critical production fixes
- Branch from `main`
- Fast-tracked PR process
- Naming: `hotfix/auth-security-issue`

**Release Branches (`release/*`)**
- Preparation for version releases
- Branch from `main`
- Used for final testing and version bumps
- Naming: `release/v0.4.0`

---

## Branch Strategy

### Creating a Feature Branch

```bash
# Start from latest main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/batch-testing-system

# Make your changes...
# Commit often with clear messages
git add .
git commit -m "feat: add JSON parser for batch test scripts"

# Push to remote
git push -u origin feature/batch-testing-system
```

### Branch Naming Conventions

**Features:**
```
feature/batch-testing-system
feature/guardrail-detection
feature/garak-integration
feature/historical-logs-viewer
```

**Bugfixes:**
```
bugfix/pagination-offset-error
bugfix/auth-redirect-loop
bugfix/evaluation-timeout
```

**Hotfixes:**
```
hotfix/xss-vulnerability
hotfix/database-connection-leak
hotfix/critical-auth-bypass
```

**Release Preparation:**
```
release/v0.4.0
release/v1.0.0
```

---

## Version Management

### Semantic Versioning

RedGuard follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

**MAJOR (1.x.x):**
- Breaking changes
- Major feature overhauls
- API changes that break compatibility

**MINOR (x.1.x):**
- New features
- Enhancements
- Backward-compatible changes

**PATCH (x.x.1):**
- Bug fixes
- Security patches
- Performance improvements

### Updating Version

When releasing a new version, update these files:

**1. Client Package:**
```bash
cd client
npm version minor  # or major, patch
```

**2. Server Package:**
```bash
cd server
npm version minor  # or major, patch
```

**3. UI Version Display:**
```typescript
// client/app/page.tsx
<span>v0.4.0</span>
```

**4. Changelog:**
```bash
# Add new section to CHANGELOG.md
## [0.4.0] - 2026-02-15

### Added
- Batch testing system with JSON/JSONL support
- Tiered LLM evaluation (Haiku → Opus)
- Historical Gen AI logs viewer
```

### Git Tags

After merging a release to main:

```bash
# Create annotated tag
git tag -a v0.4.0 -m "Release v0.4.0: Batch Testing System"

# Push tag to remote
git push origin v0.4.0

# View all tags
git tag -l
```

---

## Pull Request Process

### Before Creating PR

1. **Ensure all tests pass:**
   ```bash
   cd client && npm test
   cd server && npm test
   ```

2. **Update documentation:**
   - Update FEATURES.md if adding new features
   - Update README.md if changing setup/usage
   - Add comments to complex code

3. **Run linting:**
   ```bash
   cd client && npm run lint
   cd server && npm run lint
   ```

4. **Commit with conventional commits:**
   ```bash
   # Format: <type>(<scope>): <subject>

   feat(batch-testing): add JSON parser and validator
   fix(auth): resolve OAuth redirect URI mismatch
   docs(features): add batch testing roadmap
   refactor(logs): extract pagination logic to hook
   test(evaluation): add unit tests for tiered model selection
   ```

### Creating PR

```bash
# Push your feature branch
git push origin feature/batch-testing-system

# Use GitHub CLI or web interface
gh pr create --title "feat: Batch Testing System" \
             --body "$(cat <<'EOF'
## Summary
Implements batch testing system with:
- JSON/JSONL/YAML file upload
- Batched LLM evaluation (10 conversations per prompt)
- Tiered model selection (Haiku → Opus)

## Changes
- Add `BatchTester.tsx` component
- Add `batchEvaluation.js` service
- Update API routes for batch processing
- Add batch testing documentation

## Testing
- Tested with 50-conversation test suite
- Verified Haiku → Opus escalation logic
- Confirmed cost savings: $0.75 → $0.10

## Checklist
- [x] Tests pass
- [x] Documentation updated
- [x] No breaking changes
- [x] Follows coding standards

## Related Issues
Implements features described in FEATURES.md section 1.

🤖 Generated with Claude Code
EOF
)"
```

### PR Review Checklist

**For Author:**
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No console.log or debug code
- [ ] Secrets not hardcoded
- [ ] Error handling implemented
- [ ] Performance considerations addressed

**For Reviewer:**
- [ ] Code follows project conventions
- [ ] Logic is clear and maintainable
- [ ] No security vulnerabilities
- [ ] Edge cases handled
- [ ] Tests are comprehensive
- [ ] Documentation is clear

### PR Approval & Merge

```bash
# After approval, merge via GitHub UI or:
gh pr merge --squash --delete-branch

# Or rebase merge (preserves commit history):
gh pr merge --rebase --delete-branch

# Or merge commit (creates merge commit):
gh pr merge --merge --delete-branch
```

**Recommended:** Use **squash merge** for feature branches to keep main history clean.

---

## Rollback Procedures

### Scenario 1: Rollback Recent Commit

If the last commit on `main` introduced a bug:

```bash
# Revert the commit (creates new commit that undoes changes)
git revert HEAD

# Push to main
git push origin main

# GitHub Actions will auto-deploy the reverted version
```

### Scenario 2: Rollback to Specific Version

If multiple commits need to be undone:

```bash
# Find the commit hash of the good version
git log --oneline

# Example output:
# abc123 (HEAD -> main) feat: add batch testing
# def456 fix: pagination bug
# ghi789 feat: historical logs  <- Want to go back here

# Revert to this commit
git revert --no-commit ghi789..HEAD
git commit -m "Revert to v0.3.3 due to critical bugs"

# Push to main
git push origin main
```

### Scenario 3: Rollback via Git Tag

If you tagged releases properly:

```bash
# List available tags
git tag -l

# Checkout the tag
git checkout v0.3.3

# Create a new branch from this tag
git checkout -b hotfix/rollback-to-v0.3.3

# Push to main (after testing)
git checkout main
git reset --hard v0.3.3
git push origin main --force  # USE WITH CAUTION
```

**⚠️ WARNING:** `git push --force` rewrites history. Only use if absolutely necessary and coordinate with team.

### Scenario 4: Rollback GCP Deployment

If the deployed version is broken but `main` is fine:

```bash
# SSH into GCP instance
gcloud compute ssh redguard-server --zone=us-central1-a

# Pull specific commit
cd /path/to/redguard
git fetch origin
git checkout <good-commit-hash>

# Restart services
docker-compose down
docker-compose up -d

# Verify
curl http://localhost:3001/api/version
```

---

## Collaboration with Antigravity

### Repository Access

1. **Add Antigravity as Collaborator:**
   ```bash
   # Via GitHub CLI
   gh repo add-collaborator anthropics/antigravity-team

   # Or via GitHub web interface:
   # Settings → Collaborators → Add people
   ```

2. **Set Permissions:**
   - Antigravity: Write access (can create branches, open PRs)
   - Protect `main` branch (require PR approval)

### Workflow for Collaboration

**When Antigravity works on a feature:**

1. Antigravity creates feature branch: `feature/antigravity-batch-testing`
2. Antigravity opens PR when ready
3. You review and approve
4. Antigravity or you merge to `main`
5. GitHub Actions auto-deploys to GCP

**Communication:**
- Use PR comments for feature discussions
- Reference FEATURES.md in PRs
- Tag each other with `@username` for questions
- Use GitHub Issues for bug tracking

### Branch Protection Rules

Configure on GitHub (Settings → Branches):

**Main Branch:**
- [x] Require pull request before merging
- [x] Require approvals (1)
- [x] Require status checks to pass
- [x] Require conversation resolution before merging
- [ ] Do not allow bypassing (except for hotfixes)

---

## Development Environment

### Local Setup

**Prerequisites:**
- Node.js 22.x
- Docker & Docker Compose
- Python 3.14+ (for Garak)

**Client:**
```bash
cd client
npm install
npm run dev  # Runs on http://localhost:3000
```

**Server:**
```bash
cd server
npm install
npm run dev  # Runs on http://localhost:3001
```

**Environment Variables:**
```bash
# server/.env
KORE_WEBHOOK_URL=...
KORE_CLIENT_ID=...
KORE_CLIENT_SECRET=...
KORE_BOT_ID=...

ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GEMINI_API_KEY=...

# client/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Testing

**Client Tests:**
```bash
cd client
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm test -- --coverage  # With coverage
```

**Server Tests:**
```bash
cd server
npm test
```

**End-to-End Tests:**
```bash
# Run both client and server, then:
npm run test:e2e
```

### Code Style

**Linting:**
```bash
cd client && npm run lint
cd server && npm run lint
```

**Auto-fix:**
```bash
npm run lint -- --fix
```

**Formatting (Prettier):**
```bash
npm run format
```

---

## Deployment

### GitHub Actions CI/CD

Pipeline automatically triggers on:
- Push to `main` branch
- Manual workflow dispatch

**Pipeline Steps:**
1. Build client (Next.js)
2. Build server (Express)
3. Run tests
4. SSH into GCP instance
5. Pull latest code
6. Restart Docker containers
7. Verify deployment

**View Pipeline:**
```bash
gh workflow view
gh run list
gh run view <run-id>
```

**Manually Trigger:**
```bash
gh workflow run deploy.yml
```

### Manual Deployment

If GitHub Actions fails:

```bash
# SSH into GCP
gcloud compute ssh redguard-server --zone=us-central1-a

# Pull latest
cd /path/to/redguard
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d

# Verify
curl http://localhost:3001/api/version
```

---

## Troubleshooting

### Common Issues

**Port conflicts:**
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

**Docker issues:**
```bash
# Clean up Docker
docker-compose down -v
docker system prune -a

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up -d
```

**Database issues:**
```bash
# Reset database
cd server
rm dev.db
npx prisma migrate reset
npx prisma generate
```

---

## Best Practices

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code change that neither fixes bug nor adds feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, tooling

**Examples:**
```
feat(batch-testing): add JSON parser and validator

Implements JSON/JSONL parser for batch test scripts.
Includes schema validation and error handling.

Closes #123

---

fix(auth): resolve OAuth redirect URI mismatch

The redirect URI was hardcoded to localhost, causing
production authentication to fail. Now uses env variable.

Fixes #456

---

docs(features): add batch testing roadmap

Adds comprehensive documentation for batch testing system
including file formats, batched evaluation, and tiered models.

---

refactor(logs): extract pagination to custom hook

Moves pagination logic from LogViewer to usePagination hook
for reusability across components.
```

### Code Comments

**When to Comment:**
- Complex algorithms
- Non-obvious business logic
- Workarounds for bugs
- Security-sensitive code
- Performance optimizations

**When NOT to Comment:**
- Self-explanatory code
- Function names describe behavior
- Standard patterns

**Good Comments:**
```typescript
// Batch conversations in groups of 10 to stay under LLM context window limits
const batchSize = 10;

// Using Haiku first for 90% cost savings, escalate to Opus if confidence < 0.9
const model = confidence > 0.9 ? 'haiku' : 'opus';

// WORKAROUND: Kore.ai API sometimes returns duplicate session IDs,
// dedupe to prevent double-counting in analytics
const uniqueSessions = [...new Set(sessions)];
```

**Bad Comments:**
```typescript
// Set i to 0
let i = 0;

// Loop through array
for (const item of items) {
  // Do something
  process(item);
}
```

---

## Security Guidelines

1. **Never commit secrets:**
   - Use `.env` files (already in `.gitignore`)
   - Use environment variables in GitHub Actions
   - Rotate secrets if accidentally committed

2. **Input validation:**
   - Validate all user inputs
   - Sanitize SQL/API queries
   - Escape HTML output

3. **Authentication:**
   - Always check authentication before API calls
   - Use HTTPS in production
   - Implement rate limiting

4. **Dependencies:**
   - Keep dependencies updated
   - Run `npm audit` regularly
   - Review security advisories

---

## Resources

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Branching Model](https://nvie.com/posts/a-successful-git-branching-model/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Code Review Best Practices](https://google.github.io/eng-practices/review/)

---

## Contact

For questions about development workflow:
- Scott Guida: scott.guida@kore.com
- Antigravity Team: [contact info]

For technical issues:
- GitHub Issues: https://github.com/[org]/RedGuard/issues
- Slack: #redguard-dev (if applicable)
