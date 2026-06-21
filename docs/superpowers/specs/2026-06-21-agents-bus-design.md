# agents-bus: Multi-Agent Negotiation via MCP

## Overview

A TypeScript project that enables multiple AI agents (Claude CLI, Codex CLI, GLM API, Kimi API, etc.) to negotiate software plans through a structured debate-and-converge protocol, coordinated via an MCP server message bus. The user observes the negotiation in real-time via a terminal UI and approves the final plan.

## Architecture

Two-process design with pluggable agent providers:

1. **MCP Server (Message Bus)** — Stateless message relay with SQLite persistence. Exposes MCP tools for posting messages, reading history, managing sessions, and approving/rejecting plans. Supports N agents dynamically.
2. **Orchestrator CLI** — Drives the negotiation loop. Spawns/invokes agents (CLI or API), feeds them context, parses responses, and manages the turn-based state machine. Renders an Ink terminal UI for live observation.

```
┌─────────────────────────────────────────────────┐
│                    User (You)                    │
│         Observer + Approver via MCP client       │
└────────────┬──────────────────────┬──────────────┘
             │ MCP tools            │ MCP tools
             ▼                      ▼
┌─────────────────────┐  ┌─────────────────────────┐
│   MCP Server        │  │   Orchestrator CLI       │
│   (Message Bus)     │◄─┤   agents-bus negotiate   │
│                     │  │   "<topic>"              │
│  • post_message()   │  │  ┌──────────────────┐   │
│  • get_messages()   │  │  │ Ink Terminal UI  │   │
│  • get_state()      │  │  └──────────────────┘   │
│  • approve_plan()   │  │                          │
│  • reject_plan()    │  │  • Agent Adapters:       │
│  • list_sessions()  │  │    - CliAgent (Claude,   │
│  • create_session() │  │      Codex)              │
└─────────────────────┘  │    - ApiAgent (GLM,      │
                         │      Kimi, etc.)         │
                         │  • Drives turn loop      │
                         │  • Tracks approvals      │
                         └──────┬───────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              ┌─────────┐ ┌─────────┐ ┌─────────┐
              │ Claude  │ │ Codex   │ │ GLM/Kimi│
              │ CLI     │ │ CLI     │ │ API     │
              │ (sub)   │ │ (sub)   │ │ (HTTP)  │
              └─────────┘ └─────────┘ └─────────┘
```

## Agent Provider System

The system supports two adapter types via a unified `Agent` interface:

- **CLI-based agents** (Claude, Codex): Spawned as subprocesses via `execFile`
- **API-based agents** (GLM, Kimi, etc.): Called via OpenAI-compatible HTTP API

Each provider is defined in a config-based registry with: name, display name, type (cli/api), role, color, timeout, and type-specific fields (command+args for CLI, baseUrl+apiKey+model for API).

### Default Providers

| Name | Type | Command/Endpoint | Model | Role |
|------|------|-------------------|-------|------|
| claude | cli | `claude -p {{prompt}} --output-format json` | — | pragmatic architect |
| codex | cli | `codex -q {{prompt}}` | — | implementation-focused engineer |
| glm | api | `https://api.z.ai/api/coding/paas/v4` | glm-5.2 | systems thinker |
| kimi | api | `https://api.kimi.com/coding/v1` | kimi-k2.7-code | detail-oriented reviewer |

API keys are resolved from environment variables (e.g., `GLM_API_KEY`, `KIMI_API_KEY`).

## MCP Server Tools

| Tool | Description |
|------|-------------|
| `create_session` | Start a new negotiation with a topic and agent list |
| `list_sessions` | List all negotiation sessions |
| `post_message` | Post a message to a session (agent, content, type) |
| `get_messages` | Read all messages in a session, optionally filtered by agent |
| `get_state` | Get current negotiation state (round, approvals, current plan draft) |
| `approve_plan` | Signal approval of the current plan draft (any agent name) |
| `reject_plan` | Reject with feedback — triggers another round |

## Message Protocol

```typescript
type MessageType =
  | "proposal"      // Agent proposes a plan or plan revision
  | "critique"      // Agent critiques the other's proposal
  | "concession"    // Agent concedes a point
  | "approval"      // Agent signals "I approve this plan"
  | "rejection"     // Agent rejects with reasons
  | "system"        // System messages (round start, timeout, etc.)
```

## State Machine

```
CREATED → ROUND_IN_PROGRESS → AWAITING_APPROVAL → APPROVED
                ↑                     │
                └── REJECTED ◄────────┘
```

Each round: all N agents take turns proposing/critiquing → if all signal `approval` → `APPROVED`. If any signals `rejection` → new round with rejection feedback as context. Max rounds: configurable, default 5.

## CLI Interface

```bash
# Negotiate with specific agents
agents-bus negotiate "Design a REST API for user auth" --agents claude,codex
agents-bus negotiate "Design a REST API for user auth" --agents claude,glm,kimi
agents-bus negotiate "Design a REST API for user auth" --agents claude,codex,glm,kimi

# Other commands
agents-bus resume <session-id>
agents-bus list
agents-bus view <session-id>
agents-bus providers

# Options
-r, --rounds <number>    Maximum rounds (default: 5)
-a, --agents <agents>    Comma-separated agent names (default: claude,codex)
--no-ui                  Disable terminal UI, use plain output
```

## Terminal UI (Ink)

Live terminal UI with:
- Color-coded agent names (from provider config)
- Scrollable message feed
- Status bar with round progress and approval indicators (●/○ per agent)
- "Waiting for..." spinner when an agent is processing
- `q` or `Esc` to exit

## Error Handling

- **Agent timeout:** Configurable per provider (default 60s). Timeout → system message, skip turn, continue.
- **Agent crash/HTTP error:** System message logged, negotiation continues with remaining agents.
- **MCP server disconnect:** Orchestrator restarts server, resumes from SQLite state.
- **Max rounds exhausted:** Orchestrator merges all proposals via Claude CLI, presents merged plan for user approval.

## Project Structure

```
agents-bus/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .nvmrc
├── .gitignore
├── src/
│   ├── mcp-server/
│   │   ├── index.ts          # MCP server entry point
│   │   ├── tools.ts          # Tool definitions & handlers
│   │   ├── store.ts          # SQLite persistence layer
│   │   └── types.ts          # Server-specific types
│   ├── orchestrator/
│   │   ├── index.ts          # CLI entry point (commander)
│   │   ├── negotiate.ts      # Negotiation loop logic
│   │   ├── agents/
│   │   │   ├── types.ts      # Agent interface
│   │   │   ├── cli-agent.ts  # CLI subprocess adapter
│   │   │   ├── api-agent.ts  # OpenAI-compatible API adapter
│   │   │   ├── factory.ts    # Agent factory
│   │   │   └── providers.ts  # Provider registry
│   │   ├── prompts.ts        # Prompt templates
│   │   ├── merger.ts         # Plan merger (max rounds)
│   │   └── ui/
│   │       ├── NegotiationApp.tsx  # Ink UI component
│   │       └── index.ts            # UI render entry
│   └── shared/
│       └── types.ts          # Shared types
├── tests/
│   ├── mcp-server/
│   │   ├── store.test.ts
│   │   └── tools.test.ts
│   ├── orchestrator/
│   │   ├── agents.test.ts
│   │   ├── prompts.test.ts
│   │   ├── negotiate.test.ts
│   │   ├── merger.test.ts
│   │   └── ui.test.ts
│   └── shared/
│       └── types.test.ts
└── docs/
```

## Testing

- **Unit:** Vitest for store, prompt building, message parsing, state transitions, provider registry.
- **Integration:** Mock CLI subprocesses and HTTP fetch, run full negotiation loop, verify state machine and final plan.
- **Manual E2E:** Real Claude and Codex CLIs with a simple topic.

## Dependencies

`@modelcontextprotocol/server`, `@inkjs/ui`, `better-sqlite3`, `commander`, `ink`, `react`, `zod`, `vitest`, `tsx`, `typescript`, `@types/react`, `@types/node`, `@types/better-sqlite3`

## Tech Stack

- **Runtime:** Node.js v22.18.0
- **Package manager:** pnpm
- **Language:** TypeScript (strict)
- **Module system:** ESM (Node16 module resolution)
