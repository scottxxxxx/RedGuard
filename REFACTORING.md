# RedGuard — Refactoring Tracker

**Created:** February 21, 2026
**Last Updated:** February 21, 2026 (v2)

> This file tracks known technical debt and planned refactoring work. Items are prioritized by effort-to-impact ratio. When completing an item, move it to the Completed section with the date and version.

---

## Status Key

| Status | Meaning |
|--------|---------|
| **Queued** | Identified, not yet started |
| **In Progress** | Actively being worked on |
| **Completed** | Done — moved to Completed section with date |

---

## Priority 1 — Low Effort, High Impact

### RF-001: Centralize API URL to `utils/api.ts`
- **Status:** Completed
- **Effort:** Low (~30 min)
- **Risk:** None
- **Problem:** `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'` is copy-pasted in 12 component files instead of importing from the existing `client/utils/api.ts` (`getApiUrl()`).
- **Affected Files:**
  - `client/app/page.tsx`
  - `client/components/EvaluationSettings.tsx`
  - `client/components/LLMInspectorNew.tsx`
  - `client/components/ChatConsole.tsx`
  - `client/components/LogViewer.tsx`
  - `client/components/GuardrailSettings.tsx`
  - `client/components/RunHistory.tsx`
  - `client/components/BotSettings.tsx`
  - `client/components/LLMInspector.tsx`
  - `client/components/BatchTester.tsx`
  - `client/components/GarakTester.tsx`
  - `client/components/BotConfigAnalyzer.tsx`
- **Fix:** Replace each inline `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'` with `import { getApiUrl } from '@/utils/api'` and call `getApiUrl()`. The utility already exists.

### RF-002: Merge `context/` and `contexts/` directories
- **Status:** Completed
- **Effort:** Low (~15 min)
- **Risk:** None
- **Problem:** Two directories serve the same purpose:
  - `client/context/NotificationContext.tsx`
  - `client/contexts/UserContext.tsx`
- **Fix:** Move `NotificationContext.tsx` into `client/contexts/` (plural, where `UserContext` lives). Update all imports. Delete the empty `context/` directory.

---

## Priority 2 — Medium Effort, High Impact

### RF-003: Extract LLM provider calls from `llm-judge.js` into factory pattern
- **Status:** Completed
- **Effort:** Medium (~2-3 hours)
- **Risk:** Medium — core evaluation path, test thoroughly
- **Problem:** `server/src/services/llm-judge.js` is 822 lines. Six `_call*()` methods (`_callOpenAI`, `_callAnthropic`, `_callGemini`, `_callDeepSeek`, `_callQwen`, `_callKimi`) share nearly identical logic: construct request → `axios.post` → parse JSON → extract tokens. Only the endpoint URL, headers, and response shape differ. Three `_constructPayload*()` methods are similarly duplicated.
- **Fix:** Create a provider registry pattern:
  ```
  server/src/services/
  ├── llm-judge.js              # Orchestrator only (~200 lines)
  └── llm-providers/
      ├── index.js              # Provider registry + factory
      ├── base-provider.js      # Shared call/parse/token logic
      ├── openai-provider.js    # OpenAI-specific config
      ├── anthropic-provider.js # Anthropic-specific config
      ├── gemini-provider.js    # Gemini-specific config
      ├── deepseek-provider.js  # DeepSeek-specific config
      ├── qwen-provider.js      # Qwen-specific config
      └── kimi-provider.js      # Kimi-specific config
  ```
  Each provider file exports an object with `{ endpoint, headers, constructPayload, parseResponse, extractTokens }`. The base handles the shared `axios.post` → JSON parse → error handling flow. Adding a new provider becomes a single new file + registry entry.

### RF-004: Move business logic out of `kore.js` route into services
- **Status:** Completed
- **Effort:** Medium (~2 hours)
- **Risk:** Low — routes become thinner, behavior unchanged
- **Problem:** `server/src/routes/kore.js` is 482 lines. Route handlers contain Prisma queries, multi-step validation chains, data transformation, and business logic that belongs in the service layer.
- **Fix:** Extract into focused services:
  ```
  server/src/services/
  ├── kore-api.js           # (existing) — add log fetching + Prisma save logic
  ├── kore-validation.js    # (new) — multi-step bot validation logic
  └── backup-service.js     # (existing) — already clean
  ```
  Route file becomes a thin HTTP adapter (~100 lines): parse request → call service → send response.

### RF-005: Consolidate JWT generation
- **Status:** Completed
- **Effort:** Low-Medium (~1 hour)
- **Risk:** Low
- **Problem:** Kore.ai JWT generation logic exists in three files:
  - `server/src/services/kore-api.js`
  - `server/src/services/kore-webhook.js`
  - `server/src/services/backup-service.js`
- **Fix:** Extract a shared `generateKoreJwt(clientId, clientSecret, accountId)` utility. All three services import and call the shared function.

---

## Priority 3 — High Effort, High Impact

### RF-006: Split `page.tsx` into composable sections
- **Status:** Queued
- **Effort:** High (~4-6 hours)
- **Risk:** High — main application page, touches everything
- **Problem:** `client/app/page.tsx` is 1,095 lines with 40+ `useState` hooks, 8+ `useEffect` hooks, and manages routing, bot config, chat, evaluation, and guardrail state all in one component.
- **Fix:** Extract a custom hook and section components:
  ```
  client/
  ├── app/page.tsx                    # Layout shell + section composition (~150 lines)
  ├── hooks/useRedGuardSession.ts     # All shared state + effects (~300 lines)
  └── components/sections/
      ├── BotConfigSection.tsx        # Bot config left + Chat right
      ├── GuardrailSection.tsx        # Guards left + Logs right
      └── EvaluationSection.tsx       # Eval config left + Results right
  ```
  The custom hook manages all state and returns it as a typed object. Section components receive only the props they need.

### RF-007: Split `LogViewer.tsx` into sub-components
- **Status:** Queued
- **Effort:** Medium-High (~2-3 hours)
- **Risk:** Medium
- **Problem:** `client/components/LogViewer.tsx` is 872 lines handling stats computation, date filtering, pagination, table rendering, and CSV export all inline.
- **Fix:** Extract:
  - `LogStats.tsx` — metrics dashboard cards
  - `LogFilters.tsx` — date pickers, type/severity filters, clear button
  - `LogTable.tsx` — table rendering + pagination
  - `useLogData.ts` — data fetching + filtering hook
  - Keep `LogViewer.tsx` as the composition root (~100 lines)

### RF-008: Split `RunHistory.tsx` into sub-components
- **Status:** Queued
- **Effort:** Medium-High (~2-3 hours)
- **Risk:** Medium
- **Problem:** `client/components/RunHistory.tsx` is 868 lines with a 118-line conversation parser, CSV export logic, column configuration, and modal rendering all in one file.
- **Fix:** Extract:
  - `RunHistoryTable.tsx` — table rendering + column config
  - `RunDetailModal.tsx` — individual run detail view
  - `useRunHistory.ts` — data fetching + parsing hook
  - `run-export.ts` — CSV export utility
  - Keep `RunHistory.tsx` as the composition root (~100 lines)

---

## Priority 4 — Nice to Have

### RF-009: Add request validation middleware
- **Status:** Queued
- **Effort:** Medium (~2 hours)
- **Risk:** Low
- **Problem:** Route handlers do manual field validation (`if (!field) return res.status(400)...`) with inconsistent error response shapes. Some return `{ error, details }`, others `{ status, error }`.
- **Fix:** Add `zod` or `joi` validation schemas per route. Create a `validate(schema)` middleware that returns consistent `{ error: string, details?: object }` on 400s.

### RF-010: Create API logging middleware
- **Status:** Queued
- **Effort:** Low-Medium (~1 hour)
- **Risk:** Low
- **Problem:** Every route handler has nearly identical `apiLogger.log()` calls for success and error cases.
- **Fix:** Create an Express middleware wrapper that automatically logs request/response metadata, reducing boilerplate in each route.

---

## Priority 5 — Multi-Platform Support

### RF-011: Bot platform abstraction layer
- **Status:** Completed
- **Effort:** Medium (~3 hours)
- **Risk:** Low — additive, does not change existing Kore.ai behavior
- **Problem:** All bot interaction code (messaging, validation, log fetching, guardrail extraction) is hardcoded to Kore.ai. Supporting additional platforms (Dialogflow CX, Amazon Lex, etc.) requires duplicating routes and services.
- **Fix:** Created `server/src/services/bot-platforms/` with the same registry pattern as `llm-providers/`:
  ```
  server/src/services/bot-platforms/
  ├── index.js                    # Platform registry + factory
  ├── base-platform.js            # Abstract interface (validate, connect, send, fetchLogs, export, analyzeConfig)
  ├── kore-platform.js            # Kore.ai — delegates to existing kore-webhook/kore-api/backup-service
  ├── dialogflow-cx-platform.js   # Google Dialogflow CX — skeleton with API docs + TODO markers
  └── generic-rest-platform.js    # Works with ANY chatbot that has a REST API
  ```
  Updated `chat.js`, `kore.js`, and `evaluate.js` routes to use platform abstraction. Default platform is Kore.ai when no `platform` field is specified (backward compatible).

### RF-012: Implement Dialogflow CX platform provider
- **Status:** Queued
- **Effort:** High (~6-8 hours)
- **Risk:** Medium — requires GCP project and service account for testing
- **Problem:** The Dialogflow CX platform skeleton exists but all methods throw "not yet implemented".
- **Dependencies:** `google-auth-library` npm package, GCP service account with Dialogflow API access
- **Fix:** Implement all methods in `dialogflow-cx-platform.js`:
  - `_getAccessToken()` — OAuth token from service account key
  - `validate()` — verify credentials + agent exists + detectIntent works
  - `connect()` / `sendMessage()` — synchronous `detectIntent` API
  - `fetchLogs()` — Conversations API (v3beta1) or Cloud Logging API
  - `startExport()` / `getExportStatus()` / `downloadAndAnalyze()` — agent export API
  - `analyzeConfig()` — parse RAI safety filters, banned phrases, prompt security from agent.json

### RF-013: Add platform selector to BotSettings UI
- **Status:** Queued
- **Effort:** Medium (~3-4 hours)
- **Risk:** Medium — changes the main configuration component
- **Problem:** `BotSettings.tsx` is hardcoded to render Kore.ai-specific fields (Webhook URL, Client ID/Secret, Bot ID, Inspector credentials). Other platforms need different fields (e.g., Dialogflow CX needs Project ID, Location, Agent ID, Service Account Key).
- **Fix:** Add a platform dropdown at the top of BotSettings. Render platform-specific fields conditionally. Store `platform` in the `BotConfig` type and pass it through to API calls.

### RF-014: Platform-agnostic database schema
- **Status:** Queued
- **Effort:** Medium (~2-3 hours)
- **Risk:** Medium — schema migration needed
- **Problem:** The `KoreLLMLog` table is Kore-specific (field names, data shape). Other platforms produce different log formats.
- **Fix:** Either rename to `PlatformLog` with a `platform` discriminator column, or keep platform-specific tables and abstract via the platform's `saveLogs()` method. The latter avoids a schema migration and is simpler.

### RF-016: Generic REST platform connector
- **Status:** Completed
- **Effort:** Low-Medium (~1.5 hours)
- **Risk:** None — additive, no changes to existing code
- **Problem:** Supporting each chatbot platform requires writing a dedicated provider with deep API knowledge. This is a barrier to community contributions and slows adoption.
- **Fix:** Created `generic-rest-platform.js` — a configurable connector that works with ANY chatbot that has a REST API. Users configure:
  - `chatEndpoint` — URL to send messages to
  - `authType` — `none`, `bearer`, `api-key`, or `basic` authentication
  - `requestTemplate` — JSON template with `{{message}}`, `{{userId}}`, `{{sessionId}}` placeholders
  - `responsePath` — dot-notation path to the bot's reply text in the response (supports arrays with `*` wildcard)
  - `sessionIdPath` — optional path to extract session IDs
  - `extraHeaders` — custom HTTP headers
  Immediately supports: Botpress, Voiceflow, Rasa, Cognigy, Yellow.ai, Microsoft Direct Line, custom Flask/FastAPI/Express bots, and any other service with a REST chat endpoint. No vendor-specific code needed.

### RF-015: Amazon Lex platform provider
- **Status:** Queued
- **Effort:** High (~6-8 hours)
- **Risk:** Medium — requires AWS credentials for testing
- **Problem:** Amazon Lex is the third-largest conversational AI platform. Adding support broadens RedGuard's appeal significantly.
- **Dependencies:** `@aws-sdk/client-lex-runtime-v2` npm package, AWS credentials with Lex access
- **Fix:** Create `server/src/services/bot-platforms/amazon-lex-platform.js` implementing BasePlatform interface.

---

## Completed

### RF-016: Generic REST platform connector
- **Completed:** February 21, 2026
- **Notes:** Created `server/src/services/bot-platforms/generic-rest-platform.js` — configurable REST connector with URL/auth/request template/response path mapping. Supports bearer, API key, basic, and no-auth modes. Request templates use `{{message}}`/`{{userId}}`/`{{sessionId}}` placeholders. Response path uses dot-notation with array index (`data[0].text`) and wildcard (`data.*.text`) support. Includes best-effort config analysis for guardrail keyword detection. Registered in platform index. All tests pass.

### RF-011: Bot platform abstraction layer
- **Completed:** February 21, 2026
- **Notes:** Created `server/src/services/bot-platforms/` with `base-platform.js` (abstract interface), `kore-platform.js` (wraps existing Kore services), `dialogflow-cx-platform.js` (skeleton with API docs and TODO markers), and `index.js` (registry). Updated `chat.js` to resolve platform from request body with Kore.ai as default. Updated `kore.js` to use `korePlatform` methods. Updated `evaluate.js` `analyze-config` endpoint to accept optional `platform` field. All backward compatible — no changes to existing API contracts.

### RF-001: Centralize API URL to `utils/api.ts`
- **Completed:** February 21, 2026
- **Notes:** Replaced 28 inline `process.env.NEXT_PUBLIC_API_URL || ...` occurrences across 12 component files with `import { getApiUrl } from '@/utils/api'`. TypeScript compiles clean.

### RF-002: Merge `context/` and `contexts/` directories
- **Completed:** February 21, 2026
- **Notes:** Moved `NotificationContext.tsx` from `client/context/` to `client/contexts/`. Updated 5 import paths. Deleted empty `client/context/` directory.

### RF-003: Extract LLM provider calls from `llm-judge.js` into factory pattern
- **Completed:** February 21, 2026
- **Notes:** Created `server/src/services/llm-providers/` with registry pattern: `base-provider.js`, `openai-provider.js`, `anthropic-provider.js`, `gemini-provider.js`, `openai-compatible-provider.js` (shared base for DeepSeek/Kimi/Qwen), `deepseek-provider.js`, `kimi-provider.js`, `qwen-provider.js`, `index.js` (registry). `llm-judge.js` reduced from 822 to ~400 lines. Adding a new provider is now one file + one registry entry.

### RF-004: Move business logic out of `kore.js` route into services
- **Completed:** February 21, 2026
- **Notes:** Extracted Prisma log-saving to `koreApiService.saveLLMLogs()`, zip download/extract/analyze to `BackupService.downloadAndAnalyze()`, host derivation to `BackupService.deriveHosts()`. Route removed `axios`, `AdmZip`, and `botConfigAnalyzer` direct imports. `kore.js` reduced from 482 to ~280 lines.

### RF-005: Consolidate JWT generation
- **Completed:** February 21, 2026
- **Notes:** Created `server/src/services/kore-jwt.js` with `generateKoreJwt()` and `createKoreJwtFactory()`. Updated `kore-api.js`, `kore-webhook.js`, and `backup-service.js` to use shared utility. Removed direct `jsonwebtoken` imports from all three files.

<!-- Template for completed items:
### RF-XXX: Title
- **Completed:** Month Day, Year (vX.Y.Z)
- **Notes:** Brief summary of what was done
-->

---

## Guidelines for Refactoring Work

1. **One RF item per PR** — keep changes isolated and reviewable
2. **No behavior changes** — refactoring must not alter functionality; verify with manual testing
3. **Update this file** — move completed items to the Completed section with date and version
4. **Update CLAUDE.md / AGENT.md** — if file paths change, update the repository structure sections
5. **Run the app** — after each refactor, start client and server and verify core workflows still work
