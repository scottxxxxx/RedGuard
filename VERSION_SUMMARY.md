# RedGuard v0.2.0 - Release Summary

**Release Date:** February 10, 2025
**Previous Version:** 0.1.7

## 🎯 Key Highlights

### 1. Smart Bot Configuration
**Two-way Bot ID workflow** - The biggest UX improvement in this release:
- Paste a complete webhook URL → Bot ID extracts automatically
- OR enter Bot ID → Automatically appends to base webhook URL
- Bot ID field becomes read-only when inferred (prevents mismatches)
- Default starts with: `https://platform.kore.ai/chatbot/v2/webhook/`

### 2. Better Validation & Error Handling
- **Two-step validation:** Credentials first, then webhook (tells you exactly what's wrong)
- **Proper HTTP status codes:** 401 (auth), 404 (not found), 503 (unreachable), 500 (error)
- **Clear error messages** with troubleshooting steps for each scenario
- **Prevents incomplete connections:** Can't connect without Bot ID

### 3. Enhanced Evaluation Display
- **Evaluation Metrics section** shows model name prominently
- **Response time tracking** for all evaluations
- **Input Tokens** color-coded green to match LLM prompt
- **Overall Assessment** rating now aligns with pass/fail outcome

### 4. Fixed Major Bugs
- ✅ Stale data no longer shows after validation failures
- ✅ Regex guardrail correctly shows "Not Tested" when disabled
- ✅ Errors no longer suppressed (proper toast notifications)
- ✅ Overall Assessment parsing handles Anthropic API format

## 📊 What Changed

| Component | Change | Impact |
|-----------|--------|--------|
| BotSettings | Two-way Bot ID workflow | Much easier bot configuration |
| Validation | Two-step process (creds → webhook) | Better error diagnosis |
| Error Codes | Proper HTTP status (401/404/503/500) | Clear error understanding |
| RunHistory | Evaluation Metrics section | Better visibility of model/performance |
| Evaluation | Overall assessment alignment | More accurate ratings |
| Console | Auto-clear on connect | No stale data confusion |

## 🔧 Technical Details

### Database Changes
- Added `latencyMs` field to EvaluationRun table
- Added `model` field to EvaluationRun table

### API Changes
- `/api/kore/validate` now returns proper status codes (not always 401)
- Validation performs actual webhook test (not just credential check)

### Component Updates
- `BotSettings.tsx` - Complete refactor of validation and Bot ID handling
- `RunHistory.tsx` - Added Evaluation Metrics section with model display
- `EvaluationInspector.tsx` - Updated Overall Assessment extraction
- `page.tsx` - Version badge updated to v0.2.0

## 📈 Metrics

**Lines Changed:** ~500+
**Files Modified:** 15+
**New Files:** 3 (CHANGELOG.md, AI_ASSISTANT_GUIDE.md, VERSION_SUMMARY.md)
**Bug Fixes:** 6 major issues resolved

## 🚀 Upgrade Path

No breaking changes - existing configurations will work as-is. New features activate automatically:
- Existing webhook URLs will auto-extract Bot ID
- Old evaluations display properly with new metrics section
- Error handling improvements apply to all new connections

## 📝 Documentation

- ✅ **CHANGELOG.md** - Full version history
- ✅ **AI_ASSISTANT_GUIDE.md** - Comprehensive guide for AI assistants (Gemini, ChatGPT, Claude)
- ✅ **CLAUDE.md** - Updated with v0.2.0 info
- ✅ **VERSION_SUMMARY.md** - This file

## 🎯 Next Steps

Potential features for v0.3.0:
- Batch testing from CSV files
- Advanced attack generation (jailbreak prompts)
- Custom prompt template library
- Multi-bot comparison view
- Automated regression testing
- CI/CD integration

## 🐛 Known Issues

None at this time. All critical bugs from 0.1.7 have been resolved.

## 🙏 Credits

Built with:
- Next.js 16.1.6
- React 19.2.3
- Anthropic Claude API
- OpenAI API
- Google Gemini API
- Kore.ai XO Platform

---

**Questions?** Check the AI_ASSISTANT_GUIDE.md for comprehensive documentation.
