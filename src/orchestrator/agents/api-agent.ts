// src/orchestrator/agents/api-agent.ts

import type { ProviderConfig } from "../../shared/types.js";
import type { Agent, ProgressChunk } from "./types.js";

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

  async invoke(prompt: string, onProgress?: (chunk: ProgressChunk) => void): Promise<string> {
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
          stream: !!onProgress,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`${this.config.displayName} API error: ${response.status}`);
      }

      if (!onProgress || !response.body) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || "";
      }

      const fullText = await this.readStream(response.body, onProgress);
      return fullText.trim();
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`${this.config.displayName} API timed out`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async readStream(
    body: ReadableStream<Uint8Array>,
    onProgress: (chunk: ProgressChunk) => void
  ): Promise<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            if (delta?.reasoning_content) {
              onProgress({ type: "thinking", content: delta.reasoning_content });
            }
            if (delta?.content) {
              fullText += delta.content;
              onProgress({ type: "text", content: delta.content });
            }
          } catch {
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
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
