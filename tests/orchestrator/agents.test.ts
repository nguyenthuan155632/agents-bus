import { describe, it, expect, vi, beforeEach } from "vitest";
import { CliAgent } from "../../src/orchestrator/agents/cli-agent.js";
import { ApiAgent } from "../../src/orchestrator/agents/api-agent.js";
import { createAgent } from "../../src/orchestrator/agents/factory.js";
import type { ProviderConfig } from "../../src/shared/types.js";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(
  await import("node:child_process").then((m) => m.spawn)
);

function mockChildProcess(stdout: string, stderr = "", exitCode = 0): ChildProcess {
  const emitter = new EventEmitter() as any;
  emitter.stdout = new EventEmitter();
  emitter.stderr = new EventEmitter();
  emitter.stdin = { write: vi.fn(), end: vi.fn() };
  emitter.kill = vi.fn();

  setTimeout(() => {
    emitter.stdout.emit("data", Buffer.from(stdout));
    emitter.stderr.emit("data", Buffer.from(stderr));
    emitter.emit("close", exitCode);
  }, 0);

  return emitter as ChildProcess;
}

const cliConfig: ProviderConfig = {
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

const apiConfig: ProviderConfig = {
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

describe("CliAgent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should invoke CLI with stdin and return parsed response", async () => {
    mockSpawn.mockReturnValue(
      mockChildProcess(JSON.stringify({ result: "Use REST." }))
    );

    const agent = new CliAgent(cliConfig);
    const response = await agent.invoke("Design auth API");

    expect(response).toBe("Use REST.");
    expect(mockSpawn).toHaveBeenCalledWith(
      "claude",
      ["-p", "-", "--output-format", "json"],
      expect.objectContaining({ stdio: ["pipe", "pipe", "pipe"] })
    );

    const child = mockSpawn.mock.results[0].value as any;
    expect(child.stdin.write).toHaveBeenCalledWith("Design auth API");
  });

  it("should handle plain text parser", async () => {
    mockSpawn.mockReturnValue(mockChildProcess("Plain response"));

    const plainConfig = { ...cliConfig, responseParser: "plain" as const };
    const agent = new CliAgent(plainConfig);
    const response = await agent.invoke("prompt");
    expect(response).toBe("Plain response");
  });

  it("should handle json-array-result parser (Claude format)", async () => {
    mockSpawn.mockReturnValue(
      mockChildProcess(JSON.stringify([
        { type: "system", subtype: "init" },
        { type: "result", result: "Use REST with JWT." },
      ]))
    );

    const arrConfig = { ...cliConfig, responseParser: "json-array-result" as const };
    const agent = new CliAgent(arrConfig);
    const response = await agent.invoke("prompt");
    expect(response).toBe("Use REST with JWT.");
  });

  it("should handle jsonl-agent-message parser (Codex format)", async () => {
    mockSpawn.mockReturnValue(
      mockChildProcess([
        JSON.stringify({ type: "thread.started", thread_id: "t1" }),
        JSON.stringify({ type: "item.completed", item: { id: "i0", type: "agent_message", text: "First message" } }),
        JSON.stringify({ type: "item.completed", item: { id: "i1", type: "agent_message", text: "Final answer" } }),
        JSON.stringify({ type: "turn.completed" }),
      ].join("\n"))
    );

    const jsonlConfig = { ...cliConfig, responseParser: "jsonl-agent-message" as const };
    const agent = new CliAgent(jsonlConfig);
    const response = await agent.invoke("prompt");
    expect(response).toBe("Final answer");
  });

  it("should throw on CLI error exit code", async () => {
    mockSpawn.mockReturnValue(mockChildProcess("", "Command not found", 1));

    const agent = new CliAgent(cliConfig);
    await expect(agent.invoke("prompt")).rejects.toThrow("Claude CLI error");
  });

  it("should throw on spawn error", async () => {
    const emitter = new EventEmitter() as any;
    emitter.stdout = new EventEmitter();
    emitter.stderr = new EventEmitter();
    emitter.stdin = { write: vi.fn(), end: vi.fn() };
    emitter.kill = vi.fn();
    mockSpawn.mockReturnValue(emitter);
    setTimeout(() => emitter.emit("error", new Error("spawn failed")), 0);

    const agent = new CliAgent(cliConfig);
    await expect(agent.invoke("prompt")).rejects.toThrow("Claude CLI error: spawn failed");
  });
});

describe("ApiAgent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should call OpenAI-compatible API with correct payload", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: "Use GraphQL." } }],
      }), { status: 200 })
    );

    process.env.GLM_API_KEY = "test-key";
    const agent = new ApiAgent(apiConfig);
    const response = await agent.invoke("Design auth API");

    expect(response).toBe("Use GraphQL.");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.z.ai/api/coding/paas/v4/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      })
    );

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
    expect(body.model).toBe("glm-5.2");
    expect(body.messages[0].content).toBe("Design auth API");

    delete process.env.GLM_API_KEY;
    fetchSpy.mockRestore();
  });

  it("should throw on HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 })
    );

    process.env.GLM_API_KEY = "test-key";
    const agent = new ApiAgent(apiConfig);
    await expect(agent.invoke("prompt")).rejects.toThrow("GLM API error: 401");
    delete process.env.GLM_API_KEY;
    vi.spyOn(globalThis, "fetch").mockRestore();
  });

  it("should throw when API key env var not set", async () => {
    delete process.env.GLM_API_KEY;
    const agent = new ApiAgent(apiConfig);
    await expect(agent.invoke("prompt")).rejects.toThrow("GLM_API_KEY");
  });
});

describe("createAgent factory", () => {
  it("should create CliAgent for cli type", () => {
    const agent = createAgent(cliConfig);
    expect(agent.name).toBe("claude");
    expect(agent.displayName).toBe("Claude");
  });

  it("should create ApiAgent for api type", () => {
    const agent = createAgent(apiConfig);
    expect(agent.name).toBe("glm");
    expect(agent.displayName).toBe("GLM");
  });

  it("should throw for unknown type", () => {
    const badConfig = { ...cliConfig, type: "unknown" as any };
    expect(() => createAgent(badConfig)).toThrow("Unknown provider type");
  });
});
