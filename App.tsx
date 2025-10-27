import React, { useState, useCallback, useRef, useEffect } from 'react';
import { processTranscript, translateToItalian } from './services/geminiService';
import type { ProcessedData } from './types';
import ResultCard from './components/ResultCard';
import Loader from './components/Loader';

// This is required for TypeScript to recognize the aistudio object on the window.
// Fix: The inline type declaration for `window.aistudio` was causing a conflict.
// Replaced it with a named interface `AIStudio` to align with other declarations,
// resolving the type mismatch error as suggested by the compiler.
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}
declare global {
  interface Window {
    aistudio: AIStudio;
  }
}

// This regex matches timestamps in formats like [00:00:05] or 0:05 followed by an optional space.
// It's kept as a utility in case users paste transcripts with timestamps.
const removeTimestamps = (text: string): string => {
  return text.replace(/(\[\d{2}:\d{2}:\d{2}\]|\d{1,2}:\d{2})\s?/g, '').trim();
};

const UploadIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
);

const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessedData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [checkingApiKey, setCheckingApiKey] = useState<boolean>(true);
  
  useEffect(() => {
    const checkKey = async () => {
      setCheckingApiKey(true);
      try {
        if (await window.aistudio.hasSelectedApiKey()) {
          setHasApiKey(true);
        }
      } catch (e) {
        console.error("aistudio SDK not available.", e);
        setError("Could not connect to the API key service. Please refresh the page.");
      } finally {
        setCheckingApiKey(false);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    setError(null);
    try {
      await window.aistudio.openSelectKey();
      // Assume success to avoid race conditions and update UI immediately
      setHasApiKey(true);
    } catch (e) {
      console.error("Failed to open API key selection:", e);
      setError("Could not open the API key selection dialog. Please try refreshing the page.");
    }
  };
  
  const handleApiError = (err: unknown) => {
    let errorMessage = "An unknown error occurred.";
    if (err instanceof Error) {
        errorMessage = err.message;
        if (errorMessage.includes("Requested entity was not found")) {
            setError("Your API key appears to be invalid. Please select a valid API key to continue.");
            setHasApiKey(false); // Reset key state to show the selection screen again.
            return true; // Indicates a key error was handled
        }
    }
    setError(errorMessage);
    return false;
  };

  const handleProcessText = useCallback(async () => {
    if (!inputText.trim()) {
      setError("Please paste some text to process.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const originalScript = removeTimestamps(inputText);
      const { improvedText, summary } = await processTranscript(originalScript);
      setResult({ improvedText, summary });
    } catch (err) {
       if(handleApiError(err)) {
           setIsLoading(false);
           return;
       }
    } finally {
      setIsLoading(false);
    }
  }, [inputText]);

  const handleTranslate = useCallback(async () => {
    if (!result) return;

    setIsTranslating(true);
    setError(null);

    try {
        const [translatedImproved, translatedSummary] = await Promise.all([
            translateToItalian(result.improvedText),
            translateToItalian(result.summary)
        ]);
        setResult(prev => ({
            ...prev!,
            translatedImprovedText: translatedImproved,
            translatedSummary: translatedSummary
        }));
    } catch (err) {
       if(handleApiError(err)) {
           setIsTranslating(false);
           return;
       }
    } finally {
        setIsTranslating(false);
    }
  }, [result]);

  const downloadTextFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('text/plain')) {
        setError('Please upload a valid .txt file.');
        if (event.target) event.target.value = '';
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          setInputText(text);
        } else {
          setError('Could not read the file content.');
        }
      };
      reader.onerror = () => {
        setError('Failed to read the file.');
      };
      reader.readAsText(file);
    }
    if (event.target) event.target.value = '';
  };

  const handleClearText = () => {
    setInputText('');
    setResult(null);
    setError(null);
  };
  
  if (checkingApiKey) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4">
        <Loader />
        <p className="mt-4 text-lg">Verifying API Key...</p>
      </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/40 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-xl shadow-2xl ring-1 ring-white/10 max-w-lg text-center">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300 mb-4">
            API Key Required
          </h2>
          <p className="text-gray-400 mb-6">
            To use this application, you need to select a Gemini API key. Your key is used securely and is required to interact with the AI model.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-500 transition-all duration-200 shadow-lg hover:shadow-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75"
          >
            Select Your API Key
          </button>
          <p className="text-xs text-gray-500 mt-4">
            For more information on billing, please visit the{' '}
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              official documentation
            </a>.
          </p>
           {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/40 to-gray-900 font-sans p-4 sm:p-6 lg:p-8">
      <main className="max-w-7xl mx-auto">
        <header className="text-center my-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
            Transcript Improver & Summarizer
          </h1>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Paste a transcript, or upload a file, to have AI improve its clarity and generate a concise summary.
          </p>
        </header>

        <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl shadow-2xl ring-1 ring-white/10 max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-gray-400 mb-3">
              Need a transcript? Use this tool, copy the text, and paste it below.
            </p>
            <a
              href="https://tactiq.io/tools/youtube-transcript"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center bg-teal-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-teal-500 transition-all duration-200 shadow-lg hover:shadow-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75"
            >
              Get Transcript with Tactiq.io
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <div className="flex flex-col gap-4">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your transcript here or upload a file..."
              className="w-full bg-gray-900/70 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 min-h-[200px] text-sm"
              disabled={isLoading}
              aria-label="Transcript input"
            />
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".txt,text/plain" className="hidden" />
            <div className="flex justify-between items-center mt-1">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleUploadClick}
                        disabled={isLoading}
                        className="bg-gray-700 text-gray-300 font-semibold px-4 py-2 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center text-sm"
                    >
                        <UploadIcon className="h-4 w-4 mr-2"/>
                        Upload File
                    </button>
                     <button
                        onClick={handleClearText}
                        disabled={!inputText.trim() || isLoading}
                        className="bg-gray-700/50 text-gray-400 font-semibold px-4 py-2 rounded-lg hover:bg-gray-600/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center text-sm"
                    >
                        Clear
                    </button>
                </div>
              <button
                onClick={handleProcessText}
                disabled={isLoading || !inputText.trim()}
                className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-blue-500/50 flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <Loader />
                    <span className="ml-2">Processing...</span>
                  </>
                ) : (
                  "Improve & Summarize"
                )}
              </button>
            </div>
          </div>
          {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
        </div>
        
        <div className="mt-12">
          {isLoading && !result && (
             <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-800/30 rounded-lg">
                <Loader />
                <p className="mt-4 text-gray-300 text-lg">Processing with AI...</p>
                <p className="text-gray-500">This may take a moment.</p>
            </div>
          )}
          
          {result && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                <ResultCard 
                  title={result.translatedImprovedText ? "Improved Text (Italian)" : "Improved Text"} 
                  text={result.translatedImprovedText || result.improvedText} 
                  onSave={() => downloadTextFile(
                    result.translatedImprovedText || result.improvedText, 
                    result.translatedImprovedText ? 'improved_text_italian.txt' : 'improved_text.txt'
                  )}
                />
                <ResultCard 
                  title={result.translatedSummary ? "Summary (Italian)" : "Summary"} 
                  text={result.translatedSummary || result.summary} 
                  onSave={() => downloadTextFile(
                    result.translatedSummary || result.summary, 
                    result.translatedSummary ? 'summary_italian.txt' : 'summary.txt'
                  )}
                />
              </div>

              <div className="mt-8 text-center animate-fade-in">
                <button
                  onClick={handleTranslate}
                  disabled={isTranslating || !!result.translatedImprovedText}
                  className="bg-green-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-green-500/50 flex items-center justify-center mx-auto"
                >
                  {isTranslating ? (
                    <>
                      <Loader />
                      <span className="ml-2">Translating...</span>
                    </>
                  ) : result.translatedImprovedText ? (
                    'Translated ✓'
                  ) : (
                    'Translate to Italian'
                  )}
                </button>
              </div>
            </>
          )}

          {!isLoading && !result && !error && (
            <div className="text-center text-gray-500 mt-16 p-8 border-2 border-dashed border-gray-700 rounded-xl">
              <p className="text-xl">Your results will appear here.</p>
              <p>Paste a transcript above or upload a file to get started.</p>
            </div>
          )}
        </div>
      </main>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;
