import { describe, it, expect, vi, beforeEach } from "vitest";
import { CliAgent } from "../../src/orchestrator/agents/cli-agent.js";
import { ApiAgent } from "../../src/orchestrator/agents/api-agent.js";
import { createAgent } from "../../src/orchestrator/agents/factory.js";
import type { ProviderConfig } from "../../src/shared/types.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const mockExecFile = vi.mocked(
  await import("node:child_process").then((m) => m.execFile)
);

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

  it("should invoke CLI with correct args from config", async () => {
    mockExecFile.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(null, JSON.stringify({ result: "Use REST." }), "");
    }) as any);

    const agent = new CliAgent(cliConfig);
    const response = await agent.invoke("Design auth API");

    expect(response).toBe("Use REST.");
    expect(mockExecFile).toHaveBeenCalledWith(
      "claude",
      ["-p", "Design auth API", "--output-format", "json"],
      expect.anything(),
      expect.anything()
    );
  });

  it("should handle plain text parser", async () => {
    mockExecFile.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(null, "Plain response", "");
    }) as any);

    const plainConfig = { ...cliConfig, responseParser: "plain" as const };
    const agent = new CliAgent(plainConfig);
    const response = await agent.invoke("prompt");
    expect(response).toBe("Plain response");
  });

  it("should throw on CLI error", async () => {
    mockExecFile.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(new Error("crash"), "", "");
    }) as any);

    const agent = new CliAgent(cliConfig);
    await expect(agent.invoke("prompt")).rejects.toThrow("Claude CLI error");
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
