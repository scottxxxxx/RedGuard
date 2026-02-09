"use client";
import React, { useState, useEffect, useRef } from 'react';

interface GarakTesterProps {
    botId?: string;
}

interface ProbeInfo {
    label: string;
    description: string;
}

export default function GarakTester({ botId }: GarakTesterProps) {
    const [probes, setProbes] = useState<Record<string, ProbeInfo>>({});
    const [selectedProbe, setSelectedProbe] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        // Fetch available probes
        fetch(`${apiUrl}/garak/probes`)
            .then(res => res.json())
            .then(data => setProbes(data))
            .catch(err => console.error("Failed to fetch probes", err));
    }, []);

    // Auto-scroll logs
    useEffect(() => {
        if (scrollContainerRef.current) {
            const { scrollHeight, clientHeight } = scrollContainerRef.current;
            scrollContainerRef.current.scrollTo({
                top: scrollHeight - clientHeight,
                behavior: 'smooth'
            });
        }
    }, [logs]);

    const startScan = async () => {
        if (!selectedProbe || !botId) return;

        setIsRunning(true);
        setLogs(prev => [...prev, `Initializing Garak scan for '${probes[selectedProbe].label}'...`]);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        try {
            const response = await fetch(`${apiUrl}/garak/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guardrail: selectedProbe,
                    config: { botId } // The backend will merge this with env vars for secrets
                })
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                // Split by newlines and filter empty strings
                const lines = text.split('\n');
                setLogs(prev => [...prev, ...lines]);
            }

        } catch (error: any) {
            setLogs(prev => [...prev, `[ERROR] Connection failed: ${error.message}`]);
        } finally {
            setIsRunning(false);
            setLogs(prev => [...prev, "Scan process finished."]);
        }
    };

    if (!botId) {
        return (
            <div className="p-8 text-center text-gray-500">
                Please configure and select a bot in Bot Settings first.
            </div>
        );
    }

    return (
        <div className="flex h-full gap-6">
            {/* Left Panel: Configuration */}
            <div className="w-1/3 flex flex-col gap-6">
                <div className="card p-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="text-2xl">🛡️</span> Security Scanner
                    </h2>
                    <p className="text-sm text-gray-400 mb-6">
                        Run advanced vulnerability assessments using NVIDIA Garak.
                    </p>

                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-gray-300">Select Test Suite</label>
                        <div className="space-y-2">
                            {Object.entries(probes).map(([key, info]) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedProbe(key)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all ${selectedProbe === key
                                        ? 'bg-blue-900/40 border-blue-500 ring-1 ring-blue-500'
                                        : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                                        }`}
                                >
                                    <div className="font-medium text-white">{info.label}</div>
                                    <div className="text-xs text-gray-400 mt-1">{info.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={startScan}
                        disabled={!selectedProbe || isRunning}
                        className={`mt-6 w-full py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${!selectedProbe || isRunning
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20'
                            }`}
                    >
                        {isRunning ? (
                            <>
                                <span className="animate-spin">⚙️</span> Scanning...
                            </>
                        ) : (
                            <>🚀 Run Security Scan</>
                        )}
                    </button>

                    {isRunning && (
                        <div className="mt-4 text-xs text-center text-yellow-500 animate-pulse">
                            This may take several minutes. Do not close this tab.
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Terminal Logs */}
            <div className="w-2/3 flex flex-col h-[600px]">
                <div className="card flex flex-col h-full overflow-hidden bg-black border-gray-800">
                    <div className="p-3 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
                        <span className="font-mono text-sm text-gray-400">Scan Console Output</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setLogs([])}
                                className="text-xs px-2 py-1 hover:bg-gray-800 rounded text-gray-500"
                            >
                                Clear Logs
                            </button>
                        </div>
                    </div>
                    <div
                        ref={scrollContainerRef}
                        className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1"
                    >
                        {logs.length === 0 && (
                            <div className="text-gray-600 italic">Waiting for scan to start...</div>
                        )}
                        {logs.map((log, i) => (
                            <div key={i} className={`${log.includes('[ERROR]') ? 'text-red-400' :
                                log.includes('Success') ? 'text-green-400' :
                                    log.includes('Running probe') ? 'text-blue-400' :
                                        'text-gray-300'
                                } break-words whitespace-pre-wrap`}>
                                {log}
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );
}
