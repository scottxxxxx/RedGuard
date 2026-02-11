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
import AuthButton from "@/components/AuthButton";
import { NotificationProvider, useNotification } from "@/context/NotificationContext";
import RedGuardIntro from "@/components/RedGuardIntro";
import { useUser } from "@/contexts/UserContext";

// Composite type for ChatConsole
export type CompositeGuardrailConfig = GuardrailPolicy & {
    llmConfig: LLMConfig;
};

type ViewType = 'evaluator' | 'logs';

function HomeContent() {
    const { userId } = useUser();
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
    const [koreSessionId, setKoreSessionId] = useState<string | null>(null);  // Kore's internal session ID
    const llmInspectorRef = useRef<LLMInspectorRef>(null);
    const { showToast } = useNotification();
    const [showRequirementsModal, setShowRequirementsModal] = useState(false);
    const [missingRequirements, setMissingRequirements] = useState<string[]>([]);
    const [showTooltip, setShowTooltip] = useState(false);

    // Sidebar state
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);

    // Auto-refresh Kore GenAI Logs after bot response (5 second delay)
    // Only works if Inspector is mounted
    const handleBotResponse = useCallback(() => {
        setTimeout(() => {
            llmInspectorRef.current?.refreshLogs();
        }, 5000);
    }, []);

    const handleBotConnect = (greeting: string) => {
        // If we already have messages, don't show greeting again
        if (messages.length === 0) {
            setMessages([{
                role: 'bot',
                text: greeting,
                timestamp: new Date()
            }]);
        }
    };

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
        setKoreSessionId(null);  // Reset Kore session ID
        llmInspectorRef.current?.clearLogs();  // Clear the logs display
        setMessages([]);
        setInteraction(null);
    };

    const handleClearConsole = () => {
        // Just clear the console display without resetting userId
        setKoreSessionId(null);
        setMessages([]);
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

    const getMissingRequirements = () => {
        const missingItems: string[] = [];

        // Check for API key
        if (!llmConfig?.apiKey) {
            missingItems.push('Evaluation API Key - Configure your LLM provider and API key in the Evaluation Model section');
        }

        // Check if at least one guardrail is selected
        const hasSelectedGuardrails = guardrailPolicy?.activeGuardrails && guardrailPolicy.activeGuardrails.length > 0;

        if (!hasSelectedGuardrails) {
            missingItems.push('Guardrail Selection - Enable at least one guardrail (toxicity, topics, prompt injection, or regex) in the Guardrail Configuration section');
        }

        // Check for guardrails detected in bot logs
        const logs = llmInspectorRef.current?.getLogs() || [];
        const hasGuardrailsInLogs = logs.length > 0 && logs.some((log: any) => {
            const featureName = (log['Feature Name '] || log.Feature || '').toLowerCase();
            return featureName.includes('guardrail');
        });

        if (!hasGuardrailsInLogs) {
            missingItems.push('GenAI log from bot - A guardrail must be detected in the bot log. Send a message in the Live Verification Console that triggers a guardrail interaction with an AI component (like an Agent Node)');
        }

        return missingItems;
    };

    const canRunEvaluation = () => {
        return getMissingRequirements().length === 0;
    };

    const handleEvaluateClick = () => {
        const missing = getMissingRequirements();
        if (missing.length > 0) {
            setMissingRequirements(missing);
            setShowRequirementsModal(true);
        } else {
            handleEvaluate();
        }
    };

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
                    // Check if this guardrail is actually active in the configuration
                    const isActive = guardrailPolicy?.activeGuardrails?.some((g: string) =>
                        g.toLowerCase().includes(name.toLowerCase())
                    );
                    if (!isActive) return null; // Return null for inactive guardrails

                    if (!result.results) return null;
                    const found = result.results.find((r: any) =>
                        r.guardrail?.toLowerCase().includes(name.toLowerCase())
                    );
                    if (!found) return null;
                    return found.pass === 'N/A' ? null : found.pass;
                };

                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
                const currentMsg = messages.findLast(m => m.role === 'user' && m.text === interaction.user);

                // Extract token usage from full API response
                let inputTokens = null;
                let outputTokens = null;
                if (result.debug?.fullResponse) {
                    try {
                        const fullResp = typeof result.debug.fullResponse === 'string'
                            ? JSON.parse(result.debug.fullResponse)
                            : result.debug.fullResponse;

                        // Extract from usage object (Anthropic format)
                        if (fullResp.usage) {
                            inputTokens = fullResp.usage.input_tokens || null;
                            outputTokens = fullResp.usage.output_tokens || null;
                        }
                    } catch (e) {
                        console.error('[Evaluation] Failed to parse fullResponse for tokens:', e);
                    }
                }

                await fetch(`${apiUrl}/runs`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user-id': userId
                    },
                    body: JSON.stringify({
                        userId,
                        sessionId: koreSessionId || null,
                        userInput: interaction.user,
                        botResponse: interaction.bot,
                        promptSent: result.debug?.requestPayload || result.debug?.prompt || previewPrompt || '',
                        llmOutput: result.debug?.fullResponse || result.debug?.response || '',
                        toxicityPass: findResult('toxicity'),
                        topicsPass: findResult('topics') ?? findResult('restrict'),
                        injectionPass: findResult('injection'),
                        regexPass: findResult('regex') ?? findResult('filter'),
                        overallPass: result.pass ?? false,
                        isAttack: currentMsg?.isAttack || false,
                        inputTokens,
                        outputTokens,
                        totalTokens: result.totalTokens ?? interaction.result?.totalTokens ?? null,
                        latencyMs: result.latencyMs ?? null,
                        model: result.model ?? null
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
        if (!interaction) {
            throw new Error("Please send a message in the Live Verification Console first to create a chat interaction.");
        }
        if (!fullGuardrailConfig) {
            throw new Error("Please configure guardrail settings before regenerating the payload.");
        }
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
                                <span className="text-[10px] font-mono bg-[var(--surface-hover)] text-[var(--foreground-muted)] px-1.5 py-0.5 rounded border border-[var(--border)] mt-1">v0.3.0</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <AuthButton />
                                <ThemeSwitcher />
                            </div>
                        </div>
                    </div>
                </nav>

                {/* Sidebar + Main Content Layout */}
                <div className="flex flex-1 overflow-hidden">

                    {/* Sidebar */}
                    <aside
                        className={`bg-surface border-r border-border flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out relative ${
                            isSidebarExpanded || isSidebarHovered ? 'w-64' : 'w-16'
                        }`}
                        onMouseEnter={() => setIsSidebarHovered(true)}
                        onMouseLeave={() => setIsSidebarHovered(false)}
                    >
                        {/* Toggle Button - Vertically Centered */}
                        <button
                            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                            className="absolute top-1/2 -translate-y-1/2 right-1 p-1.5 rounded-md hover:bg-sidebar-hover text-foreground transition-all z-10 border border-[var(--border)] bg-[var(--surface)] shadow-sm"
                            title={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
                        >
                            <svg
                                className={`h-3.5 w-3.5 transition-transform duration-300 ${isSidebarExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>

                        <div className="p-4 space-y-1">

                            <button
                                onClick={() => setCurrentView('evaluator')}
                                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${currentView === 'evaluator'
                                    ? 'bg-sidebar-active text-sidebar-active-text'
                                    : 'text-foreground hover:bg-sidebar-hover'
                                    }`}
                                title="Guardrail Evaluator"
                            >
                                <svg className={`h-5 w-5 flex-shrink-0 ${isSidebarExpanded || isSidebarHovered ? 'mr-3' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className={`whitespace-nowrap transition-all duration-300 ${
                                    isSidebarExpanded || isSidebarHovered ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'
                                }`}>
                                    Guardrail Evaluator
                                </span>
                            </button>

                            <button
                                onClick={() => setCurrentView('logs')}
                                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${currentView === 'logs'
                                    ? 'bg-sidebar-active text-sidebar-active-text'
                                    : 'text-foreground hover:bg-sidebar-hover'
                                    }`}
                                title="System Logs"
                            >
                                <svg className={`h-5 w-5 flex-shrink-0 ${isSidebarExpanded || isSidebarHovered ? 'mr-3' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                <span className={`whitespace-nowrap transition-all duration-300 ${
                                    isSidebarExpanded || isSidebarHovered ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'
                                }`}>
                                    System Logs
                                </span>
                            </button>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <main className="flex-1 overflow-auto bg-[var(--background)] p-8">
                        {/* Evaluator View */}
                        <div className={`w-full ${currentView === 'evaluator' ? '' : 'hidden'}`}>
                            <RedGuardIntro />

                            {/* Tab Headers */}
                            <div className="border-b border-[var(--border)] mb-6">
                                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                                    <button
                                        onClick={() => setActiveTab('live')}
                                        className={`${activeTab === 'live'
                                            ? 'border-[var(--primary-500)] text-[var(--primary-600)]'
                                            : 'border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border)]'
                                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                                    >
                                        Live Verification Console
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('batch')}
                                        className={`${activeTab === 'batch'
                                            ? 'border-[var(--primary-500)] text-[var(--primary-600)]'
                                            : 'border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border)]'
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
                                        <div className="mb-3">
                                            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">Setup Connection</h3>
                                            <p className="text-xs text-[var(--foreground-muted)]">Connect your bot, chat to test responses, and generate adversarial attacks.</p>
                                        </div>
                                        <div className="grid grid-cols-12 gap-6" style={{ height: '550px' }}>
                                            <div className="col-span-4 h-full min-h-0">
                                                <BotSettings
                                                    onConfigChange={setBotConfig}
                                                    onConnect={handleBotConnect}
                                                    onSessionReset={handleSessionReset}
                                                    onClearConsole={handleClearConsole}
                                                    onKoreSessionUpdate={setKoreSessionId}
                                                    userId={userId}
                                                />
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
                                        <div className="mb-3 mt-2">
                                            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">Define guardrails</h3>
                                            <p className="text-xs text-[var(--foreground-muted)]">Set your safety policies and inspect real-time system logs.</p>
                                        </div>
                                        <div className="grid grid-cols-12 gap-6" style={{ height: '550px' }}>
                                            <div className="col-span-4 h-full min-h-0">
                                                <GuardrailSettings
                                                    onConfigChange={setGuardrailPolicy}
                                                    onBotConfigUpdate={setBotConfig}
                                                />
                                            </div>
                                            <div className="col-span-8 h-full min-h-0">
                                                <LLMInspector ref={llmInspectorRef} botConfig={botConfig} userId={userId} koreSessionId={koreSessionId} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 3: Evaluation Settings & Inspector */}
                                    <div>
                                        <div className="mb-3 mt-2">
                                            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">Test & Evaluate</h3>
                                            <p className="text-xs text-[var(--foreground-muted)]">Use predefined guardrail prompts or create custom ones, run evaluations, and analyze results.</p>
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
                                    <div className="relative">
                                        <div className="flex justify-center mb-2 mt-4">
                                            <div
                                                className="relative inline-block"
                                                onMouseEnter={() => !canRunEvaluation() && setShowTooltip(true)}
                                                onMouseLeave={() => setShowTooltip(false)}
                                            >
                                                <button
                                                    onClick={handleEvaluateClick}
                                                    disabled={isEvaluating || !canRunEvaluation()}
                                                    className="px-6 py-3 text-sm font-semibold text-white bg-[var(--primary-600)] hover:bg-[var(--primary-700)] rounded-lg shadow-md hover:shadow-lg transform transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none disabled:bg-gray-400"
                                                >
                                                    {isEvaluating ? (
                                                        <span className="flex items-center justify-center gap-2">
                                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            Running Evaluation...
                                                        </span>
                                                    ) : (
                                                        'Perform Guardrail Evaluation'
                                                    )}
                                                </button>

                                                {/* Hover Tooltip */}
                                                {showTooltip && !canRunEvaluation() && (
                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 pointer-events-none">
                                                        <div className="bg-gray-900 text-white text-xs rounded-lg shadow-xl p-3 max-w-xs whitespace-nowrap">
                                                            <div className="font-semibold mb-2">Missing Requirements:</div>
                                                            <ul className="space-y-1 text-left">
                                                                {getMissingRequirements().map((req, i) => {
                                                                    // Extract just the first part before the dash for tooltip
                                                                    const shortReq = req.split(' - ')[0];
                                                                    return (
                                                                        <li key={i} className="flex items-start gap-2">
                                                                            <span>•</span>
                                                                            <span>{shortReq}</span>
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                            {/* Tooltip arrow */}
                                                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
                                                                <div className="border-8 border-transparent border-t-gray-900"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Requirements Modal */}
                                        {showRequirementsModal && (
                                            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full mb-4 z-50">
                                                <div className="bg-error-bg border-2 border-error-border rounded-lg shadow-xl p-6 max-w-2xl">
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex items-center gap-2">
                                                            <svg className="w-6 h-6 text-error-text shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                            </svg>
                                                            <h3 className="text-lg font-semibold text-error-text">Cannot Perform Evaluation</h3>
                                                        </div>
                                                        <button
                                                            onClick={() => setShowRequirementsModal(false)}
                                                            className="text-error-text hover:text-error-text/80 transition-colors"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <p className="text-sm text-error-text font-medium mb-3">Please complete the following requirements:</p>
                                                        {missingRequirements.map((item, i) => (
                                                            <div key={i} className="flex gap-3 text-sm">
                                                                <span className="text-error-text font-bold shrink-0">{i + 1}.</span>
                                                                <p className="text-error-text">{item}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
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
    );
}

export default function Home() {
    return (
        <NotificationProvider>
            <HomeContent />
        </NotificationProvider>
    );
}
