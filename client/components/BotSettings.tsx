"use client";
import { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';

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
    onConnect?: (botGreeting: string) => void;
    onSessionReset?: () => void;
    onClearConsole?: () => void;
    onKoreSessionUpdate?: (sessionId: string) => void;
    onConnectingChange?: (isConnecting: boolean) => void;
    userId?: string;
    isAuthenticated?: boolean;
    onAuthRequired?: () => void;
}

export default function BotSettings({ onConfigChange, onConnect, onSessionReset, onClearConsole, onKoreSessionUpdate, onConnectingChange, userId, isAuthenticated, onAuthRequired }: Props) {
    const { showToast } = useNotification();
    const [showSecret, setShowSecret] = useState(false);
    const [config, setConfig] = useState<BotConfig>({
        clientId: '***REMOVED_KORE_CLIENT_ID***',
        clientSecret: '***REMOVED_SECRET***',
        botId: '',
        webhookUrl: 'https://platform.kore.ai/chatbot/v2/webhook/',
        host: 'platform.kore.ai',
        inspectorClientId: '',
        inspectorClientSecret: ''
    });

    const [isValidating, setIsValidating] = useState(false);
    const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [validationMessage, setValidationMessage] = useState<string | null>(null);
    const [lastValidatedConfig, setLastValidatedConfig] = useState<BotConfig | null>(null);

    // Force reset validation state on mount to prevent stuck spinner
    useEffect(() => {
        setIsValidating(false);
    }, []);

    const initializeChat = async (currentConfig: BotConfig) => {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/chat/connect`;
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                botConfig: currentConfig,
                userId: userId || `RedGuard-init-${Math.random().toString(36).substring(7)}`
            })
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Connection failed' }));
            throw new Error(errorData.error || `Failed to connect (HTTP ${res.status})`);
        }

        const data = await res.json();

        // Extract session ID from connection response
        if (data._metadata?.sessionId && onKoreSessionUpdate) {
            onKoreSessionUpdate(data._metadata.sessionId);
        } else if (data.sessionId && onKoreSessionUpdate) {
            onKoreSessionUpdate(data.sessionId);
        }

        // Try to get welcome message from connection response
        let greetingMessage = data.data?.[0]?.val;

        // If no automatic greeting, send a greeting request to trigger welcome
        if (!greetingMessage) {
            try {
                const greetingRes = await fetch(`${apiUrl.replace('/init', '/send')}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: 'Hi',
                        userId: userId || `RedGuard-init-${Math.random().toString(36).substring(7)}`,
                        botConfig: currentConfig
                    })
                });

                if (greetingRes.ok) {
                    const greetingData = await greetingRes.json();
                    if (greetingData.data && Array.isArray(greetingData.data) && greetingData.data.length > 0) {
                        greetingMessage = greetingData.data
                            .map((msg: any) => msg.val || msg.text || JSON.stringify(msg))
                            .join('\n');
                    }
                }
            } catch (greetingError) {
                console.log('[BotSettings] Could not get greeting:', greetingError);
                // Fallback greeting if bot doesn't respond
                greetingMessage = 'Connected to bot. You can start chatting now.';
            }
        }

        if (greetingMessage && onConnect) {
            onConnect(greetingMessage);
        }
    };

    const validateConnection = async (currentConfig: BotConfig) => {
        if (!currentConfig.botId || !currentConfig.clientId || !currentConfig.clientSecret) return;

        setValidationStatus('idle');
        setValidationMessage(null);

        // Validate Bot ID matches webhook URL
        if (currentConfig.webhookUrl && !currentConfig.webhookUrl.includes(currentConfig.botId)) {
            setValidationStatus('error');
            const errorMsg = 'Bot ID mismatch: The Bot ID does not match the ID in the Webhook URL';
            setValidationMessage(errorMsg);
            throw new Error(errorMsg);
        }

        try {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/kore/validate`;

            // Add 20-second timeout to validation request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    botConfig: currentConfig,
                    userId: userId || 'unknown'
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const data = await res.json();
            if (!res.ok) {
                // Provide more specific error based on status code
                if (res.status === 401) {
                    throw new Error('401 Unauthorized - Invalid credentials');
                } else if (res.status === 404) {
                    throw new Error('404 Not Found - Bot does not exist');
                } else if (res.status === 403) {
                    throw new Error('403 Forbidden - Insufficient permissions');
                } else if (res.status === 503) {
                    throw new Error('503 Service Unavailable - ' + (data.error || 'Cannot reach webhook URL'));
                } else if (res.status === 500) {
                    throw new Error('500 Server Error - ' + (data.error || 'Webhook validation failed'));
                } else {
                    throw new Error(data.error || `Validation failed (${res.status})`);
                }
            }

            setValidationStatus('success');
            setValidationMessage('Connection validated successfully');
            setLastValidatedConfig(currentConfig); // Store validated config
        } catch (err: any) {
            setValidationStatus('error');
            const errorMessage = err.message || 'Unknown validation error';
            setValidationMessage(errorMessage);
            throw err; // Re-throw to be caught by parent error handler
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
                // Don't auto-validate on mount, let user click the button
            } catch (e) {
                console.error("Failed to parse saved bot config", e);
            }
        }
    }, []); // Empty dependency array - only run once on mount

    // Trigger greeting when userId changes (e.g. on session reset)
    // Only run if userId is explicitly set (not undefined or empty)
    useEffect(() => {
        if (userId && userId !== '' && config.botId && config.clientId && config.clientSecret) {
            // Use a small delay to avoid race conditions with the button handler
            const timer = setTimeout(() => {
                initializeChat(config).catch(err => {
                    console.error('[BotSettings] Auto-connect failed:', err);
                });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [userId]); // Only depend on userId changes

    // Save to localStorage when config changes
    useEffect(() => {
        localStorage.setItem('redguard_bot_config', JSON.stringify(config));
        onConfigChange(config);
    }, [config, onConfigChange]);

    const handleChange = (key: keyof BotConfig, value: string) => {
        setConfig(prev => {
            const updated = { ...prev, [key]: value };

            // Workflow 1: If webhook URL changes, extract Bot ID from it
            if (key === 'webhookUrl') {
                const botIdMatch = value.match(/\/webhook\/([a-z0-9-]+)$/i);
                if (botIdMatch) {
                    // Complete URL with Bot ID - extract it
                    updated.botId = botIdMatch[1];
                } else if (!value.endsWith('/webhook/')) {
                    // URL changed but doesn't end properly - keep existing Bot ID
                    // This handles partial edits
                }
            }

            // Workflow 2: If Bot ID changes, sync with webhook URL
            if (key === 'botId') {
                if (value) {
                    // Bot ID provided - add or update it in webhook URL
                    if (prev.webhookUrl.endsWith('/webhook/')) {
                        // Base URL without Bot ID - append it
                        updated.webhookUrl = prev.webhookUrl + value;
                    } else {
                        // URL already has a Bot ID - replace it
                        const baseUrl = prev.webhookUrl.replace(/\/webhook\/[a-z0-9-]*$/i, '/webhook/');
                        updated.webhookUrl = baseUrl + value;
                    }
                } else {
                    // Bot ID cleared - remove it from webhook URL
                    updated.webhookUrl = prev.webhookUrl.replace(/\/webhook\/[a-z0-9-]*$/i, '/webhook/');
                }
            }

            return updated;
        });
    };

    // Check if Bot ID is inferred from webhook URL (URL has Bot ID already)
    const botIdFromWebhook = config.webhookUrl.match(/\/webhook\/([a-z0-9-]+)$/i)?.[1];
    const webhookIsIncomplete = config.webhookUrl.endsWith('/webhook/');
    const isBotIdInferred = !!botIdFromWebhook && botIdFromWebhook === config.botId && !webhookIsIncomplete;

    return (
        <div className="card p-5 h-full">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--border)]">
                <div className="w-6 h-6 rounded-md bg-[var(--primary-50)] flex items-center justify-center">
                    <svg className="w-4 h-4 text-[var(--primary-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="text-base font-semibold text-[var(--foreground)]">
                        Bot Configuration
                    </h3>
                </div>
            </div>

            {validationMessage && (
                <div className={`mb-4 p-2 rounded text-[11px] flex items-start gap-2 ${validationStatus === 'success' ? 'bg-success-bg text-success-text border border-success-border' : 'bg-error-bg text-error-text border border-error-border'
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
                    <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1.5">
                        Bot ID
                    </label>
                    <input
                        type="text"
                        value={config.botId}
                        onChange={(e) => handleChange('botId', e.target.value)}
                        placeholder="Enter Bot ID (e.g., st-abc123...)"
                        className="input w-full text-sm font-mono text-[var(--foreground)]"
                    />
                    <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
                        Syncs with webhook URL automatically
                    </p>
                </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[var(--border)]">
                <button
                    onClick={async () => {
                        // Check authentication first
                        if (!isAuthenticated && onAuthRequired) {
                            onAuthRequired();
                            return;
                        }

                        // Validate that webhook URL is complete before attempting connection
                        if (config.webhookUrl.endsWith('/webhook/')) {
                            showToast(
                                'Incomplete webhook URL.\n\n' +
                                'Please provide a Bot ID or paste the complete webhook URL.',
                                'error'
                            );
                            return;
                        }

                        //Check if credentials have changed since last validation
                        const credentialsChanged = lastValidatedConfig && (
                            lastValidatedConfig.clientId !== config.clientId ||
                            lastValidatedConfig.clientSecret !== config.clientSecret ||
                            lastValidatedConfig.botId !== config.botId ||
                            lastValidatedConfig.webhookUrl !== config.webhookUrl
                        );

                        if (credentialsChanged) {
                            // Credentials changed - clear old validation and force revalidation
                            setValidationStatus('idle');
                            setValidationMessage(null);
                            setLastValidatedConfig(null);
                        }

                        // Clear console and reset session immediately when user clicks Connect
                        // This ensures we start fresh and don't reuse old sessions
                        if (onClearConsole) onClearConsole();
                        if (onSessionReset) onSessionReset();

                        // Notify parent that connection is starting
                        if (onConnectingChange) onConnectingChange(true);

                        setIsValidating(true);
                        // Safety timeout to ensure button always resets (longer than Promise.race timeout)
                        const timeout = setTimeout(() => {
                            console.warn('[BotSettings] Connection timeout - resetting button');
                            setIsValidating(false);
                            if (onConnectingChange) onConnectingChange(false);
                            setValidationStatus('error');
                            setValidationMessage('Connection timed out - please try again');
                        }, 20000); // 20 second timeout (longer than the 15s Promise.race timeout)

                        try {
                            // Clear any previous successful state to force fresh validation
                            setValidationStatus('idle');
                            setValidationMessage(null);

                            // Validate first (fast, fails early on config errors)
                            await validateConnection(config);

                            // Then initialize chat (slower, but only if validation passed)
                            await Promise.race([
                                initializeChat(config),
                                new Promise((_, reject) =>
                                    setTimeout(() => reject(new Error('Connection timeout')), 15000)
                                )
                            ]);
                        } catch (err: any) {
                            console.error('[BotSettings] Connection error:', err);

                            // Set validation status to error
                            setValidationStatus('error');

                            // Provide specific error messages with troubleshooting guidance
                            if (err?.message?.includes('Bot ID mismatch')) {
                                const msg = 'Bot ID mismatch - Bot ID must match the ID in the Webhook URL';
                                setValidationMessage(msg);
                                showToast(
                                    'Bot ID mismatch detected.\n\n' +
                                    'The Bot ID you entered does not match the Bot ID in the Webhook URL.\n\n' +
                                    'Please ensure:\n' +
                                    '• Bot ID matches the ID at the end of the Webhook URL\n' +
                                    '• Both values are from the same bot in Kore.ai',
                                    'error'
                                );
                            } else if (err?.message === 'Connection timeout') {
                                setValidationMessage('Connection timeout - verify network and webhook URL');
                                showToast(
                                    'Connection timed out after 15 seconds. This usually means:\n' +
                                    '• Network connectivity issues\n' +
                                    '• Bot is not responding\n' +
                                    '• Webhook URL is incorrect\n\n' +
                                    'Please verify your credentials and try again.',
                                    'error'
                                );
                            } else if (err?.message?.includes('401') || err?.message?.includes('Unauthorized') || err?.message?.includes('Invalid SDK credentials')) {
                                setValidationMessage('Authentication failed - verify Client ID and Client Secret');
                                showToast(
                                    'Authentication failed (401 Unauthorized).\n\n' +
                                    'Troubleshooting:\n' +
                                    '• Verify Client ID and Client Secret are correct\n' +
                                    '• Check if credentials have expired\n' +
                                    '• Ensure the bot is published',
                                    'error'
                                );
                            } else if (err?.message?.includes('404') || err?.message?.includes('Not Found')) {
                                setValidationMessage('Bot not found - verify Bot ID');
                                showToast(
                                    'Bot not found (404).\n\n' +
                                    'Troubleshooting:\n' +
                                    '• Verify the Bot ID is correct\n' +
                                    '• Check if the bot exists in your Kore.ai workspace\n' +
                                    '• Ensure the bot is published',
                                    'error'
                                );
                            } else if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
                                showToast(
                                    'Network error - cannot reach Kore.ai platform.\n\n' +
                                    'Troubleshooting:\n' +
                                    '• Check your internet connection\n' +
                                    '• Verify firewall/proxy settings\n' +
                                    '• Kore.ai platform might be temporarily unavailable',
                                    'error'
                                );
                            } else if (err?.message?.includes('CORS')) {
                                showToast(
                                    'CORS error - webhook configuration issue.\n\n' +
                                    'Troubleshooting:\n' +
                                    '• Enable webhook in Kore.ai bot settings\n' +
                                    '• Check webhook URL configuration\n' +
                                    '• Verify bot is published with webhook enabled',
                                    'error'
                                );
                            } else if (err?.message?.includes('503') || err?.message?.includes('Service Unavailable')) {
                                showToast(
                                    'Webhook URL is unreachable.\n\n' +
                                    'Troubleshooting:\n' +
                                    '• Check if the webhook URL is correct\n' +
                                    '• Verify the hostname is valid\n' +
                                    '• Check your network connection\n' +
                                    '• Ensure the Kore.ai platform is accessible',
                                    'error'
                                );
                            } else if (err?.message?.includes('500') || err?.message?.includes('Server Error')) {
                                showToast(
                                    'Webhook validation failed.\n\n' +
                                    'Troubleshooting:\n' +
                                    '• Verify the webhook URL format is correct\n' +
                                    '• Check if the bot webhook is enabled\n' +
                                    '• Ensure the Bot ID in the URL matches your configuration\n' +
                                    '• Try the connection again in a few moments',
                                    'error'
                                );
                            } else {
                                showToast(
                                    `Connection failed: ${err?.message || 'Unknown error'}\n\n` +
                                    'Please check:\n' +
                                    '• Bot credentials are correct\n' +
                                    '• Bot is published and active\n' +
                                    '• Webhook is enabled in bot settings',
                                    'error'
                                );
                            }
                        } finally {
                            clearTimeout(timeout);
                            setIsValidating(false);
                            if (onConnectingChange) onConnectingChange(false);
                        }
                    }}
                    disabled={isValidating || webhookIsIncomplete}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 border border-gray-300 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-600 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isValidating ? (
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    )}
                    Connect
                </button>
            </div>
        </div>
    );
}
