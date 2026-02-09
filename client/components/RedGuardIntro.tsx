"use client";
import { useState, useEffect } from "react";

const RedGuardIntro = () => {
    const [visible, setVisible] = useState(false);
    const [activeStep, setActiveStep] = useState(0);

    useEffect(() => {
        setVisible(true);
        const interval = setInterval(() => {
            setActiveStep((prev) => (prev + 1) % 3);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const steps = [
        {
            number: "01",
            title: "Setup Connection",
            description: "Enter your bot's webhook credentials to establish a live chat session with your deployed Kore.ai bot.",
            icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
            ),
            maps_to: "Capture Interaction",
        },
        {
            number: "02",
            title: "Define Guardrails",
            description: "Select which safety policies to test, including toxicity, restricted topics, prompt injection, and regex filters, or pull them directly from your bot's config.",
            icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <line x1="9" y1="12" x2="15" y2="12" />
                    <line x1="12" y1="9" x2="12" y2="15" />
                </svg>
            ),
            maps_to: "Define Guardrails",
        },
        {
            number: "03",
            title: "Test & Evaluate",
            description: "Chat with your bot live, or deliberately attack it, then let an AI judge audit every response and score each guardrail as passed, failed, or missing.",
            icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M9 15l2 2 4-4" />
                </svg>
            ),
            maps_to: "Configure Evaluation + Results",
        },
    ];

    const statusBadges = [
        { label: "Pass", color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
        { label: "Fail", color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
        { label: "Not Tested", color: "#737373", bg: "rgba(115,115,115,0.08)" },
        { label: "Not Detected", color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
    ];

    return (
        <div className="relative overflow-hidden mb-12">
            <div className="relative max-w-5xl mx-auto px-4 py-10">
                {/* Hero */}
                <div
                    className={`text-center mb-12 transition-all duration-700 ease-out-expo ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                        }`}
                >
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
                        Test, verify, and harden your bot's{" "}
                        <span className="text-indigo-600 dark:text-indigo-400">
                            AI safety guardrails.
                        </span>
                    </h1>

                    <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-8 font-normal leading-relaxed">
                        Chat with your bot in a live session while an AI judge evaluates every
                        response against your configured guardrail policies, catching what
                        passed, what failed, and what's missing.
                    </p>

                    {/* Status badges */}
                    <div className="flex justify-center gap-3 flex-wrap">
                        {statusBadges.map((badge) => (
                            <span
                                key={badge.label}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-mono font-medium"
                                style={{
                                    backgroundColor: badge.bg,
                                    borderColor: `${badge.color}22`,
                                    color: badge.color,
                                }}
                            >
                                <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: badge.color }}
                                />
                                {badge.label}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Divider */}
                <div
                    className={`flex items-center justify-center gap-4 mb-10 transition-opacity duration-500 delay-200 ${visible ? "opacity-100" : "opacity-0"
                        }`}
                >
                    <div className="flex-1 max-w-[120px] h-px bg-gradient-to-r from-transparent to-gray-200 dark:to-gray-700" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-400 font-semibold">
                        How it works
                    </span>
                    <div className="flex-1 max-w-[120px] h-px bg-gradient-to-r from-gray-200 dark:from-gray-700 to-transparent" />
                </div>

                {/* 3-Step Cards */}
                <div
                    className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-700 ease-out-expo delay-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                        }`}
                >
                    {steps.map((step, i) => {
                        const isActive = activeStep === i;
                        return (
                            <div
                                key={step.number}
                                onClick={() => setActiveStep(i)}
                                className={`relative p-6 rounded-2xl cursor-pointer transition-all duration-500 group border-2 ${isActive
                                    ? "bg-white dark:bg-gray-800 border-indigo-500 shadow-xl shadow-indigo-500/10"
                                    : "bg-white/50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-900"
                                    }`}
                            >
                                {/* Top accent bar */}
                                <div
                                    className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-30"
                                        }`}
                                />

                                {/* Header: Icon + Number */}
                                <div className="flex items-center justify-between mb-5">
                                    <div
                                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-500 ${isActive
                                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                                            }`}
                                    >
                                        {step.icon}
                                    </div>
                                    <span
                                        className={`font-mono text-xs font-bold tracking-wider ${isActive ? "text-indigo-500" : "text-gray-300 dark:text-gray-600"
                                            }`}
                                    >
                                        {step.number}
                                    </span>
                                </div>

                                {/* Body */}
                                <h3
                                    className={`text-lg font-bold mb-2 transition-colors duration-500 ${isActive ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"
                                        }`}
                                >
                                    {step.title}
                                </h3>
                                <p
                                    className={`text-sm leading-relaxed mb-6 transition-colors duration-500 ${isActive ? "text-gray-600 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"
                                        }`}
                                >
                                    {step.description}
                                </p>

                                {/* Footer: Meta */}
                                <div
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold tracking-tight transition-all duration-500 ${isActive
                                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800"
                                        : "bg-gray-50 dark:bg-gray-800/50 text-gray-400 border border-transparent"
                                        }`}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M7 17l9.2-9.2M17 17V7H7" />
                                    </svg>
                                    {step.maps_to}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Progress Indicator */}
                <div
                    className={`flex justify-center items-center gap-0 mt-8 transition-opacity duration-600 delay-500 ${visible ? "opacity-100" : "opacity-0"
                        }`}
                >
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="flex items-center group">
                            <button
                                onClick={() => setActiveStep(i)}
                                className={`w-2.5 h-2.5 rounded-full transition-all duration-500 relative ${activeStep === i
                                    ? "bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.5)] scale-110"
                                    : "bg-gray-200 dark:bg-gray-700 hover:bg-indigo-300 dark:hover:bg-indigo-900"
                                    }`}
                            />
                            {i < 2 && (
                                <div className="w-20 h-0.5 relative overflow-hidden bg-gray-200 dark:bg-gray-700">
                                    <div
                                        className={`absolute inset-0 bg-indigo-600 transition-all duration-500 ${activeStep > i ? "translate-x-0" : "-translate-x-full"
                                            }`}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer Tagline */}
                <div
                    className={`text-center mt-8 text-[11px] font-mono text-gray-300 dark:text-gray-600 tracking-wide transition-opacity duration-600 delay-700 ${visible ? "opacity-100" : "opacity-0"
                        }`}
                >
                    Guardrails are evaluated strictly against their configured rules, configuration recommendations are provided separately.
                </div>
            </div>
        </div>
    );
};

export default RedGuardIntro;
