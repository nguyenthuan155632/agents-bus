// src/orchestrator/ui/ActivityIndicator.tsx

import React, { useState, useEffect, useRef } from "react";
import { Box, Text } from "ink";

const UNICODE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const ASCII_FRAMES = ["-", "\\", "|", "/"];

function shouldUseUnicode(): boolean {
  if (process.env.TERM === "dumb") return false;
  return true;
}

interface ActivityIndicatorProps {
  label: string;
  color?: string;
  active: boolean;
}

export function ActivityIndicator({ label, color = "cyan", active }: ActivityIndicatorProps) {
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef<number>(0);
  const frames = shouldUseUnicode() ? UNICODE_FRAMES : ASCII_FRAMES;

  useEffect(() => {
    if (!active) {
      setFrame(0);
      setElapsed(0);
      return;
    }

    startTime.current = Date.now();

    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 250);

    return () => {
      clearInterval(timer);
    };
  }, [active, frames.length]);

  if (!active) return null;

  return (
    <Box flexDirection="row">
      <Text color={color}>{frames[frame]} </Text>
      <Text color={color}>{label}</Text>
      <Text dimColor> {elapsed}s</Text>
    </Box>
  );
}
