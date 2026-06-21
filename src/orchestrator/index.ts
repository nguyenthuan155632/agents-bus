#!/usr/bin/env node

import { Command } from "commander";
import { Store, withStore, withStoreAsync, DATA_DIR } from "../persistence/store.js";
import { createAgent } from "./agents/factory.js";
import { getProviders, listProviders } from "./agents/providers.js";
import { Negotiator, type NegotiationEvent } from "./negotiate.js";
import { mergePlans } from "./merger.js";
import { startUI } from "./ui/index.js";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

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
      process.exitCode = 1;
      return;
    }

    const agents = providers.map((p) => createAgent(p));
    const maxRounds = parseInt(options.rounds, 10);

    await withStoreAsync(async (store) => {
      let uiHandle: ReturnType<typeof startUI> | null = null;

      if (options.ui) {
        uiHandle = startUI(topic, maxRounds, providers, () => {
          uiHandle?.unmount();
          process.exitCode = 0;
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
          if (event.type === "agent-progress") {
            const prefix = event.chunk.type === "thinking" ? "thinking" : "writing";
            process.stdout.write(`\r[${event.agent}] ${prefix}: ${event.chunk.content.slice(0, 100).replace(/\n/g, " ")}`);
            return;
          }
          if (event.type === "round-start") {
            process.stdout.write("\r\x1b[K");
            console.log(`\n--- Round ${event.round}/${event.maxRounds} ---`);
          }
          if (event.type === "agent-response") {
            process.stdout.write("\r\x1b[K");
            console.log(`\n[${event.agent}] (${event.messageType}):`);
            console.log(event.content);
          }
          if (event.type === "agent-error") {
            process.stdout.write("\r\x1b[K");
            console.error(`\n[${event.agent}] ERROR: ${event.error}`);
          }
          if (event.type === "complete") {
            process.stdout.write("\r\x1b[K");
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
    });
  });

program
  .command("list")
  .description("List all negotiation sessions")
  .action(() => {
    withStore((store) => {
      const sessions = store.listSessions();
      if (sessions.length === 0) {
        console.log("No sessions found.");
      } else {
        for (const s of sessions) {
          console.log(`${s.id} | ${s.state} | Round ${s.currentRound}/${s.maxRounds} | ${s.topic}`);
        }
      }
    });
  });

program
  .command("view")
  .description("View session transcript")
  .argument("<session-id>", "Session ID to view")
  .action((sessionId: string) => {
    withStore((store) => {
      const session = store.getSession(sessionId);
      if (!session) {
        console.error(`Session ${sessionId} not found.`);
        process.exitCode = 1;
        return;
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
    });
  });

program
  .command("resume")
  .description("Resume an existing session")
  .argument("<session-id>", "Session ID to resume")
  .action(async (sessionId: string) => {
    await withStoreAsync(async (store) => {
      const session = store.getSession(sessionId);
      if (!session) {
        console.error(`Session ${sessionId} not found.`);
        process.exitCode = 1;
        return;
      }

      if (session.state === "APPROVED") {
        console.log("Session already approved.");
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
        return;
      }

      console.log(`Resuming "${session.topic}" from round ${session.currentRound + 1} (${remaining} rounds remaining)`);
      const providers = getProviders(session.agents);
      const agents = providers.map((p) => createAgent(p));
      const negotiator = new Negotiator(store, agents, providers);
      const result = await negotiator.resume(sessionId);
      console.log(`Status: ${result.status} (round ${result.roundsCompleted}/${session.maxRounds})`);

      if (result.status === "EXHAUSTED") {
        const messages = store.getMessages(sessionId);
        const merged = await mergePlans(messages, providers);
        if (merged) {
          const planPath = join(PLANS_DIR, `${sessionId}.md`);
          writeFileSync(planPath, `# ${session.topic}\n\n${merged}`, "utf-8");
          console.log(`Plan saved to: ${planPath}`);
        }
      }
    });
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
