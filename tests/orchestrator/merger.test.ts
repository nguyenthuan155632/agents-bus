import { describe, it, expect, vi } from "vitest";
import { mergePlans } from "../../src/orchestrator/merger.js";
import type { Message, ProviderConfig } from "../../src/shared/types.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const providers: ProviderConfig[] = [
  { name: "claude", displayName: "Claude", type: "cli", role: "architect", color: "blue", timeoutMs: 60000 },
  { name: "codex", displayName: "Codex", type: "cli", role: "engineer", color: "green", timeoutMs: 60000 },
  { name: "glm", displayName: "GLM", type: "api", role: "thinker", color: "magenta", timeoutMs: 60000 },
];

describe("mergePlans", () => {
  it("should merge two proposals into a combined plan", async () => {
    const { execFile } = await import("node:child_process");
    const mockExecFile = vi.mocked(execFile);

    mockExecFile.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(null, JSON.stringify({ result: "Merged plan: REST + rate limiting + error handling." }), "");
    }) as any);

    const messages: Message[] = [
      {
        id: "1", sessionId: "s1", agent: "claude", type: "proposal",
        content: "Use REST with JWT tokens for auth.", round: 2, createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "2", sessionId: "s1", agent: "codex", type: "proposal",
        content: "Add rate limiting and comprehensive error handling.", round: 2, createdAt: "2026-01-01T00:01:00Z",
      },
    ];

    const result = await mergePlans(messages, providers);
    expect(result).toContain("Merged plan");
  });

  it("should merge 3 proposals", async () => {
    const { execFile } = await import("node:child_process");
    const mockExecFile = vi.mocked(execFile);

    mockExecFile.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(null, JSON.stringify({ result: "Merged plan from 3 proposals." }), "");
    }) as any);

    const messages: Message[] = [
      { id: "1", sessionId: "s1", agent: "claude", type: "proposal", content: "Plan A", round: 1, createdAt: "" },
      { id: "2", sessionId: "s1", agent: "codex", type: "proposal", content: "Plan B", round: 1, createdAt: "" },
      { id: "3", sessionId: "s1", agent: "glm", type: "proposal", content: "Plan C", round: 1, createdAt: "" },
    ];

    const result = await mergePlans(messages, providers);
    expect(result).toContain("Merged plan from 3");
  });

  it("should return last proposal if only one exists", async () => {
    const messages: Message[] = [
      {
        id: "1", sessionId: "s1", agent: "claude", type: "proposal",
        content: "Use REST with JWT.", round: 1, createdAt: "2026-01-01T00:00:00Z",
      },
    ];

    const result = await mergePlans(messages, providers);
    expect(result).toBe("Use REST with JWT.");
  });

  it("should return null if no proposals exist", async () => {
    const result = await mergePlans([], providers);
    expect(result).toBeNull();
  });

  it("should fallback to concatenation on merge CLI error", async () => {
    const { execFile } = await import("node:child_process");
    const mockExecFile = vi.mocked(execFile);

    mockExecFile.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(new Error("CLI failed"), "", "");
    }) as any);

    const messages: Message[] = [
      { id: "1", sessionId: "s1", agent: "claude", type: "proposal", content: "Plan A", round: 1, createdAt: "" },
      { id: "2", sessionId: "s1", agent: "codex", type: "proposal", content: "Plan B", round: 1, createdAt: "" },
    ];

    const result = await mergePlans(messages, providers);
    expect(result).toContain("Plan A");
    expect(result).toContain("Plan B");
  });
});
