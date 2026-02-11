"use client";
import React, { useState, useEffect } from 'react';

interface ApiLog {
    id: string;
    userId: string;
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
        provider: '',
        userId: ''
    });
    const [sortConfig, setSortConfig] = useState<{ key: keyof ApiLog; direction: 'asc' | 'desc' }>({
        key: 'timestamp',
        direction: 'desc'
    });
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);
    const pageSize = 20;

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filter]);

    useEffect(() => {
        fetchLogs();
        fetchStats();
    }, [filter, currentPage]);

    const fetchLogs = async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            const params = new URLSearchParams();
            if (filter.logType) params.append('logType', filter.logType);
            if (filter.isError) params.append('isError', filter.isError);
            if (filter.provider) params.append('provider', filter.provider);
            if (filter.userId) params.append('userId', filter.userId);
            params.append('limit', pageSize.toString());
            params.append('offset', ((currentPage - 1) * pageSize).toString());

            const res = await fetch(`${apiUrl}/logs?${params}`);
            const data = await res.json();
            setLogs(data.logs || []);
            setTotalLogs(data.total || 0);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: keyof ApiLog) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const sortedLogs = React.useMemo(() => {
        const sorted = [...logs].sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortConfig.direction === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortConfig.direction === 'asc'
                    ? aValue - bValue
                    : bValue - aValue;
            }

            return 0;
        });
        return sorted;
    }, [logs, sortConfig]);

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
            case 'kore_chat': return 'bg-badge-blue-bg text-badge-blue-text';
            case 'kore_connect': return 'bg-badge-blue-bg text-badge-blue-text';
            case 'kore_validate': return 'bg-badge-orange-bg text-badge-orange-text';
            case 'kore_genAI_logs': return 'bg-badge-purple-bg text-badge-purple-text';
            case 'llm_evaluate': return 'bg-badge-purple-bg text-badge-purple-text';
            default: return 'bg-badge-gray-bg text-badge-gray-text';
        }
    };

    return (
        <div className="bg-[var(--surface)] shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-[var(--primary-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">API Logs</h2>
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
                    <div className="bg-stats-bg border border-stats-border rounded-lg p-4">
                        <div className="text-2xl font-bold text-[var(--foreground)]">{stats.totalLogs}</div>
                        <div className="text-sm text-[var(--foreground-muted)]">Total Requests</div>
                    </div>
                    <div className="bg-stats-bg border border-stats-border rounded-lg p-4">
                        <div className="text-2xl font-bold text-error-text">{stats.errorLogs}</div>
                        <div className="text-sm text-[var(--foreground-muted)]">Errors ({stats.errorRate}%)</div>
                    </div>
                    <div className="bg-stats-bg border border-stats-border rounded-lg p-4">
                        <div className="text-2xl font-bold text-info-text">{stats.byType['kore_chat'] || 0}</div>
                        <div className="text-sm text-[var(--foreground-muted)]">Kore.AI Calls</div>
                    </div>
                    <div className="bg-stats-bg border border-stats-border rounded-lg p-4">
                        <div className="text-2xl font-bold text-badge-purple-text">{stats.byType['llm_evaluate'] || 0}</div>
                        <div className="text-sm text-[var(--foreground-muted)]">LLM Evaluations</div>
                    </div>
                    <div className="bg-stats-bg border border-stats-border rounded-lg p-4 border-l-4 border-l-success-border shadow-sm">
                        <div className="text-2xl font-bold text-success-text">{(stats.totalTokens || 0).toLocaleString()}</div>
                        <div className="text-sm text-[var(--foreground-muted)] font-medium">Total Tokens Used</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-4 mb-4">
                <select
                    value={filter.logType}
                    onChange={(e) => setFilter({ ...filter, logType: e.target.value })}
                    className="px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg"
                >
                    <option value="">All Types</option>
                    <option value="kore_chat">Kore.AI Chat</option>
                    <option value="kore_connect">Kore.AI Connect</option>
                    <option value="kore_validate">Kore.AI Validate</option>
                    <option value="kore_genAI_logs">Gen AI Logs Fetch</option>
                    <option value="llm_evaluate">LLM Evaluation</option>
                </select>
                <select
                    value={filter.isError}
                    onChange={(e) => setFilter({ ...filter, isError: e.target.value })}
                    className="px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg"
                >
                    <option value="">All Status</option>
                    <option value="false">Success Only</option>
                    <option value="true">Errors Only</option>
                </select>
                <select
                    value={filter.provider}
                    onChange={(e) => setFilter({ ...filter, provider: e.target.value })}
                    className="px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg"
                >
                    <option value="">All Providers</option>
                    <option value="kore">Kore.AI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Google Gemini</option>
                </select>
                <input
                    type="text"
                    placeholder="Filter by User ID..."
                    value={filter.userId}
                    onChange={(e) => setFilter({ ...filter, userId: e.target.value })}
                    className="px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg"
                />
                <button
                    onClick={fetchLogs}
                    className="px-4 py-2 bg-[var(--primary-600)] text-white rounded-lg hover:bg-[var(--primary-700)]"
                >
                    Refresh
                </button>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--border)]">
                    <thead className="bg-[var(--surface-hover)]">
                        <tr>
                            {/* Sortable header helper */}
                            {(['timestamp', 'userId', 'logType', 'provider', 'statusCode', 'totalTokens', 'latencyMs'] as const).map((key) => {
                                const labels: Record<typeof key, string> = {
                                    timestamp: 'Time',
                                    userId: 'User',
                                    logType: 'Type',
                                    provider: 'Provider',
                                    statusCode: 'Status',
                                    totalTokens: 'Tokens',
                                    latencyMs: 'Latency'
                                };
                                return (
                                    <th
                                        key={key}
                                        onClick={() => handleSort(key)}
                                        className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase cursor-pointer hover:text-[var(--foreground)] transition-colors select-none"
                                    >
                                        <div className="flex items-center gap-1">
                                            {labels[key]}
                                            <span className="text-[10px]">
                                                {sortConfig.key === key ? (
                                                    sortConfig.direction === 'asc' ? '↑' : '↓'
                                                ) : '↕'}
                                            </span>
                                        </div>
                                    </th>
                                );
                            })}
                            <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground-muted)] uppercase">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-[var(--foreground-muted)]">Loading...</td>
                            </tr>
                        ) : sortedLogs.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-[var(--foreground-muted)]">No logs found</td>
                            </tr>
                        ) : (
                            sortedLogs.map((log) => (
                                <React.Fragment key={log.id}>
                                    <tr
                                        className={`cursor-pointer hover:bg-[var(--surface-hover)] ${log.isError ? 'bg-error-bg' : ''}`}
                                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                    >
                                        <td className="px-4 py-3 text-sm text-[var(--foreground-secondary)] whitespace-nowrap">
                                            {formatTimestamp(log.timestamp)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--foreground-secondary)] max-w-[200px] truncate" title={log.userId || 'N/A'}>
                                            {log.userId || <span className="text-[var(--foreground-muted)] italic">N/A</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-xs rounded-full ${getLogTypeColor(log.logType)}`}>
                                                {log.logType}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--foreground-secondary)]">
                                            {log.provider || '-'}
                                            {log.model && <span className="text-xs text-[var(--foreground-muted)] ml-1">({log.model})</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-xs rounded-full border ${log.isError ? 'bg-error-bg text-error-text border-error-border' : 'bg-success-bg text-success-text border-success-border'}`}>
                                                {log.statusCode || (log.isError ? 'Error' : 'OK')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--foreground-secondary)] font-mono">
                                            {(log.totalTokens !== undefined && log.totalTokens !== null) ? log.totalTokens.toLocaleString() : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--foreground-secondary)]">
                                            {log.latencyMs ? `${log.latencyMs.toLocaleString()}ms` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--foreground-muted)]">
                                            {log.isError ? log.errorMessage?.substring(0, 50) : 'Click to expand'}
                                        </td>
                                    </tr>
                                    {expandedLog === log.id && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-4 bg-[var(--surface-hover)]">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <h4 className="font-medium text-[var(--foreground)] mb-2">Request</h4>
                                                        <pre className="text-xs bg-white dark:bg-gray-900 text-green-600 dark:text-green-400 p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap border border-[var(--border)]">
                                                            {log.requestBody || 'No request body'}
                                                        </pre>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium text-[var(--foreground)] mb-2">Response</h4>
                                                        <pre className="text-xs bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap border border-[var(--border)]">
                                                            {log.responseBody || 'No response body'}
                                                        </pre>
                                                    </div>
                                                </div>
                                                {log.errorMessage && (
                                                    <div className="mt-4">
                                                        <h4 className="font-medium text-error-text mb-2">Error</h4>
                                                        <p className="text-sm text-error-text">{log.errorMessage}</p>
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

            {/* Pagination Controls */}
            {totalLogs > pageSize && (
                <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
                    <div className="text-sm text-[var(--foreground-muted)]">
                        Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalLogs)} of {totalLogs} logs
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setExpandedLog(null); }}
                            disabled={currentPage === 1}
                            className="px-2 py-1 text-xs font-medium rounded border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            ← Previous
                        </button>
                        {Array.from({ length: Math.ceil(totalLogs / pageSize) }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                onClick={() => { setCurrentPage(page); setExpandedLog(null); }}
                                className={`w-7 h-7 text-xs font-medium rounded transition-colors ${
                                    page === currentPage
                                        ? 'bg-[var(--primary-600)] text-white'
                                        : 'text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)]'
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            onClick={() => { setCurrentPage(p => Math.min(Math.ceil(totalLogs / pageSize), p + 1)); setExpandedLog(null); }}
                            disabled={currentPage === Math.ceil(totalLogs / pageSize)}
                            className="px-2 py-1 text-xs font-medium rounded border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
