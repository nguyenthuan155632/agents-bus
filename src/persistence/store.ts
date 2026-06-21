// src/persistence/store.ts

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import type { Session, Message, SessionState, MessageType } from "../shared/types.js";

export const DATA_DIR = join(homedir(), ".agents-bus");
export const DB_PATH = join(DATA_DIR, "sessions.db");

export function withStore<T>(fn: (store: Store) => T): T {
  mkdirSync(DATA_DIR, { recursive: true });
  const store = new Store(DB_PATH);
  try {
    return fn(store);
  } finally {
    store.close();
  }
}

export async function withStoreAsync<T>(fn: (store: Store) => Promise<T>): Promise<T> {
  mkdirSync(DATA_DIR, { recursive: true });
  const store = new Store(DB_PATH);
  try {
    return await fn(store);
  } finally {
    store.close();
  }
}

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
