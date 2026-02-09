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
                    filters
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
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 h-[600px] flex flex-col">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b pb-2 flex justify-between items-center">
                <span>Kore GenAI Logs</span>
                <span className="text-xs text-gray-500 font-normal">Review actual prompts sent to LLM</span>
            </h3>

            <div className="mb-4 flex gap-4 items-end flex-wrap">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date From</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date To</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                    />
                </div>

                {userId && (
                    <div className="flex items-center h-[38px] px-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                        <input
                            id="filterSession"
                            type="checkbox"
                            checked={filterBySession}
                            onChange={(e) => setFilterBySession(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="filterSession" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                            Current Session Only
                        </label>
                    </div>
                )}

                <button
                    onClick={fetchLogs}
                    disabled={isLoading || !botConfig}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 h-[38px]"
                >
                    {isLoading ? 'Fetching...' : 'Fetch Logs'}
                </button>
            </div>

            {error && (
                <div className="mb-4 p-2 bg-red-100 text-red-700 rounded text-sm whitespace-pre-wrap">
                    {error}
                </div>
            )}

            <div className="flex-1 overflow-auto border rounded-md relative cursor-default">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Session ID</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Feature</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {logs.map((log: any, i: number) => (
                            <tr
                                key={i}
                                onClick={() => setSelectedLog(log)}
                                className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                            >
                                <td className="px-3 py-2 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                    {log['start Date'] ? new Date(log['start Date']).toLocaleString() : '-'}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 font-mono text-xs" title={log.channelUserIds?.[0]}>
                                    {log.channelUserIds?.[0] ? `${log.channelUserIds[0].substring(0, 8)}...` : '-'}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${log.Feature?.includes('Guardrail')
                                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                        }`}>
                                        {log.Feature || '-'}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 max-w-[300px] truncate" title={log.Description}>
                                    {log.Description || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {logs.length === 0 && !isLoading && !error && (
                    <div className="p-8 text-center text-gray-500">
                        No logs found. Ensure the bot is configured correctly and has recent activity.
                        <br /><span className="text-xs">Method: POST /public/bot/getLLMUsageLogs</span>
                        {filterBySession && userId && (
                            <>
                                <br />
                                <span className="text-xs text-indigo-500">(Filtered by current session ID)</span>
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
                                    <span className="block text-xs text-gray-500 uppercase">Description</span>
                                    <span className="font-medium text-lg">{selectedLog.Description || '-'}</span>
                                </div>
                                <div><span className="block text-xs text-gray-500 uppercase">Feature</span> <span className="font-medium">{selectedLog.Feature}</span></div>
                                <div><span className="block text-xs text-gray-500 uppercase">Input/Output</span> <span className="font-medium">{selectedLog['Feature']?.includes('Input') ? 'Input' : selectedLog['Feature']?.includes('Output') ? 'Output' : '-'}</span></div>
                                <div><span className="block text-xs text-gray-500 uppercase">Status</span> <span className="font-medium text-green-600">Success</span></div>
                                <div><span className="block text-xs text-gray-500 uppercase">Model</span> <span className="font-medium">{selectedLog.Model || '-'}</span></div>
                                <div><span className="block text-xs text-gray-500 uppercase">Session ID</span> <span className="font-medium font-mono text-xs">{selectedLog.channelUserIds?.[0] || '-'}</span></div>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    <span>📤 Request Payload (Sent to LLM)</span>
                                </h4>
                                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-[400px] border border-gray-700 shadow-inner language-json">
                                    {JSON.stringify(selectedLog['Request Payload'], null, 2)}
                                </pre>
                            </div>

                            <div>
                                <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
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
