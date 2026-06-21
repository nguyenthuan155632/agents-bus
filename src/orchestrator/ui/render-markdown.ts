// src/orchestrator/ui/render-markdown.ts

import stripAnsi from "strip-ansi";

const C0_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;

export interface RenderOptions {
  width: number;
  color?: boolean;
}

export function sanitize(text: string): string {
  return stripAnsi(text).replace(C0_RE, "");
}

export function renderMarkdown(text: string, opts: RenderOptions): string {
  const clean = sanitize(text);
  const width = Math.max(20, opts.width);
  const lines = clean.split("\n");
  const out: string[] = [];
  let inCodeBlock = false;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        inCodeBlock = false;
        out.push("");
      } else {
        inCodeBlock = true;
        out.push("");
      }
      continue;
    }

    if (inCodeBlock) {
      out.push("  " + line);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      if (inList) { inList = false; out.push(""); }
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      if (level <= 2) {
        out.push(text.toUpperCase());
        out.push("─".repeat(Math.min(text.length, width)));
      } else {
        out.push(text);
      }
      continue;
    }

    const bulletMatch = line.match(/^(\s*)([-*+])\s+(.*)/);
    if (bulletMatch) {
      inList = true;
      const indent = bulletMatch[1].length;
      const text = renderInline(bulletMatch[3]);
      out.push(" ".repeat(indent + 2) + "• " + text);
      continue;
    }

    const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      inList = true;
      const indent = numberedMatch[1].length;
      const num = numberedMatch[2];
      const text = renderInline(numberedMatch[3]);
      out.push(" ".repeat(indent) + num + ". " + text);
      continue;
    }

    if (line.trim() === "---" || line.trim() === "***") {
      if (inList) { inList = false; }
      out.push("─".repeat(width));
      continue;
    }

    if (line.trim() === "") {
      if (inList) { inList = false; }
      out.push("");
      continue;
    }

    if (inList) { inList = false; }
    out.push(wrapLine(renderInline(line), width));
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\n+$/, "");
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1")
    .replace(/\[(.+?)\]\[(.+?)\]/g, "$1")
    .replace(/~~(.+?)~~/g, "$1");
}

function wrapLine(text: string, width: number): string {
  if (text.length <= width) return text;
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length + word.length + 1 > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}
