// src/orchestrator/prompts.ts

import type { Message, ProviderConfig } from "../shared/types.js";

export function buildSystemPrompt(provider: ProviderConfig): string {
  return `You are a ${provider.role} participating in a structured negotiation.

Your goal is to collaboratively produce a high-quality software plan through debate.

Rules:
- Be constructive and specific in your critiques
- Reference prior points when responding
- When you believe the plan is ready, end your response with exactly: APPROVE
- If you see significant issues, end your response with exactly: REJECT followed by your reasons
- Do NOT approve a plan that has unresolved concerns
- Keep responses focused and actionable`;
}

export function buildAgentPrompt(input: {
  topic: string;
  currentRound: number;
  maxRounds: number;
  messages: Message[];
  agentRole: string;
  agentName: string;
}): string {
  const { topic, currentRound, maxRounds, messages, agentRole, agentName } = input;

  let transcript: string;
  if (messages.length === 0) {
    transcript = "No prior messages. You are starting the negotiation.";
  } else {
    transcript = messages
      .map((m) => `[Round ${m.round}] ${m.agent} (${m.type}): ${m.content}`)
      .join("\n\n");
  }

  return `Topic: ${topic}
Round: ${currentRound} of ${maxRounds}
Your role: ${agentName} (${agentRole})

## Conversation History

${transcript}

## Your Task

Review the conversation above and either:
1. Propose a plan or revision that addresses all feedback
2. Critique the latest proposal with specific improvements
3. If you're satisfied with the current state, end with APPROVE
4. If there are blocking issues, end with REJECT and explain why`;
}
