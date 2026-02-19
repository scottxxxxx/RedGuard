---
description: Workflow to stage, commit, and push changes to git
---

1. Check the status of current changes.
// turbo
2. Stage all changes.
```bash
git add .
```

3. Commit the changes with a default message (or ask user for one).
```bash
git commit -m "Auto-update via agent"
```

4. Push the changes to origin.
```bash
git push
```
