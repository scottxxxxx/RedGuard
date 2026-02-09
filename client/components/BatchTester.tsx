"use client";
import { useState } from 'react';
import { BotConfig } from './BotSettings';
import { CompositeGuardrailConfig } from '../app/page';

interface Props {
    botConfig: BotConfig | null;
    guardrailConfig: CompositeGuardrailConfig | null;
}

interface BatchResult {
    conversationId: string;
    utterance: string;
    botResponse: string;
    history: any[];
    evaluationQuery: string;
    evaluationResult: any;
    status: 'pass' | 'fail';
    failedGuardrail?: string;
}

export default function BatchTester({ botConfig, guardrailConfig }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<BatchResult[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const processBatch = async () => {
        if (!file || !botConfig || !guardrailConfig) return;
        setIsProcessing(true);
        setResults([]);
        setProgress(0);

        const text = await file.text();
        const rows = text.split('\n').map(row => row.split(','));
        // Skip header if present (assuming row 0 is header "conversation_number,utterance")
        const dataRows = rows.slice(1).filter(r => r.length >= 2 && r[0].trim() !== '');

        const conversations: Record<string, string[]> = {};
        dataRows.forEach(row => {
            const id = row[0].trim();
            const utterance = row.slice(1).join(',').trim(); // Handle commas in utterance? simplistic vs CSV parser
            if (!conversations[id]) conversations[id] = [];
            conversations[id].push(utterance);
        });

        const totalUtterances = dataRows.length;
        let processedCount = 0;
        const newResults: BatchResult[] = [];

        for (const [convId, utterances] of Object.entries(conversations)) {
            let history: { role: string, text: string }[] = [];

            for (const utterance of utterances) {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
                // 1. Send Message
                let botResponseText = "";
                try {
                    const chatRes = await fetch(`${apiUrl}/chat/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: utterance, botConfig })
                    });
                    const chatData = await chatRes.json();

                    if (chatData.data && Array.isArray(chatData.data)) {
                        botResponseText = chatData.data.map((m: any) => m.val || m.text).join('\n');
                    } else {
                        botResponseText = chatData.text || JSON.stringify(chatData);
                    }
                } catch (e) {
                    botResponseText = "Error: Failed to get bot response";
                }

                // 2. Evaluate
                let evalResult = null;
                let status: 'pass' | 'fail' = 'pass';
                let failedGuardrail = "";
                let debugPrompt = "";

                try {
                    const evalRes = await fetch(`${apiUrl}/evaluate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userInput: utterance,
                            botResponse: botResponseText,
                            guardrailConfig,
                            history
                        })
                    });
                    evalResult = await evalRes.json();
                    status = evalResult.pass ? 'pass' : 'fail';
                    if (!evalResult.pass && evalResult.results) {
                        failedGuardrail = evalResult.results.filter((r: any) => !r.pass).map((r: any) => r.guardrail).join(', ');
                    }
                    if (evalResult.debug) debugPrompt = evalResult.debug.prompt;
                } catch (e) {
                    status = 'fail';
                    failedGuardrail = "Evaluation API Error";
                }

                newResults.push({
                    conversationId: convId,
                    utterance,
                    botResponse: botResponseText,
                    history: [...history],
                    evaluationQuery: debugPrompt,
                    evaluationResult: evalResult,
                    status,
                    failedGuardrail
                });

                // Update History
                history.push({ role: 'user', text: utterance });
                history.push({ role: 'bot', text: botResponseText });

                processedCount++;
                setProgress(Math.round((processedCount / totalUtterances) * 100));
            }
        }

        setResults(newResults);
        setIsProcessing(false);
    };

    const downloadCsv = () => {
        const headers = ['Conversation ID', 'Complete Input (History + User Input)', 'Evaluation Query', 'Output (Bot Response)', 'Status', 'Failed Guardrail'];
        const csvContent = [
            headers.join(','),
            ...results.map(r => {
                // Create a readable history string
                const inputs = [...r.history.map(h => `${h.role}: ${h.text}`), `user: ${r.utterance}`].join(' | ');

                // Escape CSV fields
                const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;

                return [
                    escape(r.conversationId),
                    escape(inputs),
                    escape(r.evaluationQuery),
                    escape(r.botResponse),
                    escape(r.status),
                    escape(r.failedGuardrail || '')
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `batch_results_${new Date().toISOString()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 h-[600px] flex flex-col">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b pb-2">
                Batch Testing via CSV
            </h3>

            <div className="mb-4 space-y-4">
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Upload Conversation CSV
                        </label>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                        <p className="text-xs text-gray-500 mt-1">Format: conversation_number, utterance</p>
                    </div>
                    <button
                        onClick={processBatch}
                        disabled={!file || isProcessing || !guardrailConfig}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 h-10"
                    >
                        {isProcessing ? 'Processing...' : 'Run Batch'}
                    </button>
                </div>

                {isProcessing && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                        <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                )}
            </div>

            <div className="flex-1 h-0 overflow-auto border rounded-md">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Messages</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {results.map((res, i) => (
                            <tr key={i} className={res.status === 'pass' ? 'bg-green-50/50' : 'bg-red-50/50'}>
                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    {res.conversationId}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                    <div className="font-semibold">User: {res.utterance}</div>
                                    <div className="text-xs">Bot: {res.botResponse.substring(0, 50)}...</div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${res.status === 'pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                        {res.status.toUpperCase()}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                                    {res.failedGuardrail || '-'}
                                </td>
                            </tr>
                        ))}
                        {results.length === 0 && !isProcessing && (
                            <tr>
                                <td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-500">
                                    No results yet. Upload a CSV and run batch.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {results.length > 0 && (
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={downloadCsv}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download Results CSV
                    </button>
                </div>
            )}
        </div>
    );
}
