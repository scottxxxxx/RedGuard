export type LLMConfig = {
    provider: 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'qwen' | 'kimi';
    model: string;
    apiKey: string;
    customPrompt?: string;
    systemPrompt?: string | null;
};

// ... existing BotConfig ...

// ... existing GuardrailConfig (will remove LLMConfig from here) ...
