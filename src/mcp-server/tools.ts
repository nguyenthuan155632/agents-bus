// src/mcp-server/tools.ts

import type { Store } from "./store.js";
import type { MessageType } from "../shared/types.js";

export function createToolHandlers(store: Store) {
  return {
    async create_session(input: { topic: string; maxRounds: number; agents: string[] }) {
      const session = store.createSession(input.topic, input.maxRounds, input.agents);
      return { session };
    },

    async list_sessions(_input: Record<string, never>) {
      const sessions = store.listSessions();
      return { sessions };
    },

    async post_message(input: {
      sessionId: string;
      agent: string;
      type: MessageType;
      content: string;
    }) {
      const session = store.getSession(input.sessionId);
      if (!session) throw new Error(`Session ${input.sessionId} not found`);
      const message = store.postMessage(
        input.sessionId,
        input.agent,
        input.type,
        input.content,
        session.currentRound
      );
      return { message };
    },

    async get_messages(input: { sessionId: string; agent?: string }) {
      const messages = store.getMessages(input.sessionId, input.agent);
      return { messages };
    },

    async get_state(input: { sessionId: string }) {
      const session = store.getSession(input.sessionId);
      if (!session) throw new Error(`Session ${input.sessionId} not found`);
      const messages = store.getMessages(input.sessionId);
      const proposals = messages.filter((m) => m.type === "proposal");
      const currentPlanDraft = proposals.length > 0 ? proposals[proposals.length - 1].content : null;
      return { session, messages, currentPlanDraft };
    },

    async approve_plan(input: { sessionId: string; agent: string }) {
      const session = store.getSession(input.sessionId);
      if (!session) throw new Error(`Session ${input.sessionId} not found`);

      store.setApproval(input.sessionId, input.agent, true);
      store.postMessage(input.sessionId, input.agent, "approval", `${input.agent} approves the plan`, session.currentRound);

      const updated = store.getSession(input.sessionId)!;
      const allApproved = Object.values(updated.approvals).every(Boolean);
      if (allApproved) {
        store.updateSessionState(input.sessionId, "APPROVED");
      }

      return { session: store.getSession(input.sessionId)! };
    },

    async reject_plan(input: { sessionId: string; agent: string; reason: string }) {
      const session = store.getSession(input.sessionId);
      if (!session) throw new Error(`Session ${input.sessionId} not found`);

      store.postMessage(input.sessionId, input.agent, "rejection", input.reason, session.currentRound);
      store.resetApprovals(input.sessionId);
      store.updateSessionState(input.sessionId, "REJECTED");

      return { session: store.getSession(input.sessionId)! };
    },
  };
}
