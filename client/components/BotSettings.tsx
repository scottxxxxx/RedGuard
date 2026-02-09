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
}

export default function BotSettings({ onConfigChange }: Props) {
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

    // Load from localStorage on mount
    useEffect(() => {
        const savedConfig = localStorage.getItem('redguard_bot_config');
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                setConfig(prev => ({ ...prev, ...parsed }));
            } catch (e) {
                console.error("Failed to parse saved bot config", e);
            }
        }
    }, []);

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
                <h3 className="text-base font-semibold text-[var(--foreground)]">
                    Bot Configuration
                </h3>
            </div>

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
        </div>
    );
}
