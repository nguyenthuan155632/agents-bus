import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPlainUI } from "../../src/orchestrator/ui/plain-ui.js";
import type { NegotiationEvent } from "../../src/orchestrator/negotiate.js";
import type { ProviderConfig } from "../../src/shared/types.js";

const providers: ProviderConfig[] = [
  { name: "claude", displayName: "Claude", type: "cli", role: "architect", color: "blue", timeoutMs: 60000 },
  { name: "codex", displayName: "Codex", type: "cli", role: "engineer", color: "green", timeoutMs: 60000 },
];

function getAllWriteOutput(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((c) => c[0] as string).join("");
}

describe("PlainUIHandle", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    originalIsTTY = process.stdout.isTTY;
    process.stdout.isTTY = false;
  });

  afterEach(() => {
    writeSpy.mockRestore();
    process.stdout.isTTY = originalIsTTY;
  });

  it("should write agent-response events with rendered markdown", () => {
    const ui = createPlainUI("Topic", 5, providers);
    ui.pushEvent({
      type: "agent-response",
      agent: "claude",
      content: "## Plan\n\n**bold** text\n\n- item 1\n- item 2",
      messageType: "proposal",
    });
    const output = getAllWriteOutput(writeSpy);
    expect(output).toContain("[Claude]");
    expect(output).toContain("PLAN");
    expect(output).toContain("bold text");
    expect(output).toContain("• item 1");
    expect(output).not.toContain("##");
    expect(output).not.toContain("**");
  });

  it("should write round-start events", () => {
    const ui = createPlainUI("Topic", 5, providers);
    ui.pushEvent({ type: "round-start", round: 1, maxRounds: 5 });
    const output = getAllWriteOutput(writeSpy);
    expect(output).toContain("Round 1 of 5");
  });

  it("should write complete events", () => {
    const ui = createPlainUI("Topic", 5, providers);
    ui.pushEvent({ type: "complete", status: "APPROVED", finalPlan: "The plan" });
    const output = getAllWriteOutput(writeSpy);
    expect(output).toContain("APPROVED");
  });

  it("should write agent-error events", () => {
    const ui = createPlainUI("Topic", 5, providers);
    ui.pushEvent({ type: "agent-error", agent: "codex", error: "timed out" });
    const output = getAllWriteOutput(writeSpy);
    expect(output).toContain("Codex");
    expect(output).toContain("timed out");
  });

  it("should NOT write round-end events (not in display set)", () => {
    const ui = createPlainUI("Topic", 5, providers);
    ui.pushEvent({ type: "round-end", round: 1, approvals: { claude: false, codex: false } });
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("should NOT write agent-progress in non-TTY mode", () => {
    const ui = createPlainUI("Topic", 5, providers);
    ui.pushEvent({ type: "agent-progress", agent: "claude", chunk: { type: "thinking", content: "Considering..." } });
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("should NOT emit control bytes (\\r, \\x1b[K) in non-TTY mode", () => {
    const ui = createPlainUI("Topic", 5, providers);
    ui.pushEvent({ type: "round-start", round: 1, maxRounds: 5 });
    ui.pushEvent({
      type: "agent-response",
      agent: "claude",
      content: "Some content",
      messageType: "proposal",
    });
    const output = getAllWriteOutput(writeSpy);
    expect(output).not.toContain("\r");
    expect(output).not.toContain("\x1b");
  });

  it("should not contain markdown syntax in output", () => {
    const ui = createPlainUI("Topic", 5, providers);
    ui.pushEvent({
      type: "agent-response",
      agent: "claude",
      content: "## Heading\n\n**bold** and *italic*\n\n`code`",
      messageType: "proposal",
    });
    const output = getAllWriteOutput(writeSpy);
    expect(output).not.toContain("##");
    expect(output).not.toContain("**");
    expect(output).not.toContain("`code`");
  });

  it("setWaitingFor should be a no-op (no output)", () => {
    const ui = createPlainUI("Topic", 5, providers);
    ui.setWaitingFor("Claude");
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("unmount should be a no-op (no output)", () => {
    const ui = createPlainUI("Topic", 5, providers);
    ui.unmount();
    expect(writeSpy).not.toHaveBeenCalled();
  });
});
