// src/orchestrator/ui/plain-ui.ts

import type { NegotiationEvent } from "../negotiate.js";
import type { ProviderConfig } from "../../shared/types.js";
import { formatMessage } from "./NegotiationApp.js";
import type { UIHandle } from "./index.js";

const DISPLAY_EVENT_TYPES = new Set(["agent-response", "agent-error", "round-start", "complete"]);

export function createPlainUI(
  _topic: string,
  _maxRounds: number,
  providers: ProviderConfig[]
): UIHandle {
  const providerMap = new Map(providers.map((p) => [p.name, p]));

  return {
    pushEvent(event: NegotiationEvent) {
      if (event.type === "agent-progress") {
        const p = providerMap.get(event.agent);
        const label = p?.displayName ?? event.agent;
        const prefix = event.chunk.type === "thinking" ? "  [thinking] " : "  [writing] ";
        process.stdout.write(`\r${prefix}${label}: ${event.chunk.content.slice(0, 120)}`);
        return;
      }
      if (!DISPLAY_EVENT_TYPES.has(event.type)) return;
      process.stdout.write("\r\x1b[K");
      const msg = formatMessage(event, providers);
      process.stdout.write(`[${msg.label}] ${msg.content}\n`);
    },
    setWaitingFor() {
    },
    unmount() {
    },
  };
}
