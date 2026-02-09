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

    const [showPromptManager, setShowPromptManager] = useState(false);
    const [savedPrompts, setSavedPrompts] = useState<any[]>([]);
    const [currentPromptId, setCurrentPromptId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [newPromptName, setNewPromptName] = useState('');

    useEffect(() => {
        fetchSavedPrompts();
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

    const handleLoadDefault = async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            const res = await fetch(`${apiUrl}/prompts/default`);
            if (res.ok) {
                const data = await res.json();
                setCustomPrompt(data.prompt_text);
                setCurrentPromptId(null);
            }
        } catch (e) { console.error('Failed to load default template', e); }
    };

    const validatePrompt = () => {
        const required = ['{{conversation_transcript}}', '{{guardrail_configuration_table}}', '{{kore_genai_logs}}'];
        const missing = required.filter(r => !customPrompt.includes(r));
        if (missing.length > 0) {
            alert(`Cannot save prompt. Missing required variables:\n${missing.join('\n')}`);
            return false;
        }
        return true;
    };

    const handleSaveNewPrompt = async () => {
        if (!validatePrompt()) return;
        if (!newPromptName.trim()) {
            alert("Please enter a name for the template.");
            return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            const res = await fetch(`${apiUrl}/prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newPromptName, promptText: customPrompt })
            });

            if (res.ok) {
                await fetchSavedPrompts();
                setIsSaving(false);
                setNewPromptName("");
                alert("Template saved!");
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(`Failed to save: ${errData.error || res.statusText}`);
            }
        } catch (e: any) { alert(`Error saving: ${e.message}`); }
    };

    const handleUpdatePrompt = async () => {
        if (!currentPromptId || !validatePrompt()) return;

        const current = savedPrompts.find(p => p.id === currentPromptId);
        if (!current) return;

        const confirmUpdate = confirm(`Overwrite "${current.name || current.guardrailType}"? This will create a new version.`);
        if (!confirmUpdate) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            // 1. Delete old
            await fetch(`${apiUrl}/prompts/${currentPromptId}`, { method: 'DELETE' });

            // 2. Create new with same name
            const res = await fetch(`${apiUrl}/prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: current.guardrailType || current.name, promptText: customPrompt })
            });

            if (res.ok) {
                await fetchSavedPrompts();
                setCurrentPromptId(null);
                alert("Template updated!");
            }
        } catch (e) { console.error(e); alert("Update failed"); }
    };

    const handleDeletePrompt = async (id: string) => {
        if (!confirm("Are you sure you want to delete this template?")) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            await fetch(`${apiUrl}/prompts/${id}`, { method: 'DELETE' });
            await fetchSavedPrompts();
            if (currentPromptId === id) {
                setCurrentPromptId(null);
                handleLoadDefault();
            }
        } catch (e) { alert("Failed to delete"); }
    };

    const handleLoadSaved = (id: string) => {
        const p = savedPrompts.find(s => s.id === id);
        if (p) {
            const required = ['{{conversation_transcript}}', '{{guardrail_configuration_table}}', '{{kore_genai_logs}}'];
            const missing = required.filter(r => !p.promptText.includes(r));

            if (missing.length > 0) {
                alert(`Cannot load this template. It is missing required variables:\n${missing.join('\n')}`);
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

                {/* Prompt Manager Section */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                    <button
                        onClick={() => setShowPromptManager(!showPromptManager)}
                        className="w-full px-3 py-2 text-left text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Manage Evaluation Prompt
                        </span>
                        <svg className={`w-4 h-4 transform transition-transform ${showPromptManager ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showPromptManager && (
                        <div className="p-3 space-y-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                            {/* Saved Prompts Controls */}
                            <div className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                                <div className="flex gap-2 items-center justify-between flex-wrap">
                                    <div className="flex-1 min-w-[120px] flex gap-2 items-center">
                                        <select
                                            value={currentPromptId || ""}
                                            onChange={(e) => {
                                                const id = e.target.value;
                                                setCurrentPromptId(id);
                                                if (id) handleLoadSaved(id);
                                                else handleLoadDefault();
                                            }}
                                            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 flex-1"
                                        >
                                            <option value="">Default Template</option>
                                            {savedPrompts.map(p => (
                                                <option key={p.id} value={p.id}>{p.name || p.guardrailType || 'Untitled'}</option>
                                            ))}
                                        </select>

                                        {currentPromptId && (
                                            <button
                                                onClick={() => handleDeletePrompt(currentPromptId)}
                                                className="text-red-500 hover:text-red-700 p-1"
                                                title="Delete this template"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex gap-1">
                                        {currentPromptId ? (
                                            <button
                                                onClick={handleUpdatePrompt}
                                                className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 border border-indigo-200"
                                            >
                                                Update
                                            </button>
                                        ) : null}

                                        <button
                                            onClick={() => setIsSaving(true)}
                                            className={`text-xs px-2 py-1 rounded border ${isSaving ? 'bg-gray-200 text-gray-400' : 'bg-green-50 text-green-600 hover:bg-green-100 border-green-200'}`}
                                            disabled={isSaving}
                                        >
                                            Save New...
                                        </button>
                                    </div>
                                </div>

                                {isSaving && (
                                    <div className="flex gap-2 items-center bg-white dark:bg-gray-900 p-2 rounded border border-blue-200 animate-in fade-in slide-in-from-top-1">
                                        <input
                                            type="text"
                                            value={newPromptName}
                                            onChange={e => setNewPromptName(e.target.value)}
                                            placeholder="Enter template name..."
                                            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 flex-1 bg-transparent"
                                            autoFocus
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleSaveNewPrompt();
                                                if (e.key === 'Escape') setIsSaving(false);
                                            }}
                                        />
                                        <button
                                            onClick={handleSaveNewPrompt}
                                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setIsSaving(false)}
                                            className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Editor Area */}
                            <div className="relative">
                                <div className="absolute top-2 right-2 flex gap-1">
                                    <button
                                        onClick={() => setIsEditorOpen(true)}
                                        className="p-1 bg-white/80 rounded hover:bg-gray-100 text-gray-500 shadow-sm border border-gray-200"
                                        title="Expand Editor"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                        </svg>
                                    </button>
                                </div>
                                <textarea
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    placeholder="Enter custom evaluation prompt..."
                                    className="w-full text-[10px] font-mono h-48 border border-gray-300 dark:border-gray-600 rounded p-2 focus:ring-1 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-900"
                                />
                            </div>

                            {/* Validation Indicators */}
                            <div className="bg-gray-50 dark:bg-gray-800 rounded p-2 text-[10px]">
                                <p className="font-semibold text-gray-500 mb-1">Required Variables:</p>
                                <div className="grid grid-cols-1 gap-1">
                                    {[
                                        { key: '{{conversation_transcript}}', label: 'Conversation Transcript' },
                                        { key: '{{guardrail_configuration_table}}', label: 'Config Table' },
                                        { key: '{{kore_genai_logs}}', label: 'GenAI Logs' }
                                    ].map(v => {
                                        const isPresent = customPrompt.includes(v.key);
                                        return (
                                            <div key={v.key} className={`flex items-center gap-1.5 ${isPresent ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    {isPresent ? (
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    ) : (
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    )}
                                                </svg>
                                                <code className="bg-white dark:bg-gray-900 px-1 rounded border border-gray-200 dark:border-gray-700">{v.key}</code>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-gray-400 mt-2 italic">
                                    Prompt cannot be saved or used efficiently without these variables.
                                </p>
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
                onLoadTemplate={handleLoadDefault}
            />
        </div>
    );
}
