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
    avgLatencyMs: number;
    maxLatencyMs: number;
    errorRate: string;
    byType: Record<string, number>;
    byProvider: Array<{ provider: string; count: number; avgLatencyMs: number }>;
}

export default function LogViewer() {
    const [logs, setLogs] = useState<ApiLog[]>([]);
    const [stats, setStats] = useState<LogStats | null>(null);
    const [loading, setLoading] = useState(true);
    const today = new Date().toISOString().split('T')[0];
    const [filter, setFilter] = useState({
        logType: '',
        isError: '',
        provider: '',
        userId: '',
        startDate: '',
        endDate: '',
        last24h: false
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
            if (filter.last24h) {
                params.append('startDate', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
                params.append('endDate', new Date().toISOString());
            } else {
                if (filter.startDate) params.append('startDate', filter.startDate);
                if (filter.endDate) params.append('endDate', filter.endDate);
            }
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
            const params = new URLSearchParams();
            if (filter.logType) params.append('logType', filter.logType);
            if (filter.isError) params.append('isError', filter.isError);
            if (filter.provider) params.append('provider', filter.provider);
            if (filter.userId) params.append('userId', filter.userId);
            if (filter.last24h) {
                params.append('startDate', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
                params.append('endDate', new Date().toISOString());
            } else {
                if (filter.startDate) params.append('startDate', filter.startDate);
                if (filter.endDate) params.append('endDate', filter.endDate);
            }

            const res = await fetch(`${apiUrl}/logs/stats?${params}`);
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

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
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
                <div className="flex items-center gap-2">
                    <label className="text-xs uppercase text-[var(--foreground-muted)] font-medium">From</label>
                    <input
                        type="date"
                        value={filter.startDate}
                        max={filter.endDate || today}
                        onChange={(e) => setFilter({ ...filter, startDate: e.target.value, last24h: false })}
                        onFocus={() => filter.last24h && setFilter(f => ({ ...f, last24h: false }))}
                        className={`px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg ${filter.last24h ? 'opacity-40' : ''}`}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs uppercase text-[var(--foreground-muted)] font-medium">To</label>
                    <input
                        type="date"
                        value={filter.endDate}
                        min={filter.startDate || undefined}
                        max={today}
                        onChange={(e) => setFilter({ ...filter, endDate: e.target.value, last24h: false })}
                        onFocus={() => filter.last24h && setFilter(f => ({ ...f, last24h: false }))}
                        className={`px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg ${filter.last24h ? 'opacity-40' : ''}`}
                    />
                </div>
                <button
                    onClick={() => setFilter({ ...filter, startDate: '', endDate: '', last24h: !filter.last24h })}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                        filter.last24h
                            ? 'bg-[var(--primary-600)] text-white border-[var(--primary-600)]'
                            : 'border-[var(--border)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)]'
                    }`}
                >
                    Last 24h
                </button>
                <button
                    onClick={() => { setCurrentPage(1); setExpandedLog(null); fetchLogs(); fetchStats(); }}
                    disabled={loading}
                    className="px-4 py-2 bg-[var(--primary-600)] text-white rounded-lg hover:bg-[var(--primary-700)] disabled:opacity-60 flex items-center gap-2"
                >
                    {loading && (
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    )}
                    Refresh
                </button>
                <button
                    onClick={() => {
                        setFilter({ logType: '', isError: '', provider: '', userId: '', startDate: '', endDate: '', last24h: false });
                        setCurrentPage(1);
                        setExpandedLog(null);
                    }}
                    className="px-3 py-2 text-sm border border-[var(--border)] text-[var(--foreground-muted)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                >
                    Clear Filters
                </button>
            </div>

            {/* Stats Cards */}
            {stats && (() => {
                const errorPct = stats.totalLogs > 0 ? (stats.errorLogs / stats.totalLogs) * 100 : 0;
                const successPct = 100 - errorPct;
                const errorSeverity = errorPct === 0 ? 'none' : errorPct < 5 ? 'low' : errorPct < 20 ? 'medium' : 'critical';
                const providerColors: Record<string, string> = { kore: '#3b82f6', anthropic: '#8b5cf6', openai: '#10b981', gemini: '#f59e0b', deepseek: '#06b6d4', unknown: '#9ca3af' };
                const maxProviderCount = Math.max(...(stats.byProvider?.map(p => p.count) || [1]), 1);
                const formatLatency = (ms: number) => ms >= 10000 ? `${(ms / 1000).toFixed(1)}s` : `${ms.toLocaleString()}ms`;
                const latencyColor = stats.avgLatencyMs < 1000 ? '#059669' : stats.avgLatencyMs < 5000 ? '#d97706' : '#dc2626';
                const latencyPct = stats.maxLatencyMs > 0 ? Math.min((stats.avgLatencyMs / stats.maxLatencyMs) * 100, 100) : 0;
                const chatCount = stats.byType['kore_chat'] || 0;
                const evalCount = stats.byType['llm_evaluate'] || 0;
                const koreProviders = stats.byProvider?.filter(p => p.provider !== 'kore') || [];

                return (
                    <div className="grid grid-cols-6 gap-4 mb-6">
                        {/* Total Requests */}
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-3xl font-bold text-[var(--foreground)] tracking-tight">{stats.totalLogs}</div>
                                    <div className="text-xs font-medium text-[var(--foreground-muted)] mt-1">Total Requests</div>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                            </div>
                            {/* Mini type breakdown bar */}
                            {stats.totalLogs > 0 && (
                                <div className="mt-3">
                                    <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
                                        {chatCount > 0 && <div className="bg-blue-400" style={{ width: `${(chatCount / stats.totalLogs) * 100}%` }} />}
                                        {evalCount > 0 && <div className="bg-purple-400" style={{ width: `${(evalCount / stats.totalLogs) * 100}%` }} />}
                                        {(stats.totalLogs - chatCount - evalCount) > 0 && <div className="bg-gray-300" style={{ width: `${((stats.totalLogs - chatCount - evalCount) / stats.totalLogs) * 100}%` }} />}
                                    </div>
                                    <div className="flex gap-3 mt-1.5">
                                        <span className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />Chat</span>
                                        <span className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]"><span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />Eval</span>
                                        <span className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]"><span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />Other</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Errors with donut */}
                        <div className={`bg-[var(--surface)] border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow ${errorSeverity === 'critical' ? 'border-red-200 bg-red-50/30' : errorSeverity === 'medium' ? 'border-orange-200' : 'border-[var(--border)]'}`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className={`text-3xl font-bold tracking-tight ${stats.errorLogs > 0 ? 'text-red-600' : 'text-[var(--foreground)]'}`}>{stats.errorLogs}</div>
                                    <div className="text-xs font-medium text-[var(--foreground-muted)] mt-1">Errors</div>
                                </div>
                                {/* SVG donut ring */}
                                <div className="relative w-10 h-10">
                                    <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                                        <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
                                        <circle cx="18" cy="18" r="14" fill="none"
                                            stroke={errorPct > 20 ? '#dc2626' : errorPct > 5 ? '#f59e0b' : '#059669'}
                                            strokeWidth="3.5" strokeLinecap="round"
                                            strokeDasharray={`${successPct * 0.88} 88`} />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-[var(--foreground-muted)]">
                                        {errorPct.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                            <div className="mt-2">
                                <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                    errorSeverity === 'none' ? 'text-green-700 bg-green-50' :
                                    errorSeverity === 'low' ? 'text-green-700 bg-green-50' :
                                    errorSeverity === 'medium' ? 'text-orange-700 bg-orange-50' :
                                    'text-red-700 bg-red-50'
                                }`}>
                                    {errorSeverity === 'none' ? 'All Clear' : errorSeverity === 'low' ? 'Low' : errorSeverity === 'medium' ? 'Elevated' : 'Critical'}
                                </span>
                            </div>
                        </div>

                        {/* Chat Messages */}
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-3xl font-bold text-blue-600 tracking-tight">{chatCount}</div>
                                    <div className="text-xs font-medium text-[var(--foreground-muted)] mt-1">Chat Messages</div>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="mt-3 text-[10px] text-[var(--foreground-muted)]">
                                {chatCount > 0
                                    ? `${((chatCount / Math.max(stats.totalLogs, 1)) * 100).toFixed(0)}% of all traffic`
                                    : 'No active chats'}
                            </div>
                        </div>

                        {/* LLM Evaluations with provider bars */}
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-3xl font-bold text-purple-600 tracking-tight">{evalCount}</div>
                                    <div className="text-xs font-medium text-[var(--foreground-muted)] mt-1">LLM Evaluations</div>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                            {/* Mini provider bars */}
                            {koreProviders.length > 0 && (
                                <div className="mt-3 space-y-1">
                                    {koreProviders.slice(0, 3).map(p => (
                                        <div key={p.provider} className="flex items-center gap-2">
                                            <span className="text-[10px] text-[var(--foreground-muted)] w-14 truncate capitalize">{p.provider}</span>
                                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{
                                                    width: `${(p.count / maxProviderCount) * 100}%`,
                                                    backgroundColor: providerColors[p.provider] || providerColors.unknown
                                                }} />
                                            </div>
                                            <span className="text-[10px] font-mono text-[var(--foreground-muted)]">{p.count}</span>
                                        </div>
                                    ))}
                                    {koreProviders.length === 0 && (
                                        <div className="text-[10px] text-[var(--foreground-muted)]">No providers yet</div>
                                    )}
                                </div>
                            )}
                            {koreProviders.length === 0 && (
                                <div className="mt-3 text-[10px] text-[var(--foreground-muted)]">
                                    {evalCount > 0 ? `${evalCount} evaluation${evalCount !== 1 ? 's' : ''} run` : 'No evaluations yet'}
                                </div>
                            )}
                        </div>

                        {/* Total Tokens with progress bar */}
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-3xl font-bold text-emerald-600 tracking-tight">{(stats.totalTokens || 0).toLocaleString()}</div>
                                    <div className="text-xs font-medium text-[var(--foreground-muted)] mt-1">Total Tokens</div>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                </div>
                            </div>
                            {/* Token usage bar */}
                            <div className="mt-3">
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                                        style={{ width: `${Math.min(((stats.totalTokens || 0) / Math.max(stats.totalTokens || 1, 100000)) * 100, 100)}%` }} />
                                </div>
                                {koreProviders.length > 0 && (
                                    <div className="text-[10px] text-[var(--foreground-muted)] mt-1.5">
                                        {koreProviders.length} provider{koreProviders.length !== 1 ? 's' : ''} used
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Avg Latency with gauge */}
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-3xl font-bold tracking-tight" style={{ color: latencyColor }}>
                                        {formatLatency(stats.avgLatencyMs)}
                                    </div>
                                    <div className="text-xs font-medium text-[var(--foreground-muted)] mt-1">Avg Latency</div>
                                </div>
                                {/* Gauge arc */}
                                <div className="relative w-10 h-10">
                                    <svg viewBox="0 0 36 36" className="w-10 h-10" style={{ transform: 'rotate(-90deg)' }}>
                                        <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3.5"
                                            strokeDasharray="66 88" />
                                        <circle cx="18" cy="18" r="14" fill="none"
                                            stroke={latencyColor} strokeWidth="3.5" strokeLinecap="round"
                                            strokeDasharray={`${latencyPct * 0.66} 88`} />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-[var(--foreground-muted)]">
                                        AVG
                                    </span>
                                </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                {stats.maxLatencyMs > 0 && (
                                    <span className="text-[10px] text-[var(--foreground-muted)]">
                                        Max: <span className="font-mono font-medium">{formatLatency(stats.maxLatencyMs)}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

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
                                        <td className="px-4 py-3 text-sm text-[var(--foreground-muted)] max-w-[300px] truncate">
                                            {log.isError
                                                ? log.errorMessage?.substring(0, 50)
                                                : log.logType === 'kore_chat'
                                                    ? (() => {
                                                        try {
                                                            const req = typeof log.requestBody === 'string' ? JSON.parse(log.requestBody) : log.requestBody;
                                                            return req?.message ? `💬 ${req.message}` : 'Click to expand';
                                                        } catch { return 'Click to expand'; }
                                                    })()
                                                    : 'Click to expand'}
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
            {totalLogs > pageSize && (() => {
                const totalPages = Math.ceil(totalLogs / pageSize);
                const groupSize = 20;
                const currentGroup = Math.floor((currentPage - 1) / groupSize);
                const groupStart = currentGroup * groupSize + 1;
                const groupEnd = Math.min(groupStart + groupSize - 1, totalPages);

                return (
                    <div className="mt-4 flex flex-col items-center gap-2 border-t border-[var(--border)] pt-4">
                        <div className="text-sm text-[var(--foreground-muted)]">
                            Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalLogs)} of {totalLogs} logs
                        </div>
                        <div className="flex items-center gap-1">
                            {/* Previous group */}
                            {groupStart > 1 && (
                                <button
                                    onClick={() => { setCurrentPage(groupStart - 1); setExpandedLog(null); }}
                                    className="px-2 py-1 text-xs font-medium rounded border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] transition-colors"
                                    title={`Pages ${groupStart - groupSize}–${groupStart - 1}`}
                                >
                                    ←
                                </button>
                            )}
                            <button
                                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setExpandedLog(null); }}
                                disabled={currentPage === 1}
                                className="px-2 py-1 text-xs font-medium rounded border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Prev
                            </button>
                            {Array.from({ length: groupEnd - groupStart + 1 }, (_, i) => groupStart + i).map(page => (
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
                                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setExpandedLog(null); }}
                                disabled={currentPage === totalPages}
                                className="px-2 py-1 text-xs font-medium rounded border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                            {/* Next group */}
                            {groupEnd < totalPages && (
                                <button
                                    onClick={() => { setCurrentPage(groupEnd + 1); setExpandedLog(null); }}
                                    className="px-2 py-1 text-xs font-medium rounded border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] transition-colors"
                                    title={`Pages ${groupEnd + 1}–${Math.min(groupEnd + groupSize, totalPages)}`}
                                >
                                     →
                                </button>
                            )}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
