export interface ParamDef {
    key: string;
    label: string;
    type: 'number' | 'select';
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    defaultValue: number | string | undefined;
    placeholder?: string;
    helpText: string;
    disabledWhen?: {
        param: string;
        condition: 'not_equals' | 'equals';
        value: any;
        clearLabel: string;
    };
}

export interface ModelConfig {
    params: ParamDef[];
    infoBanner?: string;
    infoBannerWhen?: (params: Record<string, any>) => boolean;
}

// --- Model family configs ---

const ANTHROPIC_CONFIG: ModelConfig = {
    params: [
        {
            key: 'temperature', label: 'Temperature', type: 'number',
            min: 0, max: 1, step: 0.1, defaultValue: 0,
            helpText: '0 = deterministic, max 1.0',
            disabledWhen: { param: 'top_p', condition: 'not_equals', value: 1.0, clearLabel: 'Clear Top P to edit' }
        },
        {
            key: 'max_tokens', label: 'Max Tokens', type: 'number',
            min: 100, max: 64000, step: 100, defaultValue: 4096,
            helpText: 'Max 64,000'
        },
        {
            key: 'top_p', label: 'Top P', type: 'number',
            min: 0, max: 1, step: 0.05, defaultValue: 1.0,
            helpText: 'Nucleus sampling',
            disabledWhen: { param: 'temperature', condition: 'not_equals', value: 0, clearLabel: 'Clear Temperature to edit' }
        },
        {
            key: 'top_k', label: 'Top K', type: 'number',
            min: 0, max: 500, step: 1, defaultValue: undefined,
            placeholder: 'Off', helpText: 'Limits token pool'
        }
    ],
    infoBanner: 'Anthropic models: Temperature and Top P are mutually exclusive. Clear one to use the other.',
    infoBannerWhen: (params) => params.temperature !== 0 || params.top_p !== 1.0
};

const ANTHROPIC_OPUS_CONFIG: ModelConfig = {
    ...ANTHROPIC_CONFIG,
    params: ANTHROPIC_CONFIG.params.map(p =>
        p.key === 'max_tokens' ? { ...p, max: 128000, helpText: 'Max 128,000' } : p
    )
};

const OPENAI_GPT5_CONFIG: ModelConfig = {
    params: [
        {
            key: 'reasoning_effort', label: 'Reasoning Effort', type: 'select',
            options: ['none', 'low', 'medium', 'high'], defaultValue: 'medium',
            helpText: 'Controls reasoning depth'
        },
        {
            key: 'max_tokens', label: 'Max Tokens', type: 'number',
            min: 100, max: 128000, step: 100, defaultValue: 2000,
            helpText: 'Max 128,000'
        },
        {
            key: 'seed', label: 'Seed', type: 'number',
            min: 0, max: 2147483647, step: 1, defaultValue: undefined,
            placeholder: 'Random', helpText: 'For reproducibility'
        },
        {
            key: 'temperature', label: 'Temperature', type: 'number',
            min: 0, max: 2, step: 0.1, defaultValue: 0,
            helpText: '0 = deterministic',
            disabledWhen: { param: 'reasoning_effort', condition: 'not_equals', value: 'none', clearLabel: 'Set Effort to None' }
        },
        {
            key: 'top_p', label: 'Top P', type: 'number',
            min: 0, max: 1, step: 0.05, defaultValue: 1.0,
            helpText: 'Nucleus sampling',
            disabledWhen: { param: 'reasoning_effort', condition: 'not_equals', value: 'none', clearLabel: 'Set Effort to None' }
        }
    ],
    infoBanner: 'Temperature and Top P are only available when Reasoning Effort is set to None.',
    infoBannerWhen: (params) => params.reasoning_effort !== 'none'
};

const OPENAI_O_SERIES_CONFIG: ModelConfig = {
    params: [
        {
            key: 'reasoning_effort', label: 'Reasoning Effort', type: 'select',
            options: ['low', 'medium', 'high'], defaultValue: 'medium',
            helpText: 'Controls reasoning depth'
        },
        {
            key: 'max_tokens', label: 'Max Tokens', type: 'number',
            min: 100, max: 128000, step: 100, defaultValue: 2000,
            helpText: 'Max 128,000'
        },
        {
            key: 'seed', label: 'Seed', type: 'number',
            min: 0, max: 2147483647, step: 1, defaultValue: undefined,
            placeholder: 'Random', helpText: 'For reproducibility'
        }
    ]
};

const OPENAI_GPT41_CONFIG: ModelConfig = {
    params: [
        {
            key: 'temperature', label: 'Temperature', type: 'number',
            min: 0, max: 2, step: 0.1, defaultValue: 0.7,
            helpText: '0 = deterministic'
        },
        {
            key: 'max_tokens', label: 'Max Tokens', type: 'number',
            min: 100, max: 32768, step: 100, defaultValue: 4096,
            helpText: 'Max 32,768'
        },
        {
            key: 'top_p', label: 'Top P', type: 'number',
            min: 0, max: 1, step: 0.05, defaultValue: 1.0,
            helpText: 'Nucleus sampling'
        },
        {
            key: 'frequency_penalty', label: 'Frequency Penalty', type: 'number',
            min: -2.0, max: 2.0, step: 0.1, defaultValue: 0,
            helpText: 'Penalizes repeated tokens'
        },
        {
            key: 'presence_penalty', label: 'Presence Penalty', type: 'number',
            min: -2.0, max: 2.0, step: 0.1, defaultValue: 0,
            helpText: 'Encourages new topics'
        },
        {
            key: 'seed', label: 'Seed', type: 'number',
            min: 0, max: 2147483647, step: 1, defaultValue: undefined,
            placeholder: 'Random', helpText: 'For reproducibility'
        }
    ]
};

const GEMINI_BASE_CONFIG: ModelConfig = {
    params: [
        {
            key: 'temperature', label: 'Temperature', type: 'number',
            min: 0, max: 2, step: 0.1, defaultValue: 0,
            helpText: '0 = deterministic'
        },
        {
            key: 'max_tokens', label: 'Max Tokens', type: 'number',
            min: 100, max: 65536, step: 100, defaultValue: 4096,
            helpText: 'Max 65,536'
        },
        {
            key: 'top_p', label: 'Top P', type: 'number',
            min: 0, max: 1, step: 0.05, defaultValue: 1.0,
            helpText: 'Nucleus sampling'
        },
        {
            key: 'top_k', label: 'Top K', type: 'number',
            min: 0, max: 500, step: 1, defaultValue: undefined,
            placeholder: 'Off', helpText: 'Limits token pool'
        }
    ]
};

const GEMINI_25_FLASH_CONFIG: ModelConfig = {
    params: [
        ...GEMINI_BASE_CONFIG.params,
        {
            key: 'presence_penalty', label: 'Presence Penalty', type: 'number',
            min: -2.0, max: 2.0, step: 0.1, defaultValue: 0,
            helpText: 'Encourages new topics'
        }
    ]
};

const GEMINI_3_PRO_CONFIG: ModelConfig = {
    params: [
        ...GEMINI_BASE_CONFIG.params,
        {
            key: 'presence_penalty', label: 'Presence Penalty', type: 'number',
            min: -2.0, max: 2.0, step: 0.1, defaultValue: 0,
            helpText: 'Encourages new topics'
        },
        {
            key: 'frequency_penalty', label: 'Frequency Penalty', type: 'number',
            min: -2.0, max: 2.0, step: 0.1, defaultValue: 0,
            helpText: 'Penalizes repeated tokens'
        }
    ]
};

const OPENAI_COMPAT_CONFIG: ModelConfig = {
    params: [
        {
            key: 'temperature', label: 'Temperature', type: 'number',
            min: 0, max: 2, step: 0.1, defaultValue: 0,
            helpText: '0 = deterministic'
        },
        {
            key: 'max_tokens', label: 'Max Tokens', type: 'number',
            min: 100, max: 32768, step: 100, defaultValue: 4096,
            helpText: 'Max 32,768'
        },
        {
            key: 'top_p', label: 'Top P', type: 'number',
            min: 0, max: 1, step: 0.05, defaultValue: 1.0,
            helpText: 'Nucleus sampling'
        },
        {
            key: 'frequency_penalty', label: 'Frequency Penalty', type: 'number',
            min: -2.0, max: 2.0, step: 0.1, defaultValue: 0,
            helpText: 'Penalizes repeated tokens'
        },
        {
            key: 'presence_penalty', label: 'Presence Penalty', type: 'number',
            min: -2.0, max: 2.0, step: 0.1, defaultValue: 0,
            helpText: 'Encourages new topics'
        },
        {
            key: 'seed', label: 'Seed', type: 'number',
            min: 0, max: 2147483647, step: 1, defaultValue: undefined,
            placeholder: 'Random', helpText: 'For reproducibility'
        }
    ]
};

export function getModelConfig(provider: string, model: string): ModelConfig {
    if (provider === 'anthropic') {
        if (model && model.includes('opus')) return ANTHROPIC_OPUS_CONFIG;
        return ANTHROPIC_CONFIG;
    }

    if (provider === 'openai') {
        if (model && (model.startsWith('o3') || model.startsWith('o4'))) return OPENAI_O_SERIES_CONFIG;
        if (model && model.startsWith('gpt-5')) return OPENAI_GPT5_CONFIG;
        if (model && model.startsWith('gpt-4.1')) return OPENAI_GPT41_CONFIG;
        return OPENAI_GPT41_CONFIG; // fallback for unknown OpenAI models
    }

    if (provider === 'gemini') {
        if (model && model.includes('3-pro')) return GEMINI_3_PRO_CONFIG;
        if (model && model.includes('2.5-flash')) return GEMINI_25_FLASH_CONFIG;
        return GEMINI_BASE_CONFIG;
    }

    // DeepSeek, Qwen, Kimi — OpenAI-compatible
    if (provider === 'deepseek' || provider === 'qwen' || provider === 'kimi') {
        return OPENAI_COMPAT_CONFIG;
    }

    // Fallback: basic 3-param config
    return {
        params: [
            { key: 'temperature', label: 'Temperature', type: 'number', min: 0, max: 2, step: 0.1, defaultValue: 0, helpText: '0 = deterministic' },
            { key: 'max_tokens', label: 'Max Tokens', type: 'number', min: 100, max: 8192, step: 100, defaultValue: 4096, helpText: 'Max 8,192' },
            { key: 'top_p', label: 'Top P', type: 'number', min: 0, max: 1, step: 0.05, defaultValue: 1.0, helpText: 'Nucleus sampling' }
        ]
    };
}

export function getDefaultsFromConfig(config: ModelConfig): Record<string, any> {
    const defaults: Record<string, any> = {};
    for (const param of config.params) {
        if (param.defaultValue !== undefined) {
            defaults[param.key] = param.defaultValue;
        }
    }
    return defaults;
}
