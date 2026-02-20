"use client";
import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
    duration?: number;
}

export default function Toast({ message, type, onClose }: ToastProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const typeStyles = {
        success: 'bg-[#dcfce7] dark:bg-[#14532d] border-[#86efac] dark:border-[#22c55e] text-success-text shadow-xl',
        error: 'bg-[#fee2e2] dark:bg-[#7f1d1d] border-[#fca5a5] dark:border-[#ef4444] text-error-text shadow-xl',
        info: 'bg-[#dbeafe] dark:bg-[#1e3a5f] border-[#93c5fd] dark:border-[#3b82f6] text-info-text shadow-xl'
    };

    const iconStyles = {
        success: 'text-success-text',
        error: 'text-error-text',
        info: 'text-info-text'
    };

    const icons = {
        success: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
        ),
        error: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
        info: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        )
    };

    // Parse message string into structured blocks (paragraphs, numbered lists, bullet lists)
    const renderMessage = (msg: string) => {
        const lines = msg.split('\n');
        const blocks: React.ReactNode[] = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            // Skip empty lines
            if (line.trim() === '') { i++; continue; }

            // Collect consecutive numbered lines (e.g., "1. ...", "2. ...")
            if (/^\d+\.\s/.test(line.trim())) {
                const items: string[] = [];
                while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
                    items.push(lines[i].trim().replace(/^\d+\.\s*/, ''));
                    i++;
                }
                blocks.push(
                    <ol key={blocks.length} className="list-decimal list-inside text-left space-y-1 text-sm">
                        {items.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ol>
                );
                continue;
            }

            // Collect consecutive bullet lines (e.g., "• ...")
            if (line.trim().startsWith('•')) {
                const items: string[] = [];
                while (i < lines.length && lines[i].trim().startsWith('•')) {
                    items.push(lines[i].trim().replace(/^•\s*/, ''));
                    i++;
                }
                blocks.push(
                    <ul key={blocks.length} className="list-disc list-inside text-left space-y-1 text-sm">
                        {items.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                );
                continue;
            }

            // Regular text line
            blocks.push(<p key={blocks.length} className="text-sm">{line}</p>);
            i++;
        }
        return blocks;
    };

    return (
        <div className={`fixed inset-0 z-[10000] flex items-center justify-center p-4 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            <div className="absolute inset-0 bg-black/60" />

            <div
                className={`relative w-full max-w-md p-6 rounded-2xl border transition-all duration-300 transform shadow-2xl ${isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'
                    } ${typeStyles[type]}`}
            >
                <div className="flex flex-col items-center text-center gap-4">
                    <div className={iconStyles[type]}>
                        {icons[type]}
                    </div>
                    <div className="font-medium leading-relaxed space-y-2">
                        {renderMessage(message)}
                    </div>
                    <button
                        onClick={() => {
                            setIsVisible(false);
                            setTimeout(onClose, 300);
                        }}
                        className="mt-2 px-6 py-2 bg-black/10 hover:bg-black/20 rounded-lg font-medium transition-colors"
                    >
                        Acknowledge
                    </button>
                </div>
            </div>
        </div>
    );
}
