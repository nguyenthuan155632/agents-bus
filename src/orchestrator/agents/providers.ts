// src/orchestrator/agents/providers.ts

import type { ProviderConfig } from "../../shared/types.js";

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    name: "claude",
    displayName: "Claude",
    type: "cli",
    command: "claude",
    args: ["-p", "{{prompt}}", "--output-format", "json"],
    responseParser: "json-result",
    role: "pragmatic architect",
    color: "blue",
    timeoutMs: 60_000,
  },
  {
    name: "codex",
    displayName: "Codex",
    type: "cli",
    command: "codex",
    args: ["-q", "{{prompt}}"],
    responseParser: "plain",
    role: "implementation-focused engineer",
    color: "green",
    timeoutMs: 60_000,
  },
  {
    name: "glm",
    displayName: "GLM",
    type: "api",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    apiKey: "{{GLM_API_KEY}}",
    model: "glm-5.2",
    role: "systems thinker",
    color: "magenta",
    timeoutMs: 60_000,
  },
  {
    name: "kimi",
    displayName: "Kimi",
    type: "api",
    baseUrl: "https://api.kimi.com/coding/v1",
    apiKey: "{{KIMI_API_KEY}}",
    model: "kimi-k2.7-code",
    role: "detail-oriented reviewer",
    color: "cyan",
    timeoutMs: 60_000,
  },
];

export function getProvider(name: string): ProviderConfig | undefined {
  return DEFAULT_PROVIDERS.find((p) => p.name === name);
}

export function getProviders(names: string[]): ProviderConfig[] {
  return names
    .map((n) => getProvider(n))
    .filter((p): p is ProviderConfig => p !== undefined);
}

export function listProviders(): ProviderConfig[] {
  return DEFAULT_PROVIDERS;
}
