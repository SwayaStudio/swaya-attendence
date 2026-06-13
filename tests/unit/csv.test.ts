import { describe, it, expect } from "vitest";
import { csvEscape } from "@/lib/csv";

describe("csvEscape", () => {
  it("passes plain text through unchanged", () => {
    expect(csvEscape("Alice Smith")).toBe("Alice Smith");
  });

  it("returns empty string for null/undefined", () => {
    // @ts-expect-error testing runtime null handling
    expect(csvEscape(null)).toBe("");
    // @ts-expect-error testing runtime undefined handling
    expect(csvEscape(undefined)).toBe("");
  });

  it("quote-wraps values containing a comma", () => {
    expect(csvEscape("Smith, Alice")).toBe('"Smith, Alice"');
  });

  it("doubles embedded quotes", () => {
    expect(csvEscape('she said "hi"')).toBe('"she said ""hi"""');
  });

  it("quote-wraps values containing a newline", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  // --- formula injection (Bug 2) -------------------------------------------
  it("neutralises a leading = formula", () => {
    expect(csvEscape("=1+1")).toBe("'=1+1");
  });

  it("neutralises a leading + formula", () => {
    expect(csvEscape("+1")).toBe("'+1");
  });

  it("neutralises a leading - formula", () => {
    expect(csvEscape("-1")).toBe("'-1");
  });

  it("neutralises a leading @ formula", () => {
    expect(csvEscape("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("neutralises a dangerous HYPERLINK payload AND quotes its comma", () => {
    const payload = '=HYPERLINK("http://evil","click")';
    const out = csvEscape(payload);
    expect(out.startsWith("\"'=HYPERLINK")).toBe(true);
    // comma inside forces quote-wrapping
    expect(out.endsWith('"')).toBe(true);
  });

  it("does not alter a value where = is not the first character", () => {
    expect(csvEscape("1=1")).toBe("1=1");
  });
});
