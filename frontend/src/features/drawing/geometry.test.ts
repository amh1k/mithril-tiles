import { describe, expect, it } from "vitest";

import {
  brushSizePixels,
  denormalizeCanvasPoint,
  normalizeCanvasPoint,
  relativeBrushSize,
} from "@/features/drawing/geometry";

const bounds = {
  height: 200,
  width: 400,
};

describe("drawing geometry", () => {
  it("normalizes canvas coordinates", () => {
    expect(normalizeCanvasPoint({ x: 100, y: 50 }, bounds)).toEqual({
      x: 0.25,
      y: 0.25,
    });
  });

  it("clamps normalized coordinates into the canvas range", () => {
    expect(normalizeCanvasPoint({ x: -10, y: 250 }, bounds)).toEqual({
      x: 0,
      y: 1,
    });
  });

  it("denormalizes canvas coordinates", () => {
    expect(denormalizeCanvasPoint({ x: 0.5, y: 0.25 }, bounds)).toEqual({
      x: 200,
      y: 50,
    });
  });

  it("stores brush size relative to the shorter canvas side", () => {
    expect(relativeBrushSize(10, bounds)).toBe(0.05);
    expect(brushSizePixels(0.05, bounds)).toBe(10);
  });
});
