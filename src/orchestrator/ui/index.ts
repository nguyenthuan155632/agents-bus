// src/orchestrator/ui/index.ts

import React from "react";
import { render } from "ink";
import { NegotiationApp } from "./NegotiationApp.js";
import { createPlainUI } from "./plain-ui.js";
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
    return createPlainUI(topic, maxRounds, providers);
  }

  return createInkUIHandle(topic, maxRounds, providers, onComplete);
}

function createInkUIHandle(
  topic: string,
  maxRounds: number,
  providers: ProviderConfig[],
  onComplete: () => void
): UIHandle {
  const events: NegotiationEvent[] = [];
  let waitingFor: string | null = null;
  let progressText = "";
  let progressType: "thinking" | "text" = "thinking";
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
      progressText,
      progressType,
      onComplete,
    });
  }

  const { unmount } = render(React.createElement(Wrapper));

  return {
    pushEvent(event: NegotiationEvent) {
      if (event.type === "agent-progress") {
        if (event.chunk.type === "thinking") {
          progressType = "thinking";
          progressText = event.chunk.content;
        } else {
          progressType = "text";
          progressText = progressText + event.chunk.content;
        }
        scheduleUpdate();
      } else {
        if (event.type === "agent-response" || event.type === "agent-error") {
          progressText = "";
        }
        events.push(event);
        scheduleUpdate();
      }
    },
    setWaitingFor(agent: string | null) {
      waitingFor = agent;
      progressText = "";
      scheduleUpdate();
    },
    unmount,
  };
}
