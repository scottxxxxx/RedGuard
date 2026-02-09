export type LLMConfig = {
    provider: 'openai' | 'anthropic' | 'gemini';
    model: string;
    apiKey: string;
    customPrompt?: string;
};

// ... existing BotConfig ...

// ... existing GuardrailConfig (will remove LLMConfig from here) ...
