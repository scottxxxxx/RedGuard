"use client";
import { useState, useEffect } from 'react';
import { LLMConfig } from '../types/config';
import PromptEditorModal from './PromptEditorModal';

interface Props {
    onConfigChange: (config: LLMConfig) => void;
}

const PROVIDERS = {
    openai: {
        name: 'OpenAI',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'],
        defaultModel: 'gpt-4o'
    },
    anthropic: {
        name: 'Anthropic',
        models: [
            'claude-opus-4-5-20251101',    // Claude 4.5 Opus (most capable)
            'claude-sonnet-4-5-20250929',  // Claude 4.5 Sonnet (balanced)
            'claude-haiku-4-5-20251001',   // Claude 4.5 Haiku (fastest)
            'claude-3-5-sonnet-20241022',  // Claude 3.5 Sonnet
            'claude-3-5-haiku-20241022'    // Claude 3.5 Haiku
        ],
        defaultModel: 'claude-sonnet-4-5-20250929'
    },
    gemini: {
        name: 'Google Gemini',
        models: ['gemini-2.5-pro-preview-06-05', 'gemini-2.5-flash-preview-05-20', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        defaultModel: 'gemini-2.5-pro-preview-06-05'
    }
};

export default function EvaluationSettings({ onConfigChange }: Props) {
    const [provider, setProvider] = useState<keyof typeof PROVIDERS>('anthropic');
    const [keys, setKeys] = useState({
        openai: '',
        anthropic: '',
        gemini: ''
    });
    const [model, setModel] = useState(PROVIDERS.anthropic.defaultModel);

    // Update model when provider changes if current model is invalid for new provider
    const handleProviderChange = (newProvider: keyof typeof PROVIDERS) => {
        setProvider(newProvider);
        setModel(PROVIDERS[newProvider].defaultModel);
    };

    const handleKeyChange = (val: string) => {
        setKeys(prev => ({ ...prev, [provider]: val }));
    };

    const [customPrompt, setCustomPrompt] = useState('');
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    useEffect(() => {
        onConfigChange({
            provider,
            model,
            apiKey: keys[provider],
            customPrompt: customPrompt.trim() !== '' ? customPrompt : undefined
        });
    }, [provider, model, keys, customPrompt, onConfigChange]);

    const currentKey = keys[provider];
    const keySuffix = currentKey.length > 5 ? `...${currentKey.slice(-5)}` : '';

    const [savedPrompts, setSavedPrompts] = useState<any[]>([]);

    useEffect(() => {
        fetchSavedPrompts();
    }, []);

    const fetchSavedPrompts = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/prompts');
            if (res.ok) {
                const data = await res.json();
                setSavedPrompts(data);
            }
        } catch (e) { console.error(e); }
    };

    const handleLoadDefault = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/prompts/default');
            if (res.ok) {
                const data = await res.json();
                setCustomPrompt(data.prompt_text);
            }
        } catch (e) { console.error('Failed to load default template', e); }
    };

    const handleSavePrompt = async () => {
        const name = prompt("Enter a name for this template:");
        if (!name) return;
        try {
            const res = await fetch('http://localhost:3001/api/prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, promptText: customPrompt })
            });
            if (res.ok) {
                fetchSavedPrompts();
                alert("Template saved!");
            }
        } catch (e) { alert("Failed to save template"); }
    };

    const handleLoadSaved = (id: string) => {
        const p = savedPrompts.find(s => s.id === id);
        if (p) setCustomPrompt(p.promptText);
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
                    <label className="block text-xs text-gray-500 mb-1">Provider</label>
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
                    <label className="block text-xs text-gray-500 mb-1">Model Name</label>
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
                        <label className="block text-xs text-gray-500 mb-1">{PROVIDERS[provider].name} API Key</label>
                        {keySuffix && <span className="text-xs text-green-600 font-mono">Loaded: {keySuffix}</span>}
                    </div>
                    <input
                        type="password"
                        value={currentKey}
                        onChange={(e) => handleKeyChange(e.target.value)}
                        placeholder={`Enter ${PROVIDERS[provider].name} key...`}
                        className="input w-full text-sm"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                        Keys are stored locally in this session for each provider.
                    </p>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs text-gray-500">Custom Evaluation Prompt</label>
                        <div className="flex items-center gap-2">
                            <select
                                onChange={(e) => {
                                    if (e.target.value) handleLoadSaved(e.target.value);
                                    e.target.value = "";
                                }}
                                className="text-[10px] border rounded p-1 bg-white dark:bg-gray-800 max-w-[100px]"
                            >
                                <option value="">Load Saved...</option>
                                {savedPrompts.map(p => (
                                    <option key={p.id} value={p.id}>{p.guardrailType}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleSavePrompt}
                                className="text-[10px] text-blue-600 hover:text-blue-800 underline"
                            >
                                Save
                            </button>
                            <button
                                onClick={handleLoadDefault}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 underline"
                            >
                                Reset to Default
                            </button>
                            <button
                                onClick={() => setIsEditorOpen(true)}
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title="Open full editor"
                            >
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="Leave empty to use default. Use {{restricted_topics}} and {{filter_regex}} vars."
                        className="input w-full text-xs font-mono h-32"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                        Available variables: <code className="bg-gray-100 px-1 rounded">{'{{restricted_topics}}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{{filter_regex}}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{{conversation_history}}'}</code>
                    </p>
                </div>
            </div>

            <PromptEditorModal
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                value={customPrompt}
                onChange={setCustomPrompt}
                onLoadTemplate={handleLoadDefault}
            />
        </div>
    );
}
