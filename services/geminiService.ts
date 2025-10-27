import { GoogleGenAI } from "@google/genai";

// Creates a new GoogleGenAI instance.
// This function is called before each API request to ensure the client uses the latest,
// securely provided API key from the environment.
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    // This error is a safeguard but should not be hit in a configured environment
    // where the user is prompted to select a key.
    throw new Error("Gemini API key not found. Please select an API key to use this application.");
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
  const ai = getAiClient();
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