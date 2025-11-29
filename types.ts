export enum Tab {
  TESTING_LIST = 'TESTING_LIST',
  TASK_LIST = 'TASK_LIST',
  TEST_EVALUATION = 'TEST_EVALUATION',
  PROMPT_DEBUG = 'PROMPT_DEBUG',
}

export enum GeminiModel {
  FLASH = 'gemini-2.5-flash',
  PRO = 'gemini-3-pro-preview',
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}