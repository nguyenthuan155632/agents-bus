// src/orchestrator/agents/factory.ts

import type { ProviderConfig } from "../../shared/types.js";
import type { Agent } from "./types.js";
import { CliAgent } from "./cli-agent.js";
import { ApiAgent } from "./api-agent.js";

export function createAgent(config: ProviderConfig): Agent {
  if (config.type === "cli") {
    return new CliAgent(config);
  }
  if (config.type === "api") {
    return new ApiAgent(config);
  }
  throw new Error(`Unknown provider type: ${config.type}`);
}
