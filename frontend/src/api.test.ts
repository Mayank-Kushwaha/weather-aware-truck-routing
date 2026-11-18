import { describe, expect, it } from "vitest";
import { normalizeBase } from "@/api";

describe("normalizeBase", () => {
  it("handles empty and undefined", () => {
    expect(normalizeBase(undefined)).toBe("");
    expect(normalizeBase("  ")).toBe("");
  });
  it("strips trailing slashes and a stray /api", () => {
    expect(normalizeBase("https://x.onrender.com/")).toBe("https://x.onrender.com");
    expect(normalizeBase("https://x.onrender.com//")).toBe("https://x.onrender.com");
    expect(normalizeBase("https://x.onrender.com/api")).toBe("https://x.onrender.com");
    expect(normalizeBase(" https://x.onrender.com/api/ ")).toBe("https://x.onrender.com");
  });
});
