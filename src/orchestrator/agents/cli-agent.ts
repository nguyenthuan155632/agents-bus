// src/orchestrator/agents/cli-agent.ts

import { execFile } from "node:child_process";
import type { ProviderConfig } from "../../shared/types.js";
import type { Agent } from "./types.js";

export class CliAgent implements Agent {
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
    const args = (this.config.args ?? []).map((a) =>
      a === "{{prompt}}" ? prompt : a
    );

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${this.config.displayName} CLI timed out`));
      }, this.config.timeoutMs);

      execFile(
        this.config.command ?? "",
        args,
        { timeout: this.config.timeoutMs, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          clearTimeout(timer);
          if (error) {
            reject(new Error(`${this.config.displayName} CLI error: ${stderr || error.message}`));
            return;
          }
          resolve(this.parseResponse(stdout));
        }
      );
    });
  }

  private parseResponse(stdout: string): string {
    if (this.config.responseParser === "plain") {
      return stdout.trim();
    }

    if (this.config.responseParser === "json-array-result") {
      try {
        const arr = JSON.parse(stdout);
        if (Array.isArray(arr)) {
          const resultItem = arr.find((x: any) => x.type === "result");
          if (resultItem?.result) return String(resultItem.result);
        }
      } catch {
      }
      return stdout.trim();
    }

    if (this.config.responseParser === "jsonl-agent-message") {
      const lines = stdout.trim().split("\n");
      let lastMessage = "";
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (obj.type === "item.completed" && obj.item?.type === "agent_message" && obj.item?.text) {
            lastMessage = String(obj.item.text);
          }
        } catch {
        }
      }
      return lastMessage || stdout.trim();
    }

    try {
      const parsed = JSON.parse(stdout);
      if (this.config.responseParser === "json-result") {
        return parsed.result || stdout.trim();
      }
      if (this.config.responseParser === "json-content") {
        return parsed.content || stdout.trim();
      }
    } catch {
      return stdout.trim();
    }
    return stdout.trim();
  }
}
