"use client";
import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

export default function ThemeSwitcher() {
    const [theme, setTheme] = useState<Theme>('system');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem('theme') as Theme;
        if (stored) setTheme(stored);
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;
        const systemQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const applyTheme = () => {
            if (theme === 'dark') {
                root.classList.add('dark');
            } else if (theme === 'light') {
                root.classList.remove('dark');
            } else {
                // System
                if (systemQuery.matches) {
                    root.classList.add('dark');
                } else {
                    root.classList.remove('dark');
                }
            }
        };

        applyTheme();

        localStorage.setItem('theme', theme);

        if (theme === 'system') {
            systemQuery.addEventListener('change', applyTheme);
            return () => systemQuery.removeEventListener('change', applyTheme);
        }
    }, [theme]);

    if (!mounted) return null;

    return (
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-md transition-all ${theme === 'light' ? 'bg-white dark:bg-gray-700 shadow-sm text-yellow-500' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'}`}
                title="Light Mode"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            </button>
            <button
                onClick={() => setTheme('system')}
                className={`p-1.5 rounded-md transition-all ${theme === 'system' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-500' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'}`}
                title="System (Auto)"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
            </button>
            <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-md transition-all ${theme === 'dark' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'}`}
                title="Dark Mode"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
            </button>
        </div>
    );
}
