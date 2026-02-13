"use client";
import { useState, useImperativeHandle, forwardRef, useCallback, useEffect, useRef } from 'react';
import { BotConfig } from './BotSettings';

interface Props {
    botConfig: BotConfig | null;
    userId?: string;
    koreSessionId?: string | null;  // Kore's internal session ID for filtering logs
    onLogsUpdated?: () => void;  // Called when logs are fetched/updated
}

export interface LLMInspectorRef {
    refreshLogs: () => void;
    clearLogs: () => void;
    getLogs: () => any[];
}

const LLMInspector = forwardRef<LLMInspectorRef, Props>(({ botConfig, userId, koreSessionId, onLogsUpdated }, ref) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedLog, setSelectedLog] = useState<any | null>(null);
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

    // Reset logs when session changes
    useEffect(() => {
        if (koreSessionId) {
            setLogs([]);
        }
    }, [koreSessionId]);

    // Expose refresh and clear functions to parent
    useImperativeHandle(ref, () => ({
        refreshLogs: fetchLogs,
        clearLogs: () => {
            setLogs([]);
        },
        getLogs: () => logs
    }));

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
                            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase">Timestamp</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase">Category</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase">Activity</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase">Model</th>
                        </tr>
                    </thead>
                    <tbody className="bg-[var(--surface)] divide-y divide-[var(--border)]">
                        {logs.map((log: any, i: number) => {
                            const feature = log['Feature Name '] || log.Feature || '-';
                            const description = log.Description || '-';
                            const model = log.Integration || log['Model Name'] || log.Model || '-';
                            const isGuardrail = feature.toLowerCase().includes('guardrail');

                            return (
                                <tr
                                    key={i}
                                    onClick={() => setSelectedLog(log)}
                                    className="hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                                >
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
                                <button
                                    onClick={fetchLogs}
                                    className="mt-3 text-xs bg-[var(--primary-50)] text-[var(--primary-600)] px-3 py-1 rounded border border-[var(--primary-200)] hover:bg-[var(--primary-100)]"
                                >
                                    Fetch Logs Now
                                </button>
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

            {/* Modal for details */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-[var(--surface)] rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-[var(--surface-hover)] rounded-t-lg">
                            <div>
                                <h3 className="text-lg font-medium text-[var(--foreground)]">Log Details</h3>
                                <p className="text-xs text-[var(--foreground-muted)]">{new Date(selectedLog['start Date']).toLocaleString()}</p>
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] p-2 text-2xl">&times;</button>
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
                                <h4 className="font-medium text-sm text-[var(--foreground-secondary)] mb-2 flex items-center gap-2">
                                    <span>📤 Request Payload (Sent to LLM)</span>
                                </h4>
                                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-[400px] border border-gray-700 shadow-inner language-json">
                                    {JSON.stringify(selectedLog['Payload Details']?.['Request Payload'] || selectedLog['Request Payload'], null, 2)}
                                </pre>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm text-[var(--foreground-secondary)] mb-2 flex items-center gap-2">
                                    <span>📥 Response Payload (From LLM)</span>
                                </h4>
                                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-[300px] border border-gray-700 shadow-inner language-json">
                                    {JSON.stringify(selectedLog['Payload Details']?.['Response Payload'] || selectedLog['Response Payload'], null, 2)}
                                </pre>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

LLMInspector.displayName = 'LLMInspector';

export default LLMInspector;
