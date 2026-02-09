import { useState, useRef, useEffect, useCallback } from 'react';
import { useNotification } from '../context/NotificationContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    value: string;
    onChange: (value: string) => void;
    onLoadTemplate: () => void;
    onSaveToBackend?: (name: string, text: string) => Promise<boolean>;
}

export default function PromptEditorModal({ isOpen, onClose, value, onChange, onLoadTemplate, onSaveToBackend }: Props) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSavingToBackend, setIsSavingToBackend] = useState(false);
    const [newBackendName, setNewBackendName] = useState("");
    const { showToast } = useNotification();

    // Undo/Redo history
    const [history, setHistory] = useState<string[]>([value]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const isUndoRedo = useRef(false);

    // Update history when value changes (but not from undo/redo)
    useEffect(() => {
        if (isUndoRedo.current) {
            isUndoRedo.current = false;
            return;
        }

        // Debounce history updates
        const timer = setTimeout(() => {
            setHistory(prev => {
                const newHistory = prev.slice(0, historyIndex + 1);
                if (newHistory[newHistory.length - 1] !== value) {
                    return [...newHistory, value];
                }
                return newHistory;
            });
            setHistoryIndex(prev => prev + 1);
        }, 500);

        return () => clearTimeout(timer);
    }, [value]);

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            isUndoRedo.current = true;
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            onChange(history[newIndex]);
        }
    }, [historyIndex, history, onChange]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            isUndoRedo.current = true;
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            onChange(history[newIndex]);
        }
    }, [historyIndex, history, onChange]);

    const handleSave = useCallback(async () => {
        try {
            // Try modern File System Access API first
            if ('showSaveFilePicker' in window) {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: 'evaluation-prompt.txt',
                    types: [{
                        description: 'Text Files',
                        accept: { 'text/plain': ['.txt', '.md', '.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(value);
                await writable.close();
                showToast("Template saved to file", "success");
                return;
            }
        } catch (err: any) {
            // Ignore user cancellation
            if (err.name === 'AbortError') return;
            console.warn('File System Access API failed, falling back to download', err);
        }

        // Fallback to legacy download
        const blob = new Blob([value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'evaluation-prompt.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [value]);

    const handleLoad = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleBackendSave = useCallback(async () => {
        if (!onSaveToBackend) return;
        const success = await onSaveToBackend(newBackendName, value);
        if (success) {
            setIsSavingToBackend(false);
            setNewBackendName("");
        }
    }, [onSaveToBackend, newBackendName, value]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result as string;
                onChange(content);
            };
            reader.readAsText(file);
        }
        // Reset input so same file can be loaded again
        e.target.value = '';
    }, [onChange]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    handleRedo();
                } else {
                    handleUndo();
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleUndo, handleRedo, handleSave, onClose]);

    // Focus textarea when modal opens
    useEffect(() => {
        if (isOpen && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-[90vw] max-w-4xl h-[80vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Custom Evaluation Prompt Editor
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <button
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Undo (Cmd/Ctrl+Z)"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Undo
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Redo (Cmd/Ctrl+Shift+Z)"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                        </svg>
                        Redo
                    </button>

                    <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

                    <button
                        onClick={handleSave}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Save to file (Cmd/Ctrl+S)"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Save
                    </button>
                    <button
                        onClick={handleLoad}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Load from file"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Load
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.md,.json"
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

                    <button
                        onClick={onLoadTemplate}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Load Template
                    </button>

                    {onSaveToBackend && (
                        <button
                            onClick={() => setIsSavingToBackend(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                            title="Save as a new template to the backend"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            Save to Cloud
                        </button>
                    )}

                    <div className="flex-1" />

                    <span className="text-xs text-gray-400">
                        {value.length} chars
                    </span>
                </div>

                {/* Backend Save Overlay */}
                {isSavingToBackend && (
                    <div className="mx-4 mt-2 mb-0 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 animate-in fade-in slide-in-from-top-2 duration-200 shadow-inner flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider whitespace-nowrap">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                New Name
                            </div>
                            <input
                                type="text"
                                value={newBackendName}
                                onChange={e => setNewBackendName(e.target.value)}
                                placeholder="Enter a name for this template..."
                                className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 flex-1 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                autoFocus
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleBackendSave();
                                    if (e.key === 'Escape') setIsSavingToBackend(false);
                                }}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleBackendSave}
                                className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 shadow-sm font-medium transition-colors"
                            >
                                Confirm Save
                            </button>
                            <button
                                onClick={() => setIsSavingToBackend(false)}
                                className="px-3 py-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Persistent Validation Notice for Modal */}
                {(() => {
                    const required = ['{{conversation_transcript}}', '{{guardrail_configuration_table}}', '{{kore_genai_logs}}'];
                    const missing = required.filter(r => !value.includes(r));
                    if (missing.length > 0) {
                        return (
                            <div className="mx-4 mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-center gap-2 text-xs text-red-600 dark:text-red-400 animate-pulse">
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>
                                    <strong>Saving Disabled:</strong> Missing {missing.length} required variables: {missing.join(', ')}
                                </span>
                            </div>
                        );
                    }
                    return null;
                })()}

                {/* Editor */}
                <div className="flex-1 p-4 overflow-hidden">
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full h-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)] focus:border-transparent"
                        placeholder="Enter your custom evaluation prompt here...

Available variables:
- {{user_input}} - The user's message
- {{bot_response}} - The bot's response
- {{restricted_topics}} - Banned topics list
- {{filter_regex}} - Regex patterns
- {{active_guardrails}} - Active guardrail types"
                        spellCheck={false}
                    />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <p className="text-xs text-gray-500">
                        Press <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Esc</kbd> to close
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[var(--primary-500)] text-white rounded-lg hover:bg-[var(--primary-600)] transition-colors font-medium"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
