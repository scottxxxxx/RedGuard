# Contributing to RedGuard

Thank you for contributing to RedGuard! This guide ensures consistency and quality across all contributions.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Documentation Standards](#documentation-standards)
- [Code Standards](#code-standards)
- [Pull Request Process](#pull-request-process)
- [Deployment Guidelines](#deployment-guidelines)
- [Communication](#communication)

---

## Getting Started

### Prerequisites

Before contributing:

1. ✅ Read [README.md](./README.md) completely
2. ✅ Set up local development using [LOCAL_DEV_GUIDE.md](./LOCAL_DEV_GUIDE.md)
3. ✅ Understand deployment process from [DEPLOYMENT.md](./DEPLOYMENT.md)
4. ✅ Review existing issues and PRs

### First-Time Setup

```bash
# Clone repository
git clone https://github.com/scottguida/redguard.git
cd redguard

# Follow LOCAL_DEV_GUIDE.md for complete setup
./setup_local_dev.sh

# Create a feature branch
git checkout -b feature/your-feature-name
```

---

## Development Workflow

### Branch Strategy

```
main                    ← Production (auto-deploys to GCP)
  └── feature/xxx       ← Your feature branch
  └── fix/xxx           ← Bug fixes
  └── docs/xxx          ← Documentation updates
```

**Branch naming conventions**:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `refactor/` - Code refactoring
- `test/` - Test additions

### Development Process

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes**
   - Follow [Code Standards](#code-standards)
   - Write tests if applicable
   - Update documentation

3. **Test locally**
   ```bash
   # Client
   cd client && npm run lint

   # Server
   cd server && npm test  # If tests exist
   ```

4. **Commit with meaningful messages**
   ```bash
   git add .
   git commit -m "feat: add user authentication"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

[optional body]

[optional footer]
```

**Types**:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

**Examples**:
```bash
feat: add batch testing with CSV upload
fix: resolve connection timeout in BotSettings
docs: update deployment guide with rollback procedures
refactor: extract guardrail validation logic
```

---

## Documentation Standards

### Why Documentation Matters

**Every code change needs documentation because**:
- Future you won't remember why
- External teams need context
- Onboarding new developers
- Debugging production issues
- Compliance and auditing

### Documentation Requirements

#### 1. Always Reference Existing Docs

**In Pull Requests**:
```markdown
## Changes
- Added user authentication feature
- See LOCAL_DEV_GUIDE.md#authentication for setup
- Deployment notes in DEPLOYMENT.md#environment-variables
```

**In Issues**:
```markdown
## Bug Report
Connection timeout occurs during deployment.

**Related Documentation**:
- DEPLOYMENT.md#troubleshooting
- See section "Deployment Fails: SSH Stage"
```

**In Code Comments**:
```typescript
// Implementation follows pattern in DEPLOYMENT.md#security-best-practices
// SSH key validation per CONTRIBUTING.md#security-guidelines
```

#### 2. Update Documentation for Code Changes

**When to update docs**:
- ✅ New feature → Update README.md features section
- ✅ New API endpoint → Update README.md API section
- ✅ Environment variable added → Update DEPLOYMENT.md and LOCAL_DEV_GUIDE.md
- ✅ Deployment change → Update DEPLOYMENT.md
- ✅ Development setup change → Update LOCAL_DEV_GUIDE.md
- ✅ Architecture change → Update README.md architecture diagram

**How to update**:
```bash
# 1. Make code changes
git add src/

# 2. Update relevant documentation
git add README.md DEPLOYMENT.md

# 3. Commit together
git commit -m "feat: add user auth

- Added authentication middleware
- Updated README.md with auth setup
- Updated DEPLOYMENT.md with auth env vars"
```

#### 3. Create New Documentation When Needed

**When to create new docs**:
- Complex feature with multiple setup steps
- Integration with external service
- Troubleshooting guide for common issues
- Architecture decision records (ADR)

**New doc checklist**:
- [ ] Create `.md` file with descriptive name
- [ ] Add to [README.md Documentation section](#-documentation)
- [ ] Link from related docs
- [ ] Include table of contents for long docs
- [ ] Add to this CONTRIBUTING.md if relevant

### Documentation File Structure

```markdown
# Document Title

Brief 1-2 sentence description.

## Table of Contents (for long docs)

## Quick Start

## Detailed Sections

## Troubleshooting

## Related Documentation
- [Related Doc 1](./path.md)
- [Related Doc 2](./path.md)
```

### Documentation Maintenance

- 📅 **Quarterly Review**: Review all docs for accuracy
- 🔄 **Update on Change**: Update docs immediately when code changes
- 🗑️ **Archive Old**: Move outdated docs to `docs/archive/`
- 📊 **Track TODOs**: Use `<!-- TODO: ... -->` for needed updates

---

## Code Standards

### TypeScript (Client)

```typescript
// ✅ Good
interface BotConfig {
  clientId: string;
  clientSecret: string;
}

// Use descriptive names
const handleBotConnection = async () => { ... }

// Add comments for complex logic
// Validates bot credentials according to Kore.AI API spec
const validateCredentials = () => { ... }
```

### JavaScript (Server)

```javascript
// ✅ Good
// Follow existing patterns in codebase
router.post('/api/chat', async (req, res) => {
  try {
    // Your logic here
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### React Components

```tsx
// ✅ Good - Descriptive component name
export default function GuardrailSettings({ onConfigChange }: Props) {
  // State at top
  const [config, setConfig] = useState<Config>();

  // Effects after state
  useEffect(() => { ... }, []);

  // Handlers before return
  const handleSave = () => { ... };

  // Render
  return (
    <div className="...">
      {/* Clear structure */}
    </div>
  );
}
```

### Styling

- Use Tailwind CSS utility classes
- Follow existing color scheme (CSS variables)
- Support dark mode
- Maintain responsive design

### Error Handling

```typescript
// ✅ Always handle errors
try {
  await apiCall();
} catch (error) {
  console.error('Operation failed:', error);
  showToast('User-friendly error message', 'error');
}
```

---

## Pull Request Process

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Documentation Updated
- [ ] README.md
- [ ] DEPLOYMENT.md
- [ ] LOCAL_DEV_GUIDE.md
- [ ] Code comments
- [ ] No docs needed (justify why)

## Testing
- [ ] Tested locally
- [ ] No breaking changes
- [ ] Database migrations documented

## Related Issues
Fixes #123
See also #456

## Related Documentation
- See DEPLOYMENT.md#new-section
- Updated LOCAL_DEV_GUIDE.md with new env vars
```

### PR Review Checklist

**For Authors**:
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Tests added (if applicable)
- [ ] No console.logs left in code
- [ ] Sensitive data removed
- [ ] PR description complete

**For Reviewers**:
- [ ] Code quality acceptable
- [ ] Documentation sufficient
- [ ] No security issues
- [ ] No breaking changes (or documented)
- [ ] Tests pass

### Approval Process

1. Create PR with complete description
2. Request review from maintainer
3. Address review comments
4. Maintainer approves and merges
5. **Automatic deployment to production** (via GitHub Actions)

---

## Deployment Guidelines

### Critical: Read Before Deploying

⚠️ **IMPORTANT**: Merging to `main` automatically deploys to production.

### Pre-Deployment Checklist

- [ ] Read [DEPLOYMENT.md](./DEPLOYMENT.md) completely
- [ ] Tested changes locally
- [ ] Updated version in `client/package.json`
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Team notified of deployment
- [ ] Rollback plan ready

### Deployment Process

```bash
# 1. Ensure main is up to date
git checkout main
git pull origin main

# 2. Merge your branch (or via GitHub PR)
git merge feature/your-feature

# 3. Push to main (triggers deployment)
git push origin main

# 4. Monitor deployment
# Go to: https://github.com/scottguida/redguard/actions
# Watch "Build and Deploy to GCP" workflow

# 5. Verify deployment
curl http://***REMOVED_IP***:3000  # Client
curl http://***REMOVED_IP***:3001/api  # Server
```

### Post-Deployment

- [ ] Verify production app at http://***REMOVED_IP***:3000
- [ ] Check version number matches
- [ ] Test critical functionality
- [ ] Monitor logs for errors
- [ ] Update team on deployment status

### Emergency Rollback

See [DEPLOYMENT.md#rollback-procedures](./DEPLOYMENT.md#rollback-procedures)

---

## Communication

### Reporting Issues

**Good Issue Format**:
```markdown
## Bug Report / Feature Request

### Description
Clear description of issue or feature

### Steps to Reproduce (for bugs)
1. Go to '...'
2. Click on '...'
3. See error

### Expected Behavior
What should happen

### Actual Behavior
What actually happens

### Environment
- Browser: Chrome 120
- Production / Local dev

### Related Documentation
- See DEPLOYMENT.md#issue-section
- May relate to README.md#feature-name

### Screenshots (if applicable)
```

### Asking Questions

**Before asking**:
1. ✅ Check documentation
2. ✅ Search existing issues
3. ✅ Try troubleshooting guides

**When asking**:
- Reference relevant documentation
- Provide context and environment details
- Include error messages and logs
- Show what you've already tried

---

## For External Teams (Google, Antigravity, Contractors)

### Onboarding Process

1. **Week 1: Reading & Setup**
   - [ ] Read all core documentation (README, DEPLOYMENT, LOCAL_DEV_GUIDE, CONTRIBUTING)
   - [ ] Set up local development environment
   - [ ] Run application locally
   - [ ] Review codebase structure

2. **Week 2: Small Contributions**
   - [ ] Fix documentation typos
   - [ ] Make small bug fixes
   - [ ] Get comfortable with PR process

3. **Week 3+: Feature Development**
   - [ ] Start assigned features
   - [ ] Follow all contribution guidelines
   - [ ] Maintain communication

### Working with RedGuard

**Communication Channels**:
- GitHub Issues: Bug reports, feature requests
- GitHub PRs: Code reviews, discussions
- GitHub Discussions: General questions (if enabled)

**Response Times**:
- Issues: Response within 2 business days
- PRs: Review within 3 business days
- Urgent production issues: Tag with `urgent` label

### Handoff Requirements

When handing off work:

1. **Code**
   - [ ] All code merged to main
   - [ ] No uncommitted changes
   - [ ] No TODOs in code (or documented in issues)

2. **Documentation**
   - [ ] All changes documented
   - [ ] New features in README
   - [ ] Deployment changes in DEPLOYMENT.md
   - [ ] Architecture changes documented

3. **Knowledge Transfer**
   - [ ] Handoff document created
   - [ ] Known issues documented
   - [ ] Future work documented
   - [ ] Contact info for questions

4. **Access**
   - [ ] Document all credentials locations
   - [ ] Update access control lists
   - [ ] Document deployment process

---

## Documentation Reference Examples

### Good Examples

**In PR Description**:
```markdown
## Changes
- Fixed deployment timeout issue
- See DEPLOYMENT.md#troubleshooting for details
- Updated connection retry logic per CONTRIBUTING.md#error-handling
```

**In Code**:
```typescript
// Authentication follows pattern described in DEPLOYMENT.md#security-best-practices
// See also: LOCAL_DEV_GUIDE.md#authentication-setup
const authenticateUser = async () => { ... }
```

**In Issue**:
```markdown
## Deployment Fails

Getting timeout error during deployment.

**Troubleshooting attempted**:
- ✅ Followed DEPLOYMENT.md#deployment-fails-ssh-stage
- ✅ Verified GCP_SSH_KEY secret
- ❌ Still failing at step 3

**Related docs**:
- DEPLOYMENT.md#troubleshooting
- CONTRIBUTING.md#deployment-guidelines
```

### Bad Examples

**❌ No documentation reference**:
```markdown
PR: "Fixed the thing"
Code: // TODO: fix this later
Issue: "It doesn't work"
```

**❌ Outdated documentation**:
```markdown
Code changed but docs not updated
Feature added but README not updated
New env var added but DEPLOYMENT.md not updated
```

---

## Questions?

- 📖 Check [README.md](./README.md) first
- 📋 Review [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment questions
- 🔧 See [LOCAL_DEV_GUIDE.md](./LOCAL_DEV_GUIDE.md) for dev setup
- 🐛 Create an issue with documentation references
- 💬 Tag maintainer in GitHub discussions

---

## Checklist for External Collaborators

Before starting work:
- [ ] Read README.md completely
- [ ] Read DEPLOYMENT.md if deploying
- [ ] Read LOCAL_DEV_GUIDE.md
- [ ] Read this CONTRIBUTING.md
- [ ] Local environment working
- [ ] Understand branching strategy
- [ ] Understand documentation requirements

For every PR:
- [ ] Documentation updated
- [ ] Documentation referenced in PR
- [ ] Tests added (if applicable)
- [ ] No breaking changes (or documented)
- [ ] Version updated if needed
- [ ] Team notified if deployment

---

## License

Internal use only. See main [README.md](./README.md) for details.
