"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import { getModelConfig, getDefaultsFromConfig, ParamDef } from '@/lib/model-hyperparams';
import { EvaluationResultsView } from './EvaluationResultsView';

interface Hyperparams {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    top_k?: number;
    reasoning_effort?: 'none' | 'low' | 'medium' | 'high';
    frequency_penalty?: number;
    presence_penalty?: number;
    seed?: number;
}

interface Props {
    provider?: string;
    model?: string;
    rawResponse: string | null;
    result: any | null;
    hyperparams?: Hyperparams;
    onHyperparamsChange?: (params: Hyperparams) => void;
    previewPayload?: any;
    evaluateStage?: string | null;
}

const DEFAULT_HYPERPARAMS: Hyperparams = {
    temperature: 0.0,
    max_tokens: 4096,
    top_p: 1.0
};

// ── Main Component ────────────────────────────────────────────────────────

export default function EvaluationInspector({ provider, model, rawResponse, result, hyperparams, onHyperparamsChange, previewPayload, evaluateStage }: Props) {
    const [activeTab, setActiveTab] = useState<'payload' | 'output' | 'full'>('output');
    const [showHyperparams, setShowHyperparams] = useState(false);
    const [localParams, setLocalParams] = useState<Hyperparams>(hyperparams || DEFAULT_HYPERPARAMS);
    const [expanded, setExpanded] = useState(false);

    // Track previous result to detect genuinely new results
    const prevResultRef = useRef<any>(null);

    // Model config — recomputed when provider/model changes
    const modelConfig = useMemo(() => getModelConfig(provider || '', model || ''), [provider, model]);

    // Track previous provider/model to detect changes
    const prevProviderModel = useRef<string>('');

    // Reset hyperparams to model defaults when provider/model changes
    useEffect(() => {
        const key = `${provider}|${model}`;
        if (prevProviderModel.current && prevProviderModel.current !== key) {
            const newDefaults = getDefaultsFromConfig(modelConfig);
            const hasMaxTokens = modelConfig.params.some(p => p.key === 'max_tokens');
            if (hasMaxTokens && localParams.max_tokens !== undefined) {
                const maxTokenParam = modelConfig.params.find(p => p.key === 'max_tokens');
                if (maxTokenParam && maxTokenParam.max && localParams.max_tokens <= maxTokenParam.max) {
                    newDefaults.max_tokens = localParams.max_tokens;
                }
            }
            setLocalParams(newDefaults);
            onHyperparamsChange?.(newDefaults);
        }
        prevProviderModel.current = key;
    }, [provider, model, modelConfig]);

    useEffect(() => {
        if (hyperparams) setLocalParams(hyperparams);
    }, [hyperparams]);

    // ESC key handler and body scroll lock for expanded modal
    useEffect(() => {
        if (!expanded) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
        document.addEventListener('keydown', handleKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKey);
            document.body.style.overflow = '';
        };
    }, [expanded]);

    // Auto-switch to results tab when a genuinely new result arrives
    useEffect(() => {
        if (result && result !== prevResultRef.current && !result.error && activeTab !== 'output' && activeTab !== 'full') {
            setActiveTab('output');
        }
        prevResultRef.current = result;
    }, [result]);

    // Format payload for display
    const displayPayload = useMemo(() => {
        const payload = result?.debug?.requestPayload || result?.requestPayload || previewPayload;
        if (!payload) return "";
        return typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    }, [result, previewPayload]);

    const handleParamChange = (key: string, value: number | string | undefined) => {
        const newParams = { ...localParams, [key]: value };
        setLocalParams(newParams);
        onHyperparamsChange?.(newParams);
    };

    const handleClearParam = (paramDef: ParamDef) => {
        if (!paramDef.disabledWhen) return;
        const blockingParam = modelConfig.params.find(p => p.key === paramDef.disabledWhen!.param);
        if (blockingParam) {
            const newParams = { ...localParams, [blockingParam.key]: blockingParam.defaultValue };
            setLocalParams(newParams);
            onHyperparamsChange?.(newParams);
        }
    };

    const isParamDisabled = (paramDef: ParamDef): boolean => {
        if (!paramDef.disabledWhen) return false;
        const { param, condition, value } = paramDef.disabledWhen;
        const currentValue = localParams[param as keyof Hyperparams];
        if (condition === 'not_equals') return currentValue !== value;
        if (condition === 'equals') return currentValue === value;
        return false;
    };

    // Determine verdict and message from result
    const resultData = result ? (result.result || result) : null;

    const getVerdictInfo = () => {
        if (!result) return null;

        if (result.error) {
            return {
                type: 'error' as const,
                message: result.error,
                details: result.details || null
            };
        }

        const overallStatus = resultData.bot_response_evaluation?.overall?.status || resultData.overall?.status;

        if (overallStatus === 'pass' || result.pass === true) {
            return {
                type: 'pass' as const,
                message: 'Passed All Guardrails',
                details: resultData.bot_response_evaluation?.overall?.comment || resultData.overall?.comment || result.comment || null
            };
        }

        if (overallStatus === 'pass_with_warnings') {
            const warningDetails: string[] = [];
            const evalData = resultData.bot_response_evaluation || resultData;
            ['toxicity', 'topics', 'injection', 'regex'].forEach(key => {
                const item = evalData[key];
                if (item && item.status === 'not_detected') {
                    warningDetails.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: Not Detected (Scanner missing in logs)`);
                }
            });

            return {
                type: 'warning' as const,
                message: 'Passed with Warnings',
                details: warningDetails.length > 0 ? warningDetails.join('; ') : (resultData.bot_response_evaluation?.overall?.comment || 'Guardrails passed but configuration issues detected.')
            };
        }

        const failedChecks: string[] = [];
        if (Array.isArray(resultData.results)) {
            resultData.results.forEach((r: any) => {
                if (r.pass === false) {
                    failedChecks.push(`${r.guardrail}: ${r.reason}`);
                }
            });
        } else {
            const evalData = resultData.bot_response_evaluation || resultData;
            ['toxicity', 'topics', 'injection', 'regex'].forEach(key => {
                const item = evalData[key];
                if (item) {
                    if (item.status === 'fail' || item.pass === false) {
                        failedChecks.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${item.reason}`);
                    } else if (item.status === 'not_detected') {
                        failedChecks.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: Not Detected`);
                    }
                }
            });
        }

        return {
            type: 'fail' as const,
            message: 'Guardrail Violation Detected',
            details: failedChecks.length > 0
                ? failedChecks.join('; ')
                : (resultData.overall?.comment || resultData.bot_response_evaluation?.overall?.comment || result.comment || 'Evaluation failed')
        };
    };

    const verdictInfo = getVerdictInfo();

    const filterTokenInfo = (response: any) => {
        if (!response) return response;
        if (typeof response === 'string') {
            try {
                const parsed = JSON.parse(response);
                const filtered = { ...parsed };
                delete filtered.usage;
                delete filtered.usageMetadata;
                delete filtered.totalTokens;
                delete filtered.inputTokens;
                delete filtered.outputTokens;
                return JSON.stringify(filtered, null, 2);
            } catch {
                return response;
            }
        }
        return response;
    };

    // Compute grid columns based on param count
    const paramCount = modelConfig.params.length;
    const gridCols = paramCount <= 2 ? 'grid-cols-2' : paramCount <= 4 ? `grid-cols-${Math.min(paramCount, 4)}` : 'grid-cols-4';
    const showInfoBanner = modelConfig.infoBanner && modelConfig.infoBannerWhen?.(localParams as Record<string, any>);

    return (
        <div className="bg-[var(--surface)] shadow rounded-lg flex flex-col h-[750px]">
            {/* Hyperparameter Controls */}
            <div className="border-b border-[var(--border)]">
                <button
                    onClick={() => setShowHyperparams(!showHyperparams)}
                    className="w-full px-4 py-2 text-left text-sm font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] flex items-center justify-between"
                >
                    <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                        Hyperparameters
                    </span>
                    <svg className={`w-4 h-4 transform transition-transform ${showHyperparams ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {showHyperparams && (
                    <div className="px-4 py-3 bg-[var(--surface-hover)]">
                        {showInfoBanner && (
                            <div className="mb-3 px-3 py-2 rounded text-[11px] text-[var(--foreground-muted)] bg-[var(--surface)] border border-[var(--border)] flex items-center gap-2">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {modelConfig.infoBanner}
                            </div>
                        )}
                        <div className={`grid ${gridCols} gap-4`}>
                            {modelConfig.params.map((paramDef) => {
                                const disabled = isParamDisabled(paramDef);
                                const currentValue = localParams[paramDef.key as keyof Hyperparams];

                                if (paramDef.type === 'select') {
                                    return (
                                        <div key={paramDef.key}>
                                            <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
                                                {paramDef.label}
                                            </label>
                                            <select
                                                value={(currentValue as string) || paramDef.defaultValue || ''}
                                                onChange={(e) => handleParamChange(paramDef.key, e.target.value)}
                                                className="w-full px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--foreground)]"
                                            >
                                                {paramDef.options?.map(opt => (
                                                    <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                                                ))}
                                            </select>
                                            <span className="text-[10px] text-[var(--foreground-muted)]">{paramDef.helpText}</span>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={paramDef.key}>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className={`block text-xs font-medium ${disabled ? 'text-[var(--foreground-muted)] opacity-50' : 'text-[var(--foreground-muted)]'}`}>
                                                {paramDef.label}
                                                {disabled && (
                                                    <svg className="w-3 h-3 inline ml-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                    </svg>
                                                )}
                                            </label>
                                        </div>
                                        <input
                                            type="number"
                                            min={paramDef.min}
                                            max={paramDef.max}
                                            step={paramDef.step}
                                            disabled={disabled}
                                            value={disabled ? (paramDef.defaultValue ?? '') : (currentValue ?? '')}
                                            onChange={(e) => {
                                                const val = e.target.value === '' ? undefined : (paramDef.step && paramDef.step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value));
                                                handleParamChange(paramDef.key, val);
                                            }}
                                            placeholder={paramDef.placeholder}
                                            className={`w-full px-2 py-1.5 text-sm border rounded bg-[var(--surface)] text-[var(--foreground)] transition-opacity ${disabled ? 'opacity-30 cursor-not-allowed border-[var(--border)]' : 'border-[var(--border)]'}`}
                                        />
                                        {disabled && paramDef.disabledWhen ? (
                                            <button onClick={() => handleClearParam(paramDef)} className="text-[10px] text-[var(--accent-primary,var(--primary-600))] hover:underline cursor-pointer">
                                                {paramDef.disabledWhen.clearLabel}
                                            </button>
                                        ) : (
                                            <span className="text-[10px] text-[var(--foreground-muted)]">{paramDef.helpText}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Tab Headers */}
            <div className="flex border-b border-[var(--border)] bg-[var(--surface-hover)]">
                <button
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'payload' ? 'text-[var(--primary-600)] border-b-2 border-[var(--primary-600)] bg-[var(--surface)]' : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'}`}
                    onClick={() => setActiveTab('payload')}
                >
                    Raw Request
                </button>
                <button
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'output' ? 'text-[var(--primary-600)] border-b-2 border-[var(--primary-600)] bg-[var(--surface)]' : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'}`}
                    onClick={() => setActiveTab('output')}
                >
                    Evaluation Results
                </button>
                <button
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'full' ? 'text-[var(--primary-600)] border-b-2 border-[var(--primary-600)] bg-[var(--surface)]' : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'}`}
                    onClick={() => setActiveTab('full')}
                >
                    Raw Response
                </button>
                {resultData && activeTab === 'output' && (
                    <button
                        onClick={() => setExpanded(true)}
                        className="px-3 py-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
                        title="Expand to full screen"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Content — all read-only */}
            <div className="flex-1 h-0 overflow-auto p-4 bg-[var(--background)] border-t border-[var(--border)]">
                {activeTab === 'payload' ? (
                    <pre className="whitespace-pre-wrap text-[var(--foreground)] font-mono text-xs">
                        {displayPayload || "Raw API payload not available.\n\nSend a message to the bot and configure guardrails to generate a preview."}
                    </pre>
                ) : activeTab === 'output' ? (
                    resultData ? (
                        <EvaluationResultsView
                            resultData={resultData}
                            model={result?.model}
                            totalTokens={result?.totalTokens}
                            inputTokens={result?.inputTokens}
                            outputTokens={result?.outputTokens}
                            latencyMs={result?.latencyMs}
                        />
                    ) : evaluateStage ? (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--foreground-secondary)] text-sm">
                            <svg className="animate-spin h-8 w-8 mb-4 text-[var(--primary-600)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="font-mono text-sm">{evaluateStage}<span className="animate-pulse">|</span></p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--foreground-muted)] text-sm">
                            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p>No evaluation output yet.</p>
                            <p className="text-xs mt-1">Click "Perform Guardrail Evaluation" to run an evaluation.</p>
                        </div>
                    )
                ) : (
                    <pre className="whitespace-pre-wrap text-[var(--foreground)] font-mono text-xs">
                        {filterTokenInfo(result?.debug?.fullResponse || result?.fullApiResponse) || "Formatted response not available.\n\nThis shows the complete formatted response from the LLM provider."}
                    </pre>
                )}
            </div>

            {/* Fullscreen Modal */}
            {expanded && resultData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setExpanded(false)}>
                    <div
                        className="bg-[var(--surface)] rounded-lg shadow-2xl flex flex-col"
                        style={{ width: '90vw', height: '90vh' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                            <div className="flex items-center gap-3">
                                <h2 className="text-lg font-semibold text-[var(--foreground)]">Evaluation Results</h2>
                                {verdictInfo && (
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                        verdictInfo.type === 'pass' ? 'bg-emerald-50 text-emerald-700' :
                                        verdictInfo.type === 'warning' ? 'bg-amber-50 text-amber-700' :
                                        verdictInfo.type === 'error' ? 'bg-amber-50 text-amber-700' :
                                        'bg-red-50 text-red-700'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                            verdictInfo.type === 'pass' ? 'bg-emerald-500' :
                                            verdictInfo.type === 'warning' ? 'bg-amber-500' :
                                            verdictInfo.type === 'error' ? 'bg-amber-500' :
                                            'bg-red-500'
                                        }`} />
                                        {verdictInfo.message}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setExpanded(false)}
                                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] p-1 rounded hover:bg-[var(--surface-hover)] transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        {/* Modal Content */}
                        <div className="flex-1 overflow-auto p-6">
                            <EvaluationResultsView
                                resultData={resultData}
                                model={result?.model}
                                totalTokens={result?.totalTokens}
                                inputTokens={result?.inputTokens}
                                outputTokens={result?.outputTokens}
                                latencyMs={result?.latencyMs}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
