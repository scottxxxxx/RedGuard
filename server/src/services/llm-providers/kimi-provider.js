const OpenAICompatibleProvider = require('./openai-compatible-provider');

module.exports = new OpenAICompatibleProvider(
    'kimi',
    'https://api.moonshot.ai/v1/chat/completions',
    'api.moonshot.ai'
);
