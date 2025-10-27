import React, { useState, useCallback, useRef, useEffect } from 'react';
import { processTranscript, translateToItalian } from './services/geminiService.ts';
import type { ProcessedData } from './types.ts';
import ResultCard from './components/ResultCard.tsx';
import Loader from './components/Loader.tsx';

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
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [tempApiKey, setTempApiKey] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessedData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('gemini_api_key');
      if (storedKey) {
        setApiKey(storedKey);
      }
    } catch (e) {
      console.error("Could not access local storage:", e);
      setError("Questa applicazione richiede l'archiviazione locale del browser per salvare la tua chiave API. Abilitala per continuare.");
    }
  }, []);

  const handleSaveKey = () => {
    if (tempApiKey.trim()) {
      const trimmedKey = tempApiKey.trim();
      localStorage.setItem('gemini_api_key', trimmedKey);
      setApiKey(trimmedKey);
      setTempApiKey('');
      setError(null);
    }
  };
  
  const handleClearKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey(null);
  };

  const handleProcessText = useCallback(async () => {
    if (!inputText.trim()) {
      setError("Per favore, incolla del testo da elaborare.");
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
      let errorMessage = "Si è verificato un errore sconosciuto.";
       if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
       if (errorMessage.toLowerCase().includes('api key not valid')) {
        handleClearKey(); // Clear bad key to force re-entry
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
       let errorMessage = "Si è verificato un errore sconosciuto durante la traduzione.";
       if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
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
        setError('Per favore, carica un file .txt valido.');
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
          setError('Impossibile leggere il contenuto del file.');
        }
      };
      reader.onerror = () => {
        setError('Lettura del file fallita.');
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
  
  if (!apiKey) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/40 to-gray-900 font-sans flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-gray-800/50 backdrop-blur-sm p-8 rounded-xl shadow-2xl ring-1 ring-white/10 text-center animate-fade-in">
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300 mb-4">
                    È Richiesta una Chiave API Gemini
                </h2>
                <p className="text-gray-400 mb-6">
                    Per utilizzare questa applicazione, devi fornire la tua chiave API di Google Gemini. La tua chiave viene salvata in modo sicuro nell'archivio locale del tuo browser.
                </p>
                <div className="flex flex-col gap-4">
                    <input
                        type="password"
                        value={tempApiKey}
                        onChange={(e) => setTempApiKey(e.target.value)}
                        placeholder="Inserisci qui la tua chiave API"
                        className="w-full text-center bg-gray-900/70 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                        aria-label="Input Chiave API Gemini"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveKey(); }}
                    />
                    <button
                        onClick={handleSaveKey}
                        disabled={!tempApiKey.trim()}
                        className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:bg-gray-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-blue-500/50"
                    >
                        Salva e Continua
                    </button>
                </div>
                {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
                <p className="text-gray-500 mt-6 text-sm">
                    Non hai una chiave?{' '}
                    <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline"
                    >
                        Ottienine una da Google AI Studio
                    </a>
                </p>
            </div>
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
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/40 to-gray-900 font-sans p-4 sm:p-6 lg:p-8">
      <main className="max-w-7xl mx-auto">
        <header className="text-center my-8 relative">
           <button 
                onClick={handleClearKey} 
                className="absolute top-0 right-0 text-gray-500 hover:text-red-400 transition-colors py-2 px-3 rounded-md text-sm underline"
                title="Cambia o cancella la tua Chiave API"
            >
                Cambia Chiave API
            </button>
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
            Migliora e Riassume Trascrizioni
          </h1>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Incolla una trascrizione, o carica un file, per migliorarne la chiarezza e generare un riassunto conciso con l'IA.
          </p>
        </header>

        <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl shadow-2xl ring-1 ring-white/10 max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-gray-400 mb-3">
              Hai bisogno di una trascrizione? Usa questo strumento, copia il testo e incollalo qui sotto.
            </p>
            <a
              href="https://tactiq.io/tools/youtube-transcript"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center bg-teal-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-teal-500 transition-all duration-200 shadow-lg hover:shadow-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75"
            >
              Ottieni Trascrizione con Tactiq.io
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <div className="flex flex-col gap-4">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Incolla qui la tua trascrizione o carica un file..."
              className="w-full bg-gray-900/70 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 min-h-[200px] text-sm"
              disabled={isLoading}
              aria-label="Input trascrizione"
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
                        Carica File
                    </button>
                     <button
                        onClick={handleClearText}
                        disabled={!inputText.trim() || isLoading}
                        className="bg-gray-700/50 text-gray-400 font-semibold px-4 py-2 rounded-lg hover:bg-gray-600/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center text-sm"
                    >
                        Pulisci
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
                    <span className="ml-2">Elaborazione...</span>
                  </>
                ) : (
                  "Migliora e Riassumi"
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
                <p className="mt-4 text-gray-300 text-lg">Elaborazione con IA...</p>
                <p className="text-gray-500">Potrebbe volerci un momento.</p>
            </div>
          )}
          
          {result && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                <ResultCard 
                  title={result.translatedImprovedText ? "Testo Migliorato (Italiano)" : "Testo Migliorato"} 
                  text={result.translatedImprovedText || result.improvedText} 
                  onSave={() => downloadTextFile(
                    result.translatedImprovedText || result.improvedText, 
                    result.translatedImprovedText ? 'testo_migliorato_italiano.txt' : 'testo_migliorato.txt'
                  )}
                />
                <ResultCard 
                  title={result.translatedSummary ? "Riassunto (Italiano)" : "Riassunto"} 
                  text={result.translatedSummary || result.summary} 
                  onSave={() => downloadTextFile(
                    result.translatedSummary || result.summary, 
                    result.translatedSummary ? 'riassunto_italiano.txt' : 'riassunto.txt'
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
                      <span className="ml-2">Traduzione in corso...</span>
                    </>
                  ) : result.translatedImprovedText ? (
                    