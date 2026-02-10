/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: ['selector', '[class="dark"]'],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                "foreground-secondary": "var(--foreground-secondary)",
                surface: "var(--surface)",
                "surface-hover": "var(--surface-hover)",
                border: "var(--border)",
                "sidebar-active": "var(--sidebar-active)",
                "sidebar-active-text": "var(--sidebar-active-text)",
                "sidebar-hover": "var(--sidebar-hover)",
                primary: {
                    50: "var(--primary-50)",
                    100: "var(--primary-100)",
                    200: "var(--primary-200)",
                    400: "var(--primary-400)",
                    500: "var(--primary-500)",
                    600: "var(--primary-600)",
                    700: "var(--primary-700)",
                },
                success: {
                    bg: "var(--success-bg)",
                    border: "var(--success-border)",
                    text: "var(--success-text)",
                },
                warning: {
                    bg: "var(--warning-bg)",
                    border: "var(--warning-border)",
                    text: "var(--warning-text)",
                },
                error: {
                    bg: "var(--error-bg)",
                    border: "var(--error-border)",
                    text: "var(--error-text)",
                },
                info: {
                    bg: "var(--info-bg)",
                    border: "var(--info-border)",
                    text: "var(--info-text)",
                },
                badge: {
                    "blue-bg": "var(--badge-blue-bg)",
                    "blue-text": "var(--badge-blue-text)",
                    "purple-bg": "var(--badge-purple-bg)",
                    "purple-text": "var(--badge-purple-text)",
                    "orange-bg": "var(--badge-orange-bg)",
                    "orange-text": "var(--badge-orange-text)",
                    "gray-bg": "var(--badge-gray-bg)",
                    "gray-text": "var(--badge-gray-text)",
                },
                stats: {
                    bg: "var(--stats-bg)",
                    border: "var(--stats-border)",
                }
            },
            fontFamily: {
                sans: ["var(--font-geist-sans)"],
                mono: ["var(--font-geist-mono)"],
            },
        },
    },
    plugins: [],
};
