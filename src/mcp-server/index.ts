// src/mcp-server/index.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Store } from "./store.js";
import { createToolHandlers } from "./tools.js";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const DATA_DIR = join(homedir(), ".agents-bus");
mkdirSync(DATA_DIR, { recursive: true });

const store = new Store(join(DATA_DIR, "sessions.db"));
const handlers = createToolHandlers(store);

const server = new McpServer({
  name: "agents-bus",
  version: "0.1.0",
});

server.registerTool(
  "create_session",
  {
    description: "Start a new negotiation session with a topic and agents",
    inputSchema: z.object({
      topic: z.string().describe("The topic to negotiate"),
      maxRounds: z.number().default(5).describe("Maximum negotiation rounds"),
      agents: z.array(z.string()).describe("Agent names participating in negotiation"),
    }),
  },
  async (input) => {
    const result = await handlers.create_session(input);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "list_sessions",
  {
    description: "List all negotiation sessions",
    inputSchema: z.object({}),
  },
  async (input) => {
    const result = await handlers.list_sessions(input as Record<string, never>);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "post_message",
  {
    description: "Post a message to a negotiation session",
    inputSchema: z.object({
      sessionId: z.string(),
      agent: z.string(),
      type: z.enum(["proposal", "critique", "concession", "approval", "rejection", "system"]),
      content: z.string(),
    }),
  },
  async (input) => {
    const result = await handlers.post_message(input);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "get_messages",
  {
    description: "Get messages from a negotiation session",
    inputSchema: z.object({
      sessionId: z.string(),
      agent: z.string().optional(),
    }),
  },
  async (input) => {
    const result = await handlers.get_messages(input);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "get_state",
  {
    description: "Get the current state of a negotiation session",
    inputSchema: z.object({ sessionId: z.string() }),
  },
  async (input) => {
    const result = await handlers.get_state(input);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "approve_plan",
  {
    description: "Approve the current plan draft",
    inputSchema: z.object({
      sessionId: z.string(),
      agent: z.string(),
    }),
  },
  async (input) => {
    const result = await handlers.approve_plan(input);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "reject_plan",
  {
    description: "Reject the current plan with feedback",
    inputSchema: z.object({
      sessionId: z.string(),
      agent: z.string(),
      reason: z.string().describe("Reason for rejection"),
    }),
  },
  async (input) => {
    const result = await handlers.reject_plan(input);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("agents-bus MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

process.on("SIGINT", () => {
  store.close();
  process.exit(0);
});
