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
