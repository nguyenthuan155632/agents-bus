# agents-bus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MCP server message bus + orchestrator CLI that enables multiple AI agents (Claude CLI, Codex CLI, GLM API, Kimi API) to negotiate software plans through structured debate, with a live Ink terminal UI.

**Architecture:** Two-process design — a thin MCP server acts as a stateless message bus with SQLite persistence, while a separate orchestrator CLI drives the negotiation loop by invoking agents (CLI subprocess or API HTTP call) and managing the turn-based state machine. Pluggable provider registry supports both CLI and API-based agents via a unified Agent interface.

**Tech Stack:** Node.js v22.18.0, pnpm, TypeScript (strict, ESM), `@modelcontextprotocol/server`, `better-sqlite3`, `commander`, `zod`, `ink`, `react`, `@inkjs/ui`, `vitest`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.nvmrc`
- Create: `.gitignore`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "agents-bus",
  "version": "0.1.0",
  "type": "module",
  "engines": {
    "node": ">=22.18.0"
  },
  "bin": {
    "agents-bus": "./dist/orchestrator/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/orchestrator/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/server": "^1.12.0",
    "@inkjs/ui": "^2.0.0",
    "better-sqlite3": "^11.8.0",
    "commander": "^13.1.0",
    "ink": "^5.2.0",
    "react": "^18.3.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^22.15.0",
    "@types/react": "^18.3.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "jsx": "react-jsx",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create .nvmrc**

```
22.18.0
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
*.db
.agents-bus/
```

- [ ] **Step 6: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 7: Verify setup**

```bash
pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git init && git add -A && git commit -m "chore: project scaffolding"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/shared/types.ts`
- Create: `tests/shared/types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import {
  type Message,
  type Session,
  type ProviderConfig,
  SESSION_STATES,
  MESSAGE_TYPES,
} from "../../src/shared/types.js";

describe("types", () => {
  it("should export valid session states", () => {
    expect(SESSION_STATES).toContain("CREATED");
    expect(SESSION_STATES).toContain("ROUND_IN_PROGRESS");
    expect(SESSION_STATES).toContain("AWAITING_APPROVAL");
    expect(SESSION_STATES).toContain("APPROVED");
    expect(SESSION_STATES).toContain("REJECTED");
  });

  it("should export valid message types", () => {
    expect(MESSAGE_TYPES).toContain("proposal");
    expect(MESSAGE_TYPES).toContain("critique");
    expect(MESSAGE_TYPES).toContain("concession");
    expect(MESSAGE_TYPES).toContain("approval");
    expect(MESSAGE_TYPES).toContain("rejection");
    expect(MESSAGE_TYPES).toContain("system");
  });

  it("should allow creating a valid Message", () => {
    const msg: Message = {
      id: "msg-1",
      sessionId: "sess-1",
      agent: "claude",
      type: "proposal",
      content: "Let's use REST with JWT.",
      round: 1,
      createdAt: new Date().toISOString(),
    };
    expect(msg.type).toBe("proposal");
  });

  it("should allow creating a valid Session with dynamic agents", () => {
    const sess: Session = {
      id: "sess-1",
      topic: "Design auth API",
      state: "CREATED",
      currentRound: 0,
      maxRounds: 5,
      agents: ["claude", "codex", "glm", "kimi"],
      approvals: { claude: false, codex: false, glm: false, kimi: false },
      createdAt: new Date().toISOString(),
    };
    expect(sess.state).toBe("CREATED");
    expect(sess.agents).toHaveLength(4);
    expect(sess.approvals.claude).toBe(false);
  });

  it("should allow creating a CLI ProviderConfig", () => {
    const config: ProviderConfig = {
      name: "claude",
      displayName: "Claude",
      type: "cli",
      command: "claude",
      args: ["-p", "{{prompt}}", "--output-format", "json"],
      responseParser: "json-result",
      role: "pragmatic architect",
      color: "blue",
      timeoutMs: 60_000,
    };
    expect(config.type).toBe("cli");
    expect(config.command).toBe("claude");
  });

  it("should allow creating an API ProviderConfig", () => {
    const config: ProviderConfig = {
      name: "glm",
      displayName: "GLM",
      type: "api",
      baseUrl: "https://api.z.ai/api/coding/paas/v4",
      apiKey: "{{GLM_API_KEY}}",
      model: "glm-5.2",
      role: "systems thinker",
      color: "magenta",
      timeoutMs: 60_000,
    };
    expect(config.type).toBe("api");
    expect(config.model).toBe("glm-5.2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/shared/types.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement shared types**

```typescript
// src/shared/types.ts

export const SESSION_STATES = [
  "CREATED",
  "ROUND_IN_PROGRESS",
  "AWAITING_APPROVAL",
  "APPROVED",
  "REJECTED",
] as const;

export type SessionState = (typeof SESSION_STATES)[number];

export const MESSAGE_TYPES = [
  "proposal",
  "critique",
  "concession",
  "approval",
  "rejection",
  "system",
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

export type AgentName = string;

export interface ProviderConfig {
  name: string;
  displayName: string;
  type: "cli" | "api";
  role: string;
  color: string;
  timeoutMs: number;

  // CLI-specific (when type === "cli")
  command?: string;
  args?: string[];
  responseParser?: "json-result" | "json-content" | "plain";

  // API-specific (when type === "api")
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  agent: AgentName | "system";
  type: MessageType;
  content: string;
  round: number;
  createdAt: string;
}

export interface Session {
  id: string;
  topic: string;
  state: SessionState;
  currentRound: number;
  maxRounds: number;
  agents: AgentName[];
  approvals: Record<AgentName, boolean>;
  createdAt: string;
}

export interface NegotiationState {
  session: Session;
  messages: Message[];
  currentPlanDraft: string | null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/shared/types.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add shared types for sessions, messages, and providers"
```

---

## Task 3: SQLite Store

**Files:**
- Create: `src/mcp-server/store.ts`
- Create: `tests/mcp-server/store.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { Store } from "../../src/mcp-server/store.js";

describe("Store", () => {
  let store: Store;

  beforeEach(() => {
    store = new Store(":memory:");
  });

  it("should create a session with agents and retrieve it", () => {
    const session = store.createSession("Design auth API", 5, ["claude", "codex"]);
    expect(session.id).toBeDefined();
    expect(session.topic).toBe("Design auth API");
    expect(session.state).toBe("CREATED");
    expect(session.currentRound).toBe(0);
    expect(session.maxRounds).toBe(5);
    expect(session.agents).toEqual(["claude", "codex"]);
    expect(session.approvals).toEqual({ claude: false, codex: false });

    const retrieved = store.getSession(session.id);
    expect(retrieved).toEqual(session);
  });

  it("should create a session with 4 agents", () => {
    const session = store.createSession("Topic", 3, ["claude", "codex", "glm", "kimi"]);
    expect(session.agents).toHaveLength(4);
    expect(session.approvals).toEqual({
      claude: false,
      codex: false,
      glm: false,
      kimi: false,
    });
  });

  it("should list sessions", () => {
    store.createSession("Topic A", 5, ["claude", "codex"]);
    store.createSession("Topic B", 3, ["glm", "kimi"]);
    const sessions = store.listSessions();
    expect(sessions).toHaveLength(2);
  });

  it("should update session state", () => {
    const session = store.createSession("Topic", 5, ["claude", "codex"]);
    store.updateSessionState(session.id, "ROUND_IN_PROGRESS");
    const updated = store.getSession(session.id);
    expect(updated!.state).toBe("ROUND_IN_PROGRESS");
  });

  it("should update session round", () => {
    const session = store.createSession("Topic", 5, ["claude", "codex"]);
    store.updateSessionRound(session.id, 2);
    const updated = store.getSession(session.id);
    expect(updated!.currentRound).toBe(2);
  });

  it("should set and check approvals dynamically", () => {
    const session = store.createSession("Topic", 5, ["claude", "codex", "glm"]);
    store.setApproval(session.id, "claude", true);
    let updated = store.getSession(session.id);
    expect(updated!.approvals.claude).toBe(true);
    expect(updated!.approvals.codex).toBe(false);
    expect(updated!.approvals.glm).toBe(false);

    store.setApproval(session.id, "glm", true);
    updated = store.getSession(session.id);
    expect(updated!.approvals.glm).toBe(true);
  });

  it("should reset all approvals", () => {
    const session = store.createSession("Topic", 5, ["claude", "codex", "kimi"]);
    store.setApproval(session.id, "claude", true);
    store.setApproval(session.id, "codex", true);
    store.resetApprovals(session.id);
    const updated = store.getSession(session.id);
    expect(updated!.approvals).toEqual({ claude: false, codex: false, kimi: false });
  });

  it("should post and retrieve messages", () => {
    const session = store.createSession("Topic", 5, ["claude", "codex"]);
    const msg = store.postMessage(session.id, "claude", "proposal", "Use REST", 1);
    expect(msg.id).toBeDefined();
    expect(msg.agent).toBe("claude");
    expect(msg.type).toBe("proposal");
    expect(msg.content).toBe("Use REST");
    expect(msg.round).toBe(1);

    const messages = store.getMessages(session.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(msg);
  });

  it("should filter messages by agent", () => {
    const session = store.createSession("Topic", 5, ["claude", "codex", "glm"]);
    store.postMessage(session.id, "claude", "proposal", "Use REST", 1);
    store.postMessage(session.id, "codex", "critique", "Consider GraphQL", 1);
    store.postMessage(session.id, "glm", "critique", "Think holistically", 1);

    const claudeMsgs = store.getMessages(session.id, "claude");
    expect(claudeMsgs).toHaveLength(1);

    const codexMsgs = store.getMessages(session.id, "codex");
    expect(codexMsgs).toHaveLength(1);
  });

  it("should return null for non-existent session", () => {
    expect(store.getSession("non-existent")).toBeNull();
  });

  it("should close the database without error", () => {
    store.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/mcp-server/store.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the Store**

```typescript
// src/mcp-server/store.ts

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Session, Message, SessionState, MessageType } from "../shared/types.js";

export class Store {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'CREATED',
        current_round INTEGER NOT NULL DEFAULT 0,
        max_rounds INTEGER NOT NULL DEFAULT 5,
        agents TEXT NOT NULL DEFAULT '[]',
        approvals TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        agent TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        round INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
    `);
  }

  createSession(topic: string, maxRounds: number, agents: string[]): Session {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const approvals: Record<string, boolean> = {};
    for (const a of agents) approvals[a] = false;

    this.db
      .prepare(
        `INSERT INTO sessions (id, topic, state, current_round, max_rounds, agents, approvals, created_at)
         VALUES (?, ?, 'CREATED', 0, ?, ?, ?, ?)`
      )
      .run(id, topic, maxRounds, JSON.stringify(agents), JSON.stringify(approvals), createdAt);

    return {
      id,
      topic,
      state: "CREATED",
      currentRound: 0,
      maxRounds,
      agents,
      approvals,
      createdAt,
    };
  }

  getSession(id: string): Session | null {
    const row = this.db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(id) as any;
    if (!row) return null;
    return this.rowToSession(row);
  }

  listSessions(): Session[] {
    const rows = this.db
      .prepare("SELECT * FROM sessions ORDER BY created_at DESC")
      .all() as any[];
    return rows.map((r) => this.rowToSession(r));
  }

  updateSessionState(id: string, state: SessionState): void {
    this.db
      .prepare("UPDATE sessions SET state = ? WHERE id = ?")
      .run(state, id);
  }

  updateSessionRound(id: string, round: number): void {
    this.db
      .prepare("UPDATE sessions SET current_round = ? WHERE id = ?")
      .run(round, id);
  }

  setApproval(id: string, agent: string, approved: boolean): void {
    const session = this.getSession(id);
    if (!session) return;
    session.approvals[agent] = approved;
    this.db
      .prepare("UPDATE sessions SET approvals = ? WHERE id = ?")
      .run(JSON.stringify(session.approvals), id);
  }

  resetApprovals(id: string): void {
    const session = this.getSession(id);
    if (!session) return;
    for (const a of Object.keys(session.approvals)) session.approvals[a] = false;
    this.db
      .prepare("UPDATE sessions SET approvals = ? WHERE id = ?")
      .run(JSON.stringify(session.approvals), id);
  }

  postMessage(
    sessionId: string,
    agent: string,
    type: MessageType,
    content: string,
    round: number
  ): Message {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO messages (id, session_id, agent, type, content, round, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, sessionId, agent, type, content, round, createdAt);

    return { id, sessionId, agent, type, content, round, createdAt };
  }

  getMessages(sessionId: string, agent?: string): Message[] {
    let rows: any[];
    if (agent) {
      rows = this.db
        .prepare("SELECT * FROM messages WHERE session_id = ? AND agent = ? ORDER BY created_at ASC")
        .all(sessionId, agent) as any[];
    } else {
      rows = this.db
        .prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC")
        .all(sessionId) as any[];
    }
    return rows.map((r) => this.rowToMessage(r));
  }

  close(): void {
    this.db.close();
  }

  private rowToSession(row: any): Session {
    return {
      id: row.id,
      topic: row.topic,
      state: row.state,
      currentRound: row.current_round,
      maxRounds: row.max_rounds,
      agents: JSON.parse(row.agents),
      approvals: JSON.parse(row.approvals),
      createdAt: row.created_at,
    };
  }

  private rowToMessage(row: any): Message {
    return {
      id: row.id,
      sessionId: row.session_id,
      agent: row.agent,
      type: row.type,
      content: row.content,
      round: row.round,
      createdAt: row.created_at,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/mcp-server/store.test.ts
```

Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add SQLite store for sessions and messages with dynamic agents"
```

---

## Task 4: MCP Server Tools

**Files:**
- Create: `src/mcp-server/tools.ts`
- Create: `tests/mcp-server/tools.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { Store } from "../../src/mcp-server/store.js";
import { createToolHandlers } from "../../src/mcp-server/tools.js";

describe("tool handlers", () => {
  let store: Store;
  let handlers: ReturnType<typeof createToolHandlers>;

  beforeEach(() => {
    store = new Store(":memory:");
    handlers = createToolHandlers(store);
  });

  it("create_session should create and return a session with agents", async () => {
    const result = await handlers.create_session({
      topic: "Design auth API",
      maxRounds: 5,
      agents: ["claude", "codex"],
    });
    expect(result.session.id).toBeDefined();
    expect(result.session.topic).toBe("Design auth API");
    expect(result.session.state).toBe("CREATED");
    expect(result.session.agents).toEqual(["claude", "codex"]);
  });

  it("list_sessions should return all sessions", async () => {
    await handlers.create_session({ topic: "Topic A", maxRounds: 5, agents: ["claude"] });
    await handlers.create_session({ topic: "Topic B", maxRounds: 3, agents: ["codex"] });
    const result = await handlers.list_sessions({});
    expect(result.sessions).toHaveLength(2);
  });

  it("post_message should add a message to a session", async () => {
    const { session } = await handlers.create_session({
      topic: "Topic",
      maxRounds: 5,
      agents: ["claude", "codex"],
    });
    const result = await handlers.post_message({
      sessionId: session.id,
      agent: "claude",
      type: "proposal",
      content: "Use REST with JWT",
    });
    expect(result.message.content).toBe("Use REST with JWT");
  });

  it("get_messages should return messages for a session", async () => {
    const { session } = await handlers.create_session({
      topic: "Topic",
      maxRounds: 5,
      agents: ["claude", "codex"],
    });
    await handlers.post_message({ sessionId: session.id, agent: "claude", type: "proposal", content: "Plan A" });
    await handlers.post_message({ sessionId: session.id, agent: "codex", type: "critique", content: "Consider B" });
    const result = await handlers.get_messages({ sessionId: session.id });
    expect(result.messages).toHaveLength(2);
  });

  it("get_messages should filter by agent", async () => {
    const { session } = await handlers.create_session({
      topic: "Topic",
      maxRounds: 5,
      agents: ["claude", "codex"],
    });
    await handlers.post_message({ sessionId: session.id, agent: "claude", type: "proposal", content: "Plan A" });
    await handlers.post_message({ sessionId: session.id, agent: "codex", type: "critique", content: "Consider B" });
    const result = await handlers.get_messages({ sessionId: session.id, agent: "claude" });
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].agent).toBe("claude");
  });

  it("get_state should return session state with messages", async () => {
    const { session } = await handlers.create_session({
      topic: "Topic",
      maxRounds: 5,
      agents: ["claude", "codex"],
    });
    await handlers.post_message({ sessionId: session.id, agent: "claude", type: "proposal", content: "Plan A" });
    const result = await handlers.get_state({ sessionId: session.id });
    expect(result.session.state).toBe("CREATED");
    expect(result.messages).toHaveLength(1);
    expect(result.currentPlanDraft).toBe("Plan A");
  });

  it("approve_plan should set approval for any agent", async () => {
    const { session } = await handlers.create_session({
      topic: "Topic",
      maxRounds: 5,
      agents: ["claude", "codex", "glm"],
    });
    await handlers.approve_plan({ sessionId: session.id, agent: "glm" });
    const state = await handlers.get_state({ sessionId: session.id });
    expect(state.session.approvals.glm).toBe(true);
    expect(state.session.approvals.claude).toBe(false);
  });

  it("approve_plan from all agents should set state to APPROVED", async () => {
    const { session } = await handlers.create_session({
      topic: "Topic",
      maxRounds: 5,
      agents: ["claude", "codex"],
    });
    await handlers.approve_plan({ sessionId: session.id, agent: "claude" });
    await handlers.approve_plan({ sessionId: session.id, agent: "codex" });
    const state = await handlers.get_state({ sessionId: session.id });
    expect(state.session.state).toBe("APPROVED");
  });

  it("approve_plan with 3 agents requires all 3", async () => {
    const { session } = await handlers.create_session({
      topic: "Topic",
      maxRounds: 5,
      agents: ["claude", "codex", "kimi"],
    });
    await handlers.approve_plan({ sessionId: session.id, agent: "claude" });
    await handlers.approve_plan({ sessionId: session.id, agent: "codex" });
    let state = await handlers.get_state({ sessionId: session.id });
    expect(state.session.state).not.toBe("APPROVED");

    await handlers.approve_plan({ sessionId: session.id, agent: "kimi" });
    state = await handlers.get_state({ sessionId: session.id });
    expect(state.session.state).toBe("APPROVED");
  });

  it("reject_plan should reset approvals and set state to REJECTED", async () => {
    const { session } = await handlers.create_session({
      topic: "Topic",
      maxRounds: 5,
      agents: ["claude", "codex"],
    });
    await handlers.approve_plan({ sessionId: session.id, agent: "claude" });
    await handlers.reject_plan({ sessionId: session.id, agent: "codex", reason: "Missing error handling" });
    const state = await handlers.get_state({ sessionId: session.id });
    expect(state.session.state).toBe("REJECTED");
    expect(state.session.approvals.claude).toBe(false);
  });

  it("should throw for non-existent session", async () => {
    await expect(handlers.get_state({ sessionId: "fake" })).rejects.toThrow("not found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/mcp-server/tools.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement tool handlers**

```typescript
// src/mcp-server/tools.ts

import type { Store } from "./store.js";
import type { MessageType } from "../shared/types.js";

export function createToolHandlers(store: Store) {
  return {
    async create_session(input: { topic: string; maxRounds: number; agents: string[] }) {
      const session = store.createSession(input.topic, input.maxRounds, input.agents);
      return { session };
    },

    async list_sessions(_input: Record<string, never>) {
      const sessions = store.listSessions();
      return { sessions };
    },

    async post_message(input: {
      sessionId: string;
      agent: string;
      type: MessageType;
      content: string;
    }) {
      const session = store.getSession(input.sessionId);
      if (!session) throw new Error(`Session ${input.sessionId} not found`);
      const message = store.postMessage(
        input.sessionId,
        input.agent,
        input.type,
        input.content,
        session.currentRound
      );
      return { message };
    },

    async get_messages(input: { sessionId: string; agent?: string }) {
      const messages = store.getMessages(input.sessionId, input.agent);
      return { messages };
    },

    async get_state(input: { sessionId: string }) {
      const session = store.getSession(input.sessionId);
      if (!session) throw new Error(`Session ${input.sessionId} not found`);
      const messages = store.getMessages(input.sessionId);
      const proposals = messages.filter((m) => m.type === "proposal");
      const currentPlanDraft = proposals.length > 0 ? proposals[proposals.length - 1].content : null;
      return { session, messages, currentPlanDraft };
    },

    async approve_plan(input: { sessionId: string; agent: string }) {
      const session = store.getSession(input.sessionId);
      if (!session) throw new Error(`Session ${input.sessionId} not found`);

      store.setApproval(input.sessionId, input.agent, true);
      store.postMessage(input.sessionId, input.agent, "approval", `${input.agent} approves the plan`, session.currentRound);

      const updated = store.getSession(input.sessionId)!;
      const allApproved = Object.values(updated.approvals).every(Boolean);
      if (allApproved) {
        store.updateSessionState(input.sessionId, "APPROVED");
      }

      return { session: store.getSession(input.sessionId)! };
    },

    async reject_plan(input: { sessionId: string; agent: string; reason: string }) {
      const session = store.getSession(input.sessionId);
      if (!session) throw new Error(`Session ${input.sessionId} not found`);

      store.postMessage(input.sessionId, input.agent, "rejection", input.reason, session.currentRound);
      store.resetApprovals(input.sessionId);
      store.updateSessionState(input.sessionId, "REJECTED");

      return { session: store.getSession(input.sessionId)! };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/mcp-server/tools.test.ts
```

Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add MCP tool handlers with dynamic agent support"
```

---

## Task 5: MCP Server Entry Point

**Files:**
- Create: `src/mcp-server/index.ts`

- [ ] **Step 1: Implement MCP server**

```typescript
// src/mcp-server/index.ts

import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio.js";
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
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add MCP server entry point with stdio transport"
```

---

## Task 6: Agent Adapters (CliAgent + ApiAgent + Factory + Interface)

**Files:**
- Create: `src/orchestrator/agents/types.ts`
- Create: `src/orchestrator/agents/cli-agent.ts`
- Create: `src/orchestrator/agents/api-agent.ts`
- Create: `src/orchestrator/agents/factory.ts`
- Create: `tests/orchestrator/agents.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CliAgent } from "../../src/orchestrator/agents/cli-agent.js";
import { ApiAgent } from "../../src/orchestrator/agents/api-agent.js";
import { createAgent } from "../../src/orchestrator/agents/factory.js";
import type { ProviderConfig } from "../../src/shared/types.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const mockExecFile = vi.mocked(
  await import("node:child_process").then((m) => m.execFile)
);

const cliConfig: ProviderConfig = {
  name: "claude",
  displayName: "Claude",
  type: "cli",
  command: "claude",
  args: ["-p", "{{prompt}}", "--output-format", "json"],
  responseParser: "json-result",
  role: "pragmatic architect",
  color: "blue",
  timeoutMs: 60_000,
};

const apiConfig: ProviderConfig = {
  name: "glm",
  displayName: "GLM",
  type: "api",
  baseUrl: "https://api.z.ai/api/coding/paas/v4",
  apiKey: "{{GLM_API_KEY}}",
  model: "glm-5.2",
  role: "systems thinker",
  color: "magenta",
  timeoutMs: 60_000,
};

describe("CliAgent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should invoke CLI with correct args from config", async () => {
    mockExecFile.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(null, JSON.stringify({ result: "Use REST." }), "");
    }) as any);

    const agent = new CliAgent(cliConfig);
    const response = await agent.invoke("Design auth API");

    expect(response).toBe("Use REST.");
    expect(mockExecFile).toHaveBeenCalledWith(
      "claude",
      ["-p", "Design auth API", "--output-format", "json"],
      expect.anything(),
      expect.anything()
    );
  });

  it("should handle plain text parser", async () => {
    mockExecFile.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(null, "Plain response", "");
    }) as any);

    const plainConfig = { ...cliConfig, responseParser: "plain" as const };
    const agent = new CliAgent(plainConfig);
    const response = await agent.invoke("prompt");
    expect(response).toBe("Plain response");
  });

  it("should throw on CLI error", async () => {
    mockExecFile.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(new Error("crash"), "", "");
    }) as any);

    const agent = new CliAgent(cliConfig);
    await expect(agent.invoke("prompt")).rejects.toThrow("Claude CLI error");
  });
});

describe("ApiAgent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should call OpenAI-compatible API with correct payload", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: "Use GraphQL." } }],
      }), { status: 200 })
    );

    process.env.GLM_API_KEY = "test-key";
    const agent = new ApiAgent(apiConfig);
    const response = await agent.invoke("Design auth API");

    expect(response).toBe("Use GraphQL.");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.z.ai/api/coding/paas/v4/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      })
    );

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
    expect(body.model).toBe("glm-5.2");
    expect(body.messages[0].content).toBe("Design auth API");

    delete process.env.GLM_API_KEY;
    fetchSpy.mockRestore();
  });

  it("should throw on HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 })
    );

    process.env.GLM_API_KEY = "test-key";
    const agent = new ApiAgent(apiConfig);
    await expect(agent.invoke("prompt")).rejects.toThrow("GLM API error: 401");
    delete process.env.GLM_API_KEY;
    vi.spyOn(globalThis, "fetch").mockRestore();
  });

  it("should throw when API key env var not set", async () => {
    delete process.env.GLM_API_KEY;
    const agent = new ApiAgent(apiConfig);
    await expect(agent.invoke("prompt")).rejects.toThrow("GLM_API_KEY");
  });
});

describe("createAgent factory", () => {
  it("should create CliAgent for cli type", () => {
    const agent = createAgent(cliConfig);
    expect(agent.name).toBe("claude");
    expect(agent.displayName).toBe("Claude");
  });

  it("should create ApiAgent for api type", () => {
    const agent = createAgent(apiConfig);
    expect(agent.name).toBe("glm");
    expect(agent.displayName).toBe("GLM");
  });

  it("should throw for unknown type", () => {
    const badConfig = { ...cliConfig, type: "unknown" as any };
    expect(() => createAgent(badConfig)).toThrow("Unknown provider type");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/orchestrator/agents.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement Agent interface**

```typescript
// src/orchestrator/agents/types.ts

export interface Agent {
  readonly name: string;
  readonly displayName: string;
  readonly role: string;
  readonly color: string;
  invoke(prompt: string): Promise<string>;
}
```

- [ ] **Step 4: Implement CliAgent**

```typescript
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
```

- [ ] **Step 5: Implement ApiAgent**

```typescript
// src/orchestrator/agents/api-agent.ts

import type { ProviderConfig } from "../../shared/types.js";
import type { Agent } from "./types.js";

export class ApiAgent implements Agent {
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
    const apiKey = this.resolveApiKey();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`${this.config.displayName} API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || "";
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`${this.config.displayName} API timed out`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private resolveApiKey(): string {
    const key = this.config.apiKey;
    if (!key) throw new Error(`No API key configured for ${this.config.displayName}`);

    if (key.startsWith("{{") && key.endsWith("}}")) {
      const envVar = key.slice(2, -2);
      const resolved = process.env[envVar];
      if (!resolved) throw new Error(`Environment variable ${envVar} not set`);
      return resolved;
    }

    return key;
  }
}
```

- [ ] **Step 6: Implement factory**

```typescript
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
```

- [ ] **Step 7: Run test to verify it passes**

```bash
pnpm vitest run tests/orchestrator/agents.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: add CliAgent, ApiAgent, and factory for multi-provider support"
```

---

## Task 7: Provider Registry

**Files:**
- Create: `src/orchestrator/agents/providers.ts`
- Create: `tests/orchestrator/providers.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import {
  DEFAULT_PROVIDERS,
  getProvider,
  getProviders,
  listProviders,
} from "../../src/orchestrator/agents/providers.js";

describe("providers registry", () => {
  it("should include claude, codex, glm, kimi in defaults", () => {
    const names = DEFAULT_PROVIDERS.map((p) => p.name);
    expect(names).toContain("claude");
    expect(names).toContain("codex");
    expect(names).toContain("glm");
    expect(names).toContain("kimi");
  });

  it("claude should be CLI type with correct command", () => {
    const claude = getProvider("claude");
    expect(claude).toBeDefined();
    expect(claude!.type).toBe("cli");
    expect(claude!.command).toBe("claude");
    expect(claude!.role).toBe("pragmatic architect");
  });

  it("codex should be CLI type", () => {
    const codex = getProvider("codex");
    expect(codex).toBeDefined();
    expect(codex!.type).toBe("cli");
    expect(codex!.command).toBe("codex");
  });

  it("glm should be API type with correct endpoint and model", () => {
    const glm = getProvider("glm");
    expect(glm).toBeDefined();
    expect(glm!.type).toBe("api");
    expect(glm!.baseUrl).toBe("https://api.z.ai/api/coding/paas/v4");
    expect(glm!.model).toBe("glm-5.2");
    expect(glm!.apiKey).toBe("{{GLM_API_KEY}}");
  });

  it("kimi should be API type with correct endpoint and model", () => {
    const kimi = getProvider("kimi");
    expect(kimi).toBeDefined();
    expect(kimi!.type).toBe("api");
    expect(kimi!.baseUrl).toBe("https://api.kimi.com/coding/v1");
    expect(kimi!.model).toBe("kimi-k2.7-code");
    expect(kimi!.apiKey).toBe("{{KIMI_API_KEY}}");
  });

  it("listProviders should return all providers", () => {
    const providers = listProviders();
    expect(providers.length).toBeGreaterThanOrEqual(4);
  });

  it("getProviders should return multiple by name", () => {
    const providers = getProviders(["claude", "kimi"]);
    expect(providers).toHaveLength(2);
    expect(providers.map((p) => p.name)).toEqual(["claude", "kimi"]);
  });

  it("getProvider should return undefined for unknown", () => {
    expect(getProvider("unknown")).toBeUndefined();
  });

  it("getProviders should skip unknown providers", () => {
    const providers = getProviders(["claude", "unknown", "kimi"]);
    expect(providers).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/orchestrator/providers.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement providers registry**

```typescript
// src/orchestrator/agents/providers.ts

import type { ProviderConfig } from "../../shared/types.js";

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    name: "claude",
    displayName: "Claude",
    type: "cli",
    command: "claude",
    args: ["-p", "{{prompt}}", "--output-format", "json"],
    responseParser: "json-result",
    role: "pragmatic architect",
    color: "blue",
    timeoutMs: 60_000,
  },
  {
    name: "codex",
    displayName: "Codex",
    type: "cli",
    command: "codex",
    args: ["-q", "{{prompt}}"],
    responseParser: "plain",
    role: "implementation-focused engineer",
    color: "green",
    timeoutMs: 60_000,
  },
  {
    name: "glm",
    displayName: "GLM",
    type: "api",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    apiKey: "{{GLM_API_KEY}}",
    model: "glm-5.2",
    role: "systems thinker",
    color: "magenta",
    timeoutMs: 60_000,
  },
  {
    name: "kimi",
    displayName: "Kimi",
    type: "api",
    baseUrl: "https://api.kimi.com/coding/v1",
    apiKey: "{{KIMI_API_KEY}}",
    model: "kimi-k2.7-code",
    role: "detail-oriented reviewer",
    color: "cyan",
    timeoutMs: 60_000,
  },
];

export function getProvider(name: string): ProviderConfig | undefined {
  return DEFAULT_PROVIDERS.find((p) => p.name === name);
}

export function getProviders(names: string[]): ProviderConfig[] {
  return names
    .map((n) => getProvider(n))
    .filter((p): p is ProviderConfig => p !== undefined);
}

export function listProviders(): ProviderConfig[] {
  return DEFAULT_PROVIDERS;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/orchestrator/providers.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add provider registry with Claude, Codex, GLM, Kimi"
```

---

## Task 8: Prompt Templates

**Files:**
- Create: `src/orchestrator/prompts.ts`
- Create: `tests/orchestrator/prompts.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { buildAgentPrompt, buildSystemPrompt } from "../../src/orchestrator/prompts.js";
import type { Message, ProviderConfig } from "../../src/shared/types.js";

const claudeConfig: ProviderConfig = {
  name: "claude",
  displayName: "Claude",
  type: "cli",
  command: "claude",
  args: [],
  responseParser: "plain",
  role: "pragmatic architect",
  color: "blue",
  timeoutMs: 60_000,
};

const glmConfig: ProviderConfig = {
  name: "glm",
  displayName: "GLM",
  type: "api",
  role: "systems thinker",
  color: "magenta",
  timeoutMs: 60_000,
};

const messages: Message[] = [
  {
    id: "1",
    sessionId: "s1",
    agent: "claude",
    type: "proposal",
    content: "Use REST with JWT",
    round: 1,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "2",
    sessionId: "s1",
    agent: "codex",
    type: "critique",
    content: "Add refresh token rotation",
    round: 1,
    createdAt: "2026-01-01T00:01:00Z",
  },
];

describe("prompts", () => {
  it("buildSystemPrompt should include role from provider config", () => {
    const prompt = buildSystemPrompt(claudeConfig);
    expect(prompt).toContain("pragmatic architect");
    expect(prompt).toContain("APPROVE");
    expect(prompt).toContain("REJECT");
  });

  it("buildSystemPrompt should work for GLM", () => {
    const prompt = buildSystemPrompt(glmConfig);
    expect(prompt).toContain("systems thinker");
  });

  it("buildAgentPrompt should include topic, round, and messages", () => {
    const prompt = buildAgentPrompt({
      topic: "Design auth API",
      currentRound: 1,
      maxRounds: 5,
      messages,
      agentRole: "pragmatic architect",
      agentName: "Claude",
    });
    expect(prompt).toContain("Design auth API");
    expect(prompt).toContain("Round 1 of 5");
    expect(prompt).toContain("Use REST with JWT");
    expect(prompt).toContain("Add refresh token rotation");
    expect(prompt).toContain("Claude");
  });

  it("buildAgentPrompt should handle empty messages", () => {
    const prompt = buildAgentPrompt({
      topic: "Design auth API",
      currentRound: 1,
      maxRounds: 5,
      messages: [],
      agentRole: "systems thinker",
      agentName: "GLM",
    });
    expect(prompt).toContain("Design auth API");
    expect(prompt).toContain("No prior messages");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/orchestrator/prompts.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement prompt templates**

```typescript
// src/orchestrator/prompts.ts

import type { Message, ProviderConfig } from "../shared/types.js";

export function buildSystemPrompt(provider: ProviderConfig): string {
  return `You are a ${provider.role} participating in a structured negotiation.

Your goal is to collaboratively produce a high-quality software plan through debate.

Rules:
- Be constructive and specific in your critiques
- Reference prior points when responding
- When you believe the plan is ready, end your response with exactly: APPROVE
- If you see significant issues, end your response with exactly: REJECT followed by your reasons
- Do NOT approve a plan that has unresolved concerns
- Keep responses focused and actionable`;
}

export function buildAgentPrompt(input: {
  topic: string;
  currentRound: number;
  maxRounds: number;
  messages: Message[];
  agentRole: string;
  agentName: string;
}): string {
  const { topic, currentRound, maxRounds, messages, agentRole, agentName } = input;

  let transcript: string;
  if (messages.length === 0) {
    transcript = "No prior messages. You are starting the negotiation.";
  } else {
    transcript = messages
      .map((m) => `[Round ${m.round}] ${m.agent} (${m.type}): ${m.content}`)
      .join("\n\n");
  }

  return `Topic: ${topic}
Round: ${currentRound} of ${maxRounds}
Your role: ${agentName} (${agentRole})

## Conversation History

${transcript}

## Your Task

Review the conversation above and either:
1. Propose a plan or revision that addresses all feedback
2. Critique the latest proposal with specific improvements
3. If you're satisfied with the current state, end with APPROVE
4. If there are blocking issues, end with REJECT and explain why`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/orchestrator/prompts.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add prompt templates with dynamic provider roles"
```

---

## Task 9: Negotiation Loop with Event Emitter

**Files:**
- Create: `src/orchestrator/negotiate.ts`
- Create: `tests/orchestrator/negotiate.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Negotiator, type NegotiationEvent } from "../../src/orchestrator/negotiate.js";
import type { Session } from "../../src/shared/types.js";

const mockStore = {
  createSession: vi.fn(),
  getSession: vi.fn(),
  updateSessionState: vi.fn(),
  updateSessionRound: vi.fn(),
  postMessage: vi.fn(),
  getMessages: vi.fn(),
  setApproval: vi.fn(),
  resetApprovals: vi.fn(),
};

const mockClaude = { name: "claude", displayName: "Claude", role: "architect", color: "blue", invoke: vi.fn() };
const mockCodex = { name: "codex", displayName: "Codex", role: "engineer", color: "green", invoke: vi.fn() };
const mockGlm = { name: "glm", displayName: "GLM", role: "thinker", color: "magenta", invoke: vi.fn() };

const claudeConfig = { name: "claude", displayName: "Claude", type: "cli" as const, role: "architect", color: "blue", timeoutMs: 60000 };
const codexConfig = { name: "codex", displayName: "Codex", type: "cli" as const, role: "engineer", color: "green", timeoutMs: 60000 };

describe("Negotiator", () => {
  let negotiator: Negotiator;
  let events: NegotiationEvent[];

  beforeEach(() => {
    vi.clearAllMocks();
    events = [];
  });

  it("should run a 2-agent negotiation and return APPROVED", async () => {
    const session: Session = {
      id: "s1", topic: "Design auth API", state: "CREATED",
      currentRound: 0, maxRounds: 5, agents: ["claude", "codex"],
      approvals: { claude: false, codex: false },
      createdAt: "2026-01-01T00:00:00Z",
    };

    mockStore.createSession.mockReturnValue(session);
    mockStore.getMessages.mockReturnValue([]);
    mockStore.postMessage.mockImplementation(
      (_sid: string, agent: string, type: string, content: string, round: number) => ({
        id: "msg-1", sessionId: "s1", agent, type, content, round,
        createdAt: new Date().toISOString(),
      })
    );

    mockClaude.invoke.mockResolvedValue("Use REST with JWT. APPROVE");
    mockCodex.invoke.mockResolvedValue("Agreed. APPROVE");

    negotiator = new Negotiator(
      mockStore as any,
      [mockClaude, mockCodex],
      [claudeConfig, codexConfig],
      (e) => events.push(e)
    );

    const result = await negotiator.run("Design auth API", 5);
    expect(result.status).toBe("APPROVED");
    expect(mockClaude.invoke).toHaveBeenCalledOnce();
    expect(mockCodex.invoke).toHaveBeenCalledOnce();
  });

  it("should emit round-start, agent-response, round-end, complete events", async () => {
    const session: Session = {
      id: "s1", topic: "Design auth API", state: "CREATED",
      currentRound: 0, maxRounds: 5, agents: ["claude", "codex"],
      approvals: { claude: false, codex: false },
      createdAt: "2026-01-01T00:00:00Z",
    };

    mockStore.createSession.mockReturnValue(session);
    mockStore.getMessages.mockReturnValue([]);
    mockStore.postMessage.mockImplementation(
      (_sid: string, agent: string, type: string, content: string, round: number) => ({
        id: "msg-1", sessionId: "s1", agent, type, content, round,
        createdAt: new Date().toISOString(),
      })
    );

    mockClaude.invoke.mockResolvedValue("Plan. APPROVE");
    mockCodex.invoke.mockResolvedValue("Good. APPROVE");

    negotiator = new Negotiator(
      mockStore as any,
      [mockClaude, mockCodex],
      [claudeConfig, codexConfig],
      (e) => events.push(e)
    );

    await negotiator.run("Design auth API", 5);

    expect(events[0]).toEqual({ type: "round-start", round: 1, maxRounds: 5 });
    expect(events.some((e) => e.type === "agent-response" && e.agent === "claude")).toBe(true);
    expect(events.some((e) => e.type === "agent-response" && e.agent === "codex")).toBe(true);
    expect(events.some((e) => e.type === "round-end")).toBe(true);
    expect(events.some((e) => e.type === "complete" && e.status === "APPROVED")).toBe(true);
  });

  it("should run multiple rounds when agents reject", async () => {
    const session: Session = {
      id: "s1", topic: "Design auth API", state: "CREATED",
      currentRound: 0, maxRounds: 2, agents: ["claude", "codex"],
      approvals: { claude: false, codex: false },
      createdAt: "2026-01-01T00:00:00Z",
    };

    mockStore.createSession.mockReturnValue(session);
    mockStore.getMessages.mockReturnValue([]);
    mockStore.postMessage.mockImplementation(
      (_sid: string, agent: string, type: string, content: string, round: number) => ({
        id: "msg-1", sessionId: "s1", agent, type, content, round,
        createdAt: new Date().toISOString(),
      })
    );

    mockClaude.invoke
      .mockResolvedValueOnce("Initial plan. REJECT: missing error handling")
      .mockResolvedValueOnce("Added error handling. APPROVE");
    mockCodex.invoke
      .mockResolvedValueOnce("Need rate limiting. REJECT")
      .mockResolvedValueOnce("Rate limiting added. APPROVE");

    negotiator = new Negotiator(mockStore as any, [mockClaude, mockCodex], [claudeConfig, codexConfig]);

    const result = await negotiator.run("Design auth API", 2);
    expect(result.status).toBe("APPROVED");
    expect(mockClaude.invoke).toHaveBeenCalledTimes(2);
    expect(mockCodex.invoke).toHaveBeenCalledTimes(2);
  });

  it("should return EXHAUSTED when max rounds reached", async () => {
    const session: Session = {
      id: "s1", topic: "Design auth API", state: "CREATED",
      currentRound: 0, maxRounds: 1, agents: ["claude", "codex"],
      approvals: { claude: false, codex: false },
      createdAt: "2026-01-01T00:00:00Z",
    };

    mockStore.createSession.mockReturnValue(session);
    mockStore.getMessages.mockReturnValue([]);
    mockStore.postMessage.mockImplementation(
      (_sid: string, agent: string, type: string, content: string, round: number) => ({
        id: "msg-1", sessionId: "s1", agent, type, content, round,
        createdAt: new Date().toISOString(),
      })
    );

    mockClaude.invoke.mockResolvedValue("Plan A. REJECT");
    mockCodex.invoke.mockResolvedValue("Plan B. REJECT");

    negotiator = new Negotiator(mockStore as any, [mockClaude, mockCodex], [claudeConfig, codexConfig], (e) => events.push(e));

    const result = await negotiator.run("Design auth API", 1);
    expect(result.status).toBe("EXHAUSTED");
    expect(events.some((e) => e.type === "complete" && e.status === "EXHAUSTED")).toBe(true);
  });

  it("should emit agent-error event on agent failure", async () => {
    const session: Session = {
      id: "s1", topic: "Design auth API", state: "CREATED",
      currentRound: 0, maxRounds: 1, agents: ["claude", "codex"],
      approvals: { claude: false, codex: false },
      createdAt: "2026-01-01T00:00:00Z",
    };

    mockStore.createSession.mockReturnValue(session);
    mockStore.getMessages.mockReturnValue([]);
    mockStore.postMessage.mockImplementation(
      (_sid: string, agent: string, type: string, content: string, round: number) => ({
        id: "msg-1", sessionId: "s1", agent, type, content, round,
        createdAt: new Date().toISOString(),
      })
    );

    mockClaude.invoke.mockRejectedValue(new Error("Claude CLI timed out"));
    mockCodex.invoke.mockResolvedValue("Plan B. APPROVE");

    negotiator = new Negotiator(mockStore as any, [mockClaude, mockCodex], [claudeConfig, codexConfig], (e) => events.push(e));

    await negotiator.run("Design auth API", 1);

    const errorEvent = events.find((e) => e.type === "agent-error");
    expect(errorEvent).toBeDefined();
  });

  it("should support 3 agents in a round", async () => {
    const session: Session = {
      id: "s1", topic: "Design auth API", state: "CREATED",
      currentRound: 0, maxRounds: 5,
      agents: ["claude", "codex", "glm"],
      approvals: { claude: false, codex: false, glm: false },
      createdAt: "2026-01-01T00:00:00Z",
    };

    const glmConfig = { name: "glm", displayName: "GLM", type: "api" as const, role: "thinker", color: "magenta", timeoutMs: 60000 };

    mockStore.createSession.mockReturnValue(session);
    mockStore.getMessages.mockReturnValue([]);
    mockStore.postMessage.mockImplementation(
      (_sid: string, agent: string, type: string, content: string, round: number) => ({
        id: "msg-1", sessionId: "s1", agent, type, content, round,
        createdAt: new Date().toISOString(),
      })
    );

    mockClaude.invoke.mockResolvedValue("Plan. APPROVE");
    mockCodex.invoke.mockResolvedValue("Good. APPROVE");
    mockGlm.invoke.mockResolvedValue("Solid. APPROVE");

    negotiator = new Negotiator(
      mockStore as any,
      [mockClaude, mockCodex, mockGlm],
      [claudeConfig, codexConfig, glmConfig]
    );

    const result = await negotiator.run("Design auth API", 5);
    expect(result.status).toBe("APPROVED");
    expect(mockGlm.invoke).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/orchestrator/negotiate.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the Negotiator**

```typescript
// src/orchestrator/negotiate.ts

import type { Store } from "../mcp-server/store.js";
import type { Agent } from "./agents/types.js";
import type { ProviderConfig, Message } from "../shared/types.js";
import { buildAgentPrompt, buildSystemPrompt } from "./prompts.js";

export type NegotiationEvent =
  | { type: "round-start"; round: number; maxRounds: number }
  | { type: "agent-response"; agent: string; content: string; messageType: string }
  | { type: "agent-error"; agent: string; error: string }
  | { type: "round-end"; round: number; approvals: Record<string, boolean> }
  | { type: "complete"; status: "APPROVED" | "EXHAUSTED"; finalPlan: string | null };

export interface NegotiationResult {
  sessionId: string;
  status: "APPROVED" | "EXHAUSTED";
  finalPlan: string | null;
  roundsCompleted: number;
}

export class Negotiator {
  private onEvent: (event: NegotiationEvent) => void;

  constructor(
    private store: Store,
    private agents: Agent[],
    private providers: ProviderConfig[],
    onEvent?: (event: NegotiationEvent) => void
  ) {
    this.onEvent = onEvent ?? (() => {});
  }

  async run(topic: string, maxRounds: number): Promise<NegotiationResult> {
    const agentNames = this.agents.map((a) => a.name);
    const session = this.store.createSession(topic, maxRounds, agentNames);
    let roundsCompleted = 0;

    for (let round = 1; round <= maxRounds; round++) {
      this.store.updateSessionState(session.id, "ROUND_IN_PROGRESS");
      this.store.updateSessionRound(session.id, round);
      roundsCompleted = round;

      this.onEvent({ type: "round-start", round, maxRounds });
      this.store.postMessage(session.id, "system", "system", `Round ${round} begins`, round);

      for (let i = 0; i < this.agents.length; i++) {
        const agent = this.agents[i];
        const provider = this.providers[i];
        const messages = this.store.getMessages(session.id);
        await this.runAgentTurn(session.id, agent, provider, topic, round, maxRounds, messages);
      }

      const roundMessages = this.store.getMessages(session.id);
      const approvals = this.parseApprovals(roundMessages, round, agentNames);

      for (const [name, approved] of Object.entries(approvals)) {
        this.store.setApproval(session.id, name, approved);
      }

      this.onEvent({ type: "round-end", round, approvals });

      if (Object.values(approvals).every(Boolean)) {
        this.store.updateSessionState(session.id, "APPROVED");
        const proposals = roundMessages.filter((m) => m.type === "proposal");
        const finalPlan = proposals.length > 0 ? proposals[proposals.length - 1].content : null;
        this.onEvent({ type: "complete", status: "APPROVED", finalPlan });
        return { sessionId: session.id, status: "APPROVED", finalPlan, roundsCompleted };
      }

      this.store.resetApprovals(session.id);
    }

    this.store.updateSessionState(session.id, "AWAITING_APPROVAL");
    const allMessages = this.store.getMessages(session.id);
    const proposals = allMessages.filter((m) => m.type === "proposal");
    const finalPlan = proposals.length > 0 ? proposals[proposals.length - 1].content : null;
    this.onEvent({ type: "complete", status: "EXHAUSTED", finalPlan });

    return { sessionId: session.id, status: "EXHAUSTED", finalPlan, roundsCompleted };
  }

  private async runAgentTurn(
    sessionId: string,
    agent: Agent,
    provider: ProviderConfig,
    topic: string,
    round: number,
    maxRounds: number,
    messages: Message[]
  ): Promise<void> {
    const systemPrompt = buildSystemPrompt(provider);
    const userPrompt = buildAgentPrompt({
      topic,
      currentRound: round,
      maxRounds,
      messages,
      agentRole: provider.role,
      agentName: provider.displayName,
    });
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    try {
      const response = await agent.invoke(fullPrompt);
      const messageType = this.parseMessageType(response);
      this.store.postMessage(sessionId, agent.name, messageType, response, round);
      this.onEvent({ type: "agent-response", agent: agent.name, content: response, messageType });
    } catch (err: any) {
      const errorMsg = `${agent.name} failed: ${err.message}`;
      this.store.postMessage(sessionId, "system", "system", errorMsg, round);
      this.onEvent({ type: "agent-error", agent: agent.name, error: err.message });
    }
  }

  private parseMessageType(response: string): "approval" | "rejection" | "proposal" {
    const upper = response.toUpperCase();
    if (upper.includes("APPROVE") && !upper.includes("REJECT")) return "approval";
    if (upper.includes("REJECT")) return "rejection";
    return "proposal";
  }

  private parseApprovals(
    messages: Message[],
    round: number,
    agentNames: string[]
  ): Record<string, boolean> {
    const roundMessages = messages.filter((m) => m.round === round);
    const approvals: Record<string, boolean> = {};
    for (const name of agentNames) {
      approvals[name] = roundMessages.some((m) => m.agent === name && m.type === "approval");
    }
    return approvals;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/orchestrator/negotiate.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add negotiation loop with N-agent support and event emitter"
```

---

## Task 10: Ink Terminal UI

**Files:**
- Create: `src/orchestrator/ui/NegotiationApp.tsx`
- Create: `src/orchestrator/ui/index.ts`
- Create: `tests/orchestrator/ui.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { formatMessage, formatStatusBar } from "../../src/orchestrator/ui/NegotiationApp.js";
import type { NegotiationEvent } from "../../src/orchestrator/negotiate.js";
import type { ProviderConfig } from "../../src/shared/types.js";

const providers: ProviderConfig[] = [
  { name: "claude", displayName: "Claude", type: "cli", role: "architect", color: "blue", timeoutMs: 60000 },
  { name: "codex", displayName: "Codex", type: "cli", role: "engineer", color: "green", timeoutMs: 60000 },
  { name: "glm", displayName: "GLM", type: "api", role: "thinker", color: "magenta", timeoutMs: 60000 },
];

describe("UI formatting helpers", () => {
  it("formatMessage should format agent response with label and color", () => {
    const event: NegotiationEvent = {
      type: "agent-response",
      agent: "claude",
      content: "Use REST with JWT",
      messageType: "proposal",
    };
    const formatted = formatMessage(event, providers);
    expect(formatted.label).toBe("Claude");
    expect(formatted.content).toBe("Use REST with JWT");
    expect(formatted.color).toBe("blue");
  });

  it("formatMessage should format codex response", () => {
    const event: NegotiationEvent = {
      type: "agent-response",
      agent: "codex",
      content: "Add rate limiting",
      messageType: "critique",
    };
    const formatted = formatMessage(event, providers);
    expect(formatted.label).toBe("Codex");
    expect(formatted.color).toBe("green");
  });

  it("formatMessage should format glm response", () => {
    const event: NegotiationEvent = {
      type: "agent-response",
      agent: "glm",
      content: "Think holistically",
      messageType: "critique",
    };
    const formatted = formatMessage(event, providers);
    expect(formatted.label).toBe("GLM");
    expect(formatted.color).toBe("magenta");
  });

  it("formatMessage should format system error", () => {
    const event: NegotiationEvent = {
      type: "agent-error",
      agent: "claude",
      error: "CLI timed out",
    };
    const formatted = formatMessage(event, providers);
    expect(formatted.label).toBe("System");
    expect(formatted.color).toBe("yellow");
    expect(formatted.content).toContain("timed out");
  });

  it("formatMessage should format round-start", () => {
    const event: NegotiationEvent = {
      type: "round-start",
      round: 2,
      maxRounds: 5,
    };
    const formatted = formatMessage(event, providers);
    expect(formatted.content).toContain("Round 2 of 5");
  });

  it("formatMessage should format complete APPROVED", () => {
    const event: NegotiationEvent = {
      type: "complete",
      status: "APPROVED",
      finalPlan: "The plan",
    };
    const formatted = formatMessage(event, providers);
    expect(formatted.content).toContain("APPROVED");
    expect(formatted.color).toBe("green");
  });

  it("formatStatusBar should show round and all agent approvals", () => {
    const status = formatStatusBar("Design auth API", 2, 5, providers, {
      claude: true,
      codex: false,
      glm: false,
    });
    expect(status).toContain("Round 2/5");
    expect(status).toContain("Design auth API");
    expect(status).toContain("Claude");
    expect(status).toContain("Codex");
    expect(status).toContain("GLM");
  });

  it("formatStatusBar should show APPROVED when all approved", () => {
    const status = formatStatusBar("Topic", 1, 5, providers, {
      claude: true,
      codex: true,
      glm: true,
    });
    expect(status).toContain("APPROVED");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/orchestrator/ui.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement NegotiationApp component and helpers**

```tsx
// src/orchestrator/ui/NegotiationApp.tsx

import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { Spinner } from "@inkjs/ui";
import type { NegotiationEvent } from "../negotiate.js";
import type { ProviderConfig } from "../../shared/types.js";

interface FormattedMessage {
  label: string;
  content: string;
  color: string;
}

export function formatMessage(event: NegotiationEvent, providers: ProviderConfig[]): FormattedMessage {
  const providerMap = new Map(providers.map((p) => [p.name, p]));
  const getProvider = (name: string) => providerMap.get(name);

  if (event.type === "agent-response") {
    const p = getProvider(event.agent);
    return {
      label: p?.displayName ?? event.agent,
      content: event.content,
      color: p?.color ?? "white",
    };
  }
  if (event.type === "agent-error") {
    const p = getProvider(event.agent);
    return {
      label: "System",
      content: `${p?.displayName ?? event.agent} error: ${event.error}`,
      color: "yellow",
    };
  }
  if (event.type === "round-start") {
    return {
      label: "System",
      content: `--- Round ${event.round} of ${event.maxRounds} ---`,
      color: "yellow",
    };
  }
  if (event.type === "round-end") {
    const statuses = Object.entries(event.approvals)
      .map(([name, approved]) => {
        const p = getProvider(name);
        return `${p?.displayName ?? name}: ${approved ? "approved" : "pending"}`;
      })
      .join(", ");
    return {
      label: "System",
      content: `Round ${event.round} complete — ${statuses}`,
      color: "yellow",
    };
  }
  if (event.type === "complete") {
    return {
      label: "System",
      content: event.status === "APPROVED"
        ? "Plan APPROVED by all agents!"
        : "Max rounds reached. Plan needs manual review.",
      color: event.status === "APPROVED" ? "green" : "red",
    };
  }
  return { label: "System", content: "Unknown event", color: "white" };
}

export function formatStatusBar(
  topic: string,
  round: number,
  maxRounds: number,
  providers: ProviderConfig[],
  approvals: Record<string, boolean>
): string {
  const agentStatuses = providers
    .map((p) => `${approvals[p.name] ? "●" : "○"} ${p.displayName}`)
    .join(" ");
  const allApproved = Object.keys(approvals).length > 0 && Object.values(approvals).every(Boolean);
  const status = allApproved ? " APPROVED" : "";
  return `${topic} | Round ${round}/${maxRounds} | ${agentStatuses}${status}`;
}

interface NegotiationAppProps {
  topic: string;
  maxRounds: number;
  providers: ProviderConfig[];
  events: NegotiationEvent[];
  waitingFor: string | null;
  onComplete: () => void;
}

export function NegotiationApp({ topic, maxRounds, providers, events, waitingFor, onComplete }: NegotiationAppProps) {
  const [currentRound, setCurrentRound] = useState(0);
  const [approvals, setApprovals] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    for (const event of events) {
      if (event.type === "round-start") {
        setCurrentRound(event.round);
      }
      if (event.type === "round-end") {
        setApprovals(event.approvals);
      }
      if (event.type === "complete") {
        setDone(true);
      }
    }
  }, [events]);

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      onComplete();
    }
  });

  const displayEvents = events.filter(
    (e) => e.type === "agent-response" || e.type === "agent-error" || e.type === "round-start" || e.type === "complete"
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">
          {formatStatusBar(topic, currentRound, maxRounds, providers, approvals)}
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {displayEvents.map((event, i) => {
          const msg = formatMessage(event, providers);
          return (
            <Box key={i} flexDirection="column" marginBottom={1}>
              <Text bold color={msg.color}>
                [{msg.label}]
              </Text>
              <Text wrap="wrap">{msg.content}</Text>
            </Box>
          );
        })}
      </Box>

      {waitingFor && !done && (
        <Box marginTop={1}>
          <Spinner label={`Waiting for ${waitingFor}...`} />
        </Box>
      )}

      {done && (
        <Box marginTop={1}>
          <Text dimColor>Press q to exit</Text>
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Implement UI render entry**

```typescript
// src/orchestrator/ui/index.ts

import React from "react";
import { render } from "ink";
import { NegotiationApp, type NegotiationEvent } from "./NegotiationApp.js";
import type { ProviderConfig } from "../../shared/types.js";

export interface UIHandle {
  pushEvent: (event: NegotiationEvent) => void;
  setWaitingFor: (agent: string | null) => void;
  unmount: () => void;
}

export function startUI(
  topic: string,
  maxRounds: number,
  providers: ProviderConfig[],
  onComplete: () => void
): UIHandle {
  let events: NegotiationEvent[] = [];
  let waitingFor: string | null = null;
  let forceUpdate: () => void = () => {};

  function Wrapper() {
    const [, setState] = React.useState(0);
    forceUpdate = () => setState((n) => n + 1);
    return React.createElement(NegotiationApp, {
      topic,
      maxRounds,
      providers,
      events: [...events],
      waitingFor,
      onComplete,
    });
  }

  const { unmount } = render(React.createElement(Wrapper));

  return {
    pushEvent(event: NegotiationEvent) {
      events.push(event);
      forceUpdate();
    },
    setWaitingFor(agent: string | null) {
      waitingFor = agent;
      forceUpdate();
    },
    unmount,
  };
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run tests/orchestrator/ui.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add Ink terminal UI with dynamic provider colors"
```

---

## Task 11: Plan Merger

**Files:**
- Create: `src/orchestrator/merger.ts`
- Create: `tests/orchestrator/merger.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { mergePlans } from "../../src/orchestrator/merger.js";
import type { Message, ProviderConfig } from "../../src/shared/types.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const providers: ProviderConfig[] = [
  { name: "claude", displayName: "Claude", type: "cli", role: "architect", color: "blue", timeoutMs: 60000 },
  { name: "codex", displayName: "Codex", type: "cli", role: "engineer", color: "green", timeoutMs: 60000 },
  { name: "glm", displayName: "GLM", type: "api", role: "thinker", color: "magenta", timeoutMs: 60000 },
];

describe("mergePlans", () => {
  it("should merge two proposals into a combined plan", async () => {
    const { execFile } = await import("node:child_process");
    const mockExecFile = vi.mocked(execFile);

    mockExecFile.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(null, JSON.stringify({ result: "Merged plan: REST + rate limiting + error handling." }), "");
    }) as any);

    const messages: Message[] = [
      {
        id: "1", sessionId: "s1", agent: "claude", type: "proposal",
        content: "Use REST with JWT tokens for auth.", round: 2, createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "2", sessionId: "s1", agent: "codex", type: "proposal",
        content: "Add rate limiting and comprehensive error handling.", round: 2, createdAt: "2026-01-01T00:01:00Z",
      },
    ];

    const result = await mergePlans(messages, providers);
    expect(result).toContain("Merged plan");
  });

  it("should merge 3 proposals", async () => {
    const { execFile } = await import("node:child_process");
    const mockExecFile = vi.mocked(execFile);

    mockExecFile.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(null, JSON.stringify({ result: "Merged plan from 3 proposals." }), "");
    }) as any);

    const messages: Message[] = [
      { id: "1", sessionId: "s1", agent: "claude", type: "proposal", content: "Plan A", round: 1, createdAt: "" },
      { id: "2", sessionId: "s1", agent: "codex", type: "proposal", content: "Plan B", round: 1, createdAt: "" },
      { id: "3", sessionId: "s1", agent: "glm", type: "proposal", content: "Plan C", round: 1, createdAt: "" },
    ];

    const result = await mergePlans(messages, providers);
    expect(result).toContain("Merged plan from 3");
  });

  it("should return last proposal if only one exists", async () => {
    const messages: Message[] = [
      {
        id: "1", sessionId: "s1", agent: "claude", type: "proposal",
        content: "Use REST with JWT.", round: 1, createdAt: "2026-01-01T00:00:00Z",
      },
    ];

    const result = await mergePlans(messages, providers);
    expect(result).toBe("Use REST with JWT.");
  });

  it("should return null if no proposals exist", async () => {
    const result = await mergePlans([], providers);
    expect(result).toBeNull();
  });

  it("should fallback to concatenation on merge CLI error", async () => {
    const { execFile } = await import("node:child_process");
    const mockExecFile = vi.mocked(execFile);

    mockExecFile.mockImplementation(((_cmd: any, _args: any, _opts: any, cb: any) => {
      cb(new Error("CLI failed"), "", "");
    }) as any);

    const messages: Message[] = [
      { id: "1", sessionId: "s1", agent: "claude", type: "proposal", content: "Plan A", round: 1, createdAt: "" },
      { id: "2", sessionId: "s1", agent: "codex", type: "proposal", content: "Plan B", round: 1, createdAt: "" },
    ];

    const result = await mergePlans(messages, providers);
    expect(result).toContain("Plan A");
    expect(result).toContain("Plan B");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/orchestrator/merger.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement plan merger**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/orchestrator/merger.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add plan merger supporting N proposals"
```

---

## Task 12: Orchestrator CLI Entry Point

**Files:**
- Create: `src/orchestrator/index.ts`

- [ ] **Step 1: Implement the CLI with Ink UI integration**

```typescript
// src/orchestrator/index.ts

#!/usr/bin/env node

import { Command } from "commander";
import { Store } from "../mcp-server/store.js";
import { createAgent } from "./agents/factory.js";
import { getProviders, listProviders } from "./agents/providers.js";
import { Negotiator, type NegotiationEvent } from "./negotiate.js";
import { mergePlans } from "./merger.js";
import { startUI } from "./ui/index.js";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const DATA_DIR = join(homedir(), ".agents-bus");
const PLANS_DIR = join(DATA_DIR, "plans");
mkdirSync(PLANS_DIR, { recursive: true });

const program = new Command();

program
  .name("agents-bus")
  .description("Negotiate software plans between AI agents")
  .version("0.1.0");

program
  .command("negotiate")
  .description("Start a new negotiation session")
  .argument("<topic>", "The topic to negotiate")
  .option("-r, --rounds <number>", "Maximum rounds", "5")
  .option("-a, --agents <agents>", "Comma-separated agent names", "claude,codex")
  .option("--no-ui", "Disable terminal UI, use plain output")
  .action(async (topic: string, options: { rounds: string; agents: string; ui: boolean }) => {
    const agentNames = options.agents.split(",").map((a) => a.trim());
    const providers = getProviders(agentNames);

    if (providers.length === 0) {
      console.error("No valid agents specified. Available: " + listProviders().map((p) => p.name).join(", "));
      process.exit(1);
    }

    const agents = providers.map((p) => createAgent(p));
    const maxRounds = parseInt(options.rounds, 10);
    const store = new Store(join(DATA_DIR, "sessions.db"));

    let uiHandle: ReturnType<typeof startUI> | null = null;

    if (options.ui) {
      uiHandle = startUI(topic, maxRounds, providers, () => {
        uiHandle?.unmount();
        store.close();
        process.exit(0);
      });
    }

    const onEvent = (event: NegotiationEvent) => {
      if (uiHandle) {
        uiHandle.pushEvent(event);
        if (event.type === "round-start") {
          uiHandle.setWaitingFor(providers[0]?.displayName ?? null);
        }
        if (event.type === "agent-response") {
          const idx = providers.findIndex((p) => p.name === event.agent);
          const next = providers[idx + 1];
          uiHandle.setWaitingFor(next ? next.displayName : null);
        }
        if (event.type === "agent-error") {
          const idx = providers.findIndex((p) => p.name === event.agent);
          const next = providers[idx + 1];
          uiHandle.setWaitingFor(next ? next.displayName : null);
        }
        if (event.type === "complete") {
          uiHandle.setWaitingFor(null);
        }
      } else {
        if (event.type === "round-start") {
          console.log(`\n--- Round ${event.round}/${event.maxRounds} ---`);
        }
        if (event.type === "agent-response") {
          console.log(`\n[${event.agent}] (${event.messageType}):`);
          console.log(event.content);
        }
        if (event.type === "agent-error") {
          console.error(`\n[${event.agent}] ERROR: ${event.error}`);
        }
        if (event.type === "complete") {
          console.log(`\n=== ${event.status} ===`);
        }
      }
    };

    const negotiator = new Negotiator(store, agents, providers, onEvent);
    const result = await negotiator.run(topic, maxRounds);

    let finalPlan = result.finalPlan;

    if (result.status === "EXHAUSTED") {
      const messages = store.getMessages(result.sessionId);
      finalPlan = await mergePlans(messages, providers);
    }

    if (finalPlan) {
      const planPath = join(PLANS_DIR, `${result.sessionId}.md`);
      writeFileSync(planPath, `# ${topic}\n\n${finalPlan}`, "utf-8");

      if (!uiHandle) {
        console.log(`\nPlan saved to: ${planPath}`);
      }
    }

    if (uiHandle) {
      uiHandle.pushEvent({
        type: "complete",
        status: result.status,
        finalPlan,
      });
    }

    if (!uiHandle) {
      store.close();
    }
  });

program
  .command("list")
  .description("List all negotiation sessions")
  .action(() => {
    const store = new Store(join(DATA_DIR, "sessions.db"));
    const sessions = store.listSessions();
    if (sessions.length === 0) {
      console.log("No sessions found.");
    } else {
      for (const s of sessions) {
        console.log(`${s.id} | ${s.state} | Round ${s.currentRound}/${s.maxRounds} | ${s.topic}`);
      }
    }
    store.close();
  });

program
  .command("view")
  .description("View session transcript")
  .argument("<session-id>", "Session ID to view")
  .action((sessionId: string) => {
    const store = new Store(join(DATA_DIR, "sessions.db"));
    const session = store.getSession(sessionId);
    if (!session) {
      console.error(`Session ${sessionId} not found.`);
      process.exit(1);
    }

    console.log(`Session: ${session.id}`);
    console.log(`Topic: ${session.topic}`);
    console.log(`State: ${session.state}`);
    console.log(`Round: ${session.currentRound}/${session.maxRounds}`);
    console.log(`Agents: ${session.agents.join(", ")}`);
    console.log(`Approvals: ${JSON.stringify(session.approvals)}`);
    console.log("\n--- Transcript ---\n");

    const messages = store.getMessages(sessionId);
    for (const m of messages) {
      console.log(`[${m.agent}] (${m.type}, round ${m.round}):`);
      console.log(m.content);
      console.log();
    }

    store.close();
  });

program
  .command("resume")
  .description("Resume an existing session")
  .argument("<session-id>", "Session ID to resume")
  .action(async (sessionId: string) => {
    const store = new Store(join(DATA_DIR, "sessions.db"));
    const session = store.getSession(sessionId);
    if (!session) {
      console.error(`Session ${sessionId} not found.`);
      process.exit(1);
    }

    if (session.state === "APPROVED") {
      console.log("Session already approved.");
      store.close();
      return;
    }

    const remaining = session.maxRounds - session.currentRound;
    if (remaining <= 0) {
      console.log("Max rounds reached. Merging proposals...");
      const messages = store.getMessages(sessionId);
      const providers = getProviders(session.agents);
      const merged = await mergePlans(messages, providers);
      if (merged) {
        const planPath = join(PLANS_DIR, `${sessionId}.md`);
        writeFileSync(planPath, `# ${session.topic}\n\n${merged}`, "utf-8");
        console.log(`Plan saved to: ${planPath}`);
      }
      store.close();
      return;
    }

    console.log(`Resuming "${session.topic}" (${remaining} rounds remaining)`);
    const providers = getProviders(session.agents);
    const agents = providers.map((p) => createAgent(p));
    const negotiator = new Negotiator(store, agents, providers);
    const result = await negotiator.run(session.topic, remaining);
    console.log(`Status: ${result.status} after ${result.roundsCompleted} more rounds`);
    store.close();
  });

program
  .command("providers")
  .description("List available agent providers")
  .action(() => {
    for (const p of listProviders()) {
      const endpoint = p.type === "cli" ? p.command : `${p.baseUrl} (${p.model})`;
      console.log(`${p.name.padEnd(10)} | ${p.displayName.padEnd(10)} | ${p.type.padEnd(3)} | ${endpoint} | ${p.role}`);
    }
  });

program.parse();
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add orchestrator CLI with negotiate, list, view, resume, providers commands"
```

---

## Task 13: Run All Tests & Final Verification

- [ ] **Step 1: Run all tests**

```bash
pnpm vitest run
```

Expected: All tests pass (approximately 50+ tests across 8 test files).

- [ ] **Step 2: Run typecheck**

```bash
pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Build the project**

```bash
pnpm run build
```

Expected: Clean build to `dist/`.

- [ ] **Step 4: Verify CLI help works**

```bash
node dist/orchestrator/index.js --help
```

Expected: Shows help with negotiate, list, view, resume, providers commands.

- [ ] **Step 5: Verify providers command**

```bash
node dist/orchestrator/index.js providers
```

Expected: Lists claude, codex, glm, kimi with their details.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: verify all tests pass and build succeeds"
```
