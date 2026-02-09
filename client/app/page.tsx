"use client";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import ChatConsole from "@/components/ChatConsole";
import GuardrailSettings, { GuardrailPolicy } from "@/components/GuardrailSettings";
import BotSettings, { BotConfig } from "@/components/BotSettings";
import EvaluationSettings from "@/components/EvaluationSettings";
import EvaluationInspector from "@/components/EvaluationInspector";
import { LLMConfig } from "@/types/config";
import BatchTester from "@/components/BatchTester";
import RunHistory from "@/components/RunHistory";

import LogViewer from "@/components/LogViewer";
import LLMInspector, { LLMInspectorRef } from "@/components/LLMInspectorNew";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { NotificationProvider } from "@/context/NotificationContext";

// Composite type for ChatConsole
export type CompositeGuardrailConfig = GuardrailPolicy & {
    llmConfig: LLMConfig;
};

type ViewType = 'evaluator' | 'logs';

export default function Home() {
    const [currentView, setCurrentView] = useState<ViewType>('evaluator');

    const [guardrailPolicy, setGuardrailPolicy] = useState<GuardrailPolicy | null>(null);
    const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
    const [botConfig, setBotConfig] = useState<BotConfig | null>(null);

    // Tab State for Evaluator View
    const [activeTab, setActiveTab] = useState<'live' | 'batch'>('live');

    // Interaction State
    const [interaction, setInteraction] = useState<{ user: string, bot: string, result?: any } | null>(null);
    const [messages, setMessages] = useState<{ role: 'user' | 'bot' | 'evaluation', text: string, passed?: boolean, timestamp?: Date, isAttack?: boolean }[]>([]);

    // Evaluation State
    const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);
    const [previewPayload, setPreviewPayload] = useState<any | null>(null);
    const [evalResult, setEvalResult] = useState<any | null>(null);
    const [evalRawResponse, setEvalRawResponse] = useState<string | null>(null);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [runHistoryKey, setRunHistoryKey] = useState(0); // Force refresh of run history
    const [hyperparams, setHyperparams] = useState({ temperature: 0.0, max_tokens: 4096, top_p: 1.0 });
    const [userId, setUserId] = useState('');
    const [koreSessionId, setKoreSessionId] = useState<string | null>(null);  // Kore's internal session ID
    const llmInspectorRef = useRef<LLMInspectorRef>(null);

    useEffect(() => {
        // Use RedGuard- prefix so we can easily identify our interactions in Kore GenAI logs
        const sessionId = Math.random().toString(36).substring(2, 10);
        setUserId(`RedGuard-${sessionId}`);
    }, []);

    // Auto-refresh Kore GenAI Logs after bot response (5 second delay)
    // Only works if Inspector is mounted
    const handleBotResponse = useCallback(() => {
        setTimeout(() => {
            llmInspectorRef.current?.refreshLogs();
        }, 5000);
    }, []);

    // Merge policy and LLM config for the console
    const fullGuardrailConfig: CompositeGuardrailConfig | null = useMemo(() => {
        if (!guardrailPolicy || !llmConfig) return null;
        return {
            ...guardrailPolicy,
            llmConfig
        };
    }, [guardrailPolicy, llmConfig]);

    const handleInteractionUpdate = (user: string, bot: string) => {
        setInteraction({ user, bot });
        setEvalResult(null); // Reset result on new chat
        setEvalRawResponse(null);
    };

    const handleSessionReset = () => {
        // Use RedGuard- prefix so we can easily identify our interactions in Kore GenAI logs
        const sessionId = Math.random().toString(36).substring(2, 10);
        setUserId(`RedGuard-${sessionId}`);
        setKoreSessionId(null);  // Reset Kore session ID
        llmInspectorRef.current?.clearLogs();  // Clear the logs display
        setMessages([]);
        setInteraction(null);
    };

    // Auto-fetch Preview when interaction or config changes
    useEffect(() => {
        // Fetch preview even without interaction if customPrompt is set
        const hasCustomPrompt = !!llmConfig?.customPrompt;

        // Use interaction values or placeholders
        const userInput = interaction?.user || "{{user_input}}";
        const botResponse = interaction?.bot || "{{bot_response}}";

        if (!fullGuardrailConfig) return;

        // Show preview as long as we have a config (uses placeholders for empty interaction)

        const fetchPreview = async () => {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            try {
                const res = await fetch(`${apiUrl}/evaluate/preview`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userInput,
                        botResponse,
                        guardrailConfig: fullGuardrailConfig,
                        history: messages.filter(m => m.role !== 'evaluation'),
                        guardrailLogs: llmInspectorRef.current?.getLogs() || []
                    })
                });
                const data = await res.json();
                if (data.prompt !== undefined) {
                    setPreviewPrompt(data.prompt);
                }
                if (data.payload !== undefined) {
                    setPreviewPayload(data.payload);
                }
            } catch (e) {
                console.error("Failed to fetch prompt preview", e);
            }
        };

        fetchPreview();
    }, [interaction, fullGuardrailConfig, messages, llmConfig?.customPrompt]);

    // Clear stale evaluation results only when the base interaction content changes
    // We remove fullGuardrailConfig from dependencies so results stay visible 
    // even if settings are tweaked, until a new evaluation is run.
    const lastEvalInterRef = useRef<{ user: string, bot: string } | null>(null);
    useEffect(() => {
        const hasInteractionChanged =
            interaction?.user !== lastEvalInterRef.current?.user ||
            interaction?.bot !== lastEvalInterRef.current?.bot;

        // Only clear if the interaction text changed and we aren't just starting/resetting
        if (hasInteractionChanged && interaction) {
            setEvalResult(null);
            setEvalRawResponse(null);
        }

        lastEvalInterRef.current = interaction ? { user: interaction.user, bot: interaction.bot } : null;
    }, [interaction?.user, interaction?.bot]);

    const handleEvaluate = async () => {
        if (!interaction || !fullGuardrailConfig) return;
        setIsEvaluating(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            const res = await fetch(`${apiUrl}/evaluate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userInput: interaction.user,
                    botResponse: interaction.bot,
                    guardrailConfig: fullGuardrailConfig,
                    history: messages.filter(m => m.role !== 'evaluation'),
                    hyperparams,
                    overridePrompt: previewPrompt,
                    overridePayload: previewPayload,
                    guardrailLogs: llmInspectorRef.current?.getLogs() || []
                })
            });
            const result = await res.json();

            setEvalResult(result);
            if (interaction) {
                setInteraction({ ...interaction, result });
            }
            if (result.debug) {
                setEvalRawResponse(result.debug.response);
                setPreviewPrompt(result.debug.prompt);
            }

            // Save run to database
            try {
                // Extract individual guardrail results from the results array
                const findResult = (name: string) => {
                    if (!result.results) return null;
                    const found = result.results.find((r: any) =>
                        r.guardrail?.toLowerCase().includes(name.toLowerCase())
                    );
                    if (!found) return null;
                    return found.pass === 'N/A' ? null : found.pass;
                };

                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
                const currentMsg = messages.findLast(m => m.role === 'user' && m.text === interaction.user);

                await fetch(`${apiUrl}/runs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userInput: interaction.user,
                        botResponse: interaction.bot,
                        promptSent: result.debug?.requestPayload || result.debug?.prompt || previewPrompt || '',
                        llmOutput: result.debug?.response || '',
                        toxicityPass: findResult('toxicity'),
                        topicsPass: findResult('topics') ?? findResult('restrict'),
                        injectionPass: findResult('injection'),
                        regexPass: findResult('regex') ?? findResult('filter'),
                        overallPass: result.pass ?? false,
                        isAttack: currentMsg?.isAttack || false,
                        totalTokens: result.totalTokens ?? interaction.result?.totalTokens ?? null
                    })
                });
                // Trigger run history refresh
                setRunHistoryKey(prev => prev + 1);
            } catch (saveError) {
                console.error("Failed to save run:", saveError);
            }
        } catch (e) {
            console.error("Evaluation failed", e);
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleRequestPayloadRegen = async (prompt: string): Promise<string> => {
        if (!interaction || !fullGuardrailConfig) throw new Error("No interaction");
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const res = await fetch(`${apiUrl}/evaluate/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userInput: interaction.user,
                botResponse: interaction.bot,
                guardrailConfig: fullGuardrailConfig,
                history: messages.filter(m => m.role !== 'evaluation'),
                overridePrompt: prompt,
                hyperparams,
                guardrailLogs: llmInspectorRef.current?.getLogs() || []
            })
        });
        const data = await res.json();
        const payload = data.payload;
        return typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    };

    return (
        <NotificationProvider>
            <div className="h-screen bg-[var(--background)] flex flex-col">
                {/* Top Navigation Bar */}
                <nav className="bg-[var(--surface)] border-b border-[var(--border)] sticky top-0 z-50">
                    <div className="w-full px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-20 items-center">
                            <div className="flex items-center gap-3">
                                <img
                                    src="/logo.svg"
                                    alt="RedGuard Logo"
                                    className="h-16 w-auto object-contain"
                                />
                                <span className="text-2xl font-bold text-foreground tracking-tight hidden sm:block">RedGuard</span>
                                <span className="text-[10px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 mt-1">v0.1.1</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-sm text-[var(--foreground-muted)] hidden md:block">
                                    Kore.AI Guardrail Testing
                                </div>
                                <ThemeSwitcher />
                            </div>
                        </div>
                    </div>
                </nav>

                {/* Sidebar + Main Content Layout */}
                <div className="flex flex-1 overflow-hidden">

                    {/* Sidebar */}
                    <aside className="w-64 bg-surface border-r border-border flex flex-col flex-shrink-0">
                        <div className="p-4 space-y-1">
                            <button
                                onClick={() => setCurrentView('evaluator')}
                                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${currentView === 'evaluator'
                                    ? 'bg-sidebar-active text-sidebar-active-text'
                                    : 'text-foreground hover:bg-sidebar-hover'
                                    }`}
                            >
                                <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Guardrail Evaluator
                            </button>

                            <button
                                onClick={() => setCurrentView('logs')}
                                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${currentView === 'logs'
                                    ? 'bg-sidebar-active text-sidebar-active-text'
                                    : 'text-foreground hover:bg-sidebar-hover'
                                    }`}
                            >
                                <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                System Logs
                            </button>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <main className="flex-1 overflow-auto bg-[var(--background)] p-8">
                        {/* Evaluator View */}
                        <div className={`w-full ${currentView === 'evaluator' ? '' : 'hidden'}`}>
                            <header className="mb-4">
                                <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1">Guardrail Evaluator</h1>
                                <p className="text-sm text-[var(--foreground-muted)]">Configure, test, and verify bot guardrails in real-time</p>
                            </header>

                            {/* Tab Headers */}
                            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                                    <button
                                        onClick={() => setActiveTab('live')}
                                        className={`${activeTab === 'live'
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                                    >
                                        Live Verification Console
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('batch')}
                                        className={`${activeTab === 'batch'
                                            ? 'border-indigo-500 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                                    >
                                        Batch Tester (CSV)
                                    </button>
                                </nav>
                            </div>

                            {/* Live Tab Content */}
                            <div className={activeTab === 'live' ? '' : 'hidden'}>
                                <div className="space-y-6">
                                    {/* Row 1: Bot Config & Chat Console */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">1</span>
                                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Capture Interaction</h3>
                                            <span className="text-xs text-gray-400">- Configure your bot and chat to generate a conversation transcript.</span>
                                        </div>
                                        <div className="grid grid-cols-12 gap-6" style={{ height: '550px' }}>
                                            <div className="col-span-4 h-full min-h-0">
                                                <BotSettings onConfigChange={setBotConfig} />
                                            </div>
                                            <div className="col-span-8 h-full min-h-0">
                                                <ChatConsole
                                                    config={fullGuardrailConfig}
                                                    botConfig={botConfig}
                                                    onInteractionUpdate={handleInteractionUpdate}
                                                    messages={messages}
                                                    setMessages={setMessages}
                                                    userId={userId}
                                                    koreSessionId={koreSessionId}
                                                    onSessionReset={handleSessionReset}
                                                    onBotResponse={handleBotResponse}
                                                    onKoreSessionUpdate={setKoreSessionId}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: Guardrail Config & Kore Logs */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3 mt-2">
                                            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">2</span>
                                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Define Guardrails</h3>
                                            <span className="text-xs text-gray-400">- Set your safety policies and inspect real-time system logs.</span>
                                        </div>
                                        <div className="grid grid-cols-12 gap-6" style={{ height: '550px' }}>
                                            <div className="col-span-4 h-full min-h-0">
                                                <GuardrailSettings onConfigChange={setGuardrailPolicy} />
                                            </div>
                                            <div className="col-span-8 h-full min-h-0">
                                                <LLMInspector ref={llmInspectorRef} botConfig={botConfig} userId={userId} koreSessionId={koreSessionId} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 3: Evaluation Settings & Inspector */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3 mt-2">
                                            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">3</span>
                                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Configure Evaluation</h3>
                                            <span className="text-xs text-gray-400">- Choose the LLM that will judge the conversation against your guardrails.</span>
                                        </div>
                                        <div className="grid grid-cols-12 gap-6">
                                            <div className="col-span-4">
                                                <EvaluationSettings onConfigChange={setLlmConfig} />
                                            </div>
                                            <div className="col-span-8">
                                                <EvaluationInspector
                                                    provider={llmConfig?.provider}
                                                    prompt={previewPrompt}
                                                    rawResponse={evalRawResponse}
                                                    result={evalResult}
                                                    previewPayload={previewPayload}
                                                    hyperparams={hyperparams}
                                                    onHyperparamsChange={setHyperparams}
                                                    onPromptChange={setPreviewPrompt}
                                                    onRequestPayloadRegen={handleRequestPayloadRegen}
                                                    onPayloadChange={setPreviewPayload}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 4: Evaluate Button */}
                                    <div>
                                        <div className="flex items-center justify-center gap-2 mb-2 mt-4">
                                            <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">4</span>
                                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Execute</h3>
                                        </div>
                                        <div className="flex justify-center mb-2">
                                            <button
                                                onClick={handleEvaluate}
                                                disabled={isEvaluating || !interaction || !llmConfig?.apiKey}
                                                className="w-1/2 py-4 text-lg font-bold uppercase tracking-widest text-white bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 rounded-lg shadow-lg hover:shadow-xl transform transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                                            >
                                                {isEvaluating ? (
                                                    <span className="flex items-center justify-center gap-3">
                                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Running Evaluation...
                                                    </span>
                                                ) : (
                                                    'Perform Guardrail Evaluation'
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Row 5: History */}
                                    <div className="mt-8">
                                        <RunHistory key={runHistoryKey} botId={botConfig?.botId} />
                                    </div>
                                </div>
                            </div>

                            {/* Batch Tab Content */}
                            <div className={activeTab === 'batch' ? '' : 'hidden'}>
                                <BatchTester
                                    botConfig={botConfig}
                                    guardrailConfig={fullGuardrailConfig}
                                />
                            </div>
                        </div>

                        {/* Logs View */}
                        <div className={`w-full ${currentView === 'logs' ? '' : 'hidden'}`}>
                            <header className="mb-8">
                                <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1">System Logs</h1>
                                <p className="text-sm text-[var(--foreground-muted)]">View real-time backend and application logs</p>
                            </header>

                            <div className="space-y-8">
                                <div>
                                    <h2 className="text-lg font-medium text-[var(--foreground)] mb-4">Application Logs</h2>
                                    <LogViewer />
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </NotificationProvider>
    );
}
