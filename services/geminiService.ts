import { GoogleGenAI, Type } from "@google/genai";
import { Task, TaskStatus } from "../types";

// Helper sicuro per recuperare l'API Key in ambienti diversi (Vite vs Node/Preview)
const getApiKey = (): string => {
  // 1. Prova l'ambiente Vite (Vercel)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
    return import.meta.env.VITE_API_KEY;
  }
  // 2. Fallback per ambiente Node.js o Preview interna (dove process è definito)
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  return '';
};

const apiKey = getApiKey();

// Inizializza solo se c'è una chiave (anche vuota, l'SDK gestirà l'errore alla chiamata)
const ai = new GoogleGenAI({ apiKey });

export const generateTasksFromInput = async (input: string, projectId: string): Promise<Partial<Task>[]> => {
  if (!apiKey) {
    console.error("API Key mancante. Configura VITE_API_KEY su Vercel.");
    throw new Error("API Key mancante");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: input,
      config: {
        systemInstruction: "Sei un project manager esperto. Analizza la seguente richiesta o descrizione di funzionalità e crea una lista di task tecnici concisi e azionabili per sviluppare o risolvere quanto richiesto. Restituisci solo i titoli dei task.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "Un titolo breve e chiaro per il task (es. 'Creare endpoint API login', 'Fix bug layout header')"
              },
              description: {
                type: Type.STRING,
                description: "Una brevissima descrizione tecnica opzionale."
              }
            },
            required: ["title"]
          }
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text) as Array<{ title: string; description?: string }>;
      return data.map(item => ({
        projectId,
        title: item.title,
        description: item.description,
        status: TaskStatus.TODO
      }));
    }
    return [];
  } catch (error) {
    console.error("Errore generazione task AI:", error);
    throw error;
  }
};