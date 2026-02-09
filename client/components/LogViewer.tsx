"use client";
import React, { useState, useEffect } from 'react';

interface ApiLog {
    id: string;
    timestamp: string;
    logType: string;
    method: string;
    endpoint: string;
    requestBody: string;
    statusCode: number;
    responseBody: string;
    latencyMs: number;
    isError: boolean;
    errorMessage: string;
    provider: string;
    model: string;
    totalTokens?: number;
}

interface LogStats {
    totalLogs: number;
    errorLogs: number;
    totalTokens: number;
    errorRate: string;
    byType: Record<string, number>;
    byProvider: Array<{ provider: string; count: number; avgLatencyMs: number }>;
}

export default function LogViewer() {
    const [logs, setLogs] = useState<ApiLog[]>([]);
    const [stats, setStats] = useState<LogStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({
        logType: '',
        isError: '',
        provider: ''
    });
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

    useEffect(() => {
        fetchLogs();
        fetchStats();
    }, [filter]);

    const fetchLogs = async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            const params = new URLSearchParams();
            if (filter.logType) params.append('logType', filter.logType);
            if (filter.isError) params.append('isError', filter.isError);
            if (filter.provider) params.append('provider', filter.provider);
            params.append('limit', '50');

            const res = await fetch(`${apiUrl}/logs?${params}`);
            const data = await res.json();
            setLogs(data.logs || []);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            const res = await fetch(`${apiUrl}/logs/stats`);
            const data = await res.json();
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const exportLogs = () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const params = new URLSearchParams();
        if (filter.logType) params.append('logType', filter.logType);
        if (filter.isError) params.append('isError', filter.isError);
        if (filter.provider) params.append('provider', filter.provider);
        window.open(`${apiUrl}/logs/export?${params}`, '_blank');
    };

    const formatTimestamp = (ts: string) => {
        return new Date(ts).toLocaleString();
    };

    const getLogTypeColor = (type: string) => {
        switch (type) {
            case 'kore_chat': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'llm_evaluate': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
            case 'garak': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">API Logs</h2>
                </div>
                <button
                    onClick={exportLogs}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export CSV
                </button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-5 gap-4 mb-6">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalLogs}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Total Requests</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="text-2xl font-bold text-red-600">{stats.errorLogs}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Errors ({stats.errorRate}%)</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="text-2xl font-bold text-blue-600">{stats.byType['kore_chat'] || 0}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Kore.AI Calls</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="text-2xl font-bold text-purple-600">{stats.byType['llm_evaluate'] || 0}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">LLM Evaluations</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border-l-4 border-green-500 shadow-sm">
                        <div className="text-2xl font-bold text-green-600">{(stats.totalTokens || 0).toLocaleString()}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Tokens Used</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-4 mb-4">
                <select
                    value={filter.logType}
                    onChange={(e) => setFilter({ ...filter, logType: e.target.value })}
                    className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                    <option value="">All Types</option>
                    <option value="kore_chat">Kore.AI Chat</option>
                    <option value="llm_evaluate">LLM Evaluation</option>
                    <option value="garak">Garak</option>
                </select>
                <select
                    value={filter.isError}
                    onChange={(e) => setFilter({ ...filter, isError: e.target.value })}
                    className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                    <option value="">All Status</option>
                    <option value="false">Success Only</option>
                    <option value="true">Errors Only</option>
                </select>
                <select
                    value={filter.provider}
                    onChange={(e) => setFilter({ ...filter, provider: e.target.value })}
                    className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                    <option value="">All Providers</option>
                    <option value="kore">Kore.AI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Google Gemini</option>
                </select>
                <button
                    onClick={fetchLogs}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                    Refresh
                </button>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Time</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Provider</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Tokens</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Latency</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No logs found</td>
                            </tr>
                        ) : (
                            logs.map((log) => (
                                <React.Fragment key={log.id}>
                                    <tr
                                        className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${log.isError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                    >
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                            {formatTimestamp(log.timestamp)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-xs rounded-full ${getLogTypeColor(log.logType)}`}>
                                                {log.logType}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                            {log.provider || '-'}
                                            {log.model && <span className="text-xs text-gray-400 ml-1">({log.model})</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-xs rounded-full ${log.isError ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                                                {log.statusCode || (log.isError ? 'Error' : 'OK')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">
                                            {(log.totalTokens !== undefined && log.totalTokens !== null) ? log.totalTokens.toLocaleString() : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                            {log.latencyMs ? `${log.latencyMs.toLocaleString()}ms` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-400">
                                            {log.isError ? log.errorMessage?.substring(0, 50) : 'Click to expand'}
                                        </td>
                                    </tr>
                                    {expandedLog === log.id && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-4 bg-gray-100 dark:bg-gray-900">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Request</h4>
                                                        <pre className="text-xs bg-gray-800 text-green-400 p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap">
                                                            {log.requestBody || 'No request body'}
                                                        </pre>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Response</h4>
                                                        <pre className="text-xs bg-gray-800 text-blue-400 p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap">
                                                            {log.responseBody || 'No response body'}
                                                        </pre>
                                                    </div>
                                                </div>
                                                {log.errorMessage && (
                                                    <div className="mt-4">
                                                        <h4 className="font-medium text-red-600 mb-2">Error</h4>
                                                        <p className="text-sm text-red-500">{log.errorMessage}</p>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
