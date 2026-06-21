import { describe, it, expect } from "vitest";
import { buildAgentPrompt, buildSystemPrompt } from "../../src/orchestrator/prompts.js";
import type { Message, ProviderConfig } from "../../src/shared/types.js";

const claudeConfig: ProviderConfig = {
  name: "claude",
  displayName: "Claude",
  type: "cli",
  command: "claude",
  args: [],
  responseParser: "plain",
  role: "pragmatic architect",
  color: "blue",
  timeoutMs: 60_000,
};

const glmConfig: ProviderConfig = {
  name: "glm",
  displayName: "GLM",
  type: "api",
  role: "systems thinker",
  color: "magenta",
  timeoutMs: 60_000,
};

const messages: Message[] = [
  {
    id: "1",
    sessionId: "s1",
    agent: "claude",
    type: "proposal",
    content: "Use REST with JWT",
    round: 1,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "2",
    sessionId: "s1",
    agent: "codex",
    type: "critique",
    content: "Add refresh token rotation",
    round: 1,
    createdAt: "2026-01-01T00:01:00Z",
  },
];

describe("prompts", () => {
  it("buildSystemPrompt should include role from provider config", () => {
    const prompt = buildSystemPrompt(claudeConfig);
    expect(prompt).toContain("pragmatic architect");
    expect(prompt).toContain("APPROVE");
    expect(prompt).toContain("REJECT");
  });

  it("buildSystemPrompt should work for GLM", () => {
    const prompt = buildSystemPrompt(glmConfig);
    expect(prompt).toContain("systems thinker");
  });

  it("buildAgentPrompt should include topic, round, and messages", () => {
    const prompt = buildAgentPrompt({
      topic: "Design auth API",
      currentRound: 1,
      maxRounds: 5,
      messages,
      agentRole: "pragmatic architect",
      agentName: "Claude",
    });
    expect(prompt).toContain("Design auth API");
    expect(prompt).toContain("Round: 1 of 5");
    expect(prompt).toContain("Use REST with JWT");
    expect(prompt).toContain("Add refresh token rotation");
    expect(prompt).toContain("Claude");
  });

  it("buildAgentPrompt should handle empty messages", () => {
    const prompt = buildAgentPrompt({
      topic: "Design auth API",
      currentRound: 1,
      maxRounds: 5,
      messages: [],
      agentRole: "systems thinker",
      agentName: "GLM",
    });
    expect(prompt).toContain("Design auth API");
    expect(prompt).toContain("No prior messages");
  });
});
