// src/orchestrator/merger.ts

import { execFile } from "node:child_process";
import type { Message, ProviderConfig } from "../shared/types.js";

export async function mergePlans(
  messages: Message[],
  providers: ProviderConfig[]
): Promise<string | null> {
  const proposals = messages.filter((m) => m.type === "proposal");
  if (proposals.length === 0) return null;
  if (proposals.length === 1) return proposals[0].content;

  const providerMap = new Map(providers.map((p) => [p.name, p]));

  const sections = proposals
    .map((p) => {
      const provider = providerMap.get(p.agent);
      const label = provider?.displayName ?? p.agent;
      return `## ${label}'s Proposal\n${p.content}`;
    })
    .join("\n\n");

  const mergePrompt = `You are merging ${proposals.length} software plan proposals into a single cohesive plan.
Take the best elements from each and resolve any conflicts.

${sections}

Produce a single merged plan that incorporates the strengths of all. Be concise and structured.`;

  return new Promise((resolve) => {
    execFile(
      "claude",
      ["-p", mergePrompt, "--output-format", "json"],
      { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          // Fallback: concatenate proposals
          resolve(proposals.map((p) => p.content).join("\n\n---\n\n"));
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed.result || parsed.content || stdout.trim());
        } catch {
          resolve(stdout.trim());
        }
      }
    );
  });
}
