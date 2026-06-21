// src/orchestrator/negotiate.ts

import type { Store } from "../mcp-server/store.js";
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
    let roundsCompleted = 0;

    for (let round = 1; round <= maxRounds; round++) {
      this.store.updateSessionState(session.id, "ROUND_IN_PROGRESS");
      this.store.updateSessionRound(session.id, round);
      roundsCompleted = round;

      this.onEvent({ type: "round-start", round, maxRounds });
      this.store.postMessage(session.id, "system", "system", `Round ${round} begins`, round);

      for (let i = 0; i < this.agents.length; i++) {
        const agent = this.agents[i];
        const provider = this.providers[i];
        const messages = this.store.getMessages(session.id);
        await this.runAgentTurn(session.id, agent, provider, topic, round, maxRounds, messages);
      }

      const roundMessages = this.store.getMessages(session.id);
      const approvals = this.parseApprovals(roundMessages, round, agentNames);

      for (const [name, approved] of Object.entries(approvals)) {
        this.store.setApproval(session.id, name, approved);
      }

      this.onEvent({ type: "round-end", round, approvals });

      if (Object.values(approvals).every(Boolean)) {
        this.store.updateSessionState(session.id, "APPROVED");
        const proposals = roundMessages.filter((m) => m.type === "proposal");
        const finalPlan = proposals.length > 0 ? proposals[proposals.length - 1].content : null;
        this.onEvent({ type: "complete", status: "APPROVED", finalPlan });
        return { sessionId: session.id, status: "APPROVED", finalPlan, roundsCompleted };
      }

      this.store.resetApprovals(session.id);
    }

    this.store.updateSessionState(session.id, "AWAITING_APPROVAL");
    const allMessages = this.store.getMessages(session.id);
    const proposals = allMessages.filter((m) => m.type === "proposal");
    const finalPlan = proposals.length > 0 ? proposals[proposals.length - 1].content : null;
    this.onEvent({ type: "complete", status: "EXHAUSTED", finalPlan });

    return { sessionId: session.id, status: "EXHAUSTED", finalPlan, roundsCompleted };
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
}
