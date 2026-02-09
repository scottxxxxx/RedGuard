"use client";
import { useState, useEffect } from 'react';

// Refactored to exclude LLM Config (now handled by EvaluationSettings)
export type GuardrailPolicy = {
    activeGuardrails: string[];
    bannedTopics: string;
    regexPatterns: string[];
};

interface Props {
    onConfigChange: (config: GuardrailPolicy) => void;
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
                <div className="absolute right-0 top-8 w-80 p-4 bg-gray-900 text-white border border-gray-700 rounded-lg shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-between items-start mb-3 border-b border-gray-700 pb-2">
                        <h4 className="font-semibold text-sm text-gray-100">Feature Details</h4>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-gray-400 hover:text-white transition-colors p-0.5 hover:bg-gray-800 rounded"
                            aria-label="Close"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {text && <p className="mb-4 text-xs text-gray-300 leading-relaxed">{text}</p>}

                    {features && features.length > 0 ? (
                        <div className="max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                            <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-[var(--primary-400)]">Enabled for Features:</p>
                            <ul className="list-disc pl-4 space-y-1.5 bg-gray-800/50 p-2 rounded border border-gray-800/50">
                                {features.map((f, i) => (
                                    <li key={i} className="text-xs text-gray-300">{f}</li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="text-xs text-gray-400 italic bg-gray-800/30 p-2 rounded border border-gray-800/30">
                            Load app definition to view enabled features
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default function GuardrailSettings({ onConfigChange }: Props) {
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

    const [descriptions, setDescriptions] = useState<Record<string, string>>({
        'toxicity': "Prevent the dissemination of potentially harmful prompts and responses by analysing the toxicity of the text.",
        'topics': "Ensure the conversations are within acceptable boundaries and avoid any conversations by adding a list of sensitive or controversial topics.",
        'injection': "Secure the application from prompt manipulations tailored against LLMs by identifying and mitigating the injections in the prompts.",
        'regex': "Discard the LLM response that contains one or more text patterns."
    });
    const [featureDetails, setFeatureDetails] = useState<Record<string, string[]>>({});

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
                        <svg className="w-4 h-4 text-[var(--primary-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h3 className="text-base font-semibold text-[var(--foreground)]">
                        Guardrail Configuration
                    </h3>
                </div>

                {/* Import Button */}
                <div>
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
                                    const content = JSON.parse(ev.target?.result as string);
                                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
                                    const res = await fetch(`${apiUrl}/evaluate/analyze-config`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ botConfig: content })
                                    });

                                    if (res.ok) {
                                        const data = await res.json();
                                        console.log("Import response:", data);

                                        // Update Descriptions and Details
                                        if (data.descriptions) setDescriptions(data.descriptions);
                                        if (data.featureDetails) setFeatureDetails(data.featureDetails);

                                        // Reset all toggles to false
                                        const newToggles = {
                                            toxicity_input: false,
                                            toxicity_output: false,
                                            topics_input: false,
                                            topics_output: false,
                                            injection: false,
                                            regex: false
                                        };

                                        // Enable based on returned granular keys (e.g., toxicity_input)
                                        if (data.enabledGuardrails && Array.isArray(data.enabledGuardrails)) {
                                            data.enabledGuardrails.forEach((key: string) => {
                                                // Map keys to toggles
                                                if (key.startsWith('toxicity')) {
                                                    if (key.includes('input')) newToggles.toxicity_input = true;
                                                    if (key.includes('output')) newToggles.toxicity_output = true;
                                                } else if (key.startsWith('topics')) {
                                                    if (key.includes('input')) newToggles.topics_input = true;
                                                    if (key.includes('output')) newToggles.topics_output = true;
                                                } else if (key.startsWith('injection')) {
                                                    newToggles.injection = true;
                                                } else if (key.startsWith('regex')) {
                                                    newToggles.regex = true;
                                                } else if (key in newToggles) {
                                                    (newToggles as any)[key] = true;
                                                }
                                            });
                                        }

                                        // Populate Data Fields
                                        if (data.topics && data.topics.length > 0) {
                                            setBannedTopics(data.topics.join(', '));
                                        }
                                        if (data.regexPatterns && data.regexPatterns.length > 0) {
                                            setRegexPatterns(data.regexPatterns.join('\n'));
                                        }

                                        // Apply toggle state
                                        setToggles(newToggles);

                                        console.log("Configuration imported successfully.");
                                    } else {
                                        const errorData = await res.json().catch(() => ({}));
                                        console.error("Failed to analyze config", errorData);
                                        alert(`Failed to analyze configuration file. ${errorData.error || ''} ${errorData.details || ''}`);
                                    }
                                } catch (err) {
                                    console.error("Error reading file", err);
                                    alert("Invalid JSON file.");
                                }
                                e.target.value = '';
                            };
                            reader.readAsText(file);
                        }}
                    />
                    <button
                        onClick={() => document.getElementById('config-upload')?.click()}
                        className="text-xs flex items-center gap-1 text-[var(--primary-600)] hover:text-[var(--primary-700)] font-medium bg-[var(--primary-50)] hover:bg-[var(--primary-100)] px-2 py-1 rounded transition-colors"
                        title="Examine an app definition file to see which guardrail settings are enabled."
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Get Configuration from App Definition
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {/* Toxicity */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[var(--foreground)]">Restrict Toxicity</span>
                        <FeatureInfoButton text={descriptions['toxicity']} features={featureDetails['toxicity']} />
                    </div>
                    <div className="ml-2 flex flex-row gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={toggles.toxicity_input} onChange={() => handleToggle('toxicity_input')} className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
                            <span className="text-xs text-[var(--foreground-muted)]">Input Filtering</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={toggles.toxicity_output} onChange={() => handleToggle('toxicity_output')} className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
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
                            <input type="checkbox" checked={toggles.topics_input} onChange={() => handleToggle('topics_input')} className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
                            <span className="text-xs text-[var(--foreground-muted)]">Input Filtering</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={toggles.topics_output} onChange={() => handleToggle('topics_output')} className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
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
                    <label className="flex items-center p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
                        <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => handleToggle('injection')}>
                            <input type="checkbox" checked={toggles.injection} onChange={() => { }} className="h-4 w-4 text-[var(--primary-600)] border-[var(--border)] rounded focus:ring-[var(--primary-500)]" />
                            <span className="text-sm text-[var(--foreground)]">Detect Prompt Injections (Input Only)</span>
                        </div>
                        <FeatureInfoButton text={descriptions['injection']} features={featureDetails['injection']} />
                    </label>
                </div>

                {/* Regex */}
                <div className="border-t border-[var(--border)] pt-3">
                    <label className="flex items-center p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
                        <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => handleToggle('regex')}>
                            <input type="checkbox" checked={toggles.regex} onChange={() => { }} className="h-4 w-4 text-[var(--primary-600)] border-[var(--border)] rounded focus:ring-[var(--primary-500)]" />
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
                                placeholder=""
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
