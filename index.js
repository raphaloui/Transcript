import { GoogleGenAI } from "@google/genai";

// --- START OF GEMINI SERVICE ---
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not found. Please select an API key to use this application.");
  }
  return new GoogleGenAI({ apiKey });
};

async function processTranscript(text) {
  const ai = getAiClient();
  try {
    const improveResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Migliora il seguente testo. Correggi la grammatica, la punteggiatura e ricostruisci le frasi per renderlo scorrevole e coerente, preservando il significato originale. Fornisci solo il testo corretto senza aggiungere introduzioni o commenti.\n\n---\n\n${text}`,
    });
    const improvedText = improveResponse.text;
    if (!improvedText) throw new Error("Improving the text failed or returned empty.");

    const summarizeResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Crea un riassunto molto breve e sintetico del seguente testo in italiano, evidenziando solo i punti chiave principali:\n\n---\n\n${improvedText}`,
    });
    const summary = summarizeResponse.text;
    if (!summary) throw new Error("Summarization failed or returned empty.");
    
    return { improvedText, summary };
  } catch (error) {
    console.error("Error with Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to process text with Gemini API: ${error.message}`);
    }
    throw new Error("An unknown error occurred while processing text with Gemini API.");
  }
}

async function translateToItalian(text) {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Traduci il seguente testo in italiano. Se il testo è già in italiano, restituiscilo senza modifiche. Fornisci solo il testo tradotto/originale senza aggiungere introduzioni o commenti.\n\n---\n\n${text}`,
    });
    const translatedText = response.text;
    if (!translatedText) throw new Error("Translation failed or returned empty.");
    return translatedText;
  } catch (error) {
    console.error("Error translating with Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to translate text with Gemini API: ${error.message}`);
    }
    throw new Error("An unknown error occurred while translating text with Gemini API.");
  }
}
// --- END OF GEMINI SERVICE ---

// --- START OF UI COMPONENTS (as functions returning DOM elements) ---
const createLoader = () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'animate-spin h-8 w-8 text-blue-400');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = `
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    `;
    return svg;
};

const createResultCard = (title, text, onSave) => {
    const card = document.createElement('div');
    card.className = "bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg flex flex-col h-full ring-1 ring-white/10";
    card.innerHTML = `
        <div class="flex justify-between items-center p-4 border-b border-gray-700">
            <h3 class="text-lg font-semibold text-blue-300">${title}</h3>
            <button aria-label="Save ${title}" class="save-btn p-2 rounded-full bg-gray-600/50 hover:bg-blue-500 text-gray-300 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            </button>
        </div>
        <div class="p-4 overflow-y-auto flex-grow">
            <p class="text-gray-300 whitespace-pre-wrap font-mono text-sm leading-relaxed"></p>
        </div>
    `;
    card.querySelector('p').textContent = text;
    card.querySelector('.save-btn').addEventListener('click', onSave);
    return card;
};

// --- END OF UI COMPONENTS ---


// --- MAIN APP LOGIC ---
const appContainer = document.getElementById('app-container');
let state = {
    inputText: '',
    isLoading: false,
    isTranslating: false,
    error: null,
    result: null,
    hasApiKey: false,
    checkingApiKey: true,
};

const setState = (newState) => {
    state = { ...state, ...newState };
    render();
};

const downloadTextFile = (content, filename) => {
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

const handleApiError = (err) => {
    let errorMessage = "An unknown error occurred.";
    if (err instanceof Error) {
        errorMessage = err.message;
        if (errorMessage.includes("Requested entity was not found")) {
            setState({ error: "Your API key appears to be invalid. Please select a valid API key to continue.", hasApiKey: false });
            return true;
        }
    }
    setState({ error: errorMessage });
    return false;
};

async function handleProcessText() {
    if (!state.inputText.trim()) {
        setState({ error: "Please paste some text to process." });
        return;
    }
    setState({ isLoading: true, error: null, result: null });
    try {
        const { improvedText, summary } = await processTranscript(state.inputText);
        setState({ result: { improvedText, summary }, isLoading: false });
    } catch (err) {
        if (!handleApiError(err)) {
           setState({ isLoading: false });
        }
    }
}

async function handleTranslate() {
    if (!state.result) return;
    setState({ isTranslating: true, error: null });
    try {
        const [translatedImproved, translatedSummary] = await Promise.all([
            translateToItalian(state.result.improvedText),
            translateToItalian(state.result.summary)
        ]);
        setState({
            result: {
                ...state.result,
                translatedImprovedText: translatedImproved,
                translatedSummary: translatedSummary
            },
            isTranslating: false
        });
    } catch (err) {
        if(!handleApiError(err)) {
            setState({ isTranslating: false });
        }
    }
}

function render() {
    appContainer.innerHTML = ''; // Clear previous content

    if (state.checkingApiKey) {
        appContainer.className = "min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4";
        const loaderContainer = document.createElement('div');
        loaderContainer.appendChild(createLoader());
        const text = document.createElement('p');
        text.className = "mt-4 text-lg";
        text.textContent = "Verifying API Key...";
        loaderContainer.appendChild(text);
        appContainer.appendChild(loaderContainer);
        return;
    }

    if (!state.hasApiKey) {
        appContainer.className = "min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/40 to-gray-900 flex items-center justify-center p-4";
        const keyScreen = document.createElement('div');
        keyScreen.className = "bg-gray-800/50 backdrop-blur-sm p-8 rounded-xl shadow-2xl ring-1 ring-white/10 max-w-lg text-center";
        keyScreen.innerHTML = `
            <h2 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300 mb-4">API Key Required</h2>
            <p class="text-gray-400 mb-6">To use this application, you need to select a Gemini API key. Your key is used securely and is required to interact with the AI model.</p>
            <button id="select-key-btn" class="w-full bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-500 transition-all duration-200 shadow-lg hover:shadow-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75">
                Select Your API Key
            </button>
            <p class="text-xs text-gray-500 mt-4">For more information on billing, please visit the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">official documentation</a>.</p>
            ${state.error ? `<p class="error-message text-red-400 mt-4 text-center">${state.error}</p>` : ''}
        `;
        keyScreen.querySelector('#select-key-btn').addEventListener('click', async () => {
            setState({ error: null });
            try {
                await window.aistudio.openSelectKey();
                setState({ hasApiKey: true });
            } catch (e) {
                console.error("Failed to open API key selection:", e);
                setState({ error: "Could not open the API key selection dialog. Please try refreshing the page." });
            }
        });
        appContainer.appendChild(keyScreen);
        return;
    }

    appContainer.className = "min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/40 to-gray-900 p-4 sm:p-6 lg:p-8";
    const main = document.createElement('main');
    main.className = "max-w-7xl mx-auto";
    main.innerHTML = `
      <header class="text-center my-8">
        <h1 class="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">Transcript Improver & Summarizer</h1>
        <p class="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">Paste a transcript, or upload a file, to have AI improve its clarity and generate a concise summary.</p>
      </header>
      <div class="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl shadow-2xl ring-1 ring-white/10 max-w-4xl mx-auto">
        <div class="text-center mb-6">
          <p class="text-gray-400 mb-3">Need a transcript? Use this tool, copy the text, and paste it below.</p>
          <a href="https://tactiq.io/tools/youtube-transcript" target="_blank" rel="noopener noreferrer" class="inline-flex items-center bg-teal-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-teal-500 transition-all duration-200 shadow-lg hover:shadow-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75">
            Get Transcript with Tactiq.io
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        </div>
        <div class="flex flex-col gap-4">
          <textarea id="text-input" placeholder="Paste your transcript here or upload a file..." class="w-full bg-gray-900/70 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 min-h-[200px] text-sm"></textarea>
          <input type="file" id="file-input" accept=".txt,text/plain" class="hidden" />
          <div class="flex justify-between items-center mt-1">
            <div class="flex items-center gap-2">
              <button id="upload-btn" class="bg-gray-700 text-gray-300 font-semibold px-4 py-2 rounded-lg hover:bg-gray-600 transition-all duration-200 flex items-center justify-center text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Upload File
              </button>
              <button id="clear-btn" class="bg-gray-700/50 text-gray-400 font-semibold px-4 py-2 rounded-lg hover:bg-gray-600/50 transition-all duration-200 flex items-center justify-center text-sm">Clear</button>
            </div>
            <button id="process-btn" class="bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-500 transition-all duration-200 shadow-lg hover:shadow-blue-500/50 flex items-center justify-center">
              Improve & Summarize
            </button>
          </div>
        </div>
        ${state.error ? `<p class="error-message text-red-400 mt-4 text-center">${state.error}</p>` : ''}
      </div>
      <div id="results-container" class="mt-12"></div>
    `;

    const textInput = main.querySelector('#text-input');
    textInput.value = state.inputText;
    textInput.disabled = state.isLoading;
    textInput.addEventListener('input', (e) => setState({ inputText: e.target.value }));
    
    const fileInput = main.querySelector('#file-input');
    main.querySelector('#upload-btn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('text/plain')) {
            setState({error: 'Please upload a valid .txt file.'});
            return;
        }
        const reader = new FileReader();
        reader.onload = (re) => {
            if(typeof re.target.result === 'string') {
                setState({ inputText: re.target.result, error: null });
            }
        };
        reader.readAsText(file);
    });


    const clearBtn = main.querySelector('#clear-btn');
    clearBtn.disabled = !state.inputText.trim() || state.isLoading;
    clearBtn.addEventListener('click', () => setState({ inputText: '', result: null, error: null}));

    const processBtn = main.querySelector('#process-btn');
    processBtn.disabled = state.isLoading || !state.inputText.trim();
    processBtn.innerHTML = state.isLoading ? `<span class="loader-small animate-spin h-5 w-5 text-white"></span><span class="ml-2">Processing...</span>` : "Improve & Summarize";
    if (state.isLoading) {
       const loader = document.createElement('div');
       loader.innerHTML = `<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
       processBtn.prepend(loader.firstChild);
    }
    processBtn.addEventListener('click', handleProcessText);

    const resultsContainer = main.querySelector('#results-container');
    if (state.isLoading && !state.result) {
      resultsContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center text-center p-8 bg-gray-800/30 rounded-lg">
            <div id="loader-placeholder"></div>
            <p class="mt-4 text-gray-300 text-lg">Processing with AI...</p>
            <p class="text-gray-500">This may take a moment.</p>
        </div>`;
      resultsContainer.querySelector('#loader-placeholder').appendChild(createLoader());
    } else if (state.result) {
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in';
        
        const improvedCard = createResultCard(
            state.result.translatedImprovedText ? "Improved Text (Italian)" : "Improved Text",
            state.result.translatedImprovedText || state.result.improvedText,
            () => downloadTextFile(
                state.result.translatedImprovedText || state.result.improvedText,
                state.result.translatedImprovedText ? 'improved_text_italian.txt' : 'improved_text.txt'
            )
        );
        
        const summaryCard = createResultCard(
            state.result.translatedSummary ? "Summary (Italian)" : "Summary",
            state.result.translatedSummary || state.result.summary,
            () => downloadTextFile(
                state.result.translatedSummary || state.result.summary,
                state.result.translatedSummary ? 'summary_italian.txt' : 'summary.txt'
            )
        );

        grid.appendChild(improvedCard);
        grid.appendChild(summaryCard);
        
        const translateContainer = document.createElement('div');
        translateContainer.className = "mt-8 text-center animate-fade-in";
        const translateBtn = document.createElement('button');
        translateBtn.className = "bg-green-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-green-500/50 flex items-center justify-center mx-auto";
        translateBtn.disabled = state.isTranslating || !!state.result.translatedImprovedText;

        if (state.isTranslating) {
            translateBtn.innerHTML = `<span class="ml-2">Translating...</span>`;
            const loader = document.createElement('div');
            loader.innerHTML = `<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            translateBtn.prepend(loader.firstChild);
        } else if (state.result.translatedImprovedText) {
            translateBtn.textContent = 'Translated ✓';
        } else {
            translateBtn.textContent = 'Translate to Italian';
        }
        
        translateBtn.addEventListener('click', handleTranslate);
        translateContainer.appendChild(translateBtn);
        
        resultsContainer.appendChild(grid);
        resultsContainer.appendChild(translateContainer);

    } else if (!state.isLoading && !state.error) {
        resultsContainer.innerHTML = `
            <div class="text-center text-gray-500 mt-16 p-8 border-2 border-dashed border-gray-700 rounded-xl">
                <p class="text-xl">Your results will appear here.</p>
                <p>Paste a transcript above or upload a file to get started.</p>
            </div>
        `;
    }

    appContainer.appendChild(main);
}

// Initial check and render
(async () => {
    try {
        if (await window.aistudio.hasSelectedApiKey()) {
            setState({ hasApiKey: true, checkingApiKey: false });
        } else {
            setState({ checkingApiKey: false });
        }
    } catch (e) {
        console.error("aistudio SDK not available.", e);
        setState({ error: "Could not connect to the API key service. Please refresh the page.", checkingApiKey: false });
    }
})();
