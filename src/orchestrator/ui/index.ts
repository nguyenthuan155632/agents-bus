// src/orchestrator/ui/index.ts

import React from "react";
import { render } from "ink";
import { NegotiationApp } from "./NegotiationApp.js";
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
  const events: NegotiationEvent[] = [];
  let waitingFor: string | null = null;
  let pendingUpdate = false;

  function scheduleUpdate() {
    if (pendingUpdate) return;
    pendingUpdate = true;
    process.nextTick(() => {
      pendingUpdate = false;
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
