"use client";
import { useState, useEffect } from 'react';

interface Hyperparams {
    temperature: number;
    max_tokens: number;
    top_p: number;
}

interface Props {
    provider?: string;
    prompt: string | null;
    rawResponse: string | null;
    result: any | null;
    hyperparams?: Hyperparams;
    onHyperparamsChange?: (params: Hyperparams) => void;
    onPromptChange?: (prompt: string) => void;
    onRequestPayloadRegen?: (prompt: string) => Promise<string>;
    previewPayload?: any;
    onPayloadChange?: (payload: string) => void;
}

const DEFAULT_HYPERPARAMS: Hyperparams = {
    temperature: 0.0,
    max_tokens: 4096,
    top_p: 1.0
};

export default function EvaluationInspector({ provider, prompt, rawResponse, result, hyperparams, onHyperparamsChange, onPromptChange, onRequestPayloadRegen, previewPayload, onPayloadChange }: Props) {
    const [activeTab, setActiveTab] = useState<'prompt' | 'payload' | 'output' | 'full'>('prompt');
    const [showHyperparams, setShowHyperparams] = useState(false);
    const [localParams, setLocalParams] = useState<Hyperparams>(hyperparams || DEFAULT_HYPERPARAMS);

    // Editable states
    const [localPrompt, setLocalPrompt] = useState<string>("");
    const [localPayload, setLocalPayload] = useState<string>("");
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        if (hyperparams) setLocalParams(hyperparams);
    }, [hyperparams]);

    // Initialize local state from props when they change (unless we are editing)
    useEffect(() => {
        setLocalPrompt(prompt || "");
    }, [prompt]);

    useEffect(() => {
        const payload = result?.debug?.requestPayload || result?.requestPayload || previewPayload;
        if (payload) {
            setLocalPayload(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
        } else {
            setLocalPayload("");
        }

        // Auto-switch to results tab when a new result arrives
        if (result && !result.error && activeTab !== 'output' && activeTab !== 'full') {
            setActiveTab('output');
        }
    }, [result, previewPayload]);

    const handleParamChange = (key: keyof Hyperparams, value: number) => {
        let newParams = { ...localParams, [key]: value };

        // For Anthropic, Temperature and Top P are mutually exclusive
        if (provider === 'anthropic') {
            if (key === 'temperature' && value !== 0) {
                newParams.top_p = 1.0; // Reset top_p if using temperature
            } else if (key === 'top_p' && value !== 1.0) {
                newParams.temperature = 0.0; // Reset temperature if using top_p
            }
        }

        setLocalParams(newParams);
        onHyperparamsChange?.(newParams);
    };

    const handleTabChange = async (newTab: 'prompt' | 'payload' | 'output' | 'full') => {
        // Leaving Prompt Tab -> Entering Payload Tab
        if (activeTab === 'prompt' && newTab === 'payload') {
            // Refresh if prompt changed OR if we don't have a payload yet
            if (localPrompt && (localPrompt !== prompt || !localPayload) && onRequestPayloadRegen) {
                setIsSyncing(true);
                try {
                    const newPayload = await onRequestPayloadRegen(localPrompt);
                    setLocalPayload(newPayload);
                    onPayloadChange?.(newPayload);
                } catch (e) {
                    console.error("Failed to regen payload", e);
                } finally {
                    setIsSyncing(false);
                }
            }
        }

        // Leaving Payload Tab -> Entering Prompt Tab
        if (activeTab === 'payload' && newTab === 'prompt') {
            try {
                // Try to extract prompt from JSON payload
                const json = JSON.parse(localPayload);
                let extractedPrompt = null;

                // OpenAI / Anthropic format
                if (json.messages && Array.isArray(json.messages)) {
                    const lastMsg = json.messages[json.messages.length - 1];
                    if (lastMsg.content) extractedPrompt = lastMsg.content;
                }
                // Gemini format
                else if (json.contents && json.contents[0]?.parts?.[0]?.text) {
                    extractedPrompt = json.contents[0].parts[0].text.replace(/\n\nReturn JSON output\.$/, '');
                }

                if (extractedPrompt) {
                    setLocalPrompt(extractedPrompt);
                    onPromptChange?.(extractedPrompt);
                }
            } catch (e) {
                console.warn("Invalid JSON in payload tab, skipping sync");
            }
        }

        setActiveTab(newTab);
    };

    // Reactively update payload when hyperparams change, if we are on the payload tab
    useEffect(() => {
        const syncPayload = async () => {
            if (activeTab === 'payload' && localPrompt && onRequestPayloadRegen) {
                setIsSyncing(true);
                try {
                    const newPayload = await onRequestPayloadRegen(localPrompt);
                    setLocalPayload(newPayload);
                    onPayloadChange?.(newPayload);
                } catch (e) {
                    // Silently ignore - expected when no chat interaction exists yet
                } finally {
                    setIsSyncing(false);
                }
            }
        };

        syncPayload();
    }, [localParams, activeTab, onRequestPayloadRegen, onPayloadChange]);

    // Determine verdict and message from result
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

        // Passed Cleanly
        if (overallStatus === 'pass' || result.pass === true) {
            return {
                type: 'pass' as const,
                message: 'Passed All Guardrails',
                details: resultData.bot_response_evaluation?.overall?.comment || resultData.overall?.comment || result.comment || null
            };
        }

        // Passed with Warnings (e.g. not_detected)
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

        // Failures
        const failedChecks: string[] = [];
        if (Array.isArray(resultData.results)) {
            resultData.results.forEach((r: any) => {
                if (r.pass === false) { // Explicitly false
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
                        // Treat not_detected as a failure if it wasn't caught by pass_with_warnings (fallback)
                        failedChecks.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: Not Detected`);
                    }
                }
            });
        }

        const detailMessage = failedChecks.length > 0
            ? failedChecks.join('; ')
            : (resultData.overall?.comment || resultData.bot_response_evaluation?.overall?.comment || result.comment || 'Evaluation failed');

        return {
            type: 'fail' as const,
            message: 'Guardrail Violation Detected',
            details: detailMessage
        };
    };

    const resultData = result ? (result.result || result) : null;
    const verdictInfo = getVerdictInfo();

    // Helper to remove token usage from displayed response
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

    return (
        <div className="bg-[var(--surface)] shadow rounded-lg flex flex-col h-[600px]">
            {verdictInfo && (
                <div className={`p-4 border-b ${verdictInfo.type === 'pass' ? 'bg-success-bg border-success-border' :
                    verdictInfo.type === 'warning' ? 'bg-warning-bg border-warning-border' :
                        verdictInfo.type === 'error' ? 'bg-warning-bg border-warning-border' :
                            'bg-error-bg border-error-border'
                    }`}>
                    <div className="flex items-center gap-2">
                        <span className="text-xl">
                            {verdictInfo.type === 'pass' ? '✅' :
                                verdictInfo.type === 'warning' ? '⚠️' :
                                    verdictInfo.type === 'error' ? '⚠️' : '❌'}
                        </span>
                        <span className={`font-bold ${verdictInfo.type === 'pass' ? 'text-success-text' :
                            verdictInfo.type === 'warning' ? 'text-warning-text' :
                                verdictInfo.type === 'error' ? 'text-warning-text' :
                                    'text-error-text'
                            }`}>
                            {verdictInfo.message}
                        </span>
                    </div>
                    {verdictInfo.details && (
                        <p className={`mt-2 text-sm ${verdictInfo.type === 'pass' ? 'text-success-text' :
                            verdictInfo.type === 'warning' ? 'text-warning-text' :
                                verdictInfo.type === 'error' ? 'text-warning-text' :
                                    'text-error-text'
                            }`}>
                            {verdictInfo.details}
                        </p>
                    )}
                </div>
            )}

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
                    <div className="px-4 py-3 bg-[var(--surface-hover)] grid grid-cols-3 gap-4">
                        <div>
                            <label className={`block text-xs font-medium mb-1 ${(provider === 'anthropic' && localParams.top_p !== 1.0) ? 'text-[var(--foreground-muted)] opacity-50' : 'text-[var(--foreground-muted)]'}`}>
                                Temperature {(provider === 'anthropic' && localParams.top_p !== 1.0) && "(Ignored)"}
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="2"
                                step="0.1"
                                disabled={provider === 'anthropic' && localParams.top_p !== 1.0}
                                value={(provider === 'anthropic' && localParams.top_p !== 1.0) ? 0 : localParams.temperature}
                                onChange={(e) => handleParamChange('temperature', parseFloat(e.target.value) || 0)}
                                className={`w-full px-2 py-1.5 text-sm border rounded bg-[var(--surface)] text-[var(--foreground)] transition-opacity ${(provider === 'anthropic' && localParams.top_p !== 1.0) ? 'opacity-30 cursor-not-allowed border-[var(--border)]' : 'border-[var(--border)]'}`}
                            />
                            <span className="text-[10px] text-[var(--foreground-muted)]">0 = deterministic</span>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1">
                                Max Tokens
                            </label>
                            <input
                                type="number"
                                min="100"
                                max="8192"
                                step="100"
                                value={localParams.max_tokens}
                                onChange={(e) => handleParamChange('max_tokens', parseInt(e.target.value) || 4096)}
                                className="w-full px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--foreground)]"
                            />
                            <span className="text-[10px] text-[var(--foreground-muted)]">Response limit</span>
                        </div>
                        <div>
                            <label className={`block text-xs font-medium mb-1 ${(provider === 'anthropic' && localParams.temperature !== 0) ? 'text-[var(--foreground-muted)] opacity-50' : 'text-[var(--foreground-muted)]'}`}>
                                Top P {(provider === 'anthropic' && localParams.temperature !== 0) ? "(Ignored)" : (localParams.temperature !== 0 && localParams.top_p === 1.0 && "(Default)")}
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="1"
                                step="0.05"
                                disabled={provider === 'anthropic' && localParams.temperature !== 0}
                                value={(provider === 'anthropic' && localParams.temperature !== 0) ? 1 : localParams.top_p}
                                onChange={(e) => handleParamChange('top_p', parseFloat(e.target.value) || 1)}
                                className={`w-full px-2 py-1.5 text-sm border rounded bg-[var(--surface)] text-[var(--foreground)] transition-opacity ${(provider === 'anthropic' && localParams.temperature !== 0) ? 'opacity-30 cursor-not-allowed border-[var(--border)]' : 'border-[var(--border)]'}`}
                            />
                            <span className="text-[10px] text-[var(--foreground-muted)]">Nucleus sampling</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Tab Headers */}
            <div className="flex border-b border-[var(--border)] bg-[var(--surface-hover)]">
                <button
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'prompt' ? 'text-[var(--primary-600)] border-b-2 border-[var(--primary-600)] bg-[var(--surface)]' : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'}`}
                    onClick={() => handleTabChange('prompt')}
                >
                    Evaluation Prompt
                </button>
                <button
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'payload' ? 'text-[var(--primary-600)] border-b-2 border-[var(--primary-600)] bg-[var(--surface)]' : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'}`}
                    onClick={() => handleTabChange('payload')}
                >
                    Raw Request
                </button>
                <button
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'output' ? 'text-[var(--primary-600)] border-b-2 border-[var(--primary-600)] bg-[var(--surface)]' : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'}`}
                    onClick={() => handleTabChange('output')}
                >
                    Evaluation Results
                </button>
                <button
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'full' ? 'text-[var(--primary-600)] border-b-2 border-[var(--primary-600)] bg-[var(--surface)]' : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'}`}
                    onClick={() => handleTabChange('full')}
                >
                    Raw Response
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 h-0 overflow-auto p-4 bg-[var(--background)] font-mono text-xs border-t border-[var(--border)]">
                {isSyncing ? (
                    <div className="flex items-center justify-center h-full text-[var(--foreground-muted)]">Syncing...</div>
                ) : activeTab === 'prompt' ? (
                    <textarea
                        className="w-full h-full bg-transparent text-[var(--foreground)] resize-none outline-none border-none p-0 placeholder:text-[var(--foreground-muted)]"
                        value={localPrompt || ""}
                        onChange={(e) => {
                            setLocalPrompt(e.target.value);
                            onPromptChange?.(e.target.value);
                        }}
                        placeholder="No prompt generated yet."
                    />
                ) : activeTab === 'payload' ? (
                    <textarea
                        className="w-full h-full bg-transparent text-[var(--foreground)] resize-none outline-none border-none p-0 placeholder:text-[var(--foreground-muted)]"
                        value={localPayload || ""}
                        onChange={(e) => {
                            setLocalPayload(e.target.value);
                            onPayloadChange?.(e.target.value);
                        }}
                        placeholder="Raw API payload not available."
                    />
                ) : activeTab === 'output' ? (
                    <pre className="whitespace-pre-wrap text-[var(--foreground)]">
                        {rawResponse || "No evaluation output yet."}
                    </pre>
                ) : (
                    <pre className="whitespace-pre-wrap text-[var(--foreground)]">
                        {filterTokenInfo(result?.debug?.fullResponse || result?.fullApiResponse) || "Formatted response not available.\n\nThis shows the complete formatted response from the LLM provider."}
                    </pre>
                )}
            </div>
        </div>
    );
}
