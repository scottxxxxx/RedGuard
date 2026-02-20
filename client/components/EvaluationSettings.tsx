"use client";
import { useState, useEffect, useRef } from 'react';
import { LLMConfig } from '../types/config';
import PromptEditorModal from './PromptEditorModal';
import { useNotification } from '../context/NotificationContext';

export type ProviderKeys = Record<string, string>;

interface Props {
    onConfigChange: (config: LLMConfig) => void;
    onPromptTemplateChange?: () => void;
    providerKeys?: ProviderKeys;
    onProviderKeysChange?: (keys: ProviderKeys) => void;
}

const PROVIDERS = {
    anthropic: {
        name: 'Anthropic',
        models: [
            'claude-opus-4-6',             // Claude Opus 4.6 (most capable)
            'claude-sonnet-4-5-20250929',  // Claude Sonnet 4.5 (balanced)
            'claude-haiku-4-5-20251001',   // Claude Haiku 4.5 (fastest)
        ],
        defaultModel: 'claude-sonnet-4-5-20250929'
    },
    openai: {
        name: 'OpenAI',
        models: ['gpt-5.3-codex', 'gpt-5.3-codex-spark', 'gpt-5.2', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3', 'o4-mini'],
        defaultModel: 'gpt-5.2'
    },
    gemini: {
        name: 'Google Gemini',
        models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3-pro-preview'],
        defaultModel: 'gemini-2.5-pro'
    },
    deepseek: {
        name: 'DeepSeek',
        models: ['deepseek-chat', 'deepseek-reasoner'],
        defaultModel: 'deepseek-chat'
    },
    qwen: {
        name: 'Qwen (Alibaba)',
        models: ['qwen3-max', 'qwen3-max-preview', 'qwen-plus', 'qwen3-coder-plus'],
        defaultModel: 'qwen3-max'
    },
    kimi: {
        name: 'Kimi (Moonshot)',
        models: ['kimi-k2.5', 'kimi-k2-0905-preview', 'kimi-k2-turbo-preview', 'kimi-k2-thinking', 'kimi-k2-thinking-turbo'],
        defaultModel: 'kimi-k2.5'
    }
};

export { PROVIDERS };

export default function EvaluationSettings({ onConfigChange, onPromptTemplateChange, providerKeys, onProviderKeysChange }: Props) {
    const [provider, setProvider] = useState<keyof typeof PROVIDERS>('anthropic');

    // Use external keys if provided, otherwise manage internally
    const isControlled = !!providerKeys && !!onProviderKeysChange;
    const [internalKeys, setInternalKeys] = useState({
        openai: '',
        anthropic: '',
        gemini: '',
        deepseek: '',
        qwen: '',
        kimi: ''
    });
    const keys = isControlled ? providerKeys as typeof internalKeys : internalKeys;
    const setKeys = isControlled
        ? (updater: ((prev: typeof internalKeys) => typeof internalKeys) | typeof internalKeys) => {
            const newKeys = typeof updater === 'function' ? updater(keys as typeof internalKeys) : updater;
            onProviderKeysChange!(newKeys);
        }
        : setInternalKeys;

    // Load keys from localStorage on mount (only when uncontrolled)
    useEffect(() => {
        if (isControlled) return;
        const savedKeys = localStorage.getItem('redguard_llm_keys');
        if (savedKeys) {
            try {
                const parsed = JSON.parse(savedKeys);
                setInternalKeys(prev => ({ ...prev, ...parsed }));
            } catch (e) {
                console.error("Failed to parse saved keys", e);
            }
        }

        const savedProvider = localStorage.getItem('redguard_llm_provider');
        if (savedProvider && PROVIDERS[savedProvider as keyof typeof PROVIDERS]) {
            setProvider(savedProvider as keyof typeof PROVIDERS);
        }
    }, []);

    // Load saved provider on mount when controlled (keys already come from props)
    useEffect(() => {
        if (!isControlled) return;
        const savedProvider = localStorage.getItem('redguard_llm_provider');
        if (savedProvider && PROVIDERS[savedProvider as keyof typeof PROVIDERS]) {
            setProvider(savedProvider as keyof typeof PROVIDERS);
        }
    }, []);

    // Save keys to localStorage when they change (only when uncontrolled)
    useEffect(() => {
        if (isControlled) return;
        localStorage.setItem('redguard_llm_keys', JSON.stringify(internalKeys));
    }, [internalKeys]);

    // Save provider to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('redguard_llm_provider', provider);
    }, [provider]);

    const [model, setModel] = useState(PROVIDERS.anthropic.defaultModel);

    // Ensure model is valid for current provider on mount/initialization
    useEffect(() => {
        if (!PROVIDERS[provider].models.includes(model)) {
            setModel(PROVIDERS[provider].defaultModel);
        }
    }, [provider]);

    // Update model when provider changes if current model is invalid for new provider
    const handleProviderChange = (newProvider: keyof typeof PROVIDERS) => {
        setProvider(newProvider);
        setModel(PROVIDERS[newProvider].defaultModel);
    };

    const handleKeyChange = (val: string) => {
        setKeys(prev => ({ ...prev, [provider]: val }));
    };

    const [customPrompt, setCustomPrompt] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [systemPromptEnabled, setSystemPromptEnabled] = useState(false);
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    // Track previous provider|model to auto-load model-specific default on switch
    const prevModelRef = useRef<string>('');
    // Ref to skip auto-load during initial localStorage-driven provider/model settling
    const initializedRef = useRef(false);
    const [currentPromptId, setCurrentPromptId] = useState<string | null>(null);
    const [defaultTemplates, setDefaultTemplates] = useState<{ key: string; name: string; description?: string }[]>([]);
    const [selectedDefaultKey, setSelectedDefaultKey] = useState<string>('default_evaluation');

    // Persist selected template key to localStorage
    useEffect(() => {
        localStorage.setItem('redguard_selected_template', selectedDefaultKey);
    }, [selectedDefaultKey]);

    useEffect(() => {
        onConfigChange({
            provider,
            model,
            apiKey: keys[provider],
            customPrompt: customPrompt.trim() !== '' ? customPrompt : undefined,
            // null = explicitly disabled (don't fall back to model template)
            // undefined = not set (fall back to model template default)
            // string = use this system prompt
            systemPrompt: systemPromptEnabled
                ? (systemPrompt.trim() !== '' ? systemPrompt : undefined)
                : null
        });
    }, [provider, model, keys, customPrompt, systemPrompt, systemPromptEnabled, onConfigChange]);

    const currentKey = keys[provider];
    const keySuffix = currentKey.length > 5 ? `...${currentKey.slice(-5)}` : '';

    const [showPromptManager, setShowPromptManager] = useState(false);
    const [savedPrompts, setSavedPrompts] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [newPromptName, setNewPromptName] = useState('');
    const { showToast, confirm } = useNotification();

    const isPromptValid = customPrompt.includes('{{conversation_transcript}}') &&
        customPrompt.includes('{{guardrail_configuration_table}}') &&
        customPrompt.includes('{{kore_genai_logs}}');

    const fetchDefaultTemplates = async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            const res = await fetch(`${apiUrl}/prompts/defaults`);
            if (res.ok) {
                const data = await res.json();
                setDefaultTemplates(data);
            }
        } catch (e) { console.error('Failed to load default templates', e); }
    };

    useEffect(() => {
        fetchSavedPrompts();
        fetchDefaultTemplates();
        // Load persisted template selection, or fall back to model-auto-detect
        const savedTemplateKey = localStorage.getItem('redguard_selected_template');
        if (savedTemplateKey) {
            handleLoadDefaultByKey(savedTemplateKey);
        } else {
            handleLoadDefault();
        }
        // Mark initialized after a frame so localStorage-driven provider/model changes settle first
        requestAnimationFrame(() => { initializedRef.current = true; });
    }, []);

    const fetchSavedPrompts = async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            const res = await fetch(`${apiUrl}/prompts`);
            if (res.ok) {
                const data = await res.json();
                setSavedPrompts(data);
            }
        } catch (e) { console.error(e); }
    };

    const handleLoadDefault = async (targetProvider?: string, targetModel?: string) => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const p = targetProvider || provider;
        const m = targetModel || model;
        try {
            const res = await fetch(`${apiUrl}/prompts/default?provider=${encodeURIComponent(p)}&model=${encodeURIComponent(m)}`);
            if (res.ok) {
                const data = await res.json();
                setCustomPrompt(data.prompt_text);
                setSystemPrompt(data.system_prompt || '');
                setSystemPromptEnabled(!!data.system_prompt);
                setCurrentPromptId(null);
                if (data.key) {
                    setSelectedDefaultKey(data.key);
                }
            }
        } catch (e) { console.error('Failed to load default template', e); }
    };

    const handleLoadDefaultByKey = async (key: string) => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            const res = await fetch(`${apiUrl}/prompts/defaults/${encodeURIComponent(key)}`);
            if (res.ok) {
                const data = await res.json();
                setCustomPrompt(data.prompt_text);
                setSystemPrompt(data.system_prompt || '');
                setSystemPromptEnabled(!!data.system_prompt);
                setCurrentPromptId(null);
                setSelectedDefaultKey(key);
            }
        } catch (e) { console.error('Failed to load default template by key', e); }
    };

    // Auto-load model-specific default when provider/model changes (only if on default template)
    // Skip during initial mount — localStorage-driven provider/model changes should not
    // overwrite the persisted template selection (prevents flicker race condition)
    useEffect(() => {
        const key = `${provider}|${model}`;
        if (prevModelRef.current && prevModelRef.current !== key && initializedRef.current) {
            if (currentPromptId === null) {
                handleLoadDefault(provider, model);
                onPromptTemplateChange?.();
            }
        }
        prevModelRef.current = key;
    }, [provider, model]);

    const handleSaveNewPrompt = async (name?: string, text?: string): Promise<boolean> => {
        const promptToSave = text !== undefined ? text : customPrompt;
        const promptName = name !== undefined ? name : newPromptName;

        const required = ['{{conversation_transcript}}', '{{guardrail_configuration_table}}', '{{kore_genai_logs}}'];
        const missing = required.filter(r => !promptToSave.includes(r));
        if (missing.length > 0) {
            showToast(`Missing required variables: ${missing.join(', ')}`, 'error');
            return false;
        }

        if (!promptName.trim()) {
            showToast("Please enter a name for the template.", 'error');
            return false;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            const res = await fetch(`${apiUrl}/prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: promptName, promptText: promptToSave })
            });

            if (res.ok) {
                await fetchSavedPrompts();
                setIsSaving(false);
                setNewPromptName("");
                showToast("Template saved successfully!", 'success');
                return true;
            } else {
                const errData = await res.json().catch(() => ({}));
                showToast(`Failed to save: ${errData.error || res.statusText}`, 'error');
                return false;
            }
        } catch (e: any) {
            showToast(`Error saving: ${e.message}`, 'error');
            return false;
        }
    };

    const handleUpdatePrompt = async (): Promise<boolean> => {
        if (!currentPromptId) return false;

        const required = ['{{conversation_transcript}}', '{{guardrail_configuration_table}}', '{{kore_genai_logs}}'];
        const missing = required.filter(r => !customPrompt.includes(r));
        if (missing.length > 0) {
            showToast(`Cannot update. Missing: ${missing.join(', ')}`, 'error');
            return false;
        }

        const current = savedPrompts.find(p => p.id === currentPromptId);
        if (!current) return false;

        const name = current.name || current.guardrailType;
        const confirmed = await confirm({
            title: "Update Template",
            message: `Are you sure you want to overwrite "${name}"? A new version will be created.`,
            confirmLabel: "Overwrite"
        });

        if (!confirmed) return false;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            // 1. Delete old
            await fetch(`${apiUrl}/prompts/${currentPromptId}`, { method: 'DELETE' });

            // 2. Create new with same name
            const res = await fetch(`${apiUrl}/prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, promptText: customPrompt })
            });

            if (res.ok) {
                const newPrompt = await res.json();
                await fetchSavedPrompts();
                // Keep the newly created prompt selected
                setCurrentPromptId(newPrompt.id);
                showToast("Template updated successfully!", 'success');
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            showToast("Update failed", 'error');
            return false;
        }
    };

    const handleDeletePrompt = async (id: string) => {
        const p = savedPrompts.find(s => s.id === id);
        if (!p) return;

        const confirmed = await confirm({
            title: "Delete Template",
            message: `Are you sure you want to delete "${p.name || p.guardrailType || 'Untitled'}"? This action cannot be undone.`,
            confirmLabel: "Delete",
            isDanger: true
        });

        if (!confirmed) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            await fetch(`${apiUrl}/prompts/${id}`, { method: 'DELETE' });
            await fetchSavedPrompts();
            showToast("Template deleted", 'info');
            if (currentPromptId === id) {
                setCurrentPromptId(null);
                handleLoadDefault();
            }
        } catch (e) { showToast("Failed to delete", 'error'); }
    };

    const handleLoadSaved = (id: string) => {
        const p = savedPrompts.find(s => s.id === id);
        if (p) {
            const required = ['{{conversation_transcript}}', '{{guardrail_configuration_table}}', '{{kore_genai_logs}}'];
            const missing = required.filter(r => !p.promptText.includes(r));

            if (missing.length > 0) {
                showToast(`Incompatible template. Missing: ${missing.join(', ')}`, 'error');
                return;
            }
            setCustomPrompt(p.promptText);
        }
    };

    return (
        <div className="card p-6 h-full">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--border)]">
                <div className="w-6 h-6 rounded-md bg-[var(--primary-50)] flex items-center justify-center">
                    <svg className="w-4 h-4 text-[var(--primary-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                </div>
                <h3 className="text-base font-semibold text-[var(--foreground)]">
                    Evaluation Model
                </h3>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs text-[var(--foreground-muted)] mb-1">Provider</label>
                    <select
                        value={provider}
                        onChange={(e) => handleProviderChange(e.target.value as any)}
                        className="input w-full text-sm"
                    >
                        {Object.entries(PROVIDERS).map(([key, data]) => (
                            <option key={key} value={key}>{data.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs text-[var(--foreground-muted)] mb-1">Model Name</label>
                    <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="input w-full text-sm"
                    >
                        {PROVIDERS[provider].models.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <div className="flex justify-between">
                        <label className="block text-xs text-[var(--foreground-muted)] mb-1">{PROVIDERS[provider].name} API Key</label>
                        {keySuffix && <span className="text-xs text-green-600 font-mono">Loaded: {keySuffix}</span>}
                    </div>
                    <input
                        type="password"
                        value={currentKey}
                        onChange={(e) => handleKeyChange(e.target.value)}
                        placeholder={`Enter ${PROVIDERS[provider].name} key...`}
                        className="input w-full text-sm"
                    />
                    <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
                        Keys are persisted securely in your browser's local storage for each provider.
                    </p>
                </div>

                {/* Prompt Manager Section */}
                <div className="border border-[var(--border)] rounded-md overflow-hidden">
                    <button
                        onClick={() => setShowPromptManager(!showPromptManager)}
                        className="w-full px-3 py-2 text-left text-xs font-medium bg-[var(--surface)] text-[var(--foreground-secondary)] flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-[var(--primary-500)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Manage Evaluation Prompt
                        </span>
                        <svg className={`w-4 h-4 transform transition-transform ${showPromptManager ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showPromptManager && (
                        <div className="p-3 space-y-3 bg-[var(--surface)] border-t border-[var(--border)]">
                            {/* Saved Prompts Controls */}
                            <div className="flex flex-col gap-2 bg-[var(--background)] p-2 rounded border border-[var(--border)]">
                                <div className="flex gap-2 items-center justify-between flex-wrap">
                                    <div className="flex-1 min-w-[120px] flex gap-2 items-center">
                                        <div className="flex-1 relative">
                                            <select
                                                value={currentPromptId || `default:${selectedDefaultKey}`}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val.startsWith('default:')) {
                                                        const key = val.replace('default:', '');
                                                        handleLoadDefaultByKey(key);
                                                    } else {
                                                        setCurrentPromptId(val);
                                                        handleLoadSaved(val);
                                                    }
                                                    onPromptTemplateChange?.();
                                                }}
                                                className="w-full text-xs text-[var(--foreground)] border border-[var(--border)] rounded-md px-2 py-1.5 bg-[var(--surface)] focus:ring-1 focus:ring-[var(--primary-500)] outline-none appearance-none"
                                            >
                                                {defaultTemplates.length > 0 ? (
                                                    defaultTemplates.map(d => (
                                                        <option key={d.key} value={`default:${d.key}`}>✨ {d.name}</option>
                                                    ))
                                                ) : (
                                                    <option value="default:default_evaluation">✨ Default Template</option>
                                                )}
                                                {savedPrompts.map(p => (
                                                    <option key={p.id} value={p.id}>📂 {p.name || p.guardrailType || 'Untitled'}</option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-[var(--foreground-muted)]">
                                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>

                                        {currentPromptId && (
                                            <button
                                                onClick={() => handleDeletePrompt(currentPromptId)}
                                                className="text-[var(--foreground-muted)] hover:text-red-500 p-1.5 hover:bg-red-500/10 rounded-md transition-colors"
                                                title="Delete this template"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex gap-1.5">
                                        {currentPromptId ? (
                                            <button
                                                onClick={handleUpdatePrompt}
                                                disabled={!isPromptValid}
                                                className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-[var(--primary-50)] text-[var(--primary-600)] rounded-md hover:bg-[var(--primary-100)] border border-[var(--primary-200)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                Update
                                            </button>
                                        ) : null}

                                        <button
                                            onClick={() => setIsSaving(true)}
                                            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border shadow-sm transition-all font-medium ${isSaving || !isPromptValid
                                                ? 'bg-[var(--surface-hover)] text-[var(--foreground-muted)] border-[var(--border)] cursor-not-allowed'
                                                : 'bg-[var(--primary-500)] text-white hover:bg-[var(--primary-600)] border-[var(--primary-500)]'
                                                }`}
                                            disabled={isSaving || !isPromptValid}
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Save New
                                        </button>
                                    </div>
                                </div>

                                {isSaving && (
                                    <div className="mt-2 bg-[var(--primary-50)] dark:bg-[var(--primary-500)]/10 p-3 rounded-lg border border-[var(--primary-200)] dark:border-[var(--primary-500)]/30 animate-in fade-in slide-in-from-top-2 duration-200 shadow-inner">
                                        <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-[var(--primary-700)] dark:text-[var(--primary-300)] uppercase tracking-wider">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Create New Named Prompt
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                value={newPromptName}
                                                onChange={e => setNewPromptName(e.target.value)}
                                                placeholder="Prompt Name (e.g. Creative Evaluation v2)"
                                                className="text-xs border border-[var(--border)] rounded px-2 py-2 flex-1 bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary-500)] outline-none shadow-sm"
                                                autoFocus
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleSaveNewPrompt();
                                                    if (e.key === 'Escape') setIsSaving(false);
                                                }}
                                            />
                                            <div className="flex gap-1.5 items-center">
                                                <button
                                                    onClick={() => handleSaveNewPrompt()}
                                                    disabled={!isPromptValid}
                                                    className="text-xs px-3 py-2 bg-[var(--primary-500)] text-white rounded hover:bg-[var(--primary-600)] shadow-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => { setIsSaving(false); setNewPromptName(""); }}
                                                    className="text-xs px-2 py-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] font-medium"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Prompt Editor Area */}
                            <div className="relative border border-[var(--border)] rounded-lg overflow-hidden">
                                {/* Expand button — top-right corner */}
                                <button
                                    onClick={() => setIsEditorOpen(true)}
                                    className="absolute top-2 right-2 z-10 p-1.5 bg-[var(--surface)]/90 rounded-md hover:bg-[var(--surface-hover)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] shadow-sm border border-[var(--border)] transition-colors"
                                    title="Expand Editor"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                </button>

                                {/* System Instructions Section */}
                                <div className={`border-b ${systemPromptEnabled ? 'border-amber-200 dark:border-amber-500/30' : 'border-[var(--border)]'}`}>
                                    <div className={`flex items-center gap-2 px-3 py-2 ${systemPromptEnabled ? 'bg-amber-50/70 dark:bg-amber-500/10' : 'bg-[var(--background)]'}`}>
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={systemPromptEnabled}
                                                onChange={(e) => {
                                                    setSystemPromptEnabled(e.target.checked);
                                                    if (!e.target.checked) {
                                                        setSystemPrompt('');
                                                    }
                                                }}
                                                className="w-3.5 h-3.5 rounded border-[var(--border)] text-amber-500 focus:ring-amber-400 cursor-pointer"
                                            />
                                            <svg className={`w-3.5 h-3.5 ${systemPromptEnabled ? 'text-amber-500' : 'text-[var(--foreground-muted)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                            </svg>
                                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${systemPromptEnabled ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--foreground-muted)]'}`}>
                                                System Instructions
                                            </span>
                                        </label>
                                    </div>
                                    {systemPromptEnabled && (
                                        <textarea
                                            value={systemPrompt}
                                            onChange={(e) => setSystemPrompt(e.target.value)}
                                            placeholder="Enter system instructions for the evaluation model..."
                                            className="w-full text-[10px] font-mono h-16 border-0 border-t border-amber-100 dark:border-amber-500/20 p-2 focus:ring-0 focus:outline-none bg-amber-50/30 dark:bg-amber-500/5 text-[var(--foreground)] resize-y"
                                        />
                                    )}
                                </div>

                                {/* User Prompt Section */}
                                <div>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--background)] border-b border-[var(--border)]">
                                        <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <span className="text-[10px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">User Prompt</span>
                                    </div>
                                    <textarea
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder="Enter custom evaluation prompt..."
                                        className="w-full text-[10px] font-mono h-48 border-0 p-2 focus:ring-0 focus:outline-none bg-[var(--surface)] text-[var(--foreground)] resize-y"
                                    />
                                </div>
                            </div>

                            {/* Validation Indicators */}
                            <div className="bg-[var(--background)] rounded-lg p-3 text-[10px] border border-[var(--border)] shadow-inner">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="font-bold text-[var(--foreground-muted)] uppercase tracking-tighter">Prompt Requirements</p>
                                    {(() => {
                                        const required = ['{{conversation_transcript}}', '{{guardrail_configuration_table}}', '{{kore_genai_logs}}'];
                                        const missingCount = required.filter(r => !customPrompt.includes(r)).length;
                                        return missingCount === 0 ? (
                                            <span className="text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded-full border border-green-100 dark:border-green-500/20 uppercase tracking-tighter scale-90">Ready to Save</span>
                                        ) : (
                                            <span className="text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full border border-red-100 dark:border-red-500/20 uppercase tracking-tighter animate-pulse scale-90">Incomplete</span>
                                        );
                                    })()}
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {[
                                        { key: '{{conversation_transcript}}', label: 'Conversation Transcript' },
                                        { key: '{{guardrail_configuration_table}}', label: 'Config Table' },
                                        { key: '{{kore_genai_logs}}', label: 'GenAI Logs' }
                                    ].map(v => {
                                        const isPresent = customPrompt.includes(v.key);
                                        return (
                                            <div key={v.key} className={`flex items-center justify-between p-1.5 rounded-md border transition-all ${isPresent ? 'bg-green-50/30 dark:bg-green-500/10 border-green-100 dark:border-green-500/20 text-green-700 dark:text-green-400' : 'bg-red-50/30 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 text-red-500 dark:text-red-400'}`}>
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        {isPresent ? (
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        ) : (
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        )}
                                                    </svg>
                                                    <code className="bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)] font-bold">{v.key}</code>
                                                </div>
                                                <span className="text-[9px] opacity-70 font-medium">{v.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                {customPrompt.includes('{{conversation_transcript}}') && customPrompt.includes('{{guardrail_configuration_table}}') && customPrompt.includes('{{kore_genai_logs}}') ? null : (
                                    <div className="mt-2 p-2 bg-red-600 text-white rounded font-bold text-center animate-bounce shadow-lg">
                                        ⚠️ MISSING REQUIRED VARIABLES ABOVE
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <PromptEditorModal
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                value={customPrompt}
                onChange={setCustomPrompt}
                onSaveToBackend={(name, text) => handleSaveNewPrompt(name, text)}
                systemPrompt={systemPrompt}
                onSystemPromptChange={setSystemPrompt}
                systemPromptEnabled={systemPromptEnabled}
                onSystemPromptEnabledChange={setSystemPromptEnabled}
            />
        </div>
    );
}
