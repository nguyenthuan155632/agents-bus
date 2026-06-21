// src/orchestrator/ui/NegotiationApp.tsx

import React, { useMemo } from "react";
import { Box, Text, useInput } from "ink";
import type { NegotiationEvent } from "../negotiate.js";
import type { ProviderConfig } from "../../shared/types.js";

interface FormattedMessage {
  label: string;
  content: string;
  color: string;
}

const providerMapCache = new WeakMap<ProviderConfig[], Map<string, ProviderConfig>>();

function getProviderMap(providers: ProviderConfig[]): Map<string, ProviderConfig> {
  let map = providerMapCache.get(providers);
  if (!map) {
    map = new Map(providers.map((p) => [p.name, p]));
    providerMapCache.set(providers, map);
  }
  return map;
}

export function formatMessage(event: NegotiationEvent, providers: ProviderConfig[]): FormattedMessage {
  const providerMap = getProviderMap(providers);
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
  version: number;
  waitingFor: string | null;
  onComplete: () => void;
}

const DISPLAY_EVENT_TYPES = new Set(["agent-response", "agent-error", "round-start", "complete"]);

export function NegotiationApp({ topic, maxRounds, providers, events, version, waitingFor, onComplete }: NegotiationAppProps) {
  useInput((input, key) => {
    if (input === "q" || key.escape) {
      onComplete();
    }
  });

  const { currentRound, approvals, done, displayEvents } = useMemo(() => {
    let round = 0;
    let aps: Record<string, boolean> = {};
    let isDone = false;
    const display: NegotiationEvent[] = [];

    for (const event of events) {
      if (event.type === "round-start") {
        round = event.round;
      } else if (event.type === "round-end") {
        aps = event.approvals;
      } else if (event.type === "complete") {
        isDone = true;
      }
      if (DISPLAY_EVENT_TYPES.has(event.type)) {
        display.push(event);
      }
    }

    return { currentRound: round, approvals: aps, done: isDone, displayEvents: display };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const formattedMessages = useMemo(
    () => displayEvents.map((event) => formatMessage(event, providers)),
    [displayEvents, providers]
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">
          {formatStatusBar(topic, currentRound, maxRounds, providers, approvals)}
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {formattedMessages.map((msg, i) => (
          <Box key={i} flexDirection="column" marginBottom={1}>
            <Text bold color={msg.color}>
              [{msg.label}]
            </Text>
            <Text wrap="wrap">{msg.content}</Text>
          </Box>
        ))}
      </Box>

      {waitingFor && !done && (
        <Box marginTop={1}>
          <Text color="cyan">⠋ Waiting for {waitingFor}...</Text>
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
