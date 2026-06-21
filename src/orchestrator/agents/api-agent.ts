// src/orchestrator/agents/api-agent.ts

import type { ProviderConfig } from "../../shared/types.js";
import type { Agent } from "./types.js";

export class ApiAgent implements Agent {
  constructor(private config: ProviderConfig) {}

  get name(): string {
    return this.config.name;
  }

  get displayName(): string {
    return this.config.displayName;
  }

  get role(): string {
    return this.config.role;
  }

  get color(): string {
    return this.config.color;
  }

  async invoke(prompt: string): Promise<string> {
    const apiKey = this.resolveApiKey();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`${this.config.displayName} API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || "";
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`${this.config.displayName} API timed out`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private resolveApiKey(): string {
    const key = this.config.apiKey;
    if (!key) throw new Error(`No API key configured for ${this.config.displayName}`);

    if (key.startsWith("{{") && key.endsWith("}}")) {
      const envVar = key.slice(2, -2);
      const resolved = process.env[envVar];
      if (!resolved) throw new Error(`Environment variable ${envVar} not set`);
      return resolved;
    }

    return key;
  }
}
