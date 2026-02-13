import { useState, useRef, useEffect, useCallback } from 'react';
import { useNotification } from '../context/NotificationContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    value: string;
    onChange: (value: string) => void;
    onSaveToBackend?: (name: string, text: string) => Promise<boolean>;
    systemPrompt?: string;
    onSystemPromptChange?: (value: string) => void;
    systemPromptEnabled?: boolean;
    onSystemPromptEnabledChange?: (enabled: boolean) => void;
}

export default function PromptEditorModal({ isOpen, onClose, value, onChange, onSaveToBackend, systemPrompt, onSystemPromptChange, systemPromptEnabled, onSystemPromptEnabledChange }: Props) {
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
            <div className="relative w-[90vw] max-w-4xl h-[80vh] bg-[var(--surface)] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--background)]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-semibold text-[var(--foreground)]">
                            Custom Evaluation Prompt Editor
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                    >
                        <svg className="w-5 h-5 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-2 p-3 border-b border-[var(--border)] bg-[var(--surface)]">
                    <button
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--foreground-secondary)] rounded-md border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Undo (Cmd/Ctrl+Z)"
                    >
                        <svg className="w-4 h-4 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Undo
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--foreground-secondary)] rounded-md border border-[var(--border)] hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Redo (Cmd/Ctrl+Shift+Z)"
                    >
                        <svg className="w-4 h-4 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                        </svg>
                        Redo
                    </button>

                    <div className="w-px h-6 bg-[var(--border)] mx-1" />

                    <button
                        onClick={handleSave}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--foreground-secondary)] rounded-md border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
                        title="Save to file (Cmd/Ctrl+S)"
                    >
                        <svg className="w-4 h-4 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Save
                    </button>
                    <button
                        onClick={handleLoad}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--foreground-secondary)] rounded-md border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
                        title="Load from file"
                    >
                        <svg className="w-4 h-4 text-[var(--foreground-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                    {onSaveToBackend && (
                        <button
                            onClick={() => setIsSavingToBackend(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-[var(--primary-500)] text-white hover:bg-[var(--primary-600)] transition-colors shadow-sm"
                            title="Save as a new template to the backend"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            Save to Cloud
                        </button>
                    )}

                    <div className="flex-1" />

                    <span className="text-xs text-[var(--foreground-muted)]">
                        {value.length} chars
                    </span>
                </div>

                {/* Backend Save Overlay */}
                {isSavingToBackend && (
                    <div className="mx-4 mt-2 mb-0 bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-lg border border-indigo-200 dark:border-indigo-500/30 animate-in fade-in slide-in-from-top-2 duration-200 shadow-inner flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider whitespace-nowrap">
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
                                className="text-sm border border-[var(--border)] rounded-md px-3 py-1.5 flex-1 bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
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
                                className="px-4 py-1.5 bg-[var(--primary-500)] text-white text-sm rounded-md hover:bg-[var(--primary-600)] shadow-sm font-medium transition-colors"
                            >
                                Confirm Save
                            </button>
                            <button
                                onClick={() => setIsSavingToBackend(false)}
                                className="px-3 py-1.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)] text-sm font-medium"
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
                            <div className="mx-4 mt-2 p-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-md flex items-center gap-2 text-xs text-red-600 dark:text-red-400 animate-pulse">
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
                <div className="flex-1 p-4 overflow-hidden flex flex-col">
                    <div className="flex-1 flex flex-col border border-[var(--border)] rounded-lg overflow-hidden min-h-0">
                        {/* System Instructions Section */}
                        {onSystemPromptEnabledChange && (
                            <div className={`shrink-0 border-b ${systemPromptEnabled ? 'border-amber-200 dark:border-amber-500/30' : 'border-[var(--border)]'}`}>
                                <div className={`flex items-center gap-2 px-4 py-2 ${systemPromptEnabled ? 'bg-amber-50/70 dark:bg-amber-500/10' : 'bg-[var(--background)]'}`}>
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={systemPromptEnabled || false}
                                            onChange={(e) => {
                                                onSystemPromptEnabledChange(e.target.checked);
                                                if (!e.target.checked && onSystemPromptChange) {
                                                    onSystemPromptChange('');
                                                }
                                            }}
                                            className="w-3.5 h-3.5 rounded border-[var(--border)] text-amber-500 focus:ring-amber-400 cursor-pointer"
                                        />
                                        <svg className={`w-4 h-4 ${systemPromptEnabled ? 'text-amber-500' : 'text-[var(--foreground-muted)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                        <span className={`text-xs font-semibold uppercase tracking-wider ${systemPromptEnabled ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--foreground-muted)]'}`}>
                                            System Instructions
                                        </span>
                                    </label>
                                </div>
                                {systemPromptEnabled && (
                                    <textarea
                                        value={systemPrompt || ''}
                                        onChange={(e) => onSystemPromptChange?.(e.target.value)}
                                        placeholder="Enter system instructions for the evaluation model..."
                                        className="w-full text-sm font-mono h-24 border-0 border-t border-amber-100 dark:border-amber-500/20 p-4 focus:ring-0 focus:outline-none bg-amber-50/30 dark:bg-amber-500/5 text-[var(--foreground)] resize-y"
                                        spellCheck={false}
                                    />
                                )}
                            </div>
                        )}

                        {/* User Prompt Section */}
                        <div className="flex-1 flex flex-col min-h-0">
                            {onSystemPromptEnabledChange && (
                                <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-[var(--background)] border-b border-[var(--border)]">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">User Prompt</span>
                                </div>
                            )}
                            <textarea
                                ref={textareaRef}
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                className="w-full flex-1 p-4 bg-[var(--surface)] text-[var(--foreground)] font-mono text-sm resize-none focus:outline-none"
                                placeholder="Enter your custom evaluation prompt here..."
                                spellCheck={false}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-[var(--border)] bg-[var(--background)]">
                    <p className="text-xs text-[var(--foreground-muted)]">
                        Press <kbd className="px-1.5 py-0.5 bg-[var(--surface-hover)] rounded text-xs">Esc</kbd> to close
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
