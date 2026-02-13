"use client";

// ── Shared Evaluation Results Components ─────────────────────────────────
// Used by both EvaluationInspector (narrow panel) and RunHistory (expanded row)

export const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
        pass: 'bg-green-100 text-green-800',
        fail: 'bg-red-100 text-red-800',
        not_tested: 'bg-gray-100 text-gray-600',
        not_detected: 'bg-amber-100 text-amber-800',
    };
    const labels: Record<string, string> = {
        pass: 'Pass', fail: 'Fail', not_tested: 'Not Tested', not_detected: 'Not Detected',
    };
    return (
        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
            {labels[status] || status}
        </span>
    );
};

export const RatingBadge = ({ rating }: { rating: string }) => {
    const r = rating.toLowerCase();
    let style = 'bg-gray-100 text-gray-800';
    if (r === 'effective') style = 'bg-green-100 text-green-800';
    else if (r === 'partially_effective') style = 'bg-amber-100 text-amber-800';
    else if (r === 'ineffective') style = 'bg-red-100 text-red-800';
    else if (r === 'high') style = 'bg-green-100 text-green-800';
    else if (r === 'medium') style = 'bg-amber-100 text-amber-800';
    else if (r === 'low') style = 'bg-red-100 text-red-800';
    return (
        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full ${style}`}>
            {rating.replace(/_/g, ' ')}
        </span>
    );
};

const OverallStatusIcon = ({ status }: { status: string }) => {
    if (status === 'pass') return <span className="text-lg">✅</span>;
    if (status === 'fail') return <span className="text-lg">❌</span>;
    return <span className="text-lg">⚠️</span>;
};

interface EvaluationResultsViewProps {
    resultData: any;
    model?: string | null;
    totalTokens?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    latencyMs?: number | null;
}

export function EvaluationResultsView({ resultData, model, totalTokens, inputTokens, outputTokens, latencyMs }: EvaluationResultsViewProps) {
    const evalData = resultData.bot_response_evaluation || resultData;
    const overall = evalData.overall;
    const perf = resultData.guardrail_system_performance;
    const guardrails = ['toxicity', 'topics', 'injection', 'regex'];

    return (
        <div className="space-y-4 font-sans text-sm">
            {/* Overall Assessment */}
            {perf?.overall_assessment && (
                <div className={`rounded-lg p-4 border-2 ${
                    overall?.status === 'fail' ? 'border-red-300 bg-red-50/50' :
                    overall?.status === 'pass_with_warnings' ? 'border-amber-300 bg-amber-50/50' :
                    overall?.status === 'pass' ? 'border-green-300 bg-green-50/50' :
                    'border-[var(--border)] bg-[var(--surface)]'
                }`}>
                    <div className="flex items-center gap-2 mb-2">
                        <OverallStatusIcon status={overall?.status || ''} />
                        <span className="font-semibold text-[var(--foreground)]">Overall Assessment</span>
                        <RatingBadge rating={perf.overall_assessment.rating} />
                    </div>
                    <p className="text-xs text-[var(--foreground-secondary)] leading-relaxed">
                        {perf.overall_assessment.comment}
                    </p>
                </div>
            )}

            {/* Guardrail Results — 2x2 grid */}
            <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-2">Guardrail Results</h4>
                <div className="grid grid-cols-2 gap-2">
                    {guardrails.map(key => {
                        const item = evalData[key];
                        if (!item) return null;
                        const label = key.charAt(0).toUpperCase() + key.slice(1);
                        return (
                            <div key={key} className="rounded-lg border border-[var(--border)] p-3 bg-[var(--surface)]">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-semibold text-[var(--foreground)]">{label}</span>
                                    <StatusBadge status={item.status} />
                                </div>
                                <p className="text-[11px] text-[var(--foreground-secondary)] leading-relaxed line-clamp-3" title={item.reason}>
                                    {item.reason}
                                </p>
                                {key === 'injection' && item.detected_in_user_input !== null && item.detected_in_user_input !== undefined && (
                                    <div className="mt-1.5 flex gap-3 text-[10px] text-[var(--foreground-muted)]">
                                        <span>Injection detected: <strong>{item.detected_in_user_input ? 'Yes' : 'No'}</strong></span>
                                        <span>Bot leaked: <strong>{item.bot_leaked_info ? 'Yes' : 'No'}</strong></span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Summary Stats */}
            {overall && (
                <div className="grid grid-cols-5 gap-2">
                    {[
                        { label: 'Tested', value: overall.tested_guardrails, color: 'text-[var(--foreground)]' },
                        { label: 'Passed', value: overall.passed_guardrails, color: 'text-green-600' },
                        { label: 'Failed', value: overall.failed_guardrails, color: 'text-red-600' },
                        { label: 'Not Tested', value: overall.not_tested_guardrails, color: 'text-gray-500' },
                        { label: 'Not Detected', value: overall.not_detected_guardrails, color: 'text-amber-600' },
                    ].map(stat => (
                        <div key={stat.label} className="text-center rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 px-1">
                            <div className={`text-lg font-bold ${stat.color}`}>{stat.value ?? '—'}</div>
                            <div className="text-[9px] uppercase tracking-wide text-[var(--foreground-muted)] font-medium">{stat.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Evaluation Metrics */}
            {(totalTokens || latencyMs || model) && (
                <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-2">Evaluation Metrics</h4>
                    <div className="grid grid-cols-5 gap-2">
                        {model && (
                            <div className="text-center rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 px-1">
                                <div className="text-xs font-bold text-[var(--foreground)] font-mono truncate" title={model}>{model}</div>
                                <div className="text-[9px] uppercase tracking-wide text-[var(--foreground-muted)] font-medium">Model</div>
                            </div>
                        )}
                        {inputTokens != null && (
                            <div className="text-center rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 px-1">
                                <div className="text-xs font-bold text-green-600">{inputTokens.toLocaleString()}</div>
                                <div className="text-[9px] uppercase tracking-wide text-[var(--foreground-muted)] font-medium">Input Tokens</div>
                            </div>
                        )}
                        {outputTokens != null && (
                            <div className="text-center rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 px-1">
                                <div className="text-xs font-bold text-[var(--primary-600)]">{outputTokens.toLocaleString()}</div>
                                <div className="text-[9px] uppercase tracking-wide text-[var(--foreground-muted)] font-medium">Output Tokens</div>
                            </div>
                        )}
                        {totalTokens != null && (
                            <div className="text-center rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 px-1">
                                <div className="text-xs font-bold text-[var(--foreground)]">{totalTokens.toLocaleString()}</div>
                                <div className="text-[9px] uppercase tracking-wide text-[var(--foreground-muted)] font-medium">Total Tokens</div>
                            </div>
                        )}
                        {latencyMs != null && (
                            <div className="text-center rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 px-1">
                                <div className="text-xs font-bold text-[var(--foreground)]">{(latencyMs / 1000).toFixed(2)}s</div>
                                <div className="text-[9px] uppercase tracking-wide text-[var(--foreground-muted)] font-medium">Latency</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* System Performance */}
            {perf && (
                <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-muted)] mb-2">System Performance</h4>
                    <div className="space-y-2">
                        {perf.detection_accuracy && (
                            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-[var(--foreground)]">Detection Accuracy</span>
                                    <RatingBadge rating={perf.detection_accuracy.rating} />
                                </div>
                                <p className="text-[11px] text-[var(--foreground-secondary)] leading-relaxed">{perf.detection_accuracy.details}</p>
                            </div>
                        )}
                        {[
                            { key: 'false_positives', label: 'False Positives', field: 'found' },
                            { key: 'false_negatives', label: 'False Negatives', field: 'found' },
                        ].map(({ key, label, field }) => {
                            const item = perf[key];
                            if (!item) return null;
                            return (
                                <div key={key} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-[var(--foreground)]">{label}</span>
                                        <span className={`text-[10px] font-bold uppercase ${item[field] ? 'text-red-600' : 'text-green-600'}`}>
                                            {item[field] ? 'Found' : 'None'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-[var(--foreground-secondary)] leading-relaxed">{item.details}</p>
                                </div>
                            );
                        })}
                        {perf.coverage_gaps && (
                            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-[var(--foreground)]">Coverage Gaps</span>
                                    <span className={`text-[10px] font-bold uppercase ${perf.coverage_gaps.found ? 'text-amber-600' : 'text-green-600'}`}>
                                        {perf.coverage_gaps.found ? 'Found' : 'None'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-[var(--foreground-secondary)] leading-relaxed">{perf.coverage_gaps.recommendations}</p>
                            </div>
                        )}
                        {perf.configuration_consistency && (
                            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-[var(--foreground)]">Config Consistency</span>
                                    <span className={`text-[10px] font-bold uppercase ${perf.configuration_consistency.consistent ? 'text-green-600' : 'text-red-600'}`}>
                                        {perf.configuration_consistency.consistent ? 'Consistent' : 'Discrepancies'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-[var(--foreground-secondary)] leading-relaxed">{perf.configuration_consistency.discrepancies}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Parse raw LLM output string into structured evaluation data
export function parseEvaluationOutput(llmOutput: string): any | null {
    if (!llmOutput) return null;

    try {
        let cleanOutput = llmOutput.trim();

        // Handle API response wrapper (Anthropic format)
        try {
            const apiResponse = JSON.parse(cleanOutput);
            if (apiResponse.content && Array.isArray(apiResponse.content)) {
                cleanOutput = apiResponse.content[0]?.text || cleanOutput;
            }
        } catch {
            // Not a JSON API response wrapper
        }

        // Strip markdown code blocks
        if (cleanOutput.startsWith('```json')) {
            cleanOutput = cleanOutput.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanOutput.startsWith('```')) {
            cleanOutput = cleanOutput.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        // Extract JSON object
        const jsonMatch = cleanOutput.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanOutput = jsonMatch[0];
        }

        const parsed = JSON.parse(cleanOutput);

        // Verify it has expected structure
        if (parsed.bot_response_evaluation || parsed.guardrail_system_performance || parsed.overall) {
            return parsed;
        }

        return null;
    } catch {
        return null;
    }
}
