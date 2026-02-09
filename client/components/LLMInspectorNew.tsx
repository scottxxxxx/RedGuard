"use client";
import { useState, useImperativeHandle, forwardRef, useCallback, useEffect, useRef } from 'react';
import { BotConfig } from './BotSettings';

interface Props {
    botConfig: BotConfig | null;
    userId?: string;
    koreSessionId?: string | null;  // Kore's internal session ID for filtering logs
}

export interface LLMInspectorRef {
    refreshLogs: () => void;
    clearLogs: () => void;
    getLogs: () => any[];
}

const LLMInspector = forwardRef<LLMInspectorRef, Props>(({ botConfig, userId, koreSessionId }, ref) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedLog, setSelectedLog] = useState<any | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [pollStartTime, setPollStartTime] = useState<number | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchLogs = useCallback(async () => {
        if (!botConfig) return;

        setIsLoading(true);
        setError(null);
        try {
            // Use date range for last 2 days to ensure we capture recent logs
            // Use precise timestamps to ensure we catch logs across UTC day boundaries
            // Date-only strings can cause logs at 4 AM UTC (10 PM CST) to be missed if "end date" is interpreted as midnight
            const now = new Date();

            // Go back 24 hours to catch all recent sessions
            const yesterday = new Date(now);
            yesterday.setHours(yesterday.getHours() - 24);

            // Go forward 2 hours to catch any clock skew or immediate future logs
            const future = new Date(now);
            future.setHours(future.getHours() + 2);

            const filters: any = {
                // Formatting as 'YYYY-MM-DDTHH:mm:ss' which works reliably with Kore API
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
                    filters
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

            // Stop polling if we found logs
            if (logArray.length > 0 && isPolling) {
                stopPolling();
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [botConfig, koreSessionId, isPolling]);

    const startPolling = useCallback(() => {
        if (pollIntervalRef.current) return; // Already polling

        setIsPolling(true);
        setPollStartTime(Date.now());

        // Initial fetch
        fetchLogs();

        // Poll every 15 seconds
        pollIntervalRef.current = setInterval(fetchLogs, 15000);
    }, [fetchLogs]);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        setIsPolling(false);
        setPollStartTime(null);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => stopPolling();
    }, [stopPolling]);

    // Auto-start polling when koreSessionId changes (new session)
    useEffect(() => {
        if (koreSessionId) {
            // Reset logs for new session
            setLogs([]);
            // Start polling for logs
            startPolling();
        } else {
            stopPolling();
        }
    }, [koreSessionId, startPolling, stopPolling]);

    // Timer for UI updates
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPolling && pollStartTime) {
            interval = setInterval(() => {
                // Force re-render for timer
                setLastUpdated(new Date());
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isPolling, pollStartTime]);

    // Expose refresh and clear functions to parent
    useImperativeHandle(ref, () => ({
        refreshLogs: fetchLogs,
        clearLogs: () => {
            setLogs([]);
            stopPolling();
        },
        getLogs: () => logs
    }));

    return (
        <div className="card p-6 h-full flex flex-col">
            <h3 className="shrink-0 text-lg font-medium text-gray-900 dark:text-white mb-4 border-b pb-2 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span>Kore GenAI Logs</span>
                    {koreSessionId && (
                        <span className="text-xs font-mono bg-green-100 text-green-700 px-2 py-0.5 rounded" title="Kore Session ID">
                            Session: {koreSessionId.substring(0, 8)}...
                        </span>
                    )}
                    {!koreSessionId && userId && (
                        <span className="text-xs font-mono bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                            Waiting for chat...
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {isLoading && (
                        <span className="text-xs text-indigo-500 flex items-center gap-1">
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                        </span>
                    )}
                    {lastUpdated && !isLoading && (
                        <span className="text-xs text-gray-500">
                            Last updated: {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                        {logs.length} logs
                    </span>

                </div>
            </h3>



            {error && (
                <div className="shrink-0 mb-4 p-2 bg-red-100 text-red-700 rounded text-sm whitespace-pre-wrap">
                    {error}
                </div>
            )}

            <div className="flex-1 h-0 overflow-auto border rounded-md relative cursor-default">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {logs.map((log: any, i: number) => {
                            const rawFeature = log['Feature Name '] || log.Feature || '';
                            const isGuardrail = rawFeature.toLowerCase().includes('guardrail');
                            const isInput = rawFeature.toLowerCase().includes('input');
                            const isOutput = rawFeature.toLowerCase().includes('output');

                            // Determine Category (The Badge)
                            let category = isGuardrail
                                ? (isInput ? 'Guardrail (In)' : isOutput ? 'Guardrail (Out)' : 'Guardrail')
                                : 'GenAI Node';

                            // Determine Activity Name (The "Normalized" Description)
                            // If it's a guardrail, the description usually contains the node name it's guarding.
                            // If it's not a guardrail, the feature name itself is usually the node type.
                            let activityName = isGuardrail ? (log.Description || rawFeature) : (rawFeature || log.Description || '-');

                            // Clean up redundant prefixes
                            activityName = activityName
                                .replace(/^Guardrails - /i, '')
                                .replace(/^Guardrails- /i, '')
                                .replace(/^Guardrail - /i, '');

                            const model = log['Model Name'] || log.Model || '-';

                            return (
                                <tr
                                    key={i}
                                    onClick={() => setSelectedLog(log)}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                                >
                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                        {log['start Date'] ? new Date(log['start Date']).toLocaleTimeString() : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isGuardrail
                                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                                            }`}>
                                            {category}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 max-w-[3000px] font-medium" title={log.Description}>
                                        {activityName}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                                        {model}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {logs.length === 0 && !isLoading && !error && (
                    <div className="p-8 text-center text-gray-500">
                        {koreSessionId ? (
                            <>
                                <p>No logs found for this session yet.</p>
                                {isPolling ? (
                                    <p className="text-xs mt-2 text-blue-600 animate-pulse">Checking for new logs...</p>
                                ) : (
                                    <>

                                        <button
                                            onClick={startPolling}
                                            className="mt-3 text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded border border-indigo-200 hover:bg-indigo-100"
                                        >
                                            Start Auto-Polling
                                        </button>
                                    </>
                                )}
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
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-t-lg">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Log Details</h3>
                                <p className="text-xs text-gray-500">{new Date(selectedLog['start Date']).toLocaleString()}</p>
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="text-gray-500 hover:text-gray-700 p-2 text-2xl">&times;</button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 space-y-6">

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                                <div className="col-span-2 md:col-span-3">
                                    <span className="block text-xs text-gray-500 uppercase">Activity</span>
                                    <span className="font-medium text-lg">
                                        {(selectedLog.Description || selectedLog['Feature Name '] || selectedLog.Feature || '-')
                                            .replace(/^Guardrails - /i, '')
                                            .replace(/^Guardrails- /i, '')
                                            .replace(/^Guardrail - /i, '')
                                        }
                                    </span>
                                </div>
                                <div><span className="block text-xs text-gray-500 uppercase">Feature</span> <span className="font-medium">{selectedLog['Feature Name '] || selectedLog.Feature}</span></div>
                                <div><span className="block text-xs text-gray-500 uppercase">Status</span> <span className="font-medium text-green-600">{selectedLog.Status || 'Success'}</span></div>
                                <div><span className="block text-xs text-gray-500 uppercase">Model</span> <span className="font-medium">{selectedLog['Model Name'] || selectedLog.Model || '-'}</span></div>
                                <div><span className="block text-xs text-gray-500 uppercase">Time Taken</span> <span className="font-medium">{selectedLog['Time Taken']}ms</span></div>
                                <div><span className="block text-xs text-gray-500 uppercase">Session ID</span> <span className="font-medium font-mono text-xs">{selectedLog['Session ID'] || '-'}</span></div>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    <span>📤 Request Payload (Sent to LLM)</span>
                                </h4>
                                <pre className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-[400px] border border-gray-200 dark:border-gray-700 shadow-inner language-json">
                                    {JSON.stringify(selectedLog['Payload Details']?.['Request Payload'] || selectedLog['Request Payload'], null, 2)}
                                </pre>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    <span>📥 Response Payload (From LLM)</span>
                                </h4>
                                <pre className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-[300px] border border-gray-200 dark:border-gray-700 shadow-inner language-json">
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
