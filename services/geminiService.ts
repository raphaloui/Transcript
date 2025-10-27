import { GoogleGenAI } from "@google/genai";

// The API key is loaded from the environment variable `process.env.API_KEY`.
// Do NOT paste your key here directly.
// Instead, configure it in your deployment environment (e.g., GitHub Secrets).
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // This error message will be shown in the browser console if the API key is not configured in the environment.
  console.error("Gemini API key not found. Please set the API_KEY environment variable.");
}

// The GoogleGenAI client is initialized here using the key from the environment.
const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function processTranscript(text: string): Promise<{ improvedText: string; summary: string }> {
  if (!API_KEY) {
    throw new Error("API key is not configured. Please set it in your deployment environment.");
  }
  
  try {
    // 1. Improve the text
    const improveResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Migliora il seguente testo. Correggi la grammatica, la punteggiatura e ricostruisci le frasi per renderlo scorrevole e coerente, preservando il significato originale. Fornisci solo il testo corretto senza aggiungere introduzioni o commenti.\n\n---\n\n${text}`,
    });
    const improvedText = improveResponse.text;

    if (!improvedText) {
        throw new Error("Improving the text failed or returned empty.");
    }

    // 2. Summarize the improved Italian text
    const summarizeResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Crea un riassunto molto breve e sintetico del seguente testo in italiano, evidenziando solo i punti chiave principali:\n\n---\n\n${improvedText}`,
    });
    const summary = summarizeResponse.text;

    if (!summary) {
        throw new Error("Summarization failed or returned empty.");
    }
    
    return { improvedText, summary };
  } catch (error) {
    console.error("Error with Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to process text with Gemini API: ${error.message}`);
    }
    throw new Error("An unknown error occurred while processing text with Gemini API.");
  }
}

export async function translateToItalian(text: string): Promise<string> {
  if (!API_KEY) {
    throw new Error("API key is not configured. Please set it in your deployment environment.");
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Traduci il seguente testo in italiano. Se il testo è già in italiano, restituiscilo senza modifiche. Fornisci solo il testo tradotto/originale senza aggiungere introduzioni o commenti.\n\n---\n\n${text}`,
    });
    const translatedText = response.text;
    if (!translatedText) {
      throw new Error("Translation failed or returned empty.");
    }
    return translatedText;
  } catch (error) {
    console.error("Error translating with Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to translate text with Gemini API: ${error.message}`);
    }
    throw new Error("An unknown error occurred while translating text with Gemini API.");
  }
}