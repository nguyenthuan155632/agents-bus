// src/orchestrator/negotiate.ts

import type { Store } from "../persistence/store.js";
import type { Agent } from "./agents/types.js";
import type { ProviderConfig, Message } from "../shared/types.js";
import { buildAgentPrompt, buildSystemPrompt } from "./prompts.js";

export type NegotiationEvent =
  | { type: "round-start"; round: number; maxRounds: number }
  | { type: "agent-response"; agent: string; content: string; messageType: string }
  | { type: "agent-error"; agent: string; error: string }
  | { type: "round-end"; round: number; approvals: Record<string, boolean> }
  | { type: "complete"; status: "APPROVED" | "EXHAUSTED"; finalPlan: string | null };

export interface NegotiationResult {
  sessionId: string;
  status: "APPROVED" | "EXHAUSTED";
  finalPlan: string | null;
  roundsCompleted: number;
}

export class Negotiator {
  private onEvent: (event: NegotiationEvent) => void;

  constructor(
    private store: Store,
    private agents: Agent[],
    private providers: ProviderConfig[],
    onEvent?: (event: NegotiationEvent) => void
  ) {
    this.onEvent = onEvent ?? (() => {});
  }

  async run(topic: string, maxRounds: number): Promise<NegotiationResult> {
    const agentNames = this.agents.map((a) => a.name);
    const session = this.store.createSession(topic, maxRounds, agentNames);
    return this.runRounds(session.id, session.topic, 1, maxRounds);
  }

  async resume(sessionId: string): Promise<NegotiationResult> {
    const session = this.store.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const startRound = session.currentRound + 1;
    return this.runRounds(session.id, session.topic, startRound, session.maxRounds);
  }

  private async runRounds(
    sessionId: string,
    topic: string,
    startRound: number,
    maxRounds: number
  ): Promise<NegotiationResult> {
    const agentNames = this.agents.map((a) => a.name);
    let roundsCompleted = startRound - 1;

    for (let round = startRound; round <= maxRounds; round++) {
      this.store.updateSessionState(sessionId, "ROUND_IN_PROGRESS");
      this.store.updateSessionRound(sessionId, round);
      roundsCompleted = round;

      this.onEvent({ type: "round-start", round, maxRounds });
      this.store.postMessage(sessionId, "system", "system", `Round ${round} begins`, round);

      for (let i = 0; i < this.agents.length; i++) {
        const agent = this.agents[i];
        const provider = this.providers[i];
        const messages = this.store.getMessages(sessionId);
        await this.runAgentTurn(sessionId, agent, provider, topic, round, maxRounds, messages);
      }

      const roundMessages = this.store.getMessages(sessionId);
      const approvals = this.parseApprovals(roundMessages, round, agentNames);

      for (const [name, approved] of Object.entries(approvals)) {
        this.store.setApproval(sessionId, name, approved);
      }

      this.onEvent({ type: "round-end", round, approvals });

      if (Object.values(approvals).every(Boolean)) {
        this.store.updateSessionState(sessionId, "APPROVED");
        const finalPlan = this.extractFinalPlan(roundMessages, agentNames);
        this.onEvent({ type: "complete", status: "APPROVED", finalPlan });
        return { sessionId, status: "APPROVED", finalPlan, roundsCompleted };
      }

      this.store.resetApprovals(sessionId);
    }

    this.store.updateSessionState(sessionId, "AWAITING_APPROVAL");
    const allMessages = this.store.getMessages(sessionId);
    const finalPlan = this.extractFinalPlan(allMessages, agentNames);
    this.onEvent({ type: "complete", status: "EXHAUSTED", finalPlan });

    return { sessionId, status: "EXHAUSTED", finalPlan, roundsCompleted };
  }

  private async runAgentTurn(
    sessionId: string,
    agent: Agent,
    provider: ProviderConfig,
    topic: string,
    round: number,
    maxRounds: number,
    messages: Message[]
  ): Promise<void> {
    const systemPrompt = buildSystemPrompt(provider);
    const userPrompt = buildAgentPrompt({
      topic,
      currentRound: round,
      maxRounds,
      messages,
      agentRole: provider.role,
      agentName: provider.displayName,
    });
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    try {
      const response = await agent.invoke(fullPrompt);
      const messageType = this.parseMessageType(response);
      this.store.postMessage(sessionId, agent.name, messageType, response, round);
      this.onEvent({ type: "agent-response", agent: agent.name, content: response, messageType });
    } catch (err: any) {
      const errorMsg = `${agent.name} failed: ${err.message}`;
      this.store.postMessage(sessionId, "system", "system", errorMsg, round);
      this.onEvent({ type: "agent-error", agent: agent.name, error: err.message });
    }
  }

  private parseMessageType(response: string): "approval" | "rejection" | "proposal" {
    const upper = response.toUpperCase();
    if (upper.includes("APPROVE") && !upper.includes("REJECT")) return "approval";
    if (upper.includes("REJECT")) return "rejection";
    return "proposal";
  }

  private parseApprovals(
    messages: Message[],
    round: number,
    agentNames: string[]
  ): Record<string, boolean> {
    const roundMessages = messages.filter((m) => m.round === round);
    const approvals: Record<string, boolean> = {};
    for (const name of agentNames) {
      approvals[name] = roundMessages.some((m) => m.agent === name && m.type === "approval");
    }
    return approvals;
  }

  private extractFinalPlan(messages: Message[], agentNames: string[]): string | null {
    const agentMessages = messages.filter(
      (m) => m.agent !== "system" && (m.type === "proposal" || m.type === "approval" || m.type === "rejection" || m.type === "critique" || m.type === "concession")
    );
    if (agentMessages.length === 0) return null;

    const latestByAgent = new Map<string, Message>();
    for (const msg of agentMessages) {
      const existing = latestByAgent.get(msg.agent);
      if (!existing || msg.round > existing.round || msg.createdAt > existing.createdAt) {
        latestByAgent.set(msg.agent, msg);
      }
    }

    const latest = Array.from(latestByAgent.values());
    if (latest.length === 0) return null;
    if (latest.length === 1) return latest[0].content;

    return latest
      .map((m) => `## ${m.agent}\n\n${m.content}`)
      .join("\n\n---\n\n");
  }
}
