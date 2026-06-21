// src/orchestrator/agents/cli-agent.ts

import { spawn } from "node:child_process";
import type { ProviderConfig } from "../../shared/types.js";
import type { Agent, ProgressChunk } from "./types.js";

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

  async invoke(prompt: string, onProgress?: (chunk: ProgressChunk) => void): Promise<string> {
    const args = (this.config.args ?? []).map((a) =>
      a === "{{prompt}}" ? "-" : a
    );

    return new Promise((resolve, reject) => {
      const child = spawn(this.config.command ?? "", args, {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: this.config.timeoutMs,
      });

      let stdout = "";
      let stderr = "";
      let lineBuffer = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, this.config.timeoutMs);

      child.stdout.on("data", (data) => {
        const chunk = data.toString();
        stdout += chunk;

        if (onProgress && this.config.responseParser === "json-array-result") {
          lineBuffer += chunk;
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";
          for (const line of lines) {
            this.parseStreamLine(line, onProgress);
          }
        }
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`${this.config.displayName} CLI error: ${err.message}`));
      });

      child.on("close", (code) => {
        clearTimeout(timer);

        if (onProgress && lineBuffer) {
          this.parseStreamLine(lineBuffer, onProgress);
        }

        if (timedOut) {
          reject(new Error(`${this.config.displayName} CLI timed out`));
          return;
        }
        if (code !== 0 && !stdout) {
          reject(new Error(`${this.config.displayName} CLI error: ${stderr || `exit ${code}`}`));
          return;
        }
        resolve(this.parseResponse(stdout));
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  private parseStreamLine(line: string, onProgress: (chunk: ProgressChunk) => void): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const obj = JSON.parse(trimmed);

      if (obj.type === "assistant" && obj.message?.content) {
        for (const block of obj.message.content) {
          if (block.type === "thinking" && block.thinking) {
            onProgress({ type: "thinking", content: block.thinking });
          } else if (block.type === "text" && block.text) {
            onProgress({ type: "text", content: block.text });
          }
        }
      }

      if (obj.type === "item.completed" && obj.item?.type === "agent_message" && obj.item?.text) {
        onProgress({ type: "text", content: obj.item.text });
      }
    } catch {
    }
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
      const lines = stdout.trim().split("\n");
      for (const line of lines) {
        try {
          const obj = JSON.parse(line.trim());
          if (obj.type === "result" && obj.result) {
            return String(obj.result);
          }
        } catch {
        }
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
