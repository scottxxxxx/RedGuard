"use client";
import { useState, useEffect, useRef, useCallback } from 'react';

// Custom Dialog Component
const InfoDialog = ({ isOpen, onClose, title, message }: { isOpen: boolean; onClose: () => void; title: string; message: string }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-3">{title}</h3>
                <div className="text-sm text-[var(--foreground-muted)] whitespace-pre-line mb-6">
                    {message}
                </div>
                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[var(--primary-500)] hover:bg-[var(--primary-600)] text-white rounded-md font-medium transition-colors"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

// Refactored to exclude LLM Config (now handled by EvaluationSettings)
export type GuardrailPolicy = {
    activeGuardrails: string[];
    bannedTopics: string;
    regexPatterns: string[];
};

interface Props {
    onConfigChange: (config: GuardrailPolicy) => void;
    onBotConfigUpdate?: (config: any) => void;
    botConfig?: any; // Bot connection config for exporting App Definition
}

const FeatureInfoButton = ({ text, features }: { text?: string, features?: string[] }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={`relative ml-2 ${isOpen ? 'z-[100]' : 'z-0'}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors focus:outline-none"
                aria-label="More Information"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-8 w-80 p-4 bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] rounded-lg shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-between items-start mb-3 border-b border-[var(--border)] pb-2">
                        <h4 className="font-semibold text-sm text-[var(--foreground)]">Feature Details</h4>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-0.5 hover:bg-[var(--surface-hover)] rounded"
                            aria-label="Close"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {text && <p className="mb-4 text-xs text-[var(--foreground-muted)] leading-relaxed">{text}</p>}

                    {features && features.length > 0 ? (
                        <div className="max-h-60 overflow-y-auto pr-1">
                            <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-[var(--primary-600)]">Enabled for Features:</p>
                            <ul className="list-disc pl-4 space-y-1.5 bg-[var(--surface-hover)] p-2 rounded border border-[var(--border)]">
                                {features.map((f, i) => (
                                    <li key={i} className="text-xs text-[var(--foreground-muted)]">{f}</li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="text-xs text-[var(--foreground-muted)] italic bg-[var(--surface-hover)] p-2 rounded border border-[var(--border)]">
                            Load app definition to view enabled features
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default function GuardrailSettings({ onConfigChange, onBotConfigUpdate, botConfig }: Props) {
    const [toggles, setToggles] = useState({
        toxicity_input: true,
        toxicity_output: true,
        topics_input: true,
        topics_output: true,
        injection: true,
        regex: false
    });
    const [bannedTopics, setBannedTopics] = useState("politics, violence, competitors");
    const [regexPatterns, setRegexPatterns] = useState("");

    const [dialog, setDialog] = useState<{ isOpen: boolean; title: string; message: string }>({
        isOpen: false,
        title: '',
        message: ''
    });

    const showDialog = (title: string, message: string) => {
        setDialog({ isOpen: true, title, message });
    };

    const [descriptions, setDescriptions] = useState<Record<string, string>>({
        'toxicity': "Prevent the dissemination of potentially harmful prompts and responses by analysing the toxicity of the text.",
        'topics': "Ensure the conversations are within acceptable boundaries and avoid any conversations by adding a list of sensitive or controversial topics.",
        'injection': "Secure the application from prompt manipulations tailored against LLMs by identifying and mitigating the injections in the prompts.",
        'regex': "Discard the LLM response that contains one or more text patterns."
    });
    const [featureDetails, setFeatureDetails] = useState<Record<string, string[]>>({});

    // Backup state
    const [backupStatus, setBackupStatus] = useState<'idle' | 'starting' | 'exporting' | 'extracting' | 'completed' | 'error'>('idle');
    const [backupError, setBackupError] = useState<string | null>(null);
    const [backupJobId, setBackupJobId] = useState<string | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const applyAnalysisResult = useCallback((data: any) => {
        const newToggles = {
            toxicity_input: false,
            toxicity_output: false,
            topics_input: false,
            topics_output: false,
            injection: false,
            regex: false
        };

        if (data.descriptions) setDescriptions(data.descriptions);
        if (data.featureDetails) setFeatureDetails(data.featureDetails);

        if (data.enabledGuardrails && Array.isArray(data.enabledGuardrails)) {
            data.enabledGuardrails.forEach((key: string) => {
                if (key.includes('toxicity')) {
                    if (key.includes('input')) newToggles.toxicity_input = true;
                    if (key.includes('output')) newToggles.toxicity_output = true;
                } else if (key.includes('topics')) {
                    if (key.includes('input')) newToggles.topics_input = true;
                    if (key.includes('output')) newToggles.topics_output = true;
                } else if (key.includes('injection')) {
                    newToggles.injection = true;
                } else if (key.includes('regex')) {
                    newToggles.regex = true;
                }
            });
        }

        if (data.topics && data.topics.length > 0) {
            setBannedTopics(data.topics.join(', '));
        }

        if (data.regexPatterns && data.regexPatterns.length > 0) {
            setRegexPatterns(data.regexPatterns.join('\n'));
        }

        setToggles(newToggles);
    }, []);

    // Cleanup polling/dismiss timers
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        };
    }, []);

    const handleFetchFromBot = async () => {
        if (!botConfig?.botId || !botConfig?.clientId || !botConfig?.clientSecret) return;

        setBackupStatus('starting');
        setBackupError(null);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            const startRes = await fetch(`${apiUrl}/kore/backup-guardrails`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botConfig })
            });

            if (!startRes.ok) {
                const errData = await startRes.json();
                throw new Error(errData.error || 'Failed to start backup');
            }

            const { jobId } = await startRes.json();
            setBackupJobId(jobId);
            setBackupStatus('exporting');

            // Poll for status
            pollIntervalRef.current = setInterval(async () => {
                try {
                    const statusRes = await fetch(`${apiUrl}/kore/backup-guardrails/${jobId}`);
                    const statusData = await statusRes.json();

                    if (statusData.status === 'completed' && statusData.guardrails) {
                        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                        pollIntervalRef.current = null;
                        setBackupStatus('completed');
                        applyAnalysisResult(statusData.guardrails);

                        // Auto-dismiss after 5s
                        dismissTimerRef.current = setTimeout(() => {
                            setBackupStatus('idle');
                        }, 5000);
                    } else if (statusData.status === 'failed') {
                        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                        pollIntervalRef.current = null;
                        setBackupStatus('error');
                        setBackupError(statusData.error || 'Export failed');
                    }
                    // else still in progress, keep polling
                } catch (pollErr) {
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                    setBackupStatus('error');
                    setBackupError('Lost connection to backup service');
                }
            }, 5000);
        } catch (err) {
            setBackupStatus('error');
            setBackupError(err instanceof Error ? err.message : String(err));
        }
    };

    useEffect(() => {
        const active = Object.entries(toggles)
            .filter(([_, enabled]) => enabled)
            .map(([key]) => key);

        onConfigChange({
            activeGuardrails: active,
            bannedTopics,
            regexPatterns: regexPatterns.split('\n').filter(p => p.trim() !== '')
        });
    }, [toggles, bannedTopics, regexPatterns, onConfigChange]);

    const handleToggle = (key: keyof typeof toggles) => {
        setToggles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="card p-6 h-full flex flex-col overflow-auto">
            <div className="shrink-0 flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[var(--primary-50)] flex items-center justify-center">
                        <svg className="w-4 h-4 text-[var(--primary-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            <line x1="9" y1="12" x2="15" y2="12" />
                        </svg>
                    </div>
                    <h3 className="text-base font-semibold text-[var(--foreground)]">
                        Guardrail Configuration
                    </h3>
                </div>

                {/* Import / Fetch Buttons */}
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        id="config-upload"
                        className="hidden"
                        accept=".json"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            const reader = new FileReader();
                            reader.onload = async (ev) => {
                                try {
                                    console.log("📄 File loaded, parsing JSON...");
                                    const content = JSON.parse(ev.target?.result as string);
                                    console.log("✅ JSON parsed successfully");

                                    // 1. Update Bot ID if found
                                    const botId = content.botId || content._id || content.id;

                                    console.log("Bot ID:", botId);

                                    if (botId && onBotConfigUpdate) {
                                        onBotConfigUpdate((prev: any) => ({ ...prev, botId }));
                                    }

                                    // 2. Request logic analysis from backend
                                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
                                    console.log("🔄 Sending to backend:", apiUrl);

                                    const res = await fetch(`${apiUrl}/evaluate/analyze-config`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ botConfig: content })
                                    });

                                    console.log("📥 Response status:", res.status);

                                    if (res.ok) {
                                        const data = await res.json();
                                        console.log("Analysis Result:", data);
                                        applyAnalysisResult(data);
                                        console.log("Guardrail settings updated successfully!");
                                    } else {
                                        const errorText = await res.text();
                                        console.error("❌ Failed to analyze config file. Status:", res.status);
                                        console.error("Error response:", errorText);
                                        alert(`Failed to analyze config: ${errorText}`);
                                    }
                                } catch (err) {
                                    console.error("❌ Error:", err);
                                    if (err instanceof SyntaxError) {
                                        alert("Invalid JSON file. Please check the file format.");
                                    } else {
                                        alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
                                    }
                                }
                                e.target.value = '';
                            };
                            reader.readAsText(file);
                        }}
                    />
                    <button
                        onClick={() => document.getElementById('config-upload')?.click()}
                        className="text-xs flex items-center gap-1 text-[var(--primary-600)] hover:text-[var(--primary-700)] font-medium bg-[var(--primary-50)] hover:bg-[var(--primary-100)] px-2 py-1 rounded transition-colors"
                        title="Upload an App Definition file to import guardrail settings."
                    >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span className="leading-tight text-center">Import&nbsp;App<br />Definition&nbsp;File</span>
                    </button>
                    <button
                        onClick={handleFetchFromBot}
                        disabled={!botConfig?.botId || !botConfig?.clientId || !botConfig?.clientSecret || backupStatus === 'starting' || backupStatus === 'exporting' || backupStatus === 'extracting'}
                        className="text-xs flex items-center gap-1 text-[var(--primary-600)] hover:text-[var(--primary-700)] font-medium bg-[var(--primary-50)] hover:bg-[var(--primary-100)] px-2 py-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={!botConfig?.botId ? "Connect to a bot first" : "Fetch guardrail configuration directly from the bot"}
                    >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                        <span className="leading-tight text-center">Fetch&nbsp;from<br />Bot</span>
                    </button>
                </div>
            </div>

            {/* Backup Status Indicator */}
            {backupStatus !== 'idle' && (
                <div className={`mb-3 px-3 py-2 rounded-md text-xs flex items-center gap-2 ${
                    backupStatus === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : backupStatus === 'error'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                    {(backupStatus === 'starting' || backupStatus === 'exporting' || backupStatus === 'extracting') && (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    )}
                    {backupStatus === 'completed' && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                    {backupStatus === 'error' && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    )}
                    <span className="flex-1">
                        {backupStatus === 'starting' && 'Initiating bot backup...'}
                        {backupStatus === 'exporting' && 'Exporting bot configuration... This may take 1-2 minutes.'}
                        {backupStatus === 'extracting' && 'Extracting guardrail settings...'}
                        {backupStatus === 'completed' && 'Guardrails loaded from bot'}
                        {backupStatus === 'error' && (backupError || 'An error occurred')}
                    </span>
                    {(backupStatus === 'completed' || backupStatus === 'error') && (
                        <button
                            onClick={() => { setBackupStatus('idle'); setBackupError(null); }}
                            className="text-current opacity-60 hover:opacity-100"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            )}

            <div className="space-y-4">
                {/* Toxicity */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[var(--foreground)]">Restrict Toxicity</span>
                        <FeatureInfoButton text={descriptions['toxicity']} features={featureDetails['toxicity']} />
                    </div>
                    <div className="ml-2 flex flex-row gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={toggles.toxicity_input} onChange={() => handleToggle('toxicity_input')} className="rounded border-[var(--border)] text-[var(--primary-600)] shadow-sm focus:border-[var(--primary-500)] focus:ring focus:ring-[var(--primary-200)] focus:ring-opacity-50" />
                            <span className="text-xs text-[var(--foreground-muted)]">Input Filtering</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={toggles.toxicity_output} onChange={() => handleToggle('toxicity_output')} className="rounded border-[var(--border)] text-[var(--primary-600)] shadow-sm focus:border-[var(--primary-500)] focus:ring focus:ring-[var(--primary-200)] focus:ring-opacity-50" />
                            <span className="text-xs text-[var(--foreground-muted)]">Output Filtering</span>
                        </label>
                    </div>
                </div>

                {/* Topics */}
                <div className="space-y-2 border-t border-[var(--border)] pt-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[var(--foreground)]">Restrict Topics</span>
                        <FeatureInfoButton text={descriptions['topics']} features={featureDetails['topics']} />
                    </div>
                    <div className="ml-2 flex flex-row gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={toggles.topics_input} onChange={() => handleToggle('topics_input')} className="rounded border-[var(--border)] text-[var(--primary-600)] shadow-sm focus:border-[var(--primary-500)] focus:ring focus:ring-[var(--primary-200)] focus:ring-opacity-50" />
                            <span className="text-xs text-[var(--foreground-muted)]">Input Filtering</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={toggles.topics_output} onChange={() => handleToggle('topics_output')} className="rounded border-[var(--border)] text-[var(--primary-600)] shadow-sm focus:border-[var(--primary-500)] focus:ring focus:ring-[var(--primary-200)] focus:ring-opacity-50" />
                            <span className="text-xs text-[var(--foreground-muted)]">Output Filtering</span>
                        </label>
                    </div>

                    {(toggles.topics_input || toggles.topics_output) && (
                        <div className="ml-2 mt-2">
                            <textarea
                                value={bannedTopics}
                                onChange={(e) => setBannedTopics(e.target.value)}
                                className="input w-full text-xs text-[var(--foreground)] p-2"
                                rows={2}
                                placeholder="Enter banned topics..."
                            />
                        </div>
                    )}
                </div>

                {/* Injection */}
                <div className="border-t border-[var(--border)] pt-3">
                    <label className="flex items-center p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">
                        <div className="flex items-center gap-3 flex-1">
                            <input
                                type="checkbox"
                                checked={toggles.injection}
                                onChange={() => handleToggle('injection')}
                                className="h-4 w-4 text-[var(--primary-600)] border-[var(--border)] rounded focus:ring-[var(--primary-500)] cursor-pointer"
                            />
                            <span className="text-sm text-[var(--foreground)]">Detect Prompt Injections (Input Only)</span>
                        </div>
                        <FeatureInfoButton text={descriptions['injection']} features={featureDetails['injection']} />
                    </label>
                </div>

                {/* Regex */}
                <div className="border-t border-[var(--border)] pt-3">
                    <label className="flex items-center p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">
                        <div className="flex items-center gap-3 flex-1">
                            <input
                                type="checkbox"
                                checked={toggles.regex}
                                onChange={() => handleToggle('regex')}
                                className="h-4 w-4 text-[var(--primary-600)] border-[var(--border)] rounded focus:ring-[var(--primary-500)] cursor-pointer"
                            />
                            <span className="text-sm text-[var(--foreground)]">Filter Responses (Regex) (Output Only)</span>
                        </div>
                        <FeatureInfoButton text={descriptions['regex']} features={featureDetails['regex']} />
                    </label>

                    {toggles.regex && (
                        <div className="ml-9 mt-2">
                            <textarea
                                value={regexPatterns}
                                onChange={(e) => setRegexPatterns(e.target.value)}
                                className="input w-full text-sm font-mono text-[var(--foreground)]"
                                rows={2}
                                placeholder="Enter regex patterns (one per line)..."
                            />
                        </div>
                    )}
                </div>
            </div>

            <InfoDialog
                isOpen={dialog.isOpen}
                onClose={() => setDialog({ ...dialog, isOpen: false })}
                title={dialog.title}
                message={dialog.message}
            />
        </div>
    );
}
