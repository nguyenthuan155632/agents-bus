import { describe, it, expect, vi, beforeEach } from "vitest";
import { Negotiator, type NegotiationEvent } from "../../src/orchestrator/negotiate.js";

const mockClaude = { name: "claude", displayName: "Claude", role: "architect", color: "blue", invoke: vi.fn() };
const mockCodex = { name: "codex", displayName: "Codex", role: "engineer", color: "green", invoke: vi.fn() };
const mockGlm = { name: "glm", displayName: "GLM", role: "thinker", color: "magenta", invoke: vi.fn() };

const claudeConfig = { name: "claude", displayName: "Claude", type: "cli" as const, role: "architect", color: "blue", timeoutMs: 60000 };
const codexConfig = { name: "codex", displayName: "Codex", type: "cli" as const, role: "engineer", color: "green", timeoutMs: 60000 };

describe("Negotiator", () => {
  let negotiator: Negotiator;
  let events: NegotiationEvent[];
  let testMessages: any[];
  let msgCounter: number;

  const mockStore = {
    createSession: vi.fn(),
    getSession: vi.fn(),
    updateSessionState: vi.fn(),
    updateSessionRound: vi.fn(),
    postMessage: vi.fn(),
    getMessages: vi.fn(),
    setApproval: vi.fn(),
    resetApprovals: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    events = [];
    testMessages = [];
    msgCounter = 0;

    mockStore.createSession.mockImplementation((topic: string, maxRounds: number, agents: string[]) => ({
      id: "s1",
      topic,
      state: "CREATED" as const,
      currentRound: 0,
      maxRounds,
      agents,
      approvals: Object.fromEntries(agents.map((a: string) => [a, false])),
      createdAt: "2026-01-01T00:00:00Z",
    }));

    mockStore.postMessage.mockImplementation(
      (_sid: string, agent: string, type: string, content: string, round: number) => {
        const msg = {
          id: `msg-${msgCounter++}`,
          sessionId: "s1",
          agent,
          type,
          content,
          round,
          createdAt: "2026-01-01T00:00:00Z",
        };
        testMessages.push(msg);
        return msg;
      }
    );

    mockStore.getMessages.mockImplementation(() => testMessages);
  });

  it("should run a 2-agent negotiation and return APPROVED", async () => {
    mockClaude.invoke.mockResolvedValue("Use REST with JWT. APPROVE");
    mockCodex.invoke.mockResolvedValue("Agreed. APPROVE");

    negotiator = new Negotiator(
      mockStore as any,
      [mockClaude, mockCodex],
      [claudeConfig, codexConfig],
      (e) => events.push(e)
    );

    const result = await negotiator.run("Design auth API", 5);
    expect(result.status).toBe("APPROVED");
    expect(mockClaude.invoke).toHaveBeenCalledOnce();
    expect(mockCodex.invoke).toHaveBeenCalledOnce();
  });

  it("should emit round-start, agent-response, round-end, complete events", async () => {
    mockClaude.invoke.mockResolvedValue("Plan. APPROVE");
    mockCodex.invoke.mockResolvedValue("Good. APPROVE");

    negotiator = new Negotiator(
      mockStore as any,
      [mockClaude, mockCodex],
      [claudeConfig, codexConfig],
      (e) => events.push(e)
    );

    await negotiator.run("Design auth API", 5);

    expect(events[0]).toEqual({ type: "round-start", round: 1, maxRounds: 5 });
    expect(events.some((e) => e.type === "agent-response" && e.agent === "claude")).toBe(true);
    expect(events.some((e) => e.type === "agent-response" && e.agent === "codex")).toBe(true);
    expect(events.some((e) => e.type === "round-end")).toBe(true);
    expect(events.some((e) => e.type === "complete" && e.status === "APPROVED")).toBe(true);
  });

  it("should run multiple rounds when agents reject", async () => {
    mockClaude.invoke
      .mockResolvedValueOnce("Initial plan. REJECT: missing error handling")
      .mockResolvedValueOnce("Added error handling. APPROVE");
    mockCodex.invoke
      .mockResolvedValueOnce("Need rate limiting. REJECT")
      .mockResolvedValueOnce("Rate limiting added. APPROVE");

    negotiator = new Negotiator(mockStore as any, [mockClaude, mockCodex], [claudeConfig, codexConfig]);

    const result = await negotiator.run("Design auth API", 2);
    expect(result.status).toBe("APPROVED");
    expect(mockClaude.invoke).toHaveBeenCalledTimes(2);
    expect(mockCodex.invoke).toHaveBeenCalledTimes(2);
  });

  it("should return EXHAUSTED when max rounds reached", async () => {
    mockClaude.invoke.mockResolvedValue("Plan A. REJECT");
    mockCodex.invoke.mockResolvedValue("Plan B. REJECT");

    negotiator = new Negotiator(mockStore as any, [mockClaude, mockCodex], [claudeConfig, codexConfig], (e) => events.push(e));

    const result = await negotiator.run("Design auth API", 1);
    expect(result.status).toBe("EXHAUSTED");
    expect(events.some((e) => e.type === "complete" && e.status === "EXHAUSTED")).toBe(true);
  });

  it("should emit agent-error event on agent failure", async () => {
    mockClaude.invoke.mockRejectedValue(new Error("Claude CLI timed out"));
    mockCodex.invoke.mockResolvedValue("Plan B. APPROVE");

    negotiator = new Negotiator(mockStore as any, [mockClaude, mockCodex], [claudeConfig, codexConfig], (e) => events.push(e));

    await negotiator.run("Design auth API", 1);

    const errorEvent = events.find((e) => e.type === "agent-error");
    expect(errorEvent).toBeDefined();
  });

  it("should support 3 agents in a round", async () => {
    const glmConfig = { name: "glm", displayName: "GLM", type: "api" as const, role: "thinker", color: "magenta", timeoutMs: 60000 };

    mockClaude.invoke.mockResolvedValue("Plan. APPROVE");
    mockCodex.invoke.mockResolvedValue("Good. APPROVE");
    mockGlm.invoke.mockResolvedValue("Solid. APPROVE");

    negotiator = new Negotiator(
      mockStore as any,
      [mockClaude, mockCodex, mockGlm],
      [claudeConfig, codexConfig, glmConfig]
    );

    const result = await negotiator.run("Design auth API", 5);
    expect(result.status).toBe("APPROVED");
    expect(mockGlm.invoke).toHaveBeenCalledOnce();
  });
});
