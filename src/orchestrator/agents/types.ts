// src/orchestrator/agents/types.ts

export interface ProgressChunk {
  type: "thinking" | "text";
  content: string;
}

export interface Agent {
  readonly name: string;
  readonly displayName: string;
  readonly role: string;
  readonly color: string;
  invoke(prompt: string, onProgress?: (chunk: ProgressChunk) => void): Promise<string>;
}
