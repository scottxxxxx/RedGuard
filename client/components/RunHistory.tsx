"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { EvaluationResultsView, parseEvaluationOutput } from './EvaluationResultsView';

interface EvaluationRun {
    id: string;
    sessionId?: string | null;
    userInput: string;
    botResponse: string;
    promptSent: string;
    llmOutput: string;
    toxicityPass: boolean | null | string;
    topicsPass: boolean | null | string;
    injectionPass: boolean | null | string;
    regexPass: boolean | null | string;
    overallPass: boolean;
    isAttack: boolean;
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number;
    latencyMs?: number | null;
    model?: string | null;
    createdAt: string;
}

interface AttackMessage {
    id: string;
    sessionId: string;
    messageContent: string;
    category: string;
    turnIndex: number | null;
    timestamp: string;
}

const PassFailBadge = ({ pass }: { pass: boolean | null | string }) => {
    if (pass === null || pass === 'N/A') return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: 'rgba(115,115,115,0.08)', color: '#737373' }}>Not Tested</span>
    );
    return pass ? (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: 'rgba(34,197,94,0.08)', color: '#22c55e' }}>Pass</span>
    ) : (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>Fail</span>
    );
};

// ── Column Configuration ──────────────────────────────────────────────────

interface ColumnDef {
    id: string;
    label: string;
    minWidth: number;
    defaultWidth: number;
    align: 'left' | 'center';
}

const ALL_COLUMNS: ColumnDef[] = [
    { id: 'time', label: 'Time', minWidth: 80, defaultWidth: 100, align: 'left' },
    { id: 'conversation', label: 'Conversation', minWidth: 150, defaultWidth: 280, align: 'left' },
    { id: 'sessionId', label: 'Bot Session ID', minWidth: 100, defaultWidth: 200, align: 'left' },
    { id: 'model', label: 'Model', minWidth: 80, defaultWidth: 120, align: 'left' },
    { id: 'prompt', label: 'Prompt', minWidth: 80, defaultWidth: 140, align: 'left' },
    { id: 'toxicity', label: 'Toxicity', minWidth: 70, defaultWidth: 90, align: 'center' },
    { id: 'topics', label: 'Topics', minWidth: 70, defaultWidth: 90, align: 'center' },
    { id: 'injection', label: 'Injection', minWidth: 70, defaultWidth: 90, align: 'center' },
    { id: 'regex', label: 'Regex', minWidth: 70, defaultWidth: 90, align: 'center' },
    { id: 'overall', label: 'Overall', minWidth: 70, defaultWidth: 90, align: 'center' },
];

interface ColumnConfig {
    order: string[];
    visible: string[];
    widths: Record<string, number>;
}

const DEFAULT_COLUMN_CONFIG: ColumnConfig = {
    order: ALL_COLUMNS.map(c => c.id),
    visible: ALL_COLUMNS.map(c => c.id),
    widths: Object.fromEntries(ALL_COLUMNS.map(c => [c.id, c.defaultWidth])),
};

// ── Prompt & Conversation Helpers ─────────────────────────────────────────

// Parse conversation history from prompt to count turns
const parseConversation = (promptSent: string) => {
    if (!promptSent) return [];

    const turns: { role: 'user' | 'bot', content: string }[] = [];
    let searchableText = promptSent;

    // Strategy 0: If prompt is JSON (Request Payload), extract the content
    try {
        if (promptSent.trim().startsWith('{')) {
            const json = JSON.parse(promptSent);
            if (json.messages && Array.isArray(json.messages)) {
                searchableText = json.messages.map((m: any) => m.content).join('\n\n');
            } else if (json.input && Array.isArray(json.input)) {
                // OpenAI Responses API format
                searchableText = json.input.map((m: any) => m.content).join('\n\n');
            } else if (json.contents && Array.isArray(json.contents)) {
                searchableText = json.contents.map((c: any) => c.parts?.[0]?.text || '').join('\n\n');
            }
        }
    } catch (e) {
        // Not JSON, continue with raw text
    }

    // Strategy 0.5: If text has === USER PROMPT === header, extract just that section
    const userPromptSection = searchableText.match(/=== USER PROMPT ===\s*([\s\S]*?)$/i);
    if (userPromptSection) {
        searchableText = userPromptSection[1];
    }

    // Strategy 1: Look for the transcript section — support both --- and ## as delimiters
    const transcriptMatch = searchableText.match(/##+ Conversation Transcript\s*([\s\S]*?)\s*(?:---|##[^#])/i);
    const textToAnalyze = transcriptMatch ? transcriptMatch[1] : searchableText;

    // Strategy 2: Robust Regex for "User: \"text\"" or "Bot: \"text\""
    const pattern = /(?:- )?(User|Bot|user|bot):\s*"?([^]*?)(?="?\s*(?:\n(?:- )?(?:User|Bot|user|bot):|\nInput Data:|\n\n|###|##|---|$))/gi;
    let match;

    while ((match = pattern.exec(textToAnalyze)) !== null) {
        const roleStr = match[1].toLowerCase();
        const role = roleStr.includes('user') ? 'user' : 'bot';
        let content = match[2].trim();
        content = content.replace(/^"|"$/g, '').trim();

        if (content && content !== '{{conversation_transcript}}' && content !== '{{conversation_history}}') {
            turns.push({ role, content });
        }
    }

    // Strategy 3: Line-by-line fallback if regex failed
    if (turns.length === 0) {
        const lines = textToAnalyze.split('\n');
        let currentRole: 'user' | 'bot' | null = null;
        let currentContent: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            const lowerLine = trimmed.toLowerCase();

            const isUser = lowerLine.startsWith('user:') || lowerLine.startsWith('- user:');
            const isBot = lowerLine.startsWith('bot:') || lowerLine.startsWith('- bot:');

            if (isUser || isBot) {
                if (currentRole && currentContent.length > 0) {
                    const content = currentContent.join('\n').replace(/^"|"$/g, '').trim();
                    if (content && content !== '{{conversation_transcript}}' && content !== '{{conversation_history}}') {
                        turns.push({ role: currentRole, content });
                    }
                }
                currentRole = isUser ? 'user' : 'bot';
                const prefixMatch = trimmed.match(/^(?:- )?(?:user|bot):\s*/i);
                currentContent = [trimmed.substring(prefixMatch ? prefixMatch[0].length : 0).trim()];
            } else if (currentRole && trimmed && !trimmed.startsWith('##') && !trimmed.startsWith('---')) {
                currentContent.push(trimmed);
            }
        }

        if (currentRole && currentContent.length > 0) {
            const content = currentContent.join('\n').replace(/^"|"$/g, '').trim();
            if (content && content !== '{{conversation_transcript}}' && content !== '{{conversation_history}}') {
                turns.push({ role: currentRole, content });
            }
        }
    }

    return turns;
};

// Get last message of a role
const getLastMessage = (text: string, promptSent: string) => {
    if (text.length < 100 && !text.includes('\n')) {
        return { text, turnCount: 1 };
    }

    const turns = parseConversation(promptSent);
    const userTurns = turns.filter(t => t.role === 'user');
    const botTurns = turns.filter(t => t.role === 'bot');

    return {
        text: text,
        turnCount: Math.max(userTurns.length, botTurns.length) || 1
    };
};


// Derive prompt template label from model name
const getPromptLabel = (run: EvaluationRun): string => {
    const model = (run.model || '').toLowerCase();
    if (model.startsWith('gpt-5')) return 'GPT 5.x';
    if (model.startsWith('o3') || model.startsWith('o4')) return 'GPT 5.x';
    if (model.startsWith('claude')) return 'Opus';
    if (model.startsWith('gemini')) return 'Gemini';
    if (model.startsWith('deepseek')) return 'DeepSeek';
    if (model.startsWith('qwen')) return 'Qwen';
    if (model.startsWith('kimi')) return 'Kimi';
    return 'Default';
};

// ── Component ─────────────────────────────────────────────────────────────

interface RunHistoryProps {
    botId?: string;
}

export default function RunHistory({ botId }: RunHistoryProps) {
    const { userId } = useUser();
    const [runs, setRuns] = useState<EvaluationRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [attackMessages, setAttackMessages] = useState<{ [sessionId: string]: AttackMessage[] }>({});
    const [expandedModal, setExpandedModal] = useState<{ type: 'prompt' | 'output', content: string } | null>(null);
    const pageSize = 10;

    // Column configuration
    const [columnConfig, setColumnConfig] = useState<ColumnConfig>(DEFAULT_COLUMN_CONFIG);
    const [showColumnSettings, setShowColumnSettings] = useState(false);
    const [resizing, setResizing] = useState<{ colId: string; startX: number; startWidth: number } | null>(null);
    const settingsRef = useRef<HTMLDivElement>(null);

    // Load column config from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('runhistory_columns');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults so new columns are included
                const allIds = ALL_COLUMNS.map(c => c.id);
                const savedOrder = (parsed.order || []).filter((id: string) => allIds.includes(id));
                const newCols = allIds.filter(id => !savedOrder.includes(id));
                setColumnConfig({
                    order: [...savedOrder, ...newCols],
                    visible: parsed.visible?.length ? parsed.visible : DEFAULT_COLUMN_CONFIG.visible,
                    widths: { ...DEFAULT_COLUMN_CONFIG.widths, ...(parsed.widths || {}) },
                });
            }
        } catch { /* ignore */ }
    }, []);

    // Persist column config
    useEffect(() => {
        localStorage.setItem('runhistory_columns', JSON.stringify(columnConfig));
    }, [columnConfig]);

    // Column resize mouse handling
    useEffect(() => {
        if (!resizing) return;
        const onMove = (e: MouseEvent) => {
            const col = ALL_COLUMNS.find(c => c.id === resizing.colId);
            const minW = col?.minWidth || 50;
            const newWidth = Math.max(minW, resizing.startWidth + (e.clientX - resizing.startX));
            setColumnConfig(prev => ({ ...prev, widths: { ...prev.widths, [resizing.colId]: newWidth } }));
        };
        const onUp = () => setResizing(null);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    }, [resizing]);

    // Close column settings on outside click
    useEffect(() => {
        if (!showColumnSettings) return;
        const handler = (e: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
                setShowColumnSettings(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showColumnSettings]);

    // Column helpers
    const toggleColumn = (colId: string) => {
        setColumnConfig(prev => ({
            ...prev,
            visible: prev.visible.includes(colId)
                ? prev.visible.filter(id => id !== colId)
                : [...prev.visible, colId]
        }));
    };

    const moveColumn = (colId: string, direction: 'up' | 'down') => {
        setColumnConfig(prev => {
            const order = [...prev.order];
            const idx = order.indexOf(colId);
            if (idx < 0) return prev;
            const newIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= order.length) return prev;
            [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
            return { ...prev, order };
        });
    };

    const visibleColumns = columnConfig.order.filter(id => columnConfig.visible.includes(id));

    // Data fetching
    const fetchRuns = useCallback(async () => {
        if (!userId) return; // Don't fetch if no user ID

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            const res = await fetch(`${apiUrl}/runs?userId=${userId}`);
            if (res.ok) {
                const data = await res.json();
                setRuns(data);

                const sessionIds = [...new Set(data.map((run: EvaluationRun) => run.sessionId).filter(Boolean))] as string[];
                const attackData: { [sessionId: string]: AttackMessage[] } = {};

                await Promise.all(sessionIds.map(async (sessionId) => {
                    try {
                        const attackRes = await fetch(`${apiUrl}/attack-messages/${sessionId}`);
                        if (attackRes.ok) {
                            attackData[sessionId] = await attackRes.json();
                        }
                    } catch (err) {
                        console.error(`[RunHistory] Failed to fetch attacks for session ${sessionId}:`, err);
                    }
                }));

                setAttackMessages(attackData);
            }
        } catch (error) {
            console.error('Failed to fetch runs:', error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchRuns();
    }, [fetchRuns]);

    const getRunTurns = (run: EvaluationRun) => {
        let turns = parseConversation(run.promptSent);
        if (turns.length === 0 && (run.userInput.includes('User:') || run.userInput.includes('Bot:'))) {
            turns = parseConversation(run.userInput);
        }
        return turns;
    };

    const clearAllRuns = async () => {
        if (!confirm('Are you sure you want to clear all run history?')) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            await fetch(`${apiUrl}/runs`, { method: 'DELETE' });
            setRuns([]);
            setCurrentPage(1);
        } catch (error) {
            console.error('Failed to clear runs:', error);
        }
    };

    const exportToCSV = async () => {
        if (runs.length === 0) return;

        const escapeCSV = (value: string | boolean | null) => {
            if (value === null) return 'N/A';
            if (typeof value === 'boolean') return value ? 'Pass' : 'Fail';
            let str = String(value);
            str = str.replace(/\r\n/g, ' | ').replace(/\n/g, ' | ').replace(/\r/g, ' | ');
            if (str.includes(',') || str.includes('"')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headers = ['Timestamp', 'User Input', 'Bot Response', 'Model', 'Toxicity', 'Topics', 'Injection', 'Regex', 'Overall', 'Prompt Sent', 'LLM Output'];
        const rows = runs.map(run => [
            new Date(run.createdAt).toLocaleString(),
            escapeCSV(run.userInput),
            escapeCSV(run.botResponse),
            run.model || '-',
            escapeCSV(run.toxicityPass),
            escapeCSV(run.topicsPass),
            escapeCSV(run.injectionPass),
            escapeCSV(run.regexPass),
            run.overallPass ? 'Pass' : 'Fail',
            escapeCSV(run.promptSent),
            escapeCSV(run.llmOutput)
        ]);

        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const botIdSuffix = botId ? botId.slice(-6) : '000000';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const defaultFilename = `GuardrailEval_Bot${botIdSuffix}_${timestamp}.csv`;

        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: defaultFilename,
                    types: [{ description: 'CSV file', accept: { 'text/csv': ['.csv'] } }]
                });
                const writable = await handle.createWritable();
                await writable.write(csvContent);
                await writable.close();
                return;
            } catch (err: any) {
                if (err.name === 'AbortError') return;
            }
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', defaultFilename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const truncate = (text: string, maxLen: number = 50) => {
        if (text.length <= maxLen) return text;
        return text.substring(0, maxLen) + '...';
    };

    // ── Cell Renderer ─────────────────────────────────────────────────────

    const renderCell = (colId: string, run: EvaluationRun, turns: { role: 'user' | 'bot'; content: string }[], turnCount: number) => {
        switch (colId) {
            case 'time':
                return (
                    <td key={colId} className="py-2 px-2 text-xs text-[var(--foreground-muted)] whitespace-nowrap overflow-hidden">
                        {new Date(run.createdAt).toLocaleTimeString()}
                    </td>
                );
            case 'conversation':
                return (
                    <td key={colId} className="py-2 px-2 overflow-hidden">
                        <div className="flex items-center gap-2">
                            <span className="shrink-0 px-1.5 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700">
                                {turnCount} {turnCount === 1 ? 'turn' : 'turns'}
                            </span>
                            <div className="flex flex-col min-w-0">
                                <span className={`text-xs truncate ${run.isAttack ? 'text-red-600 font-bold' : 'text-blue-600'}`} title={run.userInput}>
                                    {run.isAttack && <span className="mr-1">🚨</span>}
                                    <strong>U:</strong> {truncate(turns.filter(t => t.role === 'user').pop()?.content || run.userInput, 40)}
                                </span>
                                <span className="text-xs text-gray-600 truncate" title={run.botResponse}>
                                    <strong>B:</strong> {truncate(turns.filter(t => t.role === 'bot').pop()?.content || run.botResponse, 40)}
                                </span>
                            </div>
                        </div>
                    </td>
                );
            case 'sessionId':
                return (
                    <td key={colId} className="py-2 px-2 text-xs font-mono text-[var(--foreground-muted)] truncate overflow-hidden">
                        {run.sessionId || '-'}
                    </td>
                );
            case 'model':
                return (
                    <td key={colId} className="py-2 px-2 text-xs font-mono text-[var(--foreground-muted)] truncate overflow-hidden">
                        {run.model || '-'}
                    </td>
                );
            case 'prompt':
                return (
                    <td key={colId} className="py-2 px-2 text-xs overflow-hidden">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-[var(--bg-tertiary,#f3f4f6)] text-[var(--foreground-secondary,#4b5563)]">
                            {getPromptLabel(run)}
                        </span>
                    </td>
                );
            case 'toxicity':
                return <td key={colId} className="py-2 px-2 text-center"><PassFailBadge pass={run.toxicityPass} /></td>;
            case 'topics':
                return <td key={colId} className="py-2 px-2 text-center"><PassFailBadge pass={run.topicsPass} /></td>;
            case 'injection':
                return <td key={colId} className="py-2 px-2 text-center"><PassFailBadge pass={run.injectionPass} /></td>;
            case 'regex':
                return <td key={colId} className="py-2 px-2 text-center"><PassFailBadge pass={run.regexPass} /></td>;
            case 'overall':
                return (
                    <td key={colId} className="py-2 px-2 text-center">
                        {run.overallPass ? (
                            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-600 text-white">PASS</span>
                        ) : (
                            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-600 text-white">FAIL</span>
                        )}
                    </td>
                );
            default:
                return <td key={colId} />;
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="card p-6">
                <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="card p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[var(--primary-50)] flex items-center justify-center">
                        <svg className="w-4 h-4 text-[var(--primary-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <h3 className="text-base font-semibold text-[var(--foreground)]">
                        Evaluation History
                    </h3>
                    <span className="text-xs text-[var(--foreground-muted)] ml-2">
                        ({runs.length} runs)
                    </span>
                </div>
                {runs.length > 0 && (
                    <div className="flex items-center gap-2">
                        {/* Column Settings */}
                        <div className="relative" ref={settingsRef}>
                            <button
                                onClick={() => setShowColumnSettings(!showColumnSettings)}
                                className="text-xs flex items-center gap-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)] font-medium px-2 py-1 rounded hover:bg-[var(--surface-hover)] transition-colors"
                                title="Configure columns"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                </svg>
                                Columns
                            </button>
                            {showColumnSettings && (
                                <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--surface,#fff)] border border-[var(--border)] rounded-lg shadow-lg p-3 w-72">
                                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-[var(--border)]">
                                        <span className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wide">Configure Columns</span>
                                        <button
                                            onClick={() => { setColumnConfig(DEFAULT_COLUMN_CONFIG); }}
                                            className="text-[10px] text-[var(--primary-600)] hover:text-[var(--primary-700)] font-medium"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                    <div className="space-y-0.5 max-h-80 overflow-y-auto">
                                        {columnConfig.order.map((colId, idx) => {
                                            const col = ALL_COLUMNS.find(c => c.id === colId);
                                            if (!col) return null;
                                            const isVisible = columnConfig.visible.includes(colId);
                                            return (
                                                <div key={colId} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-[var(--surface-hover)] group">
                                                    <input
                                                        type="checkbox"
                                                        checked={isVisible}
                                                        onChange={() => toggleColumn(colId)}
                                                        className="rounded border-gray-300 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] w-3.5 h-3.5"
                                                    />
                                                    <span className={`text-xs flex-1 ${isVisible ? 'text-[var(--foreground)]' : 'text-[var(--foreground-muted)]'}`}>
                                                        {col.label}
                                                    </span>
                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => moveColumn(colId, 'up')}
                                                            disabled={idx === 0}
                                                            className="p-0.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)] disabled:opacity-20"
                                                            title="Move up"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => moveColumn(colId, 'down')}
                                                            disabled={idx === columnConfig.order.length - 1}
                                                            className="p-0.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)] disabled:opacity-20"
                                                            title="Move down"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-[var(--border)] text-[10px] text-[var(--foreground-muted)]">
                                        Drag column borders to resize. Use arrows to reorder.
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={exportToCSV}
                            className="text-xs flex items-center gap-1 text-green-600 hover:text-green-700 font-medium px-2 py-1 rounded hover:bg-green-50 transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export CSV
                        </button>
                        <button
                            onClick={clearAllRuns}
                            className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        >
                            Clear All
                        </button>
                    </div>
                )}
            </div>

            {runs.length === 0 ? (
                <div className="text-center py-8 text-[var(--foreground-muted)]">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-sm">No evaluation runs yet.</p>
                    <p className="text-xs mt-1">Runs will appear here after you evaluate a response.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                        <thead>
                            <tr className="border-b border-[var(--border)]">
                                {visibleColumns.map(colId => {
                                    const col = ALL_COLUMNS.find(c => c.id === colId)!;
                                    return (
                                        <th
                                            key={colId}
                                            className={`${col.align === 'center' ? 'text-center' : 'text-left'} py-2 px-2 font-medium text-[var(--foreground-muted)] relative select-none`}
                                            style={{ width: columnConfig.widths[colId] || col.defaultWidth }}
                                        >
                                            {col.label}
                                            <div
                                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--primary-200)] active:bg-[var(--primary-400)] transition-colors"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setResizing({
                                                        colId,
                                                        startX: e.clientX,
                                                        startWidth: columnConfig.widths[colId] || col.defaultWidth
                                                    });
                                                }}
                                            />
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {runs.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((run) => {
                                const turns = getRunTurns(run);
                                const turnCount = Math.max(turns.filter(t => t.role === 'user').length, 1);

                                return (
                                    <React.Fragment key={run.id}>
                                        <tr
                                            className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                                            onClick={() => setExpandedRow(expandedRow === run.id ? null : run.id)}
                                        >
                                            {visibleColumns.map(colId => renderCell(colId, run, turns, turnCount))}
                                        </tr>
                                        {expandedRow === run.id && (
                                            <tr className="bg-[var(--surface-hover)]">
                                                <td colSpan={visibleColumns.length} className="p-4">
                                                    <div className="space-y-4">
                                                        {/* Structured Evaluation Results */}
                                                        {(() => {
                                                            const parsedData = parseEvaluationOutput(run.llmOutput);
                                                            if (parsedData) {
                                                                return (
                                                                    <EvaluationResultsView
                                                                        resultData={parsedData}
                                                                        model={run.model}
                                                                        totalTokens={run.totalTokens}
                                                                        inputTokens={run.inputTokens}
                                                                        outputTokens={run.outputTokens}
                                                                        latencyMs={run.latencyMs}
                                                                    />
                                                                );
                                                            }
                                                            return null;
                                                        })()}

                                                        {/* Conversation View */}
                                                        <div>
                                                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-2">
                                                                Conversation {turns.length > 0 && `(${Math.ceil(turns.length / 2)} turns)`}
                                                            </h4>
                                                            <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] p-4 max-h-96 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-gray-300">
                                                                {turns.length > 0 ? (
                                                                    (() => {
                                                                        const sessionAttacks = run.sessionId ? (attackMessages[run.sessionId] || []) : [];
                                                                        return turns.map((turn, idx) => {
                                                                            const attackInfo = turn.role === 'user'
                                                                                ? sessionAttacks.find(a => a.messageContent === turn.content)
                                                                                : null;
                                                                            const isAttackTurn = !!attackInfo;

                                                                            return (
                                                                                <div key={idx} className={`flex ${turn.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                                                                                    <div className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${turn.role === 'user'
                                                                                        ? (isAttackTurn ? 'bg-red-600 text-white border border-red-400 font-medium' : 'bg-blue-100 text-blue-900')
                                                                                        : 'bg-gray-100 text-gray-900'}`}>
                                                                                        <span className={`font-semibold text-[10px] uppercase tracking-wide opacity-60 ${isAttackTurn ? 'text-red-100' : ''}`}>
                                                                                            {turn.role === 'user' ? 'User' : 'Bot'}
                                                                                        </span>
                                                                                        {isAttackTurn && attackInfo && (
                                                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                                                <div className="text-[9px] font-bold uppercase tracking-wider text-red-100">
                                                                                                    🚨 Malicious Probe
                                                                                                </div>
                                                                                                <span className="px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide rounded-full bg-red-800/50 text-red-100 border border-red-400/30">
                                                                                                    {attackInfo.category}
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                        <p className="mt-0.5">{turn.content}</p>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        });
                                                                    })()
                                                                ) : (
                                                                    <div className="space-y-2">
                                                                        <div className="flex justify-start">
                                                                            <div className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${run.isAttack ? 'bg-red-600 text-white border border-red-400 font-medium' : 'bg-blue-100 text-blue-900'}`}>
                                                                                <span className={`font-semibold text-[10px] uppercase tracking-wide opacity-60 ${run.isAttack ? 'text-red-100' : ''}`}>User</span>
                                                                                {run.isAttack && (
                                                                                    <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5 text-red-100">🚨 Malicious Probe</div>
                                                                                )}
                                                                                <p className="mt-0.5">{run.userInput}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex justify-end">
                                                                            <div className="max-w-[80%] px-3 py-2 rounded-lg text-xs bg-gray-100 text-gray-900">
                                                                                <span className="font-semibold text-[10px] uppercase tracking-wide opacity-60">Bot</span>
                                                                                <p className="mt-0.5">{run.botResponse}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Raw LLM Details (collapsible) */}
                                                        <details className="text-xs">
                                                            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-2 select-none">
                                                                Raw LLM Details
                                                            </summary>
                                                            <div className="grid grid-cols-2 gap-4 mt-2">
                                                                <div>
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <h4 className="font-semibold text-[var(--foreground)]">Prompt Sent to LLM</h4>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setExpandedModal({ type: 'prompt', content: run.promptSent }); }}
                                                                            className="text-[var(--primary-600)] hover:text-[var(--primary-700)] p-1"
                                                                            title="Expand"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                    <pre className="bg-white dark:bg-gray-900 text-green-600 dark:text-green-400 p-2 rounded border border-[var(--border)] max-h-32 overflow-auto text-xs whitespace-pre-wrap">{run.promptSent}</pre>
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <h4 className="font-semibold text-[var(--foreground)]">LLM Output</h4>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setExpandedModal({ type: 'output', content: run.llmOutput }); }}
                                                                            className="text-[var(--primary-600)] hover:text-[var(--primary-700)] p-1"
                                                                            title="Expand"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                    <pre className="bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 p-2 rounded border border-[var(--border)] max-h-32 overflow-auto text-xs whitespace-pre-wrap">{run.llmOutput}</pre>
                                                                </div>
                                                            </div>
                                                        </details>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                    {/* Pagination */}
                    {runs.length > pageSize && (
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--border)]">
                            <span className="text-xs text-[var(--foreground-muted)]">
                                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, runs.length)} of {runs.length}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setExpandedRow(null); }}
                                    disabled={currentPage === 1}
                                    className="px-2 py-1 text-xs font-medium rounded border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    ← Prev
                                </button>
                                {Array.from({ length: Math.ceil(runs.length / pageSize) }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => { setCurrentPage(page); setExpandedRow(null); }}
                                        className={`w-7 h-7 text-xs font-medium rounded transition-colors ${page === currentPage
                                                ? 'bg-[var(--accent-primary,#4f46e5)] text-white'
                                                : 'text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    onClick={() => { setCurrentPage(p => Math.min(Math.ceil(runs.length / pageSize), p + 1)); setExpandedRow(null); }}
                                    disabled={currentPage === Math.ceil(runs.length / pageSize)}
                                    className="px-2 py-1 text-xs font-medium rounded border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Expanded Modal */}
            {expandedModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setExpandedModal(null)}>
                    <div className="bg-[var(--surface)] rounded-lg shadow-xl w-full max-w-6xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
                            <h3 className="text-lg font-medium text-[var(--foreground)]">
                                {expandedModal.type === 'prompt' ? 'Prompt Sent to LLM' : 'LLM Output'}
                            </h3>
                            <button onClick={() => setExpandedModal(null)} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] p-2 text-2xl">&times;</button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <pre className={`whitespace-pre-wrap text-sm ${expandedModal.type === 'prompt' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {expandedModal.content}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
