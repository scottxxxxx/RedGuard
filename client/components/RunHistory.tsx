"use client";
import React, { useState, useEffect } from 'react';

interface EvaluationRun {
    id: string;
    userInput: string;
    botResponse: string;
    promptSent: string;
    llmOutput: string;
    toxicityPass: boolean | null | string;
    topicsPass: boolean | null | string;
    injectionPass: boolean | null | string;
    regexPass: boolean | null | string;
    overallPass: boolean;
    createdAt: string;
}

const PassFailBadge = ({ pass }: { pass: boolean | null | string }) => {
    if (pass === null || pass === 'N/A') return <span className="text-gray-400 text-xs">N/A</span>;
    return pass ? (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Pass</span>
    ) : (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">Fail</span>
    );
};

// Parse conversation history from prompt to count turns
const parseConversation = (promptSent: string) => {
    if (!promptSent) return [];

    const turns: { role: 'user' | 'bot', content: string }[] = [];

    // Strategy 1: Look specifically for the transcript section in v4 prompts
    const transcriptMatch = promptSent.match(/## Conversation Transcript\s*([^]*?)\s*---/i);
    const searchableText = transcriptMatch ? transcriptMatch[1] : promptSent;

    // Strategy 2: Robust Regex for "User: \"text\"" or "Bot: \"text\""
    // Also handles the "- user:" format from older prompts
    const pattern = /(?:- )?(User|Bot|user|bot):\s*"?([^]*?)(?="?\s*(?:\n(?:- )?(?:User|Bot|user|bot):|\nInput Data:|\n\n|##|---|$))/gi;
    let match;

    while ((match = pattern.exec(searchableText)) !== null) {
        const roleStr = match[1].toLowerCase();
        const role = roleStr.includes('user') ? 'user' : 'bot';
        let content = match[2].trim();

        // Clean up quotes if present
        content = content.replace(/^"|"$/g, '').trim();

        if (content && content !== '{{conversation_transcript}}') {
            turns.push({ role, content });
        }
    }

    // Strategy 3: Line-by-line fallback if regex failed
    if (turns.length === 0) {
        const lines = searchableText.split('\n');
        let currentRole: 'user' | 'bot' | null = null;
        let currentContent: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            const lowerLine = trimmed.toLowerCase();

            const isUser = lowerLine.startsWith('user:') || lowerLine.startsWith('- user:');
            const isBot = lowerLine.startsWith('bot:') || lowerLine.startsWith('- bot:');

            if (isUser || isBot) {
                // Save previous turn
                if (currentRole && currentContent.length > 0) {
                    const content = currentContent.join('\n').replace(/^"|"$/g, '').trim();
                    if (content && content !== '{{conversation_transcript}}') {
                        turns.push({ role: currentRole, content });
                    }
                }

                currentRole = isUser ? 'user' : 'bot';
                // Remove prefix
                const prefixMatch = trimmed.match(/^(?:- )?(?:user|bot):\s*/i);
                currentContent = [trimmed.substring(prefixMatch ? prefixMatch[0].length : 0).trim()];
            } else if (currentRole && trimmed && !trimmed.startsWith('##') && !trimmed.startsWith('---')) {
                currentContent.push(trimmed);
            }
        }

        // Save last turn
        if (currentRole && currentContent.length > 0) {
            const content = currentContent.join('\n').replace(/^"|"$/g, '').trim();
            if (content && content !== '{{conversation_transcript}}') {
                turns.push({ role: currentRole, content });
            }
        }
    }

    return turns;
};

// Get last message of a role
const getLastMessage = (text: string, promptSent: string) => {
    // If the text looks like it could be a single message (short), just return it
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

interface RunHistoryProps {
    botId?: string;
}

export default function RunHistory({ botId }: RunHistoryProps) {
    const [runs, setRuns] = useState<EvaluationRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const fetchRuns = async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            const res = await fetch(`${apiUrl}/runs`);
            if (res.ok) {
                const data = await res.json();
                setRuns(data);
            }
        } catch (error) {
            console.error('Failed to fetch runs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRuns();
    }, []);

    const clearAllRuns = async () => {
        if (!confirm('Are you sure you want to clear all run history?')) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            await fetch(`${apiUrl}/runs`, { method: 'DELETE' });
            setRuns([]);
        } catch (error) {
            console.error('Failed to clear runs:', error);
        }
    };

    const exportToCSV = async () => {
        if (runs.length === 0) return;

        // Helper to escape CSV values (handle commas, quotes, newlines)
        const escapeCSV = (value: string | boolean | null) => {
            if (value === null) return 'N/A';
            if (typeof value === 'boolean') return value ? 'Pass' : 'Fail';
            let str = String(value);

            // Replace newlines with " | " for better Excel readability
            str = str.replace(/\r\n/g, ' | ').replace(/\n/g, ' | ').replace(/\r/g, ' | ');

            // If contains comma or quote, wrap in quotes and escape internal quotes
            if (str.includes(',') || str.includes('"')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        // CSV Headers
        const headers = [
            'Timestamp',
            'User Input',
            'Bot Response',
            'Toxicity',
            'Topics',
            'Injection',
            'Regex',
            'Overall',
            'Prompt Sent',
            'LLM Output'
        ];

        // CSV Rows
        const rows = runs.map(run => [
            new Date(run.createdAt).toLocaleString(),
            escapeCSV(run.userInput),
            escapeCSV(run.botResponse),
            escapeCSV(run.toxicityPass),
            escapeCSV(run.topicsPass),
            escapeCSV(run.injectionPass),
            escapeCSV(run.regexPass),
            run.overallPass ? 'Pass' : 'Fail',
            escapeCSV(run.promptSent),
            escapeCSV(run.llmOutput)
        ]);

        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        // Generate default filename: GuardrailEval_Bot######_timestamp.csv
        const botIdSuffix = botId ? botId.slice(-6) : '000000';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const defaultFilename = `GuardrailEval_Bot${botIdSuffix}_${timestamp}.csv`;

        // Try to use File System Access API for "Save As" dialog
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: defaultFilename,
                    types: [{
                        description: 'CSV file',
                        accept: { 'text/csv': ['.csv'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(csvContent);
                await writable.close();
                return;
            } catch (err: any) {
                // User cancelled or API not supported
                if (err.name === 'AbortError') return;
                console.warn('File System Access API failed, falling back to download:', err);
            }
        }

        // Fallback: standard download (for Firefox, Safari, or if API fails)
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
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--border)]">
                                <th className="text-left py-2 px-2 font-medium text-[var(--foreground-muted)]">Time</th>
                                <th className="text-left py-2 px-2 font-medium text-[var(--foreground-muted)]">Conversation</th>
                                <th className="text-center py-2 px-2 font-medium text-[var(--foreground-muted)]">Toxicity</th>
                                <th className="text-center py-2 px-2 font-medium text-[var(--foreground-muted)]">Topics</th>
                                <th className="text-center py-2 px-2 font-medium text-[var(--foreground-muted)]">Injection</th>
                                <th className="text-center py-2 px-2 font-medium text-[var(--foreground-muted)]">Regex</th>
                                <th className="text-center py-2 px-2 font-medium text-[var(--foreground-muted)]">Overall</th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map((run) => {
                                const turns = parseConversation(run.promptSent);
                                const turnCount = Math.max(turns.filter(t => t.role === 'user').length, 1);

                                return (
                                    <React.Fragment key={run.id}>
                                        <tr
                                            className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                                            onClick={() => setExpandedRow(expandedRow === run.id ? null : run.id)}
                                        >
                                            <td className="py-2 px-2 text-xs text-[var(--foreground-muted)] whitespace-nowrap">
                                                {new Date(run.createdAt).toLocaleTimeString()}
                                            </td>
                                            <td className="py-2 px-2 max-w-[300px]">
                                                <div className="flex items-center gap-2">
                                                    {turnCount > 1 && (
                                                        <span className="shrink-0 px-1.5 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700">
                                                            {turnCount} turns
                                                        </span>
                                                    )}
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-xs text-blue-600 truncate" title={run.userInput}>
                                                            <strong>U:</strong> {truncate(run.userInput, 40)}
                                                        </span>
                                                        <span className="text-xs text-gray-600 truncate" title={run.botResponse}>
                                                            <strong>B:</strong> {truncate(run.botResponse, 40)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2 px-2 text-center"><PassFailBadge pass={run.toxicityPass} /></td>
                                            <td className="py-2 px-2 text-center"><PassFailBadge pass={run.topicsPass} /></td>
                                            <td className="py-2 px-2 text-center"><PassFailBadge pass={run.injectionPass} /></td>
                                            <td className="py-2 px-2 text-center"><PassFailBadge pass={run.regexPass} /></td>
                                            <td className="py-2 px-2 text-center">
                                                {run.overallPass ? (
                                                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-600 text-white">PASS</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-600 text-white">FAIL</span>
                                                )}
                                            </td>
                                        </tr>
                                        {expandedRow === run.id && (
                                            <tr className="bg-[var(--surface-hover)]">
                                                <td colSpan={7} className="p-4">
                                                    <div className="space-y-4">
                                                        {/* Conversation View */}
                                                        <div>
                                                            <h4 className="font-semibold text-[var(--foreground)] mb-2 text-sm">
                                                                Conversation {turns.length > 0 && `(${Math.ceil(turns.length / 2)} turns)`}
                                                            </h4>
                                                            <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] p-4 max-h-96 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-gray-300">
                                                                {turns.length > 0 ? (
                                                                    turns.map((turn, idx) => (
                                                                        <div
                                                                            key={idx}
                                                                            className={`flex ${turn.role === 'user' ? 'justify-start' : 'justify-end'}`}
                                                                        >
                                                                            <div
                                                                                className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${turn.role === 'user'
                                                                                    ? 'bg-blue-100 text-blue-900'
                                                                                    : 'bg-gray-100 text-gray-900'
                                                                                    }`}
                                                                            >
                                                                                <span className="font-semibold text-[10px] uppercase tracking-wide opacity-60">
                                                                                    {turn.role === 'user' ? 'User' : 'Bot'}
                                                                                </span>
                                                                                <p className="mt-0.5">{turn.content}</p>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="space-y-2">
                                                                        <div className="flex justify-start">
                                                                            <div className="max-w-[80%] px-3 py-2 rounded-lg text-xs bg-blue-100 text-blue-900">
                                                                                <span className="font-semibold text-[10px] uppercase tracking-wide opacity-60">User</span>
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

                                                        {/* LLM Details */}
                                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                                            <div>
                                                                <h4 className="font-semibold text-[var(--foreground)] mb-1">Prompt Sent to LLM</h4>
                                                                <pre className="text-[var(--foreground-muted)] bg-gray-900 text-green-400 p-2 rounded border max-h-32 overflow-auto text-xs whitespace-pre-wrap">{run.promptSent}</pre>
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold text-[var(--foreground)] mb-1">LLM Output</h4>
                                                                <pre className="text-[var(--foreground-muted)] bg-gray-900 text-blue-400 p-2 rounded border max-h-32 overflow-auto text-xs whitespace-pre-wrap">{run.llmOutput}</pre>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
