import { GoogleGenAI } from "@google/genai";

// Creates a new GoogleGenAI instance.
// This function reads the API key from the browser's local storage,
// allowing any user to use their own key.
const getAiClient = () => {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    // This error is a safeguard. The UI should prevent API calls without a key.
    throw new Error("Chiave API di Gemini non trovata nell'archivio locale. Per favore, imposta la tua chiave API nell'applicazione.");
  }
  return new GoogleGenAI({ apiKey });
};


export async function processTranscript(text: string): Promise<{ improvedText: string; summary: string }> {
  const ai = getAiClient();
  try {
    // 1. Improve the text
    const improveResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Migliora il seguente testo. Correggi la grammatica, la punteggiatura e ricostruisci le frasi per renderlo scorrevole e coerente, preservando il significato originale. Fornisci solo il testo corretto senza aggiungere introduzioni o commenti.\n\n---\n\n${text}`,
    });
    const improvedText = improveResponse.text;

    if (!improvedText) {
        throw new Error("Il miglioramento del testo è fallito o non ha restituito alcun risultato.");
    }

    // 2. Summarize the improved Italian text
    const summarizeResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Crea un riassunto molto breve e sintetico del seguente testo in italiano, evidenziando solo i punti chiave principali:\n\n---\n\n${improvedText}`,
    });
    const summary = summarizeResponse.text;

    if (!summary) {
        throw new Error("La creazione del riassunto è fallita o non ha restituito alcun risultato.");
    }
    
    return { improvedText, summary };
  } catch (error) {
    console.error("Error with Gemini API:", error);
    if (error instanceof Error) {
        // Check for specific authentication errors.
        if (error.message.includes('API key not valid')) {
             throw new Error(`La tua chiave API di Gemini non è valida. Controllala e riprova.`);
        }
        throw new Error(`Impossibile elaborare il testo con l'API Gemini: ${error.message}`);
    }
    throw new Error("Si è verificato un errore sconosciuto durante l'elaborazione del testo con l'API Gemini.");
  }
}

export async function translateToItalian(text: string): Promise<string> {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Traduci il seguente testo in italiano. Se il testo è già in italiano, restituiscilo senza modifiche. Fornisci solo il testo tradotto/originale senza aggiungere introduzioni o commenti.\n\n---\n\n${text}`,
    });
    const translatedText = response.text;
    if (!translatedText) {
      throw new Error("La traduzione è fallita o non ha restituito alcun risultato.");
    }
    return translatedText;
  } catch (error) {
    console.error("Error translating with Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Impossibile tradurre il testo con l'API Gemini: ${error.message}`);
    }
    throw new Error("Si è verificato un errore sconosciuto durante la traduzione del testo con l'API Gemini.");
  }
}