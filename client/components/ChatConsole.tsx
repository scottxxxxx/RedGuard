import { useState, useRef, useEffect } from 'react';
import { CompositeGuardrailConfig } from '../app/page';
import { BotConfig } from './BotSettings';
import { useNotification } from '../context/NotificationContext';

interface Props {
    config: CompositeGuardrailConfig | null;
    botConfig: BotConfig | null;
    onInteractionUpdate?: (userMsg: string, botMsg: string) => void;
    messages: { role: 'user' | 'bot' | 'evaluation', text: string, passed?: boolean, timestamp?: Date, isAttack?: boolean, attackCategory?: string }[];
    setMessages: React.Dispatch<React.SetStateAction<{ role: 'user' | 'bot' | 'evaluation', text: string, passed?: boolean, timestamp?: Date, isAttack?: boolean, attackCategory?: string }[]>>;
    userId: string;
    koreSessionId?: string | null;  // The Kore platform session ID
    onSessionReset?: () => void;
    onBotResponse?: () => void;
    onKoreSessionUpdate?: (sessionId: string) => void;  // Callback to pass Kore's session ID to parent
    isAuthenticated?: boolean;
    onAuthRequired?: () => void;
}

export default function ChatConsole({ config, botConfig, onInteractionUpdate, messages, setMessages, userId, koreSessionId, onSessionReset, onBotResponse, onKoreSessionUpdate, isAuthenticated, onAuthRequired }: Props) {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [showAttackMenu, setShowAttackMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { showToast } = useNotification();
    const [lastGeneratedAttack, setLastGeneratedAttack] = useState<string | null>(null);
    const [lastAttackCategory, setLastAttackCategory] = useState<string | null>(null);

    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
        if (scrollContainerRef.current) {
            const { scrollHeight, clientHeight } = scrollContainerRef.current;
            scrollContainerRef.current.scrollTo({
                top: scrollHeight - clientHeight,
                behavior
            });
        }
    };

    // Only scroll to bottom when messages change or loading state changes,
    // and ONLY if there are messages (prevents scrolling on page load)
    useEffect(() => {
        if (messages.length > 0 || loading) {
            scrollToBottom();
        }
    }, [messages, loading]);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowAttackMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const generateAttack = async (type: string) => {
        setLoading(true);
        setShowAttackMenu(false);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            const res = await fetch(`${apiUrl}/garak/prompt?category=${type}`);
            if (!res.ok) throw new Error('Failed to fetch prompt');
            const data = await res.json();
            if (data.prompt) {
                setInput(data.prompt);
                setLastGeneratedAttack(data.prompt);
                setLastAttackCategory(type); // Store the attack category
            } else {
                showToast('No prompt generated.', 'info');
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to generate attack. Check backend server.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        // Check authentication first
        if (!isAuthenticated && onAuthRequired) {
            onAuthRequired();
            return;
        }

        if (!input.trim()) return;

        if (!config || !config.llmConfig || !config.llmConfig.apiKey) {
            // Warn user? Or just proceed without evaluation
            // Let's add a local system message if key is missing but guardrails are on
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const userMsg = input;
        const isAttack = userMsg === lastGeneratedAttack;
        const attackCategory = isAttack ? lastAttackCategory : null;
        setMessages(prev => [...prev, { role: 'user', text: userMsg, timestamp: new Date(), isAttack, attackCategory: attackCategory || undefined }]);
        setInput('');

        // Save attack message to database if it's an attack
        if (isAttack && koreSessionId && attackCategory) {
            const turnIndex = messages.filter(m => m.role === 'user').length; // Current user turn index
            try {
                await fetch(`${apiUrl}/attack-messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: koreSessionId,
                        messageContent: userMsg,
                        category: attackCategory,
                        turnIndex,
                        botId: botConfig?.botId || null,
                        userId
                    })
                });
            } catch (error) {
                console.error('[ChatConsole] Failed to save attack message:', error);
                // Don't block the chat flow if saving fails
            }
        }

        setLastGeneratedAttack(null);
        setLastAttackCategory(null);
        setLoading(true);

        try {
            const res = await fetch(`${apiUrl}/chat/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg,
                    userId, // Pass explicit userId to maintain session
                    botConfig // Pass dynamic bot config
                })
            });

            const data = await res.json();

            if (res.ok) {
                // Kore.AI response format: { data: [ { val: "text", ... } ], ... }
                // Plus our evaluation results if present
                let botText = "No response text found.";

                if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                    botText = data.data
                        .map((msg: any) => msg.val || msg.text || JSON.stringify(msg))
                        .join('\n');
                } else if (data.text) {
                    botText = data.text;
                } else {
                    botText = JSON.stringify(data, null, 2);
                }

                setMessages(prev => [...prev, { role: 'bot', text: botText, timestamp: new Date() }]);

                // Extract Kore session ID from response and notify parent
                if (data.sessionId && onKoreSessionUpdate) {
                    onKoreSessionUpdate(data.sessionId);
                }

                // Notify parent of new interaction for Inspector
                if (onInteractionUpdate) {
                    onInteractionUpdate(userMsg, botText);
                }

                // Trigger LLM Inspector refresh after bot response
                if (onBotResponse) {
                    onBotResponse();
                }

            } else {
                setMessages(prev => [...prev, { role: 'bot', text: `Error: ${data.details ? JSON.stringify(data.details) : data.error}`, timestamp: new Date() }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: 'bot', text: "Network Error: Could not connect to backend.", timestamp: new Date() }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card p-5 flex flex-col h-full max-h-full overflow-hidden">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--border)] shrink-0">
                <div className="w-6 h-6 rounded-md bg-[var(--primary-50)] flex items-center justify-center">
                    <svg className="w-4 h-4 text-[var(--primary-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                </div>
                <h3 className="text-base font-semibold text-[var(--foreground)]">
                    Live Verification Console
                </h3>
            </div>

            <div
                ref={scrollContainerRef}
                className="flex-1 h-0 overflow-y-auto mb-4 space-y-3 p-3 bg-[var(--surface-hover)] rounded-lg min-h-0"
            >
                {messages.length === 0 && (
                    <div className="text-center text-[var(--foreground-muted)] mt-20 text-sm">
                        Start a conversation to test the guardrails.
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-lg px-4 py-2.5 ${msg.role === 'user'
                            ? (msg.isAttack
                                ? 'bg-gradient-to-br from-red-600 to-red-700 text-white shadow-md border border-red-400'
                                : 'bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-600)] text-white shadow-sm')
                            : msg.role === 'evaluation'
                                ? (msg.passed ? 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20' : 'bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/20')
                                : 'bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] shadow-sm'
                            }`}>
                            {msg.isAttack && msg.role === 'user' && (
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-red-100 flex items-center gap-1">
                                        <span className="animate-pulse">⚠️</span> Malicious Probe
                                    </div>
                                    {msg.attackCategory && (
                                        <span className="px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide rounded-full bg-red-800/50 text-red-100 border border-red-400/30">
                                            {msg.attackCategory}
                                        </span>
                                    )}
                                </div>
                            )}
                            <pre className="whitespace-pre-wrap font-sans text-sm">{msg.text}</pre>
                            {msg.timestamp && (
                                <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-white/60' : 'text-gray-400'}`}>
                                    {msg.timestamp.toLocaleTimeString()}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm text-[var(--foreground-muted)] flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                        </div>
                    </div>
                )}
            </div>

            <div className="shrink-0 flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                    <div className="text-[10px] text-[var(--foreground-muted)] font-mono">
                        Session ID: <span className="text-[var(--primary-600)]">{koreSessionId || 'Waiting for chat...'}</span>
                    </div>
                    <div className="flex gap-2" ref={menuRef}>
                        <div className="relative">
                            <button
                                onClick={() => setShowAttackMenu(!showAttackMenu)}
                                className="text-xs flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded border border-red-900/30 bg-red-900/10 hover:bg-red-900/20"
                            >
                                <span>⚡</span> Generate Attack
                            </button>

                            {showAttackMenu && (
                                <div className="absolute bottom-full right-0 mb-2 w-48 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl z-20 overflow-hidden">
                                    <div className="text-xs font-semibold text-[var(--foreground-muted)] px-3 py-2 bg-[var(--surface-hover)] border-b border-[var(--border)]">Select Attack Type</div>
                                    {['toxicity', 'injection', 'topics', 'encoding'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => generateAttack(type)}
                                            className="w-full text-left px-3 py-2 text-xs text-[var(--foreground)] hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 capitalize transition-colors block"
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Type a message to test..."
                        className="input flex-1 text-sm text-[var(--foreground)]"
                    />
                    <button
                        onClick={() => {
                            if (onSessionReset) {
                                onSessionReset();
                            } else {
                                setMessages([]);
                            }
                            setInput('');
                        }}
                        title="Reset Conversation"
                        className="px-3 py-2 text-sm flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--foreground-muted)] hover:text-[var(--error)] transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                    <button
                        onClick={sendMessage}
                        disabled={loading}
                        className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
