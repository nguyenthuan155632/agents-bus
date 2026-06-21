// src/orchestrator/ui/ActivityIndicator.tsx

import React, { useState, useEffect, useRef } from "react";
import { Box, Text } from "ink";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface ActivityIndicatorProps {
  label: string;
  color?: string;
  active: boolean;
}

export function ActivityIndicator({ label, color = "cyan", active }: ActivityIndicatorProps) {
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setFrame(0);
      setElapsed(0);
      return;
    }

    startTime.current = Date.now();

    const spinnerTimer = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, 80);

    const elapsedTimer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);

    return () => {
      clearInterval(spinnerTimer);
      clearInterval(elapsedTimer);
    };
  }, [active]);

  if (!active) return null;

  return (
    <Box marginTop={1} flexDirection="row">
      <Text color={color}>{SPINNER_FRAMES[frame]} </Text>
      <Text color={color}>{label}</Text>
      <Text dimColor> {elapsed}s</Text>
    </Box>
  );
}
