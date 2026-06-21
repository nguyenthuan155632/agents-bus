// src/orchestrator/ui/index.ts

import type { NegotiationEvent } from "../negotiate.js";
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
  if (!process.stdout.isTTY) {
    return createPlainUIHandle(topic, maxRounds, providers);
  }

  return createInkUIHandle(topic, maxRounds, providers, onComplete);
}

function createPlainUIHandle(
  topic: string,
  maxRounds: number,
  providers: ProviderConfig[]
): UIHandle {
  const { createPlainUI } = require("./plain-ui.js") as typeof import("./plain-ui.js");
  return createPlainUI(topic, maxRounds, providers);
}

function createInkUIHandle(
  topic: string,
  maxRounds: number,
  providers: ProviderConfig[],
  onComplete: () => void
): UIHandle {
  const React = require("react") as typeof import("react");
  const { render } = require("ink") as typeof import("ink");
  const { NegotiationApp } = require("./NegotiationApp.js") as typeof import("./NegotiationApp.js");

  const events: NegotiationEvent[] = [];
  let waitingFor: string | null = null;
  let version = 0;
  let pendingUpdate = false;

  function scheduleUpdate() {
    if (pendingUpdate) return;
    pendingUpdate = true;
    process.nextTick(() => {
      pendingUpdate = false;
      version++;
      rerender();
    });
  }

  function rerender() {
    renderRoot();
  }

  let renderRoot: () => void = () => {};

  function Wrapper() {
    const [, setTick] = React.useState(0);
    renderRoot = () => setTick((n) => n + 1);
    return React.createElement(NegotiationApp, {
      topic,
      maxRounds,
      providers,
      events,
      version,
      waitingFor,
      onComplete,
    });
  }

  const { unmount } = render(React.createElement(Wrapper));

  return {
    pushEvent(event: NegotiationEvent) {
      events.push(event);
      scheduleUpdate();
    },
    setWaitingFor(agent: string | null) {
      waitingFor = agent;
      scheduleUpdate();
    },
    unmount,
  };
}
