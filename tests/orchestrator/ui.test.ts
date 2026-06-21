import { describe, it, expect } from "vitest";
import { formatMessage, formatStatusBar } from "../../src/orchestrator/ui/NegotiationApp.js";
import type { NegotiationEvent } from "../../src/orchestrator/negotiate.js";
import type { ProviderConfig } from "../../src/shared/types.js";

const providers: ProviderConfig[] = [
  { name: "claude", displayName: "Claude", type: "cli", role: "architect", color: "blue", timeoutMs: 60000 },
  { name: "codex", displayName: "Codex", type: "cli", role: "engineer", color: "green", timeoutMs: 60000 },
  { name: "glm", displayName: "GLM", type: "api", role: "thinker", color: "magenta", timeoutMs: 60000 },
];

describe("UI formatting helpers", () => {
  it("formatMessage should format agent response with label and color", () => {
    const event: NegotiationEvent = {
      type: "agent-response",
      agent: "claude",
      content: "Use REST with JWT",
      messageType: "proposal",
    };
    const formatted = formatMessage(event, providers);
    expect(formatted.label).toBe("Claude");
    expect(formatted.content).toBe("Use REST with JWT");
    expect(formatted.color).toBe("blue");
  });

  it("formatMessage should format codex response", () => {
    const event: NegotiationEvent = {
      type: "agent-response",
      agent: "codex",
      content: "Add rate limiting",
      messageType: "critique",
    };
    const formatted = formatMessage(event, providers);
    expect(formatted.label).toBe("Codex");
    expect(formatted.color).toBe("green");
  });

  it("formatMessage should format glm response", () => {
    const event: NegotiationEvent = {
      type: "agent-response",
      agent: "glm",
      content: "Think holistically",
      messageType: "critique",
    };
    const formatted = formatMessage(event, providers);
    expect(formatted.label).toBe("GLM");
    expect(formatted.color).toBe("magenta");
  });

  it("formatMessage should format system error", () => {
    const event: NegotiationEvent = {
      type: "agent-error",
      agent: "claude",
      error: "CLI timed out",
    };
    const formatted = formatMessage(event, providers);
    expect(formatted.label).toBe("System");
    expect(formatted.color).toBe("yellow");
    expect(formatted.content).toContain("timed out");
  });

  it("formatMessage should format round-start", () => {
    const event: NegotiationEvent = {
      type: "round-start",
      round: 2,
      maxRounds: 5,
    };
    const formatted = formatMessage(event, providers);
    expect(formatted.content).toContain("Round 2 of 5");
  });

  it("formatMessage should format complete APPROVED", () => {
    const event: NegotiationEvent = {
      type: "complete",
      status: "APPROVED",
      finalPlan: "The plan",
    };
    const formatted = formatMessage(event, providers);
    expect(formatted.content).toContain("APPROVED");
    expect(formatted.color).toBe("green");
  });

  it("formatStatusBar should show round and all agent approvals", () => {
    const status = formatStatusBar("Design auth API", 2, 5, providers, {
      claude: true,
      codex: false,
      glm: false,
    });
    expect(status).toContain("Round 2/5");
    expect(status).toContain("Design auth API");
    expect(status).toContain("Claude");
    expect(status).toContain("Codex");
    expect(status).toContain("GLM");
  });

  it("formatStatusBar should show APPROVED when all approved", () => {
    const status = formatStatusBar("Topic", 1, 5, providers, {
      claude: true,
      codex: true,
      glm: true,
    });
    expect(status).toContain("APPROVED");
  });
});
