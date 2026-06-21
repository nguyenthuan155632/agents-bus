# agents-bus

Negotiate software plans between multiple AI agents through structured debate. Agents take turns proposing, critiquing, and refining until they reach consensus (or max rounds).

## Install

```bash
pnpm install
pnpm build
pnpm link --global
```

## CLI Usage

```bash
# Negotiate with default agents (Claude + Codex)
agents-bus negotiate "Design a REST API for user authentication"

# Choose specific agents
agents-bus negotiate "Design a REST API for user auth" --agents claude,codex,glm,kimi

# Control rounds
agents-bus negotiate "..." --rounds 3

# Plain output (no terminal UI)
agents-bus negotiate "..." --no-ui

# List sessions
agents-bus list

# View a session transcript
agents-bus view <session-id>

# Resume an incomplete session
agents-bus resume <session-id>

# List available providers
agents-bus providers
```

## MCP Server

The MCP server exposes the negotiation bus as tools for external clients (Claude Desktop, Cursor, etc.) to observe and approve plans.

```bash
# Run the MCP server standalone
agents-bus-mcp

# Or via dev script
pnpm dev:mcp
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `create_session` | Start a new negotiation with a topic and agents |
| `list_sessions` | List all negotiation sessions |
| `post_message` | Post a message to a session |
| `get_messages` | Read messages from a session |
| `get_state` | Get current negotiation state |
| `approve_plan` | Approve the current plan |
| `reject_plan` | Reject with feedback |

## Providers

| Name | Type | Model | Role |
|------|------|-------|------|
| claude | CLI | (subscription default) | pragmatic architect |
| codex | CLI | (subscription default) | implementation-focused engineer |
| glm | API | glm-5.2 | systems thinker |
| kimi | API | kimi-k2.7-code | detail-oriented reviewer |

### Environment Variables (API providers)

```bash
export GLM_API_KEY="your-glm-api-key"
export KIMI_API_KEY="your-kimi-api-key"
```

## Data Storage

- **Database:** `~/.agents-bus/sessions.db` (SQLite)
- **Plans:** `~/.agents-bus/plans/<session-id>.md`

## Architecture

```
User (observer/approver)
  |
  ├── agents-bus (CLI) ──→ Negotiator ──→ Agents (Claude/Codex/GLM/Kimi)
  |                         |
  └── agents-bus-mcp (MCP) ─┘
                            └──→ Store (SQLite)
```

- **Orchestrator CLI** (`agents-bus`): Drives the negotiation loop, spawns agents, manages turns
- **MCP Server** (`agents-bus-mcp`): External observe/approve surface for MCP clients
- **Persistence** (`src/persistence/`): Shared SQLite store used by both CLI and MCP server
- **Agent Adapters**: CLI-based (Claude, Codex) and API-based (GLM, Kimi) via unified `Agent` interface

## Development

```bash
pnpm install
pnpm test          # run tests
pnpm test:watch    # watch mode
pnpm lint          # typecheck
pnpm build         # compile to dist/
```

## Tech Stack

- Node.js v22.18.0, pnpm, TypeScript (strict, ESM)
- `@modelcontextprotocol/sdk`, `better-sqlite3`, `commander`, `ink`, `react`, `zod`
- Testing: `vitest`
