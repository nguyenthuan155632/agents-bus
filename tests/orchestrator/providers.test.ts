import { describe, it, expect } from "vitest";
import {
  DEFAULT_PROVIDERS,
  getProvider,
  getProviders,
  listProviders,
} from "../../src/orchestrator/agents/providers.js";

describe("providers registry", () => {
  it("should include claude, codex, glm, kimi in defaults", () => {
    const names = DEFAULT_PROVIDERS.map((p) => p.name);
    expect(names).toContain("claude");
    expect(names).toContain("codex");
    expect(names).toContain("glm");
    expect(names).toContain("kimi");
  });

  it("claude should be CLI type with correct command", () => {
    const claude = getProvider("claude");
    expect(claude).toBeDefined();
    expect(claude!.type).toBe("cli");
    expect(claude!.command).toBe("claude");
    expect(claude!.role).toBe("pragmatic architect");
  });

  it("codex should be CLI type", () => {
    const codex = getProvider("codex");
    expect(codex).toBeDefined();
    expect(codex!.type).toBe("cli");
    expect(codex!.command).toBe("codex");
  });

  it("glm should be API type with correct endpoint and model", () => {
    const glm = getProvider("glm");
    expect(glm).toBeDefined();
    expect(glm!.type).toBe("api");
    expect(glm!.baseUrl).toBe("https://api.z.ai/api/coding/paas/v4");
    expect(glm!.model).toBe("glm-5.2");
    expect(glm!.apiKey).toBe("{{GLM_API_KEY}}");
  });

  it("kimi should be API type with correct endpoint and model", () => {
    const kimi = getProvider("kimi");
    expect(kimi).toBeDefined();
    expect(kimi!.type).toBe("api");
    expect(kimi!.baseUrl).toBe("https://api.kimi.com/coding/v1");
    expect(kimi!.model).toBe("kimi-k2.7-code");
    expect(kimi!.apiKey).toBe("{{KIMI_API_KEY}}");
  });

  it("listProviders should return all providers", () => {
    const providers = listProviders();
    expect(providers.length).toBeGreaterThanOrEqual(4);
  });

  it("getProviders should return multiple by name", () => {
    const providers = getProviders(["claude", "kimi"]);
    expect(providers).toHaveLength(2);
    expect(providers.map((p) => p.name)).toEqual(["claude", "kimi"]);
  });

  it("getProvider should return undefined for unknown", () => {
    expect(getProvider("unknown")).toBeUndefined();
  });

  it("getProviders should skip unknown providers", () => {
    const providers = getProviders(["claude", "unknown", "kimi"]);
    expect(providers).toHaveLength(2);
  });
});
