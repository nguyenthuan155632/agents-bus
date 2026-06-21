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
