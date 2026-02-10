# Changelog

All notable changes to RedGuard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-02-10

### Added
- **Two-way Bot ID workflow**: Users can now either paste a complete webhook URL (Bot ID extracted automatically) or enter Bot ID separately (appended to base webhook URL)
- **Evaluation Metrics section** with model name display in evaluation history
- **Response time and model tracking** for all evaluations
- **Overall Assessment** display in evaluation details with rating alignment to pass/fail status
- **Proper HTTP status codes** for validation errors (401, 404, 503, 500)
- **Two-step validation**: Validates credentials first (independent of webhook), then validates webhook connectivity
- **Clear console on connect**: Session ID and messages clear immediately when Connect is clicked
- **Bot ID auto-inference**: Bot ID field automatically becomes read-only when extracted from webhook URL
- **Webhook URL validation**: Prevents connection attempts with incomplete webhook URLs
- **Input Tokens color coding**: Matches green color used in LLM prompt display

### Changed
- **Default webhook URL**: Now starts with base URL `https://platform.kore.ai/chatbot/v2/webhook/` for easier Bot ID entry
- **Evaluation prompt**: Updated to ensure overall_assessment rating aligns with actual pass/fail results
- **Error messages**: More specific troubleshooting guidance for different failure scenarios
- **Connection flow**: Simplified to clear only console display (not full session) on connect attempts

### Fixed
- **Bot ID validation**: Now properly validates Bot ID matches webhook URL before connection
- **Stale data in console**: Fixed issue where old messages and session IDs showed after validation failures
- **Regex guardrail status**: Fixed displaying "Pass" when regex guardrail was not enabled
- **Error suppression**: Removed silent error catching that prevented proper error messages
- **HTTP status code accuracy**: Bad webhook URLs now return 500/503 instead of incorrectly showing 401
- **Overall Assessment extraction**: Fixed parsing to handle new Anthropic API response format

### Technical
- Improved error handling with specific status code checks (401, 404, 503, 500)
- Enhanced validation logic with Bot ID mismatch detection
- Better state management for console clearing vs full session reset
- Updated server-side validation to test actual webhook connectivity

## [0.1.7] - 2025-01-XX

Previous version (features from before this changelog was created)

---

## Version Numbering

RedGuard follows semantic versioning:
- **0.x.y** - Pre-release versions (current phase)
- **x.0.0** - Major breaking changes
- **0.x.0** - Minor features and improvements
- **0.0.x** - Patches and bug fixes

Target: **1.0.0** when production-ready with stable API
