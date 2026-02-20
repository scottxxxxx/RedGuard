"use client";
import { useState, useImperativeHandle, forwardRef, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BotConfig } from './BotSettings';

export interface ChatMessage {
    role: 'user' | 'bot' | 'evaluation';
    text: string;
    timestamp?: Date;
    isAttack?: boolean;
    attackCategory?: string;
}

interface Props {
    botConfig: BotConfig | null;
    userId?: string;
    koreSessionId?: string | null;  // Kore's internal session ID for filtering logs
    onLogsUpdated?: () => void;  // Called when logs are fetched/updated
    messages?: ChatMessage[];  // Chat messages for attack correlation
}

export interface LLMInspectorRef {
    refreshLogs: () => void;
    clearLogs: () => void;
    getLogs: () => any[];
}

// Execution-order priority for tiebreaking same-second timestamps
// 0 = input guardrail, 1 = agent/LLM processing, 2 = output guardrail, 3 = other
function getLogPriority(log: any): number {
    const feature = (log['Feature Name '] || log.Feature || '').toLowerCase();
    if (feature.includes('guardrail') && (feature.includes('input') || feature.includes('request'))) return 0;
    if (feature.includes('agent node') || feature.includes('dialog') || feature.includes('llm') || feature.includes('genai') || feature.includes('orchestrator') || feature.includes('conversation manager')) return 1;
    if (feature.includes('guardrail') && (feature.includes('output') || feature.includes('response'))) return 2;
    return 3;
}

// Check if a guardrail response payload indicates the guardrail caught/blocked something
function didGuardrailCatch(log: any): boolean {
    try {
        const resp = log['Payload Details']?.['Response Payload'] || log['Response Payload'];
        if (!resp) return false;
        const text = typeof resp === 'string' ? resp : JSON.stringify(resp);
        const lower = text.toLowerCase();
        // Detection signals: violations found, blocked, denied, flagged, safety triggered
        return lower.includes('"violation') || lower.includes('"blocked"') ||
            lower.includes('"denied"') || lower.includes('"flagged": true') ||
            lower.includes('"flagged":true') || lower.includes('"safety"') ||
            lower.includes('violation detected') || lower.includes('content blocked') ||
            lower.includes('"status":"denied"') || lower.includes('"status": "denied"') ||
            lower.includes('"action":"deny"') || lower.includes('"action": "deny"');
    } catch {
        return false;
    }
}

const LLMInspector = forwardRef<LLMInspectorRef, Props>(({ botConfig, userId, koreSessionId, onLogsUpdated, messages = [] }, ref) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    // Keyboard navigation for log detail modal
    useEffect(() => {
        if (selectedLogIndex === null) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedLogIndex(prev => Math.max(0, (prev ?? 0) - 1));
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedLogIndex(prev => Math.min(logs.length - 1, (prev ?? 0) + 1));
            } else if (e.key === 'Escape') {
                setSelectedLogIndex(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedLogIndex, logs.length]);

    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const fetchLogs = useCallback(async () => {
        if (!botConfig) return;

        setIsLoading(true);
        setError(null);
        try {
            const now = new Date();

            // Go back 24 hours to catch all recent sessions
            const yesterday = new Date(now);
            yesterday.setHours(yesterday.getHours() - 24);

            // Go forward 2 hours to catch any clock skew or immediate future logs
            const future = new Date(now);
            future.setHours(future.getHours() + 2);

            const filters: any = {
                dateFrom: yesterday.toISOString().split('.')[0],
                dateTo: future.toISOString().split('.')[0],
                limit: "50"
            };

            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/kore/llm-logs`;

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    botConfig,
                    filters,
                    userId: userId || 'unknown'
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch logs');

            let logArray = Array.isArray(data) ? data : (data.hits || []);

            // Client-side filter by Kore session ID (API doesn't support sessionId filter)
            if (koreSessionId) {
                logArray = logArray.filter((log: any) => log['Session ID'] === koreSessionId);
            }

            setLogs(logArray);
            setLastUpdated(new Date());
            if (logArray.length > 0) onLogsUpdated?.();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [botConfig, koreSessionId]);

    // Fetch fresh logs when session changes (don't clear — preserves logs during re-evaluations)
    useEffect(() => {
        if (koreSessionId) {
            fetchLogs();
        }
    }, [koreSessionId]);

    // Expose refresh and clear functions to parent
    useImperativeHandle(ref, () => ({
        refreshLogs: fetchLogs,
        clearLogs: () => {
            setLogs([]);
        },
        getLogs: () => [...logs].sort((a, b) => {
            const timeA = new Date(a['start Date'] || 0).getTime();
            const timeB = new Date(b['start Date'] || 0).getTime();
            if (timeA !== timeB) return timeA - timeB;
            return getLogPriority(a) - getLogPriority(b);
        })
    }));

    // Sort logs by timestamp ascending, with execution-order tiebreaker for same-second entries
    const sortedLogs = useMemo(() => {
        if (logs.length === 0) return [];
        return [...logs].sort((a, b) => {
            const timeA = new Date(a['start Date'] || 0).getTime();
            const timeB = new Date(b['start Date'] || 0).getTime();
            if (timeA !== timeB) return timeA - timeB;
            return getLogPriority(a) - getLogPriority(b);
        });
    }, [logs]);

    // Assign X.Y section labels based on sorted order
    const logNumberMap = useMemo(() => {
        const map = new Map<number, string>();
        if (sortedLogs.length === 0) return map;

        // Categorize into sections: 1=input guardrail, 2=agent/LLM, 3=output guardrail, 4=other
        const sections: { idx: number }[][] = [[], [], [], []];
        for (let i = 0; i < sortedLogs.length; i++) {
            const priority = getLogPriority(sortedLogs[i]);
            sections[priority].push({ idx: i });
        }

        // Assign X.Y labels
        sections.forEach((section, sectionIdx) => {
            section.forEach((entry, posIdx) => {
                map.set(entry.idx, `${sectionIdx + 1}.${posIdx + 1}`);
            });
        });

        return map;
    }, [sortedLogs]);

    // Map each log to its attack status: 'caught' | 'missed' | null
    // Correlates logs with attack messages by timestamp windows
    const logAttackStatus = useMemo(() => {
        const statusMap = new Map<number, 'caught' | 'missed'>();
        if (sortedLogs.length === 0 || messages.length === 0) return statusMap;

        // Get user messages with timestamps, sorted chronologically
        const userMsgs = messages
            .filter(m => m.role === 'user' && m.timestamp)
            .map(m => ({ time: new Date(m.timestamp!).getTime(), isAttack: !!m.isAttack, category: m.attackCategory }));

        if (userMsgs.length === 0) return statusMap;

        for (let i = 0; i < sortedLogs.length; i++) {
            const log = sortedLogs[i];
            const logTime = new Date(log['start Date'] || 0).getTime();
            const isGuardrail = (log['Feature Name '] || log.Feature || '').toLowerCase().includes('guardrail');

            if (!isGuardrail) continue;

            // Find which user message this log belongs to (latest message before this log)
            let matchedMsg = null;
            for (let j = userMsgs.length - 1; j >= 0; j--) {
                if (userMsgs[j].time <= logTime) {
                    matchedMsg = userMsgs[j];
                    break;
                }
            }

            if (matchedMsg && matchedMsg.isAttack) {
                statusMap.set(i, didGuardrailCatch(log) ? 'caught' : 'missed');
            }
        }

        return statusMap;
    }, [sortedLogs, messages]);

    const copyToClipboard = useCallback(async (content: any, fieldName: string) => {
        try {
            const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
            await navigator.clipboard.writeText(text);
            setCopiedField(fieldName);
            setTimeout(() => setCopiedField(null), 2000);
        } catch { /* clipboard API unavailable */ }
    }, []);

    const selectedLog = selectedLogIndex !== null && sortedLogs[selectedLogIndex]
        ? { ...sortedLogs[selectedLogIndex], _logNumber: logNumberMap.get(selectedLogIndex), _attackStatus: logAttackStatus.get(selectedLogIndex) }
        : null;

    return (
        <div className="card p-6 h-full flex flex-col">
            <h3 className="shrink-0 text-lg font-medium text-[var(--foreground)] mb-4 border-b pb-2 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span>Kore GenAI Logs</span>
                </div>
                <div className="flex items-center gap-3">
                    {isLoading && (
                        <span className="text-xs text-[var(--primary-600)] flex items-center gap-1">
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                        </span>
                    )}
                    {lastUpdated && !isLoading && (
                        <span className="text-xs text-[var(--foreground-muted)]">
                            Last updated: {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    <span className="text-xs px-2 py-0.5 bg-badge-blue-bg text-badge-blue-text rounded">
                        {logs.length} logs
                    </span>

                </div>
            </h3>



            {error && (
                <div className="shrink-0 mb-4 p-2 bg-error-bg text-error-text border border-error-border rounded text-sm whitespace-pre-wrap">
                    {error}
                </div>
            )}

            <div className="flex-1 h-0 overflow-auto border rounded-md relative cursor-default">
                <table className="min-w-full divide-y divide-[var(--border)]">
                    <thead className="bg-[var(--surface-hover)] sticky top-0">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase">Log #</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase">Timestamp</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase">Category</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase">Activity</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase">Model</th>
                        </tr>
                    </thead>
                    <tbody className="bg-[var(--surface)] divide-y divide-[var(--border)]">
                        {sortedLogs.map((log: any, i: number) => {
                            const feature = log['Feature Name '] || log.Feature || '-';
                            const description = log.Description || '-';
                            const model = log.Integration || log['Model Name'] || log.Model || '-';
                            const isGuardrail = feature.toLowerCase().includes('guardrail');
                            const attackStatus = logAttackStatus.get(i);

                            return (
                                <tr
                                    key={i}
                                    onClick={() => setSelectedLogIndex(i)}
                                    className={`cursor-pointer transition-colors ${attackStatus === 'caught'
                                        ? 'bg-[var(--success-bg)] hover:bg-[var(--success-bg)] border-l-4 border-l-[var(--success-text)]'
                                        : attackStatus === 'missed'
                                            ? 'bg-[var(--error-bg)] hover:bg-[var(--error-bg)] border-l-4 border-l-[var(--error-text)]'
                                            : 'hover:bg-[var(--surface-hover)]'
                                        }`}
                                >
                                    <td className="px-3 py-2 text-xs font-mono font-bold text-[var(--foreground-muted)]">
                                        <span className="flex items-center gap-1.5">
                                            {logNumberMap.get(i) || '-'}
                                            {attackStatus === 'caught' && <span title="Guardrail caught the attack" className="w-2 h-2 rounded-full bg-[var(--success-text)] inline-block" />}
                                            {attackStatus === 'missed' && <span title="Guardrail missed the attack" className="w-2 h-2 rounded-full bg-[var(--error-text)] inline-block" />}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-sm text-[var(--foreground)] whitespace-nowrap">
                                        {log['start Date'] ? new Date(log['start Date']).toLocaleTimeString() : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-[var(--foreground)]">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isGuardrail
                                            ? 'bg-badge-orange-bg text-badge-orange-text'
                                            : 'bg-badge-blue-bg text-badge-blue-text'
                                            }`}>
                                            {feature}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-sm text-[var(--foreground-secondary)] max-w-[3000px] font-medium" title={description}>
                                        {description}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-[var(--foreground-muted)] font-mono text-[11px]">
                                        {model}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {logs.length === 0 && !isLoading && !error && (
                    <div className="p-8 text-center text-[var(--foreground-muted)]">
                        {koreSessionId ? (
                            <>
                                <p>No logs found for this session yet.</p>
                                <p className="text-xs mt-2 text-[var(--foreground-muted)]">Logs will be fetched automatically after bot responses.</p>
                            </>
                        ) : (
                            <>
                                <p>Send a message to the bot to start a session.</p>
                                <p className="text-xs mt-2">Logs will be filtered by your session automatically.</p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Modal for details — portal to body so backdrop-filter ancestors don't break fixed positioning */}
            {selectedLog && createPortal(
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-[var(--surface)] rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-[var(--surface-hover)] rounded-t-lg">
                            <div>
                                <h3 className="text-lg font-medium text-[var(--foreground)] flex items-center gap-2">
                                    Log Details
                                    {selectedLog._logNumber && (
                                        <span className="text-sm font-mono font-bold text-[var(--foreground-muted)]">
                                            #{selectedLog._logNumber}
                                        </span>
                                    )}
                                    {selectedLog._attackStatus === 'caught' && (
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success-border)]">
                                            Attack Caught
                                        </span>
                                    )}
                                    {selectedLog._attackStatus === 'missed' && (
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--error-bg)] text-[var(--error-text)] border border-[var(--error-border)]">
                                            Attack Missed
                                        </span>
                                    )}
                                </h3>
                                <p className="text-xs text-[var(--foreground-muted)]">{new Date(selectedLog['start Date']).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Prev/Next navigation */}
                                <button
                                    onClick={() => setSelectedLogIndex(Math.max(0, (selectedLogIndex ?? 0) - 1))}
                                    disabled={selectedLogIndex === 0}
                                    className="p-1.5 rounded border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    title="Previous log"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <span className="text-xs font-mono text-[var(--foreground-muted)] min-w-[4rem] text-center">
                                    {(selectedLogIndex ?? 0) + 1} of {logs.length}
                                </span>
                                <button
                                    onClick={() => setSelectedLogIndex(Math.min(logs.length - 1, (selectedLogIndex ?? 0) + 1))}
                                    disabled={selectedLogIndex === logs.length - 1}
                                    className="p-1.5 rounded border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    title="Next log"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                                {/* Close button */}
                                <button onClick={() => setSelectedLogIndex(null)} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] p-2 text-2xl ml-2">&times;</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-6 space-y-6">

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-[var(--surface-hover)] p-4 rounded-lg">
                                <div className="col-span-2 md:col-span-3">
                                    <span className="block text-xs text-[var(--foreground-muted)] uppercase">Activity</span>
                                    <span className="font-medium text-lg text-[var(--foreground)]">
                                        {(selectedLog.Description || selectedLog['Feature Name '] || selectedLog.Feature || '-')
                                            .replace(/^Guardrails - /i, '')
                                            .replace(/^Guardrails- /i, '')
                                            .replace(/^Guardrail - /i, '')
                                        }
                                    </span>
                                </div>
                                <div><span className="block text-xs text-[var(--foreground-muted)] uppercase">Feature</span> <span className="font-medium text-[var(--foreground)]">{selectedLog['Feature Name '] || selectedLog.Feature}</span></div>
                                <div><span className="block text-xs text-[var(--foreground-muted)] uppercase">Status</span> <span className="font-medium text-success-text">{selectedLog.Status || 'Success'}</span></div>
                                <div><span className="block text-xs text-[var(--foreground-muted)] uppercase">Model</span> <span className="font-medium text-[var(--foreground)]">{selectedLog.Integration || selectedLog['Model Name'] || selectedLog.Model || '-'}</span></div>
                                <div><span className="block text-xs text-[var(--foreground-muted)] uppercase">Time Taken</span> <span className="font-medium text-[var(--foreground)]">{selectedLog['Time Taken']}ms</span></div>
                                <div><span className="block text-xs text-[var(--foreground-muted)] uppercase">Session ID</span> <span className="font-medium font-mono text-xs text-[var(--foreground)]">{selectedLog['Session ID'] || '-'}</span></div>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm text-[var(--foreground-secondary)] mb-2 flex items-center justify-between">
                                    <span>📤 Request Payload (Sent to LLM)</span>
                                    <button
                                        onClick={() => copyToClipboard(selectedLog['Payload Details']?.['Request Payload'] || selectedLog['Request Payload'], 'request')}
                                        className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                                        title="Copy request payload"
                                    >
                                        {copiedField === 'request' ? (
                                            <><svg className="w-3.5 h-3.5 text-[var(--success-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-[var(--success-text)]">Copied</span></>
                                        ) : (
                                            <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
                                        )}
                                    </button>
                                </h4>
                                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-[400px] border border-gray-700 shadow-inner language-json whitespace-pre-wrap break-words">
                                    {JSON.stringify(selectedLog['Payload Details']?.['Request Payload'] || selectedLog['Request Payload'], null, 2)}
                                </pre>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm text-[var(--foreground-secondary)] mb-2 flex items-center justify-between">
                                    <span>📥 Response Payload (From LLM)</span>
                                    <button
                                        onClick={() => copyToClipboard(selectedLog['Payload Details']?.['Response Payload'] || selectedLog['Response Payload'], 'response')}
                                        className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                                        title="Copy response payload"
                                    >
                                        {copiedField === 'response' ? (
                                            <><svg className="w-3.5 h-3.5 text-[var(--success-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-[var(--success-text)]">Copied</span></>
                                        ) : (
                                            <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
                                        )}
                                    </button>
                                </h4>
                                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-[300px] border border-gray-700 shadow-inner language-json whitespace-pre-wrap break-words">
                                    {JSON.stringify(selectedLog['Payload Details']?.['Response Payload'] || selectedLog['Response Payload'], null, 2)}
                                </pre>
                            </div>

                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
});

LLMInspector.displayName = 'LLMInspector';

export default LLMInspector;
