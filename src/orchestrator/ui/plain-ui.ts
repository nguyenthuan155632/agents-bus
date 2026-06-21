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
  return {
    pushEvent(event: NegotiationEvent) {
      if (!DISPLAY_EVENT_TYPES.has(event.type)) return;
      const msg = formatMessage(event, providers);
      process.stdout.write(`[${msg.label}] ${msg.content}\n`);
    },
    setWaitingFor() {
    },
    unmount() {
    },
  };
}
