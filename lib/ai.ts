export enum Model {
  GEMINI_3_1_PRO_PREVIEW = "gemini-3.1-pro-preview",
  GEMINI_3_1_FLASH_LITE_PREVIEW = "gemini-3.1-flash-lite-preview",
  GEMINI_3_FLASH_PREVIEW = "gemini-3-flash-preview",
}

export enum ChatRole {
  User = "user",
  Assistant = "assistant",
}

export type ChatTurn = {
  role: ChatRole;
  content: string;
};

export type ChatHistory = {
  id: number;
  sessionId: string;
  role: ChatRole;
  content: string;
};
