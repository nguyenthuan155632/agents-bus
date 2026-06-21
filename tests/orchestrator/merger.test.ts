import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import type { Message, ProviderConfig } from "../../src/shared/types.js";
import { mergePlans } from "../../src/orchestrator/merger.js";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(
  await import("node:child_process").then((m) => m.spawn)
);

function mockChildProcess(stdout: string, exitCode = 0): ChildProcess {
  const emitter = new EventEmitter() as any;
  emitter.stdout = new EventEmitter();
  emitter.stderr = new EventEmitter();
  emitter.stdin = { write: vi.fn(), end: vi.fn() };
  emitter.kill = vi.fn();

  setTimeout(() => {
    emitter.stdout.emit("data", Buffer.from(stdout));
    emitter.emit("close", exitCode);
  }, 0);

  return emitter as ChildProcess;
}

const providers: ProviderConfig[] = [
  { name: "claude", displayName: "Claude", type: "cli", role: "architect", color: "blue", timeoutMs: 60000 },
  { name: "codex", displayName: "Codex", type: "cli", role: "engineer", color: "green", timeoutMs: 60000 },
  { name: "glm", displayName: "GLM", type: "api", role: "thinker", color: "magenta", timeoutMs: 60000 },
];

describe("mergePlans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should merge two agents' latest contributions into a combined plan", async () => {
    mockSpawn.mockReturnValue(
      mockChildProcess(JSON.stringify([
        { type: "result", result: "Merged plan: REST + rate limiting + error handling." },
      ]))
    );

    const messages: Message[] = [
      {
        id: "1", sessionId: "s1", agent: "claude", type: "rejection",
        content: "Use REST with JWT tokens for auth.", round: 2, createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "2", sessionId: "s1", agent: "codex", type: "rejection",
        content: "Add rate limiting and comprehensive error handling.", round: 2, createdAt: "2026-01-01T00:01:00Z",
      },
    ];

    const result = await mergePlans(messages, providers);
    expect(result).toContain("Merged plan");
  });

  it("should merge 3 agents' contributions", async () => {
    mockSpawn.mockReturnValue(
      mockChildProcess(JSON.stringify([
        { type: "result", result: "Merged plan from 3 agents." },
      ]))
    );

    const messages: Message[] = [
      { id: "1", sessionId: "s1", agent: "claude", type: "approval", content: "Plan A", round: 1, createdAt: "" },
      { id: "2", sessionId: "s1", agent: "codex", type: "rejection", content: "Plan B", round: 1, createdAt: "" },
      { id: "3", sessionId: "s1", agent: "glm", type: "critique", content: "Plan C", round: 1, createdAt: "" },
    ];

    const result = await mergePlans(messages, providers);
    expect(result).toContain("Merged plan from 3");
  });

  it("should return last message if only one agent contributed", async () => {
    const messages: Message[] = [
      {
        id: "1", sessionId: "s1", agent: "claude", type: "approval",
        content: "Use REST with JWT.", round: 1, createdAt: "2026-01-01T00:00:00Z",
      },
    ];

    const result = await mergePlans(messages, providers);
    expect(result).toBe("Use REST with JWT.");
  });

  it("should return null if no agent messages exist", async () => {
    const result = await mergePlans([], providers);
    expect(result).toBeNull();
  });

  it("should ignore system messages when finding latest contributions", async () => {
    mockSpawn.mockReturnValue(
      mockChildProcess(JSON.stringify([
        { type: "result", result: "Merged plan." },
      ]))
    );

    const messages: Message[] = [
      { id: "1", sessionId: "s1", agent: "system", type: "system", content: "Round 1 begins", round: 1, createdAt: "" },
      { id: "2", sessionId: "s1", agent: "claude", type: "proposal", content: "Plan A", round: 1, createdAt: "" },
      { id: "3", sessionId: "s1", agent: "system", type: "system", content: "Round 2 begins", round: 2, createdAt: "" },
      { id: "4", sessionId: "s1", agent: "codex", type: "rejection", content: "Plan B revised", round: 2, createdAt: "" },
    ];

    const result = await mergePlans(messages, providers);
    expect(result).toContain("Merged plan");
  });

  it("should use the latest round per agent, not just the first", async () => {
    mockSpawn.mockReturnValue(
      mockChildProcess(JSON.stringify([
        { type: "result", result: "Merged from latest rounds." },
      ]))
    );

    const messages: Message[] = [
      { id: "1", sessionId: "s1", agent: "claude", type: "proposal", content: "Old plan A", round: 1, createdAt: "2026-01-01T00:00:00Z" },
      { id: "2", sessionId: "s1", agent: "codex", type: "proposal", content: "Old plan B", round: 1, createdAt: "2026-01-01T00:01:00Z" },
      { id: "3", sessionId: "s1", agent: "claude", type: "approval", content: "New plan A v2", round: 3, createdAt: "2026-01-01T00:05:00Z" },
      { id: "4", sessionId: "s1", agent: "codex", type: "rejection", content: "New plan B v2", round: 3, createdAt: "2026-01-01T00:06:00Z" },
    ];

    await mergePlans(messages, providers);

    const stdinWrite = (mockSpawn.mock.results[0].value as any).stdin.write;
    const writtenPrompt = stdinWrite.mock.calls[0][0];
    expect(writtenPrompt).toContain("New plan A v2");
    expect(writtenPrompt).toContain("New plan B v2");
    expect(writtenPrompt).not.toContain("Old plan A");
    expect(writtenPrompt).not.toContain("Old plan B");
  });

  it("should fallback to concatenation on merge CLI error", async () => {
    const emitter = new EventEmitter() as any;
    emitter.stdout = new EventEmitter();
    emitter.stderr = new EventEmitter();
    emitter.stdin = { write: vi.fn(), end: vi.fn() };
    emitter.kill = vi.fn();
    mockSpawn.mockReturnValue(emitter);
    setTimeout(() => emitter.emit("error", new Error("spawn failed")), 0);

    const messages: Message[] = [
      { id: "1", sessionId: "s1", agent: "claude", type: "proposal", content: "Plan A", round: 1, createdAt: "" },
      { id: "2", sessionId: "s1", agent: "codex", type: "rejection", content: "Plan B", round: 1, createdAt: "" },
    ];

    const result = await mergePlans(messages, providers);
    expect(result).toContain("Plan A");
    expect(result).toContain("Plan B");
  });
});
