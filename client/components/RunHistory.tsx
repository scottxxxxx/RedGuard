"use client";
import React, { useState, useEffect } from 'react';

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
                // OpenAI/Anthropic format
                searchableText = json.messages.map((m: any) => m.content).join('\n\n');
            } else if (json.contents && Array.isArray(json.contents)) {
                // Gemini format
                searchableText = json.contents.map((c: any) => c.parts?.[0]?.text || '').join('\n\n');
            }
        }
    } catch (e) {
        // Not JSON, continue with raw text
    }

    // Strategy 1: Look specifically for the transcript section in v4 prompts
    const transcriptMatch = searchableText.match(/## Conversation Transcript\s*([^]*?)\s*---/i) ||
        searchableText.match(/### Conversation Transcript\s*([^]*?)\s*---/i);
    const textToAnalyze = transcriptMatch ? transcriptMatch[1] : searchableText;

    // Strategy 2: Robust Regex for "User: \"text\"" or "Bot: \"text\""
    // Also handles the "- user:" format from older prompts
    const pattern = /(?:- )?(User|Bot|user|bot):\s*"?([^]*?)(?="?\s*(?:\n(?:- )?(?:User|Bot|user|bot):|\nInput Data:|\n\n|###|##|---|$))/gi;
    let match;

    while ((match = pattern.exec(textToAnalyze)) !== null) {
        const roleStr = match[1].toLowerCase();
        const role = roleStr.includes('user') ? 'user' : 'bot';
        let content = match[2].trim();

        // Clean up quotes if present
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

// Extract overall assessment from LLM output
const extractOverallAssessment = (llmOutput: string): { rating: string; comment: string } | null => {
    if (!llmOutput) return null;

    try {
        // Clean up the output - remove markdown code blocks if present
        let cleanOutput = llmOutput.trim();

        // First, try to parse as full API response (Anthropic format with content array)
        try {
            const apiResponse = JSON.parse(cleanOutput);

            // Check if it's an Anthropic API response with content array
            if (apiResponse.content && Array.isArray(apiResponse.content)) {
                // Extract the text from the first content block
                cleanOutput = apiResponse.content[0]?.text || cleanOutput;
            }
        } catch {
            // Not a JSON API response, continue with cleanOutput as-is
        }

        // Remove markdown json code blocks
        if (cleanOutput.startsWith('```json')) {
            cleanOutput = cleanOutput.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanOutput.startsWith('```')) {
            cleanOutput = cleanOutput.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        // Try to find JSON if there's text around it
        const jsonMatch = cleanOutput.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanOutput = jsonMatch[0];
        }

        const parsed = JSON.parse(cleanOutput);

        // Check for overall_assessment object at top level
        if (parsed.overall_assessment?.comment) {
            return {
                rating: parsed.overall_assessment.rating || 'unknown',
                comment: parsed.overall_assessment.comment
            };
        }

        // Check nested in bot_response_evaluation
        if (parsed.bot_response_evaluation?.overall_assessment?.comment) {
            return {
                rating: parsed.bot_response_evaluation.overall_assessment.rating || 'unknown',
                comment: parsed.bot_response_evaluation.overall_assessment.comment
            };
        }

        // Check nested in guardrail_system_performance
        if (parsed.guardrail_system_performance?.overall_assessment?.comment) {
            return {
                rating: parsed.guardrail_system_performance.overall_assessment.rating || 'unknown',
                comment: parsed.guardrail_system_performance.overall_assessment.comment
            };
        }

    } catch (e) {
        console.error('[RunHistory] Failed to parse LLM output:', e);
    }

    return null;
};

interface RunHistoryProps {
    botId?: string;
}

export default function RunHistory({ botId }: RunHistoryProps) {
    const [runs, setRuns] = useState<EvaluationRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [attackMessages, setAttackMessages] = useState<{ [sessionId: string]: AttackMessage[] }>({});
    const [expandedModal, setExpandedModal] = useState<{ type: 'prompt' | 'output', content: string } | null>(null);
    const pageSize = 10;

    const fetchRuns = async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            const res = await fetch(`${apiUrl}/runs`);
            if (res.ok) {
                const data = await res.json();
                setRuns(data);

                // Fetch attack messages for all unique session IDs
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
    };

    useEffect(() => {
        fetchRuns();
    }, []);

    // Helper to get conversation turns from a run
    const getRunTurns = (run: EvaluationRun) => {
        let turns = parseConversation(run.promptSent);
        // Fallback: If prompt didn't yield turns but userInput looks like it has markers
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
                                <th className="text-left py-2 px-2 font-medium text-[var(--foreground-muted)]">Bot Session ID</th>
                                <th className="text-center py-2 px-2 font-medium text-[var(--foreground-muted)]">Toxicity</th>
                                <th className="text-center py-2 px-2 font-medium text-[var(--foreground-muted)]">Topics</th>
                                <th className="text-center py-2 px-2 font-medium text-[var(--foreground-muted)]">Injection</th>
                                <th className="text-center py-2 px-2 font-medium text-[var(--foreground-muted)]">Regex</th>
                                <th className="text-center py-2 px-2 font-medium text-[var(--foreground-muted)]">Overall</th>
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
                                            <td className="py-2 px-2 text-xs font-mono text-[var(--foreground-muted)]">
                                                {run.sessionId || '-'}
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
                                                <td colSpan={8} className="p-4">
                                                    <div className="space-y-4">
                                                        {/* Overall Assessment */}
                                                        {(() => {
                                                            const assessment = extractOverallAssessment(run.llmOutput);
                                                            if (!assessment) return null;

                                                            // Rating badge styling
                                                            const getRatingStyle = (rating: string) => {
                                                                const r = rating.toLowerCase();
                                                                if (r === 'effective' || r === 'excellent') {
                                                                    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
                                                                }
                                                                if (r === 'good' || r === 'adequate') {
                                                                    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
                                                                }
                                                                if (r === 'poor' || r === 'ineffective') {
                                                                    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
                                                                }
                                                                if (r === 'warning' || r === 'moderate') {
                                                                    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
                                                                }
                                                                return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
                                                            };

                                                            return (
                                                                <div className="bg-[var(--surface)] border-2 border-[var(--primary-600)] rounded-lg p-4">
                                                                    <div className="flex items-start gap-3">
                                                                        <div className="flex-shrink-0 mt-0.5">
                                                                            <svg className="w-5 h-5 text-[var(--primary-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                            </svg>
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                <h4 className="font-semibold text-[var(--foreground)] text-sm">Overall Assessment</h4>
                                                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full uppercase ${getRatingStyle(assessment.rating)}`}>
                                                                                    {assessment.rating}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">{assessment.comment}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Conversation View */}
                                                        <div>
                                                            <div className="mb-2">
                                                                <h4 className="font-semibold text-[var(--foreground)] text-sm">
                                                                    Conversation {turns.length > 0 && `(${Math.ceil(turns.length / 2)} turns)`}
                                                                </h4>
                                                            </div>
                                                            <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] p-4 max-h-96 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-gray-300">
                                                                {turns.length > 0 ? (
                                                                    (() => {
                                                                        // Get attack messages for this session
                                                                        const sessionAttacks = run.sessionId ? (attackMessages[run.sessionId] || []) : [];

                                                                        return turns.map((turn, idx) => {
                                                                            // Check if this turn is an attack by matching content
                                                                            const attackInfo = turn.role === 'user'
                                                                                ? sessionAttacks.find(a => a.messageContent === turn.content)
                                                                                : null;
                                                                            const isAttackTurn = !!attackInfo;

                                                                            return (
                                                                                <div
                                                                                    key={idx}
                                                                                    className={`flex ${turn.role === 'user' ? 'justify-start' : 'justify-end'}`}
                                                                                >
                                                                                    <div
                                                                                        className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${turn.role === 'user'
                                                                                            ? (isAttackTurn
                                                                                                ? 'bg-red-600 text-white border border-red-400 font-medium'
                                                                                                : 'bg-blue-100 text-blue-900')
                                                                                            : 'bg-gray-100 text-gray-900'
                                                                                            }`}
                                                                                    >
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
                                                                            <div className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${
                                                                                run.isAttack
                                                                                    ? 'bg-red-600 text-white border border-red-400 font-medium'
                                                                                    : 'bg-blue-100 text-blue-900'
                                                                            }`}>
                                                                                <span className={`font-semibold text-[10px] uppercase tracking-wide opacity-60 ${run.isAttack ? 'text-red-100' : ''}`}>User</span>
                                                                                {run.isAttack && (
                                                                                    <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5 text-red-100">
                                                                                        🚨 Malicious Probe
                                                                                    </div>
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

                                                        {/* Evaluation Metrics */}
                                                        {run.totalTokens && (
                                                            <div>
                                                                <div className="mb-2">
                                                                    <h4 className="font-semibold text-[var(--foreground)] text-sm">
                                                                        Evaluation Metrics {run.model && `(${run.model})`}
                                                                    </h4>
                                                                </div>
                                                                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 mb-4">
                                                                    <div className="grid grid-cols-4 gap-4 text-xs">
                                                                    <div className="text-center">
                                                                        <div className="text-[10px] uppercase tracking-wide text-[var(--foreground-muted)] mb-1 font-semibold">Input Tokens</div>
                                                                        <div className="text-lg font-bold text-green-600 dark:text-green-400">
                                                                            {run.inputTokens ? run.inputTokens.toLocaleString() : '—'}
                                                                        </div>
                                                                        <div className="text-[9px] text-[var(--foreground-muted)] mt-0.5">
                                                                            {run.inputTokens ? 'Prompt' : 'Not tracked'}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <div className="text-[10px] uppercase tracking-wide text-[var(--foreground-muted)] mb-1 font-semibold">Output Tokens</div>
                                                                        <div className="text-lg font-bold text-[var(--primary-600)]">
                                                                            {run.outputTokens ? run.outputTokens.toLocaleString() : '—'}
                                                                        </div>
                                                                        <div className="text-[9px] text-[var(--foreground-muted)] mt-0.5">
                                                                            {run.outputTokens ? 'Response' : 'Not tracked'}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <div className="text-[10px] uppercase tracking-wide text-[var(--foreground-muted)] mb-1 font-semibold">Total Tokens</div>
                                                                        <div className="text-lg font-bold text-[var(--foreground)]">{run.totalTokens.toLocaleString()}</div>
                                                                        <div className="text-[9px] text-[var(--foreground-muted)] mt-0.5">Combined</div>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <div className="text-[10px] uppercase tracking-wide text-[var(--foreground-muted)] mb-1 font-semibold">Response Time</div>
                                                                        <div className="text-lg font-bold text-[var(--foreground)]">
                                                                            {run.latencyMs ? `${(run.latencyMs / 1000).toFixed(2)}s` : '—'}
                                                                        </div>
                                                                        <div className="text-[9px] text-[var(--foreground-muted)] mt-0.5">
                                                                            {run.latencyMs ? 'Latency' : 'Not tracked'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            </div>
                                                        )}

                                                        {/* LLM Details */}
                                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                                            <div>
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <h4 className="font-semibold text-[var(--foreground)]">Prompt Sent to LLM</h4>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setExpandedModal({ type: 'prompt', content: run.promptSent });
                                                                        }}
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
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setExpandedModal({ type: 'output', content: run.llmOutput });
                                                                        }}
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
                                        className={`w-7 h-7 text-xs font-medium rounded transition-colors ${
                                            page === currentPage
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
                            <button
                                onClick={() => setExpandedModal(null)}
                                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] p-2 text-2xl"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <pre className={`whitespace-pre-wrap text-sm ${
                                expandedModal.type === 'prompt'
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-blue-600 dark:text-blue-400'
                            }`}>
                                {expandedModal.content}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
