import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GeminiModel } from "../types";

const apiKey = process.env.API_KEY;
// Initialize with API Key directly as per instructions.
// The app assumes process.env.API_KEY is available.
const ai = new GoogleGenAI({ apiKey: apiKey });

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