// src/shared/types.ts

export const SESSION_STATES = [
  "CREATED",
  "ROUND_IN_PROGRESS",
  "AWAITING_APPROVAL",
  "APPROVED",
  "REJECTED",
] as const;

export type SessionState = (typeof SESSION_STATES)[number];

export const MESSAGE_TYPES = [
  "proposal",
  "critique",
  "concession",
  "approval",
  "rejection",
  "system",
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

export type AgentName = string;

export interface ProviderConfig {
  name: string;
  displayName: string;
  type: "cli" | "api";
  role: string;
  color: string;
  timeoutMs: number;

  // CLI-specific (when type === "cli")
  command?: string;
  args?: string[];
  responseParser?: "json-result" | "json-content" | "plain" | "json-array-result" | "jsonl-agent-message";

  // API-specific (when type === "api")
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  agent: AgentName | "system";
  type: MessageType;
  content: string;
  round: number;
  createdAt: string;
}

export interface Session {
  id: string;
  topic: string;
  state: SessionState;
  currentRound: number;
  maxRounds: number;
  agents: AgentName[];
  approvals: Record<AgentName, boolean>;
  createdAt: string;
}

export interface NegotiationState {
  session: Session;
  messages: Message[];
  currentPlanDraft: string | null;
}
