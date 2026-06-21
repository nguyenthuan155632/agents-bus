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
