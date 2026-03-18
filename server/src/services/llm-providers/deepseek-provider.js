const OpenAICompatibleProvider = require('./openai-compatible-provider');

module.exports = new OpenAICompatibleProvider(
    'deepseek',
    'https://api.deepseek.com/v1/chat/completions',
    'api.deepseek.com'
);
