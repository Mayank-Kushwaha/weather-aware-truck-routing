import { describe, expect, it } from "vitest";
import { buildPath, mileAtProgress, nextIndex, pointAt, prevIndex } from "./trace";

describe("trace path", () => {
  const path = buildPath([[0, 0], [1, 0], [1, 1]]);

  it("starts and ends at the line ends", () => {
    expect(pointAt(path, 0)).toEqual([0, 0]);
    expect(pointAt(path, 1)).toEqual([1, 1]);
  });

  it("interpolates along the first segment by length", () => {
    // first leg is 1 unit, second about 1 unit, so 25% of total lies halfway along the first leg
    const [x, y] = pointAt(path, 0.25);
    expect(y).toBe(0);
    expect(x).toBeGreaterThan(0.4);
    expect(x).toBeLessThan(0.6);
  });

  it("clamps out-of-range fractions", () => {
    expect(pointAt(path, -3)).toEqual([0, 0]);
    expect(pointAt(path, 9)).toEqual([1, 1]);
  });
});

describe("trace progress", () => {
  const miles = [0, 25, 50, 60];
  it("maps fractional checkpoint index to miles", () => {
    expect(mileAtProgress(miles, 0)).toBe(0);
    expect(mileAtProgress(miles, 1.5)).toBe(37.5);
    expect(mileAtProgress(miles, 2.5)).toBe(55);
    expect(mileAtProgress(miles, 3)).toBe(60);
    expect(mileAtProgress(miles, 99)).toBe(60);
  });
  it("steps to the next and previous checkpoint", () => {
    expect(nextIndex(0, 4)).toBe(1);
    expect(nextIndex(1.4, 4)).toBe(2);
    expect(nextIndex(3, 4)).toBe(3);
    expect(prevIndex(2)).toBe(1);
    expect(prevIndex(1.4)).toBe(1);
    expect(prevIndex(0)).toBe(0);
  });
});
