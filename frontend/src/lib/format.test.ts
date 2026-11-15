import { describe, expect, it } from "vitest";
import { formatDuration, formatMiles, toLocalInputValue } from "./format";
import { heatWeightExpression, routeColor } from "./mapData";

describe("format", () => {
  it("formats durations", () => {
    expect(formatDuration(45 * 60)).toBe("45 m");
    expect(formatDuration(15.1 * 3600)).toBe("15 h 06 m");
  });
  it("formats miles", () => {
    expect(formatMiles(1004.2)).toBe("1,004 mi");
    expect(formatMiles(4.26)).toBe("4.3 mi");
  });
  it("formats datetime-local value", () => {
    expect(toLocalInputValue(new Date(2026, 10, 5, 9, 7))).toBe("2026-11-05T09:07");
  });
});

describe("map data", () => {
  it("builds the heat weight expression for the slider hour", () => {
    expect(heatWeightExpression(12)).toEqual(["/", ["coalesce", ["get", "h12"], 0], 4]);
  });
  it("assigns stable route colors by rank", () => {
    expect(routeColor(1)).not.toBe(routeColor(2));
    expect(routeColor(9)).toBe(routeColor(3));
  });
});
