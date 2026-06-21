// src/orchestrator/agents/types.ts

export interface Agent {
  readonly name: string;
  readonly displayName: string;
  readonly role: string;
  readonly color: string;
  invoke(prompt: string): Promise<string>;
}
