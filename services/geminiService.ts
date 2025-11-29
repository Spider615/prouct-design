import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GeminiModel } from "../types";

const apiKey = import.meta.env.VITE_API_KEY;

export interface GenerationConfig {
  temperature?: number;
  topP?: number;
  responseMimeType?: string;
  responseSchema?: any;
}

export const generateContentStream = async (
  model: GeminiModel,
  prompt: string,
  systemInstruction?: string,
  generationConfig?: GenerationConfig
) => {
  try {
    if (!apiKey) {
      throw new Error("Missing VITE_API_KEY in environment");
    }
    const ai = new GoogleGenAI({ apiKey });
    const config: any = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }
    
    if (generationConfig) {
      if (generationConfig.temperature !== undefined) config.temperature = generationConfig.temperature;
      if (generationConfig.topP !== undefined) config.topP = generationConfig.topP;
      if (generationConfig.responseMimeType) config.responseMimeType = generationConfig.responseMimeType;
      if (generationConfig.responseSchema) config.responseSchema = generationConfig.responseSchema;
    }

    const responseStream = await ai.models.generateContentStream({
      model: model,
      contents: prompt,
      config: config,
    });
    
    return responseStream;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
};
