/**
 * LLM Provider Registry
 *
 * Central registry for all LLM providers. To add a new provider:
 * 1. Create a new file (e.g., `my-provider.js`) extending BaseProvider or OpenAICompatibleProvider
 * 2. Register it here with providers.register()
 * 3. That's it — llm-judge.js will pick it up automatically.
 */

const openaiProvider = require('./openai-provider');
const anthropicProvider = require('./anthropic-provider');
const geminiProvider = require('./gemini-provider');
const deepseekProvider = require('./deepseek-provider');
const qwenProvider = require('./qwen-provider');
const kimiProvider = require('./kimi-provider');

const registry = new Map();

function register(provider) {
    registry.set(provider.name, provider);
}

function get(name) {
    return registry.get(name) || null;
}

function has(name) {
    return registry.has(name);
}

function list() {
    return Array.from(registry.keys());
}

// Register built-in providers
register(openaiProvider);
register(anthropicProvider);
register(geminiProvider);
register(deepseekProvider);
register(qwenProvider);
register(kimiProvider);

module.exports = { register, get, has, list };
