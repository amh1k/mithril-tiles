export type CanvasPoint = {
  x: number;
  y: number;
};
export type NormalizedPoint = {
  x: number;
  y: number;
};

export function normalizeCanvasPoint(
  point: CanvasPoint,
  bounds: Pick<DOMRect, "height" | "width">,
): NormalizedPoint {
  return {
    x: clamp01(point.x / bounds.width),
    y: clamp01(point.y / bounds.height),
  };
}

export function denormalizeCanvasPoint(
  point: NormalizedPoint,
  bounds: Pick<DOMRect, "height" | "width">,
): CanvasPoint {
  return {
    x: point.x * bounds.width,
    y: point.y * bounds.height,
  };
}

export function relativeBrushSize(
  brushSizePx: number,
  bounds: Pick<DOMRect, "height" | "width">,
): number {
  return brushSizePx / Math.min(bounds.width, bounds.height);
}

export function brushSizePixels(
  brushSize: number,
  bounds: Pick<DOMRect, "height" | "width">,
): number {
  return brushSize * Math.min(bounds.width, bounds.height);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
