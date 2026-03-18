const OpenAICompatibleProvider = require('./openai-compatible-provider');

module.exports = new OpenAICompatibleProvider(
    'qwen',
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    'dashscope-intl.aliyuncs.com'
);
