"use client";
import { useState, useEffect } from 'react';

interface Hyperparams {
    temperature: number;
    max_tokens: number;
    top_p: number;
}

interface Props {
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

export default function EvaluationInspector({ prompt, rawResponse, result, hyperparams, onHyperparamsChange, onPromptChange, onRequestPayloadRegen, previewPayload, onPayloadChange }: Props) {
    const [activeTab, setActiveTab] = useState<'prompt' | 'payload' | 'output' | 'full' | 'analysis'>('prompt');
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
    }, [result, previewPayload]);

    const handleParamChange = (key: keyof Hyperparams, value: number) => {
        const newParams = { ...localParams, [key]: value };
        setLocalParams(newParams);
        onHyperparamsChange?.(newParams);
    };

    const handleTabChange = async (newTab: 'prompt' | 'payload' | 'output' | 'full' | 'analysis') => {
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
                    console.error("Failed to sync payload on param change", e);
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

        const resultData = result.result || result;
        const pass = result.pass;

        if (pass) {
            return {
                type: 'pass' as const,
                message: 'Passed All Guardrails',
                details: resultData.bot_response_evaluation?.overall?.comment || resultData.overall?.comment || result.comment || null
            };
        }

        const failedChecks: string[] = [];
        if (Array.isArray(resultData.results)) {
            resultData.results.forEach((r: any) => {
                if (r.pass === false) { // Explicitly false, not 'N/A' or true
                    failedChecks.push(`${r.guardrail}: ${r.reason}`);
                }
            });
        } else {
            const evalData = resultData.bot_response_evaluation || resultData;
            ['toxicity', 'topics', 'injection', 'regex'].forEach(key => {
                const item = evalData[key];
                if (item && (item.status === 'fail' || item.pass === false)) {
                    failedChecks.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${item.reason}`);
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

    const verdictInfo = getVerdictInfo();

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg flex flex-col h-[600px]">
            {verdictInfo && (
                <div className={`p-4 border-b ${verdictInfo.type === 'pass' ? 'bg-green-50 border-green-200' :
                    verdictInfo.type === 'error' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-center gap-2">
                        <span className="text-xl">
                            {verdictInfo.type === 'pass' ? '✅' : verdictInfo.type === 'error' ? '⚠️' : '❌'}
                        </span>
                        <span className={`font-bold ${verdictInfo.type === 'pass' ? 'text-green-800' :
                            verdictInfo.type === 'error' ? 'text-yellow-800' :
                                'text-red-800'
                            }`}>
                            {verdictInfo.message}
                        </span>
                    </div>
                    {verdictInfo.details && (
                        <p className={`mt-2 text-sm ${verdictInfo.type === 'pass' ? 'text-green-700' :
                            verdictInfo.type === 'error' ? 'text-yellow-700' :
                                'text-red-700'
                            }`}>
                            {verdictInfo.details}
                        </p>
                    )}
                </div>
            )}

            {/* Hyperparameter Controls */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setShowHyperparams(!showHyperparams)}
                    className="w-full px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between"
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
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 grid grid-cols-3 gap-4">
                        <div>
                            <label className={`block text-xs font-medium mb-1 ${localParams.top_p !== 1.0 ? 'text-gray-400 opacity-50' : 'text-gray-500 dark:text-gray-400'}`}>
                                Temperature {localParams.top_p !== 1.0 && "(Ignored)"}
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="2"
                                step="0.1"
                                disabled={localParams.top_p !== 1.0}
                                value={localParams.top_p !== 1.0 ? 0 : localParams.temperature}
                                onChange={(e) => handleParamChange('temperature', parseFloat(e.target.value) || 0)}
                                className={`w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-opacity ${localParams.top_p !== 1.0 ? 'opacity-30 cursor-not-allowed border-gray-200' : 'border-gray-300 dark:border-gray-600'}`}
                            />
                            <span className="text-[10px] text-gray-400">0 = deterministic</span>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Max Tokens
                            </label>
                            <input
                                type="number"
                                min="100"
                                max="4096"
                                step="100"
                                value={localParams.max_tokens}
                                onChange={(e) => handleParamChange('max_tokens', parseInt(e.target.value) || 1024)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            />
                            <span className="text-[10px] text-gray-400">Response length limit</span>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Top P {localParams.temperature !== 0 && localParams.top_p === 1.0 && "(Default)"}
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="1"
                                step="0.05"
                                value={localParams.top_p}
                                onChange={(e) => handleParamChange('top_p', parseFloat(e.target.value) || 1)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            />
                            <span className="text-[10px] text-gray-400">Nucleus sampling</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Tab Headers */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <button
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'prompt' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white dark:bg-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => handleTabChange('prompt')}
                >
                    Evaluation Prompt
                </button>
                <button
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'payload' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white dark:bg-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => handleTabChange('payload')}
                >
                    Raw Request
                </button>
                <button
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'output' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white dark:bg-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => handleTabChange('output')}
                >
                    LLM Output
                </button>
                <button
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'full' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white dark:bg-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => handleTabChange('full')}
                >
                    Provider Response
                </button>
                <button
                    className={`flex-1 py-3 text-sm font-medium ${activeTab === 'analysis' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white dark:bg-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => handleTabChange('analysis')}
                >
                    System Analysis
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 h-0 overflow-auto p-4 bg-gray-900 font-mono text-xs">
                {isSyncing ? (
                    <div className="flex items-center justify-center h-full text-gray-400">Syncing...</div>
                ) : activeTab === 'prompt' ? (
                    <textarea
                        className="w-full h-full bg-transparent text-green-400 resize-none outline-none border-none p-0"
                        value={localPrompt || ""}
                        onChange={(e) => {
                            setLocalPrompt(e.target.value);
                            onPromptChange?.(e.target.value);
                        }}
                        placeholder="No prompt generated yet."
                    />
                ) : activeTab === 'payload' ? (
                    <textarea
                        className="w-full h-full bg-transparent text-yellow-400 resize-none outline-none border-none p-0"
                        value={localPayload || ""}
                        onChange={(e) => {
                            setLocalPayload(e.target.value);
                            onPayloadChange?.(e.target.value);
                        }}
                        placeholder="Raw API payload not available."
                    />
                ) : activeTab === 'output' ? (
                    <pre className="whitespace-pre-wrap text-blue-400">
                        {rawResponse || "No evaluation output yet."}
                    </pre>
                ) : activeTab === 'analysis' ? (
                    <div className="text-gray-300 space-y-4">
                        {result?.result?.guardrail_system_performance ? (
                            <>
                                <div className="border-b border-gray-700 pb-2">
                                    <h3 className="text-sm font-bold text-indigo-400 mb-1 uppercase tracking-wider">System Audit Summary</h3>
                                    <p className="text-lg text-white">{result.result.guardrail_system_performance.overall_assessment?.rating?.toUpperCase() || "N/A"}</p>
                                    <p className="text-gray-400 italic">"{result.result.guardrail_system_performance.overall_assessment?.comment}"</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-800 p-2 rounded">
                                        <p className="text-[10px] text-gray-500 uppercase">Detection Accuracy</p>
                                        <p className="text-xs font-semibold">{result.result.guardrail_system_performance.detection_accuracy?.rating || "N/A"}</p>
                                    </div>
                                    <div className="bg-gray-800 p-2 rounded">
                                        <p className="text-[10px] text-gray-500 uppercase">Fallback Behavior</p>
                                        <p className="text-xs font-semibold">{result.result.guardrail_system_performance.fallback_behavior?.triggered_correctly ? "Correct" : "Incorrect"}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase mb-1">Detailed Findings</p>
                                    <ul className="list-disc list-inside space-y-1 text-xs">
                                        <li><strong>Detection:</strong> {result.result.guardrail_system_performance.detection_accuracy?.details}</li>
                                        <li><strong>False Positives:</strong> {result.result.guardrail_system_performance.false_positives?.details || "None reported"}</li>
                                        <li><strong>False Negatives:</strong> {result.result.guardrail_system_performance.false_negatives?.details || "None reported"}</li>
                                        <li><strong>Coverage Gaps:</strong> {result.result.guardrail_system_performance.coverage_gaps?.recommendations || "No gaps identified"}</li>
                                    </ul>
                                </div>
                            </>
                        ) : (
                            <div className="text-gray-500 p-4 border border-dashed border-gray-700 rounded text-center">
                                Detailed system performance audit only available after running an evaluation.
                            </div>
                        )}
                    </div>
                ) : (
                    <pre className="whitespace-pre-wrap text-purple-400">
                        {result?.debug?.fullResponse || result?.fullApiResponse || "Formatted response not available.\n\nThis shows the complete formatted response from the LLM provider including metadata like token usage."}
                    </pre>
                )}
            </div>
        </div>
    );
}
