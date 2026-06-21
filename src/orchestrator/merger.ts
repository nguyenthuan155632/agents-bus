// src/orchestrator/merger.ts

import { spawn } from "node:child_process";
import type { Message, ProviderConfig } from "../shared/types.js";

export async function mergePlans(
  messages: Message[],
  providers: ProviderConfig[]
): Promise<string | null> {
  // Get the last substantive message from each agent (exclude system messages)
  const agentMessages = messages.filter(
    (m) => m.agent !== "system" && (m.type === "proposal" || m.type === "approval" || m.type === "rejection" || m.type === "critique" || m.type === "concession")
  );

  if (agentMessages.length === 0) return null;

  // Get the latest message per agent
  const latestByAgent = new Map<string, Message>();
  for (const msg of agentMessages) {
    const existing = latestByAgent.get(msg.agent);
    if (!existing || msg.round > existing.round || msg.createdAt > existing.createdAt) {
      latestByAgent.set(msg.agent, msg);
    }
  }

  const proposals = Array.from(latestByAgent.values());
  if (proposals.length === 0) return null;
  if (proposals.length === 1) return proposals[0].content;

  const providerMap = new Map(providers.map((p) => [p.name, p]));

  const sections = proposals
    .map((p) => {
      const provider = providerMap.get(p.agent);
      const label = provider?.displayName ?? p.agent;
      return `## ${label}'s Latest Contribution\n${p.content}`;
    })
    .join("\n\n");

  const mergePrompt = `You are merging ${proposals.length} agent contributions into a single cohesive plan.
Take the best elements from each and resolve any conflicts. Include all agreed-upon decisions and action items.

${sections}

Produce a single merged plan that incorporates the strengths of all. Be concise and structured.`;

  return new Promise((resolve) => {
    const child = spawn(
      "claude",
      ["-p", "-", "--output-format", "json", "--dangerously-skip-permissions"],
      { stdio: ["pipe", "pipe", "pipe"], timeout: 120_000 }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", () => {
      resolve(proposals.map((p) => p.content).join("\n\n---\n\n"));
    });

    child.on("close", () => {
      try {
        const arr = JSON.parse(stdout);
        if (Array.isArray(arr)) {
          const resultItem = arr.find((x: any) => x.type === "result");
          if (resultItem?.result) {
            resolve(String(resultItem.result));
            return;
          }
        }
        resolve(stdout.trim() || proposals.map((p) => p.content).join("\n\n---\n\n"));
      } catch {
        resolve(stdout.trim() || proposals.map((p) => p.content).join("\n\n---\n\n"));
      }
    });

    child.stdin.write(mergePrompt);
    child.stdin.end();
  });
}
