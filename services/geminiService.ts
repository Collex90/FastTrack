import { GoogleGenAI, Type } from "@google/genai";
import { Task, TaskStatus } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateTasksFromInput = async (input: string, projectId: string): Promise<Partial<Task>[]> => {
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