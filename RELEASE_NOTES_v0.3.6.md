# RedGuard v0.3.6 Release Notes

**Release Date:** February 13, 2026

## Summary

v0.3.6 is a major evaluation engine upgrade. Every LLM model family now gets its own optimized evaluation template with automatic fallback. GPT-5.x models use OpenAI's strict JSON Schema structured output for deterministic results. The evaluation experience has been redesigned — structured results replace raw JSON throughout the UI, and the Evaluation History now shows the same rich detail as the live evaluation panel.

---

## New Features

### Model-Specific Default Evaluation Prompts
- Each model family can have its own default evaluation prompt template with automatic fallback to the universal (Opus) template.
- Templates carry three pieces: `prompt_text` (user message with placeholders), `system_prompt` (optional system instruction), and `response_format` (optional structured output schema).
- The `system_prompt` and `response_format` always come from the model's template, even when the user has a custom `prompt_text` — ensuring the output format matches what the parser expects.

### GPT-5.x Structured Output Template
- Dedicated template for OpenAI GPT-5.x models (`default_evaluation_gpt5.json`) using strict JSON Schema enforcement via `text.format` (Responses API).
- Full evaluation framework in `system_prompt` (status determination rules, scoping rules, log interpretation, evaluation tasks, rating guidelines).
- Concise `prompt_text` with 3 dynamic data sections: Conversation Transcript, Guardrail Configuration, Runtime Logs.
- All JSON Schema `$ref`/`$defs` inlined for maximum compatibility with OpenAI strict mode.

### GPT-5.x Flash Template
- New concise template (`default_evaluation_gpt5_flash.json`) optimized for speed and token efficiency.
- Uses a compact A/B/C status ladder in the system prompt (~1,500 chars vs ~10,000 chars for the full GPT-5.x template).
- Same structured output schema and `prompt_text` pattern as the full GPT-5.x template.

### Opus Template System/User Split
- The universal Opus template (`default_evaluation.json`) now uses the same `system_prompt` / `prompt_text` split as the GPT-5.x templates.
- All static evaluation framework (15,380 chars) is in `system_prompt` — cached by Anthropic across evaluations.
- `prompt_text` contains only the 3 dynamic data placeholders, matching the GPT-5.x pattern.

### Template Selector with Multiple Opus Variants
- Template dropdown now includes additional named templates: GPT 5.x Flash, Opus v2, Opus OG.
- `EXTRA_TEMPLATES` array in `prompt-service.js` for manually selectable templates that don't auto-match any model.
- `GET /api/prompts/defaults` returns all available templates (universal + model-specific + extras).

### Auto-Load on Model Switch
- Switching the evaluation model automatically loads the appropriate model-specific default prompt.
- If the user has a custom template selected, switching models does NOT overwrite their custom prompt.
- Switching back to a previous provider/model re-loads that model's default.

### Template System Prompt & Response Format in All Provider Payloads
- **OpenAI (Responses API):** `text.format` with flattened JSON Schema structure; `system_prompt` as system input message.
- **OpenAI (Chat Completions):** `response_format` with nested `json_schema` structure.
- **Anthropic:** `system_prompt` sent as `system` field (prompt-cached).
- **Gemini:** `system_prompt` sent as `systemInstruction`.
- **DeepSeek/Qwen/Kimi:** Threaded through the OpenAI-compatible payload constructor.

---

## UI Improvements

### Structured Evaluation Results View
- **Evaluation Results tab** now shows a rich structured display instead of raw JSON:
  - Overall Assessment banner with status icon and rating badge
  - Guardrail Results in a 2x2 card grid (Toxicity, Topics, Injection, Regex) with status badges and reason text
  - Summary stats row (Tested / Passed / Failed / Not Tested / Not Detected)
  - Evaluation Metrics (Model, Input/Output/Total Tokens, Latency)
  - System Performance (Detection Accuracy, False Positives/Negatives, Coverage Gaps, Config Consistency)

### Evaluation History — Full Structured Data
- Expanding a row in Evaluation History now shows the **same structured evaluation data** as the live Evaluation Results tab.
- Includes: Overall Assessment, Guardrail Results grid, Summary Stats, Metrics, System Performance, Conversation, and collapsible Raw LLM Details.
- Consistent status icons across both views (previously History used a static checkmark for all statuses).

### Simplified Evaluation Inspector
- Removed the redundant "Evaluation Prompt" tab — the prompt is already editable in the left-side Test & Evaluate section.
- All remaining tabs (Raw Request, Evaluation Results, Raw Response) are now read-only.
- Removed bidirectional sync logic between the prompt editor and inspector panel, reducing component complexity by ~50%.

### Evaluation History Table Enhancements
- **Turns badge** always visible (including "1 turn" for single-turn conversations).
- **New columns:** Model and Prompt template name (auto-derived from model: gpt-5* -> "GPT 5.x", claude* -> "Opus", etc.).
- **Column configuration:** Visibility toggles, drag-to-reorder arrows, column border resize, persisted in localStorage.

### Model-Aware Hyperparameters
- New `model-hyperparams.ts` configuration system with per-model parameter definitions.
- Parameters auto-reset to model defaults when switching providers (e.g., `reasoning_effort` for o3/o4, `top_k` for Claude).
- Conditional parameter disabling (e.g., temperature locked when `reasoning_effort != 'none'`).

---

## Bug Fixes

### OpenAI Responses API Payload Structure
- Fixed `text.format` structure — Responses API requires `{ type, name, schema }` as siblings, not the nested `{ type, json_schema: { name, schema } }` format used by Chat Completions.
- Added automatic transformation in `_constructPayloadOpenAI()` to convert from Chat Completions format when needed.

### GPT-5.x Conversation Parsing
- Fixed conversation parsing for GPT-5.x evaluations where all turns appeared as a single message bubble.
- Added support for `## ` heading delimiters (GPT-5.x template) in addition to `---` separators (Opus template).
- Added `=== USER PROMPT ===` header extraction from the stored `promptSent` field.
- Added `input` array support for OpenAI Responses API format.

### Tab Auto-Switching Bug
- Fixed a bug where editing the evaluation prompt caused the tab to switch to Evaluation Results.
- Root cause: a `useEffect` combining `result` and `previewPayload` dependencies. Prompt edits triggered preview refresh, which fired the effect with a stale result, switching the tab.
- Fixed by splitting into two effects with a `prevResultRef` to only auto-switch on genuinely new results.

---

## API Changes

### `GET /api/prompts/default`
- **New query parameters:** `?provider=<provider>&model=<model>`
- Returns model-specific default template when a match exists, otherwise falls back to universal default.
- **Backward compatible:** Calling without query params returns the same universal default as before.

### `GET /api/prompts/defaults`
- Returns all available templates: universal + model-specific + extra named templates.

---

## Architecture

### Shared EvaluationResultsView Component
- `EvaluationResultsView`, `StatusBadge`, `RatingBadge`, and `parseEvaluationOutput` extracted into `client/components/EvaluationResultsView.tsx`.
- Used by both `EvaluationInspector` (narrow panel) and `RunHistory` (expanded row) — single source of truth.

### Template Resolution Flow
```
User selects provider + model
       |
prompt-service checks MODEL_TEMPLATE_MAP
       |
Match found? -> Load model-specific template (e.g., default_evaluation_gpt5.json)
No match?   -> Load universal template (default_evaluation.json)
       |
Returns: { name, description, prompt_text, system_prompt?, response_format? }
```

### Adding Future Model Templates
1. Create `server/src/prompts/default_evaluation_<model>.json` with `name`, `description`, `prompt_text`, and optionally `system_prompt` and `response_format`.
2. Add a matcher to `MODEL_TEMPLATE_MAP` in `prompt-service.js` for auto-matching, OR add the filename to `EXTRA_TEMPLATES` for manual selection only.

---

## Files Changed

| File | Change |
|------|--------|
| `client/components/EvaluationResultsView.tsx` | **NEW** — Shared structured results component |
| `client/lib/model-hyperparams.ts` | **NEW** — Per-model hyperparameter configuration |
| `server/src/prompts/default_evaluation_gpt5.json` | **NEW** — GPT-5.x structured output template |
| `server/src/prompts/default_evaluation_gpt5_flash.json` | **NEW** — GPT-5.x Flash concise template |
| `server/src/prompts/default_evaluation.json` | Split into system_prompt + slim prompt_text |
| `server/src/services/prompt-service.js` | Model-aware template resolution, EXTRA_TEMPLATES |
| `server/src/services/llm-judge.js` | `constructPrompt` returns object; `text.format` fix; all provider payload constructors updated |
| `server/src/services/guardrail-logic.js` | Pass provider/model to `constructPrompt` calls |
| `server/src/routes/prompts.js` | `?provider=&model=` query params; `/defaults` endpoint |
| `client/components/EvaluationInspector.tsx` | Simplified to 3 read-only tabs; imports shared component |
| `client/components/EvaluationSettings.tsx` | Auto-load model-specific default; template selector |
| `client/components/PromptEditorModal.tsx` | System prompt display support |
| `client/components/RunHistory.tsx` | Full structured data in expanded view; column config; turns badge |
| `client/app/page.tsx` | Cleaned up EvaluationInspector props |
| `client/types/config.ts` | Added system_prompt/response_format to types |
| `client/package.json` | Version 0.3.6 |
| `server/package.json` | Version 0.3.6 |

---

## Verification Checklist

- [ ] `GET /prompts/default` (no params) returns Opus template with `system_prompt`
- [ ] `GET /prompts/default?provider=openai&model=gpt-5.3-codex` returns GPT-5.x template
- [ ] `GET /prompts/defaults` returns all templates (Opus, GPT 5.x, GPT 5.x Flash, Opus v2, Opus OG)
- [ ] Select Anthropic Opus -> switch to OpenAI GPT-5.3 -> prompt updates to GPT-5.x -> switch back -> Opus prompt returns
- [ ] Load a saved custom template -> switch models -> textarea does NOT change
- [ ] GPT-5.x Raw Request shows `text.format` with flattened `{ type, name, schema }`
- [ ] Anthropic Raw Request shows `system` field with full evaluation framework
- [ ] Run evaluation with GPT-5.3 -> structured output parses -> Evaluation Results tab shows cards/badges
- [ ] Expand a run in Evaluation History -> shows full structured data (not just assessment + conversation)
- [ ] Icons are consistent between Evaluation Results tab and History expanded view
- [ ] Conversation parsing works for both Opus and GPT-5.x evaluations (multiple turns shown)
- [ ] Column config (visibility, reorder, resize) persists across page refresh
- [ ] Hyperparameters reset to model defaults when switching providers
