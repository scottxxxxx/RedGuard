"use client";
import { useState, useEffect } from 'react';

export type BotConfig = {
    clientId: string;
    clientSecret: string;
    botId: string;
    webhookUrl: string;
    host?: string;
    inspectorClientId?: string;
    inspectorClientSecret?: string;
};

interface Props {
    onConfigChange: (config: BotConfig) => void;
    onBotNameUpdate?: (name: string | null) => void;
    onConnect?: (botGreeting: string) => void;
    onSessionReset?: () => void;
    userId?: string;
}

export default function BotSettings({ onConfigChange, onBotNameUpdate, onConnect, onSessionReset, userId }: Props) {
    const [showSecret, setShowSecret] = useState(false);
    const [config, setConfig] = useState<BotConfig>({
        clientId: '***REMOVED_KORE_CLIENT_ID***',
        clientSecret: '***REMOVED_SECRET***',
        botId: '***REMOVED_KORE_BOT_ID***',
        webhookUrl: 'https://platform.kore.ai/chatbot/v2/webhook/***REMOVED_KORE_BOT_ID***',
        host: 'platform.kore.ai',
        inspectorClientId: '',
        inspectorClientSecret: ''
    });

    const [isValidating, setIsValidating] = useState(false);
    const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [validationMessage, setValidationMessage] = useState<string | null>(null);

    const initializeChat = async (currentConfig: BotConfig) => {
        try {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/chat/connect`;
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    botConfig: currentConfig,
                    userId: userId || `RedGuard-init-${Math.random().toString(36).substring(7)}`
                })
            });

            const data = await res.json();

            const foundName = data.botName || data.botInfo?.name || data.meta?.botName;
            if (foundName && onBotNameUpdate) {
                onBotNameUpdate(foundName);
            }

            if (res.ok && data.data?.[0]?.val && onConnect) {
                onConnect(data.data[0].val);
            }
        } catch (err) {
            console.warn("Failed to get initial bot greeting:", err);
        }
    };

    const validateConnection = async (currentConfig: BotConfig) => {
        if (!currentConfig.botId || !currentConfig.clientId || !currentConfig.clientSecret) return;

        setValidationStatus('idle');
        setValidationMessage(null);

        try {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/kore/validate`;
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botConfig: currentConfig })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Validation failed');

            setValidationStatus('success');
            if (data.name) {
                setValidationMessage(`Connected as "${data.name}"`);
                if (onBotNameUpdate) onBotNameUpdate(data.name);
            } else {
                setValidationMessage(data.message || 'Connected (Bot name restricted)');
                if (onBotNameUpdate) onBotNameUpdate(null);
            }

        } catch (err: any) {
            setValidationStatus('error');
            setValidationMessage(err.message);
            if (onBotNameUpdate) onBotNameUpdate(null);
        }
    };

    // Load from localStorage on mount
    useEffect(() => {
        const savedConfig = localStorage.getItem('redguard_bot_config');
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                const merged = { ...config, ...parsed };
                setConfig(merged);
                // Try to validate on load if we have full config
                if (merged.botId && merged.clientId && merged.clientSecret) {
                    setIsValidating(true);
                    validateConnection(merged).finally(() => setIsValidating(false));
                }
            } catch (e) {
                console.error("Failed to parse saved bot config", e);
            }
        }
    }, [onBotNameUpdate]);

    // Trigger greeting when userId changes (e.g. on session reset)
    useEffect(() => {
        if (userId && config.botId && config.clientId && config.clientSecret) {
            setIsValidating(true);
            initializeChat(config).finally(() => setIsValidating(false));
        }
    }, [userId]);

    // Save to localStorage when config changes
    useEffect(() => {
        localStorage.setItem('redguard_bot_config', JSON.stringify(config));
        onConfigChange(config);
    }, [config, onConfigChange]);

    const handleChange = (key: keyof BotConfig, value: string) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="card p-5 h-full">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--border)]">
                <div className="w-6 h-6 rounded-md bg-[var(--primary-50)] flex items-center justify-center">
                    <svg className="w-4 h-4 text-[var(--primary-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="text-base font-semibold text-[var(--foreground)]">
                        Bot Configuration
                    </h3>
                </div>
            </div>

            {validationMessage && (
                <div className={`mb-4 p-2 rounded text-[11px] flex items-start gap-2 ${validationStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                    <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {validationStatus === 'success' ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        )}
                    </svg>
                    {validationMessage}
                </div>
            )}

            <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase text-[var(--foreground-muted)] tracking-wider mt-4">Web SDK (Chat) Credentials</h4>

                <div>
                    <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1.5">Webhook URL</label>
                    <input
                        type="text"
                        value={config.webhookUrl}
                        onChange={(e) => handleChange('webhookUrl', e.target.value)}
                        className="input w-full text-xs font-mono text-[var(--foreground)]"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1.5">Client ID</label>
                    <input
                        type="text"
                        value={config.clientId}
                        onChange={(e) => handleChange('clientId', e.target.value)}
                        className="input w-full text-sm font-mono text-[var(--foreground)]"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1.5">Client Secret</label>
                    <div className="flex items-center gap-2">
                        <input
                            type={showSecret ? "text" : "password"}
                            value={config.clientSecret}
                            onChange={(e) => handleChange('clientSecret', e.target.value)}
                            className="input flex-1 text-sm font-mono text-[var(--foreground)]"
                        />
                        <button
                            type="button"
                            onClick={() => setShowSecret(!showSecret)}
                            className="p-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--primary-50)] rounded transition-colors"
                            title={showSecret ? "Hide Secret" : "Show Secret"}
                        >
                            {showSecret ? (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1.5">Bot ID</label>
                    <input
                        type="text"
                        value={config.botId}
                        onChange={(e) => handleChange('botId', e.target.value)}
                        className="input w-full text-sm font-mono text-[var(--foreground)]"
                    />
                </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[var(--border)]">
                <button
                    onClick={async () => {
                        setIsValidating(true);
                        try {
                            if (onSessionReset) onSessionReset();
                            await validateConnection(config);
                            await initializeChat(config);
                        } finally {
                            setIsValidating(false);
                        }
                    }}
                    disabled={isValidating}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 rounded-lg transition-all hover:shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isValidating ? (
                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    )}
                    Test Bot Connection
                </button>
            </div>
        </div>
    );
}
