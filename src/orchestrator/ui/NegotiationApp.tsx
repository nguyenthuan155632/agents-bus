// src/orchestrator/ui/NegotiationApp.tsx

import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { Spinner } from "@inkjs/ui";
import type { NegotiationEvent } from "../negotiate.js";
import type { ProviderConfig } from "../../shared/types.js";

interface FormattedMessage {
  label: string;
  content: string;
  color: string;
}

export function formatMessage(event: NegotiationEvent, providers: ProviderConfig[]): FormattedMessage {
  const providerMap = new Map(providers.map((p) => [p.name, p]));
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
  waitingFor: string | null;
  onComplete: () => void;
}

export function NegotiationApp({ topic, maxRounds, providers, events, waitingFor, onComplete }: NegotiationAppProps) {
  const [currentRound, setCurrentRound] = useState(0);
  const [approvals, setApprovals] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    for (const event of events) {
      if (event.type === "round-start") {
        setCurrentRound(event.round);
      }
      if (event.type === "round-end") {
        setApprovals(event.approvals);
      }
      if (event.type === "complete") {
        setDone(true);
      }
    }
  }, [events]);

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      onComplete();
    }
  });

  const displayEvents = events.filter(
    (e) => e.type === "agent-response" || e.type === "agent-error" || e.type === "round-start" || e.type === "complete"
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">
          {formatStatusBar(topic, currentRound, maxRounds, providers, approvals)}
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {displayEvents.map((event, i) => {
          const msg = formatMessage(event, providers);
          return (
            <Box key={i} flexDirection="column" marginBottom={1}>
              <Text bold color={msg.color}>
                [{msg.label}]
              </Text>
              <Text wrap="wrap">{msg.content}</Text>
            </Box>
          );
        })}
      </Box>

      {waitingFor && !done && (
        <Box marginTop={1}>
          <Spinner label={`Waiting for ${waitingFor}...`} />
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
