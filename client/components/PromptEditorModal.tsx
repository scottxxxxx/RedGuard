"use client";
import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    value: string;
    onChange: (value: string) => void;
    onLoadTemplate: () => void;
}

export default function PromptEditorModal({ isOpen, onClose, value, onChange, onLoadTemplate }: Props) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-[var(--primary-500)] text-white hover:bg-[var(--primary-600)] transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Load Template
                    </button>

                    <div className="flex-1" />

                    <span className="text-xs text-gray-400">
                        {value.length} chars
                    </span>
                </div>

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
