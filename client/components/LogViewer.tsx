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
    prevPeriodTotal: number | null;
    last24h: number | null;
    dailyAvg: number | null;
    evalTokens: number;
    evalOutcome: { passed: number; failed: number; total: number };
    chatStats: { avgLatencyMs: number; maxLatencyMs: number; errorCount: number };
    byType: Record<string, number>;
    byProvider: Array<{ provider: string; count: number; avgLatencyMs: number; totalTokens: number }>;
    errorsByType: Record<string, number>;
    lastError: { timestamp: string; logType: string; errorMessage: string } | null;
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
                params.append('last24h', 'true');
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
                const genAiCount = stats.byType['kore_genAI_logs'] || 0;
                const otherCount = Math.max(0, stats.totalLogs - chatCount - evalCount - genAiCount);
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
                                {/* Trend indicator */}
                                {(() => {
                                    // Mode 1: Last 24h — compare vs daily average
                                    if (stats.last24h !== null && stats.dailyAvg !== null && stats.dailyAvg > 0) {
                                        const diff = stats.last24h - stats.dailyAvg;
                                        const pctChange = Math.round((diff / stats.dailyAvg) * 100);
                                        const isUp = diff > 0;
                                        const isFlat = diff === 0;
                                        return (
                                            <div className={`flex flex-col items-end gap-0.5 px-2 py-1 rounded-lg text-[10px] font-semibold ${
                                                isFlat ? 'bg-gray-50 dark:bg-gray-800 text-gray-500'
                                                    : isUp ? 'bg-emerald-50 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300'
                                                    : 'bg-red-50 dark:bg-red-900/60 text-red-500 dark:text-red-300'
                                            }`}>
                                                <div className="flex items-center gap-0.5">
                                                    {!isFlat && (
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                                                                d={isUp ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                                                        </svg>
                                                    )}
                                                    <span>{isFlat ? '—' : `${Math.abs(pctChange)}%`}</span>
                                                </div>
                                                <span className="text-[9px] font-normal text-[var(--foreground-muted)]">vs daily avg</span>
                                            </div>
                                        );
                                    }
                                    // Mode 2: Date range filter — compare vs previous period
                                    if (stats.prevPeriodTotal !== null) {
                                        const diff = stats.totalLogs - stats.prevPeriodTotal;
                                        const pctChange = stats.prevPeriodTotal > 0
                                            ? Math.round((diff / stats.prevPeriodTotal) * 100)
                                            : (stats.totalLogs > 0 ? 100 : 0);
                                        const isUp = diff > 0;
                                        const isFlat = diff === 0;
                                        return (
                                            <div className={`flex flex-col items-end gap-0.5 px-2 py-1 rounded-lg text-[10px] font-semibold ${
                                                isFlat ? 'bg-gray-50 dark:bg-gray-800 text-gray-500'
                                                    : isUp ? 'bg-emerald-50 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300'
                                                    : 'bg-red-50 dark:bg-red-900/60 text-red-500 dark:text-red-300'
                                            }`}>
                                                <div className="flex items-center gap-0.5">
                                                    {!isFlat && (
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                                                                d={isUp ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                                                        </svg>
                                                    )}
                                                    <span>{isFlat ? '—' : `${Math.abs(pctChange)}%`}</span>
                                                </div>
                                                <span className="text-[9px] font-normal text-[var(--foreground-muted)]">vs prev period</span>
                                            </div>
                                        );
                                    }
                                    // No filter — no meaningful trend to show
                                    return null;
                                })()}
                            </div>
                            {/* Mini type breakdown bar */}
                            {(chatCount + evalCount + genAiCount) > 0 && (
                                <div className="mt-3">
                                    <div className="flex w-full h-1.5 rounded-full overflow-hidden">
                                        {chatCount > 0 && <div className="bg-blue-400" style={{ width: `${(chatCount / stats.totalLogs) * 100}%`, minWidth: '3px' }} />}
                                        {evalCount > 0 && <div className="bg-purple-400" style={{ width: `${(evalCount / stats.totalLogs) * 100}%`, minWidth: '3px' }} />}
                                        {genAiCount > 0 && <div className="bg-amber-400" style={{ width: `${(genAiCount / stats.totalLogs) * 100}%`, minWidth: '3px' }} />}
                                        {otherCount > 0 && <div className="bg-gray-300 dark:bg-gray-600" style={{ width: `${(otherCount / stats.totalLogs) * 100}%`, minWidth: '3px' }} />}
                                    </div>
                                    <div className="flex gap-3 mt-1.5">
                                        <span className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />Chat</span>
                                        <span className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]"><span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />Eval</span>
                                        <span className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />GenAI</span>
                                        <span className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]"><span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-500 inline-block" />Other</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Errors with donut */}
                        <div className={`bg-[var(--surface)] border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow ${errorSeverity === 'critical' ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/20' : errorSeverity === 'medium' ? 'border-orange-200 dark:border-orange-800' : 'border-[var(--border)]'}`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className={`text-3xl font-bold tracking-tight ${stats.errorLogs > 0 ? 'text-red-600 dark:text-red-400' : 'text-[var(--foreground)]'}`}>{stats.errorLogs}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-medium text-[var(--foreground-muted)]">Errors</span>
                                        <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                            errorSeverity === 'none' ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/60' :
                                            errorSeverity === 'low' ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/60' :
                                            errorSeverity === 'medium' ? 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/60' :
                                            'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/60'
                                        }`}>
                                            {errorSeverity === 'none' ? 'All Clear' : errorSeverity === 'low' ? 'Low' : errorSeverity === 'medium' ? 'Elevated' : 'Critical'}
                                        </span>
                                    </div>
                                </div>
                                {/* SVG donut ring */}
                                <div className="relative w-10 h-10">
                                    <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                                        <circle cx="18" cy="18" r="14" fill="none" stroke="var(--border)" strokeWidth="3.5" />
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
                            {/* Error breakdown by type + last error */}
                            {stats.errorLogs > 0 && (() => {
                                const ebt = stats.errorsByType || {};
                                const errChat = ebt['kore_chat'] || 0;
                                const errEval = ebt['llm_evaluate'] || 0;
                                const errGenAi = ebt['kore_genAI_logs'] || 0;
                                const errOther = Math.max(0, stats.errorLogs - errChat - errEval - errGenAi);
                                return (
                                    <div className="mt-3">
                                        <div className="flex w-full h-1.5 rounded-full overflow-hidden">
                                            {errChat > 0 && <div className="bg-blue-400" style={{ width: `${(errChat / stats.errorLogs) * 100}%`, minWidth: '3px' }} />}
                                            {errEval > 0 && <div className="bg-purple-400" style={{ width: `${(errEval / stats.errorLogs) * 100}%`, minWidth: '3px' }} />}
                                            {errGenAi > 0 && <div className="bg-amber-400" style={{ width: `${(errGenAi / stats.errorLogs) * 100}%`, minWidth: '3px' }} />}
                                            {errOther > 0 && <div className="bg-gray-300 dark:bg-gray-600" style={{ width: `${(errOther / stats.errorLogs) * 100}%`, minWidth: '3px' }} />}
                                        </div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                            {errChat > 0 && <span className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />Chat {errChat}</span>}
                                            {errEval > 0 && <span className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]"><span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />Eval {errEval}</span>}
                                            {errGenAi > 0 && <span className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />GenAI {errGenAi}</span>}
                                            {errOther > 0 && <span className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]"><span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-500 inline-block" />Other {errOther}</span>}
                                        </div>
                                        {stats.lastError && (
                                            <div className="text-[10px] text-[var(--foreground-muted)] mt-1">
                                                Last: <span className="font-mono font-medium">{(() => {
                                                    const ago = Date.now() - new Date(stats.lastError.timestamp).getTime();
                                                    const mins = Math.floor(ago / 60000);
                                                    if (mins < 1) return 'just now';
                                                    if (mins < 60) return `${mins}m ago`;
                                                    const hrs = Math.floor(mins / 60);
                                                    if (hrs < 24) return `${hrs}h ago`;
                                                    return `${Math.floor(hrs / 24)}d ago`;
                                                })()}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Chat Messages */}
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-3xl font-bold text-[var(--foreground)] tracking-tight">{chatCount}</div>
                                    <div className="text-xs font-medium text-[var(--foreground-muted)] mt-1">Chat Messages</div>
                                </div>
                                {/* Success rate badge */}
                                {chatCount > 0 && (
                                    <div className={`flex flex-col items-end gap-0.5 px-2 py-1 rounded-lg text-[10px] font-semibold ${
                                        stats.chatStats.errorCount === 0 ? 'bg-emerald-50 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/60 text-red-500 dark:text-red-300'
                                    }`}>
                                        <span>{Math.round(((chatCount - stats.chatStats.errorCount) / chatCount) * 100)}%</span>
                                        <span className="text-[9px] font-normal text-[var(--foreground-muted)]">success</span>
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 space-y-1">
                                {chatCount > 0 ? (
                                    <>
                                        <div className="text-[10px] text-[var(--foreground-muted)]">
                                            Avg response: <span className="font-mono font-medium">{stats.chatStats.avgLatencyMs >= 10000 ? `${(stats.chatStats.avgLatencyMs / 1000).toFixed(1)}s` : `${stats.chatStats.avgLatencyMs.toLocaleString()}ms`}</span>
                                            {stats.chatStats.maxLatencyMs > 0 && (
                                                <span className="ml-1 text-[var(--foreground-muted)]">
                                                    (max {stats.chatStats.maxLatencyMs >= 10000 ? `${(stats.chatStats.maxLatencyMs / 1000).toFixed(1)}s` : `${stats.chatStats.maxLatencyMs.toLocaleString()}ms`})
                                                </span>
                                            )}
                                        </div>
                                        {stats.chatStats.errorCount > 0 && (
                                            <div className="text-[10px] text-red-500 dark:text-red-400">
                                                {stats.chatStats.errorCount} failed request{stats.chatStats.errorCount !== 1 ? 's' : ''}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-[10px] text-[var(--foreground-muted)]">No active chats</div>
                                )}
                            </div>
                        </div>

                        {/* LLM Evaluations — run-centric */}
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className={`text-3xl font-bold tracking-tight ${
                                        stats.evalOutcome.total === 0 ? 'text-[var(--foreground)]'
                                            : (stats.evalOutcome.failed / stats.evalOutcome.total) >= 0.10 ? 'text-red-600 dark:text-red-400'
                                            : (stats.evalOutcome.failed / stats.evalOutcome.total) >= 0.05 ? 'text-amber-500 dark:text-amber-400'
                                            : 'text-emerald-600 dark:text-emerald-400'
                                    }`}>{stats.evalOutcome.total}</div>
                                    <div className="text-xs font-medium text-[var(--foreground-muted)] mt-1">Evaluation Runs</div>
                                </div>
                                {stats.evalOutcome.total > 0 ? (
                                    <div className={`flex flex-col items-end gap-0.5 px-2 py-1 rounded-lg text-[10px] font-semibold ${
                                        stats.evalOutcome.failed === 0 ? 'bg-emerald-50 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300'
                                            : stats.evalOutcome.passed === 0 ? 'bg-red-50 dark:bg-red-900/60 text-red-500 dark:text-red-300'
                                            : 'bg-amber-50 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300'
                                    }`}>
                                        <span>{Math.round((stats.evalOutcome.passed / stats.evalOutcome.total) * 100)}%</span>
                                        <span className="text-[9px] font-normal text-[var(--foreground-muted)]">pass rate</span>
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/40 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            {stats.evalOutcome.total > 0 ? (
                                <div className="mt-3">
                                    {/* Pass/Fail breakdown bar */}
                                    <div className="flex w-full h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-emerald-400" style={{ width: `${(stats.evalOutcome.passed / stats.evalOutcome.total) * 100}%` }} />
                                        <div className="bg-red-400" style={{ width: `${(stats.evalOutcome.failed / stats.evalOutcome.total) * 100}%` }} />
                                    </div>
                                    <div className="flex gap-3 mt-1.5">
                                        <span className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Pass {stats.evalOutcome.passed}
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />Fail {stats.evalOutcome.failed}
                                        </span>
                                    </div>
                                    {/* Avg eval time */}
                                    {koreProviders.length > 0 && (() => {
                                        const totalEvalLatency = koreProviders.reduce((sum, p) => sum + p.avgLatencyMs * p.count, 0);
                                        const weightedAvg = evalCount > 0 ? Math.round(totalEvalLatency / evalCount) : 0;
                                        return weightedAvg > 0 && (
                                            <div className="text-[10px] text-[var(--foreground-muted)] mt-1.5">
                                                Avg eval time: <span className="font-mono font-medium">{weightedAvg >= 10000 ? `${(weightedAvg / 1000).toFixed(1)}s` : `${weightedAvg.toLocaleString()}ms`}</span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="mt-3 text-[10px] text-[var(--foreground-muted)]">No evaluations yet</div>
                            )}
                        </div>

                        {/* Total Tokens with provider breakdown */}
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-3xl font-bold text-[var(--foreground)] tracking-tight">{(stats.totalTokens || 0).toLocaleString()}</div>
                                    <div className="text-xs font-medium text-[var(--foreground-muted)] mt-1">Total Tokens</div>
                                </div>
                                {stats.costEstimate && stats.costEstimate.totalEstimate > 0 ? (
                                    <div className="flex flex-col items-end gap-0.5 px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800" title={stats.costEstimate.disclaimer}>
                                        <span className="text-xs font-mono font-semibold text-[var(--foreground)]">
                                            {stats.costEstimate.totalEstimate < 0.01 ? '<$0.01' : `$${stats.costEstimate.totalEstimate.toFixed(2)}`}
                                        </span>
                                        <span className="text-[9px] font-normal text-[var(--foreground-muted)]">Est. cost</span>
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/60 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            {/* Provider token breakdown bar */}
                            <div className="mt-3">
                                {(() => {
                                    const tokenProviders = (stats.byProvider || [])
                                        .filter(p => p.totalTokens > 0)
                                        .sort((a, b) => b.totalTokens - a.totalTokens);
                                    if (tokenProviders.length > 0 && stats.totalTokens > 0) {
                                        const top3 = tokenProviders.slice(0, 3);
                                        const rest = tokenProviders.slice(3);
                                        const otherTokens = rest.reduce((sum, p) => sum + p.totalTokens, 0);
                                        const displayProviders = otherTokens > 0
                                            ? [...top3, { provider: 'other', totalTokens: otherTokens, count: 0, avgLatencyMs: 0 }]
                                            : top3;
                                        return (
                                            <>
                                                <div className="flex w-full h-1.5 rounded-full overflow-hidden">
                                                    {displayProviders.map(p => (
                                                        <div key={p.provider} className="h-full" style={{
                                                            width: `${(p.totalTokens / stats.totalTokens) * 100}%`,
                                                            backgroundColor: providerColors[p.provider] || providerColors.unknown
                                                        }} />
                                                    ))}
                                                </div>
                                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                                                    {displayProviders.map(p => (
                                                        <span key={p.provider} className="flex items-center gap-1 text-[10px] text-[var(--foreground-muted)]">
                                                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: providerColors[p.provider] || providerColors.unknown }} />
                                                            {p.provider.charAt(0).toUpperCase() + p.provider.slice(1)} {p.totalTokens.toLocaleString()}
                                                        </span>
                                                    ))}
                                                </div>
                                            </>
                                        );
                                    }
                                    return (
                                        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                                                style={{ width: `${Math.min(((stats.totalTokens || 0) / Math.max(stats.totalTokens || 1, 100000)) * 100, 100)}%` }} />
                                        </div>
                                    );
                                })()}
                                {stats.evalTokens > 0 && stats.evalOutcome.total > 0 && (
                                    <div className="text-[10px] text-[var(--foreground-muted)] mt-1.5">
                                        Avg tokens/eval: <span className="font-mono font-medium">{Math.round(stats.evalTokens / stats.evalOutcome.total).toLocaleString()}</span>
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
                                        <circle cx="18" cy="18" r="14" fill="none" stroke="var(--border)" strokeWidth="3.5"
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
                                                        <pre className="text-xs bg-[var(--surface)] text-green-600 dark:text-green-300 p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap border border-[var(--border)]">
                                                            {log.requestBody || 'No request body'}
                                                        </pre>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium text-[var(--foreground)] mb-2">Response</h4>
                                                        <pre className="text-xs bg-[var(--surface)] text-blue-600 dark:text-blue-300 p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap border border-[var(--border)]">
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
