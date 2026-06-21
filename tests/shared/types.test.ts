import { describe, it, expect } from "vitest";
import {
  type Message,
  type Session,
  type ProviderConfig,
  SESSION_STATES,
  MESSAGE_TYPES,
} from "../../src/shared/types.js";

describe("types", () => {
  it("should export valid session states", () => {
    expect(SESSION_STATES).toContain("CREATED");
    expect(SESSION_STATES).toContain("ROUND_IN_PROGRESS");
    expect(SESSION_STATES).toContain("AWAITING_APPROVAL");
    expect(SESSION_STATES).toContain("APPROVED");
    expect(SESSION_STATES).toContain("REJECTED");
  });

  it("should export valid message types", () => {
    expect(MESSAGE_TYPES).toContain("proposal");
    expect(MESSAGE_TYPES).toContain("critique");
    expect(MESSAGE_TYPES).toContain("concession");
    expect(MESSAGE_TYPES).toContain("approval");
    expect(MESSAGE_TYPES).toContain("rejection");
    expect(MESSAGE_TYPES).toContain("system");
  });

  it("should allow creating a valid Message", () => {
    const msg: Message = {
      id: "msg-1",
      sessionId: "sess-1",
      agent: "claude",
      type: "proposal",
      content: "Let's use REST with JWT.",
      round: 1,
      createdAt: new Date().toISOString(),
    };
    expect(msg.type).toBe("proposal");
  });

  it("should allow creating a valid Session with dynamic agents", () => {
    const sess: Session = {
      id: "sess-1",
      topic: "Design auth API",
      state: "CREATED",
      currentRound: 0,
      maxRounds: 5,
      agents: ["claude", "codex", "glm", "kimi"],
      approvals: { claude: false, codex: false, glm: false, kimi: false },
      createdAt: new Date().toISOString(),
    };
    expect(sess.state).toBe("CREATED");
    expect(sess.agents).toHaveLength(4);
    expect(sess.approvals.claude).toBe(false);
  });

  it("should allow creating a CLI ProviderConfig", () => {
    const config: ProviderConfig = {
      name: "claude",
      displayName: "Claude",
      type: "cli",
      command: "claude",
      args: ["-p", "{{prompt}}", "--output-format", "json"],
      responseParser: "json-result",
      role: "pragmatic architect",
      color: "blue",
      timeoutMs: 60_000,
    };
    expect(config.type).toBe("cli");
    expect(config.command).toBe("claude");
  });

  it("should allow creating an API ProviderConfig", () => {
    const config: ProviderConfig = {
      name: "glm",
      displayName: "GLM",
      type: "api",
      baseUrl: "https://api.z.ai/api/coding/paas/v4",
      apiKey: "{{GLM_API_KEY}}",
      model: "glm-5.2",
      role: "systems thinker",
      color: "magenta",
      timeoutMs: 60_000,
    };
    expect(config.type).toBe("api");
    expect(config.model).toBe("glm-5.2");
  });
});
