# RedGuard - AI Assistant Guide
**Version:** 0.2.0
**Last Updated:** February 10, 2025

## Project Overview

**RedGuard** is an AI safety verification platform for Kore.ai XO Platform chatbots. It allows users to:
1. Connect to their Kore.ai bot via webhook
2. Define guardrail policies (toxicity, topics, prompt injection, regex filters)
3. Chat with the bot in real-time
4. Have an AI judge (LLM) evaluate every response against configured guardrails

## Tech Stack

- **Frontend:** Next.js 16.1.6 (React 19.2.3, TypeScript 5)
- **Backend:** Express 5.2.1 (Node.js)
- **Database:** SQLite with Prisma ORM 6.19.2
- **AI Integration:** Anthropic Claude, OpenAI GPT, Google Gemini
- **Styling:** Tailwind CSS 4

## Key Components

### Bot Configuration (`client/components/BotSettings.tsx`)
**Purpose:** Configure and connect to Kore.ai bot

**Two-way Bot ID Workflow (v0.2.0):**
1. **Paste complete webhook URL** → Bot ID extracted automatically (field becomes read-only)
2. **Enter Bot ID separately** → Appended to base webhook URL automatically

**Validation Flow:**
- Step 1: Validate credentials (Client ID, Client Secret, Bot ID) - independent of webhook
- Step 2: Test webhook connectivity by sending ON_CONNECT event
- Returns proper HTTP status: 401 (auth), 404 (not found), 503 (unreachable), 500 (server error)

### Chat Console (`client/components/ChatConsole.tsx`)
Real-time chat interface with bot. Shows conversation history, session ID, and allows sending test messages or generating adversarial attacks.

### Evaluation Inspector (`client/components/EvaluationInspector.tsx`)
Configure LLM judge (model, provider, hyperparameters) and view evaluation prompt/payload before running evaluation.

### Guardrail Configuration (`client/components/GuardrailSettings.tsx`)
Select which safety policies to test:
- Toxicity (input/output filtering)
- Restricted Topics (input/output filtering)
- Prompt Injection Detection (input only)
- Regex Filters (output only)

### Run History (`client/components/RunHistory.tsx`)
**NEW in v0.2.0:**
- Displays evaluation metrics (input/output/total tokens, response time)
- Shows model used for each evaluation
- Includes Overall Assessment with rating (effective/partially_effective/ineffective)
- Expandable details with full conversation, prompt, and LLM output

## Guardrail Evaluation Statuses

**Exactly 4 possible statuses:**
1. **Pass** - Guardrail enabled, confirmed in logs, no violation
2. **Fail** - Guardrail enabled, confirmed in logs, violation found
3. **Not Tested** - Guardrail disabled in configuration, intentionally skipped
4. **Not Detected** - Guardrail enabled in config but missing from runtime logs (configuration mismatch)

## API Endpoints

### Bot Connection
- `POST /api/chat/connect` - Initial bot connection (sends ON_CONNECT event)
- `POST /api/chat/send` - Send message to bot
- `POST /api/kore/validate` - Validate credentials and webhook URL

### Evaluation
- `POST /api/evaluate` - Run LLM evaluation on bot response
- `GET /api/runs` - Get evaluation history
- `POST /api/runs` - Save evaluation result
- `DELETE /api/runs/:id` - Delete evaluation

### Logs
- `GET /api/logs` - Get API request logs (with filters)
- `GET /api/logs/stats` - Get log statistics
- `GET /api/logs/export` - Export logs as CSV
- `POST /api/kore/llm-logs` - Fetch GenAI logs from Kore.ai

## Environment Variables

```bash
# Kore.ai Configuration (optional defaults, can be overridden in UI)
KORE_WEBHOOK_URL=https://platform.kore.ai/chatbot/v2/webhook/{botId}
KORE_CLIENT_ID=cs-...
KORE_CLIENT_SECRET=...
KORE_BOT_ID=st-...

# LLM Judge Configuration
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...

# Server
PORT=3001
DATABASE_URL=file:./dev.db
```

## Recent Changes (v0.2.0)

### Bot Configuration Improvements
- **Two-way Bot ID workflow**: Extract from URL or append to URL
- **Smart field behavior**: Bot ID becomes read-only when inferred from webhook
- **Better validation**: Checks credentials first, then webhook (two-step process)
- **Proper error codes**: 401 (auth), 404 (not found), 503 (unreachable), 500 (error)

### Evaluation Enhancements
- **Evaluation Metrics section**: Shows model name, tokens, response time
- **Overall Assessment**: Now properly aligns with pass/fail outcome
- **Input Tokens**: Color matches LLM prompt (green) for visual consistency
- **Response time tracking**: Stored in database and displayed in history

### Bug Fixes
- Fixed stale data in console after validation failures
- Fixed regex guardrail incorrectly showing "Pass" when disabled
- Fixed error suppression that prevented proper error messages
- Fixed Overall Assessment parsing for Anthropic API response format

## Database Schema

### EvaluationRun
Stores each evaluation with:
- `userInput`, `botResponse` - Conversation
- `promptSent`, `llmOutput` - LLM judge details
- `toxicityPass`, `topicsPass`, `injectionPass`, `regexPass`, `overallPass` - Results
- `sessionId` - Kore.ai bot session ID
- `model` - LLM model used (e.g., "claude-sonnet-4-5-20250929")
- `latencyMs` - Response time in milliseconds
- `inputTokens`, `outputTokens`, `totalTokens` - Token usage

### ApiLog
Tracks all API calls with:
- `logType` - kore_chat, llm_evaluate, garak
- `provider`, `model` - Service and model used
- `totalTokens` - Token usage
- `latencyMs` - Response time
- `isError`, `errorMessage` - Error tracking

## Design System

**Color Palette:**
- Primary: Indigo (#4f46e5)
- Status colors: Green (pass), Red (fail), Gray (not tested), Amber (not detected)
- Theme support: Light and dark mode with CSS variables

**Typography:**
- Font: Inter (UI), JetBrains Mono (code/technical IDs)
- Section headings: 14px uppercase, semibold, letter-spacing

**Key Principles:**
1. Information-dense but never cluttered
2. Calm authority (security tool aesthetic)
3. Progressive disclosure (show what's needed per step)
4. Consistent rhythm with 4px spacing scale

## Deployment

### Development
```bash
# Client (port 3000)
cd client && npm run dev

# Server (port 3001)
cd server && npm run dev
```

### Production Considerations
- Set `NEXT_PUBLIC_API_URL` for client API calls
- Run database migrations: `npx prisma migrate deploy`
- Consider running client on port 80 (requires root or reverse proxy)
- Enable CORS for production domains

## Common Issues

### "Bot ID mismatch"
- **Cause:** Bot ID field doesn't match ID in webhook URL
- **Fix:** Let system auto-extract from webhook URL (don't edit Bot ID manually)

### "503 Service Unavailable"
- **Cause:** Webhook URL is unreachable or hostname invalid
- **Fix:** Verify webhook URL format and network connectivity

### "Connection timeout"
- **Cause:** Bot not responding within 15 seconds
- **Fix:** Check bot is published, webhook enabled, and credentials valid

### "Webhook validation failed (credentials are valid)"
- **Cause:** Credentials work but webhook URL has issues
- **Fix:** Verify webhook URL format matches: `https://platform.kore.ai/chatbot/v2/webhook/{botId}`

## For AI Assistants

When helping users with RedGuard:
1. **Check version** - Different features available in different versions
2. **Understand the two-way Bot ID workflow** - Users can either paste full URL or enter Bot ID
3. **Know the 4 guardrail statuses** - Pass, Fail, Not Tested, Not Detected
4. **Recognize error codes** - 401 (auth), 404 (not found), 503 (unreachable), 500 (error)
5. **Reference CLAUDE.md** for design system and component guidelines
6. **Check CHANGELOG.md** for version-specific features

## Roadmap

Potential future enhancements:
- Batch testing from CSV
- Advanced attack generation (jailbreak, injection)
- Custom prompt templates library
- Multi-bot comparison
- Automated regression testing
- Integration with CI/CD pipelines

---

**Need Help?**
- Check `/help` in the app
- Review [CLAUDE.md](/.claude/CLAUDE.md) for design guidelines
- See [CHANGELOG.md](/CHANGELOG.md) for version history
- Report issues: https://github.com/anthropics/claude-code/issues (placeholder)
