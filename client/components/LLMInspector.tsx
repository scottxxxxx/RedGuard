"use client";
import { useState } from 'react';
import { BotConfig } from './BotSettings';

interface Props {
    botConfig: BotConfig | null;
    userId?: string;
}

export default function LLMInspector({ botConfig, userId }: Props) {
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedLog, setSelectedLog] = useState<any | null>(null);
    const [filterBySession, setFilterBySession] = useState(true);

    const fetchLogs = async () => {
        if (!botConfig) return;
        setIsLoading(true);
        setError(null);
        try {
            // Fix: Ensure "Date To" includes the full day and "Date From" starts at 00:00:00
            const adjustedDateFrom = dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00`;
            const adjustedDateTo = dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59`;

            const filters = {
                dateFrom: adjustedDateFrom,
                dateTo: adjustedDateTo,
                channelUserIds: (filterBySession && userId) ? [userId] : undefined
            };

            console.log("Fetching logs with filters:", filters); // Debugging

            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/kore/llm-logs`;
            console.log("Fetching from:", apiUrl);

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

            // API Response handling
            const logArray = Array.isArray(data) ? data : (data.hits || []);
            setLogs(logArray);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-[var(--surface)] shadow rounded-lg p-6 h-[600px] flex flex-col">
            <h3 className="text-lg font-medium text-[var(--foreground)] mb-4 border-b pb-2 flex justify-between items-center">
                <span>Kore GenAI Logs</span>
                <span className="text-xs text-[var(--foreground-muted)] font-normal">Review actual prompts sent to LLM</span>
            </h3>

            <div className="mb-4 flex gap-4 items-end flex-wrap">
                <div>
                    <label className="block text-sm font-medium text-[var(--foreground-secondary)]">Date From</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="mt-1 block w-full rounded-md border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-sm focus:border-[var(--primary-500)] focus:ring-[var(--primary-500)] sm:text-sm p-2 border"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-[var(--foreground-secondary)]">Date To</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="mt-1 block w-full rounded-md border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-sm focus:border-[var(--primary-500)] focus:ring-[var(--primary-500)] sm:text-sm p-2 border"
                    />
                </div>

                {userId && (
                    <div className="flex items-center h-[38px] px-2 bg-[var(--surface-hover)] rounded border border-[var(--border)]">
                        <input
                            id="filterSession"
                            type="checkbox"
                            checked={filterBySession}
                            onChange={(e) => setFilterBySession(e.target.checked)}
                            className="h-4 w-4 text-[var(--primary-600)] focus:ring-[var(--primary-500)] border-[var(--border)] rounded"
                        />
                        <label htmlFor="filterSession" className="ml-2 block text-sm text-[var(--foreground)]">
                            Current Session Only
                        </label>
                    </div>
                )}

                <button
                    onClick={fetchLogs}
                    disabled={isLoading || !botConfig}
                    className="bg-[var(--primary-600)] text-white px-4 py-2 rounded-md hover:bg-[var(--primary-700)] disabled:opacity-50 h-[38px]"
                >
                    {isLoading ? 'Fetching...' : 'Fetch Logs'}
                </button>
            </div>

            {error && (
                <div className="mb-4 p-2 bg-error-bg text-error-text border border-error-border rounded text-sm whitespace-pre-wrap">
                    {error}
                </div>
            )}

            <div className="flex-1 overflow-auto border rounded-md relative cursor-default">
                <table className="min-w-full divide-y divide-[var(--border)]">
                    <thead className="bg-[var(--surface-hover)] sticky top-0">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase">Timestamp</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase">Session ID</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase">Feature</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase">Description</th>
                        </tr>
                    </thead>
                    <tbody className="bg-[var(--surface)] divide-y divide-[var(--border)]">
                        {logs.map((log: any, i: number) => (
                            <tr
                                key={i}
                                onClick={() => setSelectedLog(log)}
                                className="hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                            >
                                <td className="px-3 py-2 text-sm text-[var(--foreground)] whitespace-nowrap">
                                    {log['start Date'] ? new Date(log['start Date']).toLocaleString() : '-'}
                                </td>
                                <td className="px-3 py-2 text-sm text-[var(--foreground-muted)] font-mono text-xs" title={log.channelUserIds?.[0]}>
                                    {log.channelUserIds?.[0] ? `${log.channelUserIds[0].substring(0, 8)}...` : '-'}
                                </td>
                                <td className="px-3 py-2 text-sm text-[var(--foreground)]">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${log.Feature?.includes('Guardrail')
                                        ? 'bg-badge-orange-bg text-badge-orange-text'
                                        : 'bg-badge-blue-bg text-badge-blue-text'
                                        }`}>
                                        {log.Feature || '-'}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-sm text-[var(--foreground-muted)] max-w-[300px] truncate" title={log.Description}>
                                    {log.Description || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {logs.length === 0 && !isLoading && !error && (
                    <div className="p-8 text-center text-[var(--foreground-muted)]">
                        No logs found. Ensure the bot is configured correctly and has recent activity.
                        <br /><span className="text-xs">Method: POST /public/bot/getLLMUsageLogs</span>
                        {filterBySession && userId && (
                            <>
                                <br />
                                <span className="text-xs text-[var(--primary-600)]">(Filtered by current session ID)</span>
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
                                    <span className="block text-xs text-[var(--foreground-muted)] uppercase">Description</span>
                                    <span className="font-medium text-lg text-[var(--foreground)]">{selectedLog.Description || '-'}</span>
                                </div>
                                <div><span className="block text-xs text-[var(--foreground-muted)] uppercase">Feature</span> <span className="font-medium text-[var(--foreground)]">{selectedLog.Feature}</span></div>
                                <div><span className="block text-xs text-[var(--foreground-muted)] uppercase">Input/Output</span> <span className="font-medium text-[var(--foreground)]">{selectedLog['Feature']?.includes('Input') ? 'Input' : selectedLog['Feature']?.includes('Output') ? 'Output' : '-'}</span></div>
                                <div><span className="block text-xs text-[var(--foreground-muted)] uppercase">Status</span> <span className="font-medium text-success-text">Success</span></div>
                                <div><span className="block text-xs text-[var(--foreground-muted)] uppercase">Model</span> <span className="font-medium text-[var(--foreground)]">{selectedLog.Model || '-'}</span></div>
                                <div><span className="block text-xs text-[var(--foreground-muted)] uppercase">Session ID</span> <span className="font-medium font-mono text-xs text-[var(--foreground)]">{selectedLog.channelUserIds?.[0] || '-'}</span></div>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm text-[var(--foreground-secondary)] mb-2 flex items-center gap-2">
                                    <span>📤 Request Payload (Sent to LLM)</span>
                                </h4>
                                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-[400px] border border-gray-700 shadow-inner language-json">
                                    {JSON.stringify(selectedLog['Request Payload'], null, 2)}
                                </pre>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm text-[var(--foreground-secondary)] mb-2 flex items-center gap-2">
                                    <span>📥 Response Payload (From LLM)</span>
                                </h4>
                                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-[300px] border border-gray-700 shadow-inner language-json">
                                    {JSON.stringify(selectedLog['Response Payload'], null, 2)}
                                </pre>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
