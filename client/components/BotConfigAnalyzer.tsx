"use client";
import { useState } from 'react';

interface MatchResult {
    path: string;
    value: string;
    context: string;
}

interface AnalysisResult {
    topics: string[];
    regexPatterns: string[];
}

export default function BotConfigAnalyzer() {
    const [bannedTopic, setBannedTopic] = useState("weapons");
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [jsonContent, setJsonContent] = useState<any>(null);
    const [fileName, setFileName] = useState<string>("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [extractedData, setExtractedData] = useState<AnalysisResult | null>(null);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = JSON.parse(e.target?.result as string);
                setJsonContent(content);
                setMatches([]); // Reset matches on new file
                setExtractedData(null); // Reset analysis
            } catch (error) {
                console.error("Error parsing JSON:", error);
                alert("Invalid JSON file");
            }
        };
        reader.readAsText(file);
    };

    const findMatches = (obj: any, topic: string, currentPath: string = ""): MatchResult[] => {
        let results: MatchResult[] = [];
        const lowerTopic = topic.toLowerCase();

        if (typeof obj === 'string') {
            if (obj.toLowerCase().includes(lowerTopic)) {
                results.push({
                    path: currentPath,
                    value: obj,
                    context: "Direct Match"
                });
            }
            return results;
        }

        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                results = results.concat(findMatches(item, topic, `${currentPath}[${index}]`));
            });
            return results;
        }

        if (typeof obj === 'object' && obj !== null) {
            Object.keys(obj).forEach(key => {
                const newPath = currentPath ? `${currentPath}.${key}` : key;
                results = results.concat(findMatches(obj[key], topic, newPath));
            });
        }

        return results;
    };

    const handleAnalyze = async () => {
        if (!jsonContent) return;
        setIsAnalyzing(true);

        // 1. Client-side Search for specific topic
        const results = findMatches(jsonContent, bannedTopic);
        setMatches(results);

        // 2. Server-side Extraction
        try {
            const response = await fetch('http://localhost:3001/api/evaluate/analyze-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ botConfig: jsonContent }),
            });

            if (response.ok) {
                const data = await response.json();
                setExtractedData(data);
            } else {
                console.error("Analysis failed:", await response.text());
            }
        } catch (error) {
            console.error("Error contacting server:", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="card p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--border)]">
                <div className="w-6 h-6 rounded-md bg-[var(--primary-50)] flex items-center justify-center">
                    <svg className="w-4 h-4 text-[var(--primary-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
                <h3 className="text-base font-semibold text-[var(--foreground)]">
                    Bot Config Analyzer
                </h3>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1.5">Search Keyword</label>
                    <input
                        type="text"
                        value={bannedTopic}
                        onChange={(e) => setBannedTopic(e.target.value)}
                        className="input w-full text-sm text-[var(--foreground)]"
                        placeholder="e.g. weapons"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-[var(--foreground-muted)] mb-1.5">Configuration File</label>
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="block w-full text-sm text-[var(--foreground-muted)] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[var(--primary-50)] file:text-[var(--primary-700)] hover:file:bg-[var(--primary-100)] file:cursor-pointer file:transition-colors"
                    />
                    {fileName && (
                        <p className="mt-1.5 text-xs text-[var(--success)] flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {fileName}
                        </p>
                    )}
                </div>

                <button
                    onClick={handleAnalyze}
                    disabled={!jsonContent || isAnalyzing}
                    className="btn-primary w-full py-2.5 px-4 text-sm"
                >
                    {isAnalyzing ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Analyzing...
                        </span>
                    ) : (
                        "Analyze Configuration"
                    )}
                </button>

                {/* Extracted Metadata Section */}
                {extractedData && (
                    <div className="mt-4 p-4 bg-[var(--surface-hover)] rounded-lg border border-[var(--border)] animate-fade-in">
                        <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-[var(--primary-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Detected Configuration
                        </h4>

                        <div className="space-y-4">
                            <div>
                                <h5 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider mb-2">Topics</h5>
                                <div className="flex flex-wrap gap-1.5">
                                    {extractedData.topics.length > 0 ? (
                                        extractedData.topics.map((t, i) => (
                                            <span key={i} className="badge badge-blue">
                                                {t}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs text-[var(--foreground-muted)] italic">No topics found</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h5 className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider mb-2">Regex Patterns</h5>
                                {extractedData.regexPatterns.length > 0 ? (
                                    <ul className="space-y-1.5">
                                        {extractedData.regexPatterns.map((r, i) => (
                                            <li key={i} className="text-xs font-mono badge badge-yellow break-all">
                                                {r}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span className="text-xs text-[var(--foreground-muted)] italic">No patterns found</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Match Results Section */}
                {matches.length > 0 && (
                    <div className="mt-4 animate-fade-in">
                        <h4 className="text-sm font-medium text-[var(--error)] mb-2 flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {matches.length} matches for "{bannedTopic}"
                        </h4>
                        <div className="bg-[var(--error)]/5 rounded-lg p-3 max-h-48 overflow-y-auto border border-[var(--error)]/20">
                            {matches.map((match, idx) => (
                                <div key={idx} className="text-xs mb-2 pb-2 border-b border-[var(--error)]/10 last:border-0 last:mb-0 last:pb-0">
                                    <div className="font-medium text-[var(--foreground)] break-all">{match.path}</div>
                                    <div className="text-[var(--foreground-muted)] break-words mt-0.5">"{match.value}"</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {matches.length === 0 && extractedData && !isAnalyzing && (
                    <div className="mt-3 text-xs text-[var(--foreground-muted)] flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-[var(--success)]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Analysis complete. No matches for "{bannedTopic}".
                    </div>
                )}
            </div>
        </div>
    );
}
