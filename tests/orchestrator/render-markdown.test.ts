import { describe, it, expect } from "vitest";
import { renderMarkdown, sanitize } from "../../src/orchestrator/ui/render-markdown.js";

describe("sanitize", () => {
  it("should strip ANSI escape codes", () => {
    const input = "\x1b[31mred text\x1b[0m";
    expect(sanitize(input)).toBe("red text");
  });

  it("should strip C0 control chars except newline and tab", () => {
    const input = "hello\x00world\x07beep\x0bvertical\x01";
    expect(sanitize(input)).toBe("helloworldbeepvertical");
  });

  it("should preserve newlines and tabs", () => {
    const input = "line1\nline2\ttabbed";
    expect(sanitize(input)).toBe("line1\nline2\ttabbed");
  });
});

describe("renderMarkdown", () => {
  const opts = { width: 60, color: false };

  it("should render h1/h2 as uppercase with divider", () => {
    const out = renderMarkdown("## My Heading", opts);
    expect(out).toContain("MY HEADING");
    expect(out).toContain("─");
  });

  it("should render h3+ as plain text", () => {
    const out = renderMarkdown("### Sub Heading", opts);
    expect(out).toContain("Sub Heading");
    expect(out).not.toContain("SUB HEADING");
  });

  it("should strip bold markers", () => {
    const out = renderMarkdown("This is **bold** text", opts);
    expect(out).toContain("This is bold text");
    expect(out).not.toContain("**");
  });

  it("should strip italic markers", () => {
    const out = renderMarkdown("This is *italic* text", opts);
    expect(out).toContain("This is italic text");
    expect(out).not.toContain("*italic*");
  });

  it("should strip inline code backticks", () => {
    const out = renderMarkdown("Use `npm install` to install", opts);
    expect(out).toContain("Use npm install to install");
    expect(out).not.toContain("`");
  });

  it("should render bullet lists with bullet points", () => {
    const out = renderMarkdown("- item 1\n- item 2\n- item 3", opts);
    expect(out).toContain("• item 1");
    expect(out).toContain("• item 2");
    expect(out).toContain("• item 3");
  });

  it("should render numbered lists", () => {
    const out = renderMarkdown("1. first\n2. second\n3. third", opts);
    expect(out).toContain("1. first");
    expect(out).toContain("2. second");
    expect(out).toContain("3. third");
  });

  it("should render code blocks indented", () => {
    const out = renderMarkdown("```\nconst x = 1;\nconsole.log(x);\n```", opts);
    expect(out).toContain("  const x = 1;");
    expect(out).toContain("  console.log(x);");
    expect(out).not.toContain("```");
  });

  it("should render links as just the text", () => {
    const out = renderMarkdown("See [the docs](https://example.com) for more", opts);
    expect(out).toContain("See the docs for more");
    expect(out).not.toContain("https://example.com");
    expect(out).not.toContain("[");
    expect(out).not.toContain("]");
  });

  it("should render horizontal rules as divider line", () => {
    const out = renderMarkdown("above\n\n---\n\nbelow", opts);
    expect(out).toContain("─");
    expect(out).toContain("above");
    expect(out).toContain("below");
  });

  it("should strip strikethrough markers", () => {
    const out = renderMarkdown("~~deleted~~ text", opts);
    expect(out).toContain("deleted text");
    expect(out).not.toContain("~~");
  });

  it("should not contain literal markdown syntax in output", () => {
    const md = "## Heading\n\n**bold** and *italic*\n\n- list item\n\n`code`";
    const out = renderMarkdown(md, opts);
    expect(out).not.toContain("##");
    expect(out).not.toContain("**");
    expect(out).not.toContain("*italic*");
    expect(out).not.toContain("`code`");
  });

  it("should wrap long lines to specified width", () => {
    const longText = "This is a very long line of text that should be wrapped because it exceeds the specified width parameter";
    const out = renderMarkdown(longText, { width: 30, color: false });
    const lines = out.split("\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(30);
    }
  });

  it("should handle nested bullet indentation", () => {
    const out = renderMarkdown("- top\n  - nested\n  - nested 2", opts);
    expect(out).toContain("• top");
    expect(out).toContain("  • nested");
  });

  it("should strip ANSI from input before rendering", () => {
    const input = "## \x1b[31mRed Heading\x1b[0m";
    const out = renderMarkdown(input, opts);
    expect(out).toContain("RED HEADING");
    expect(out).not.toContain("\x1b");
  });

  it("should strip C0 control chars from input", () => {
    const input = "Hello\x00World\x07Beep";
    const out = renderMarkdown(input, opts);
    expect(out).toContain("HelloWorldBeep");
    expect(out).not.toContain("\x00");
    expect(out).not.toContain("\x07");
  });

  it("should collapse excessive blank lines", () => {
    const out = renderMarkdown("para 1\n\n\n\n\npara 2", opts);
    expect(out).not.toMatch(/\n{3,}/);
  });
});
