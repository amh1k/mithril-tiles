"use client";

import { useEffect, useRef, useState } from "react";

import {
  brushSizePixels,
  normalizeCanvasPoint,
  type NormalizedPoint,
} from "@/features/drawing/geometry";
import type { DrawStroke } from "@/features/realtime/protocol";
import { cn } from "@/lib/utils";

type LocalStrokeSegment = {
  brushSize: number;
  color: string;
  from: NormalizedPoint;
  to: NormalizedPoint;
};

type DrawingCanvasProps = {
  brushSize?: number;
  className?: string;
  color?: string;
  disabled?: boolean;
  isErasing?: boolean;
  onStroke?: (stroke: DrawStroke) => void;
  remoteStrokes?: Array<{
    id: number;
    stroke: DrawStroke;
  }>;
  resetKey?: string | null;
};

export function DrawingCanvas({
  brushSize = 0.012,
  className,
  color = "#111827",
  disabled = false,
  isErasing = false,
  onStroke,
  remoteStrokes = [],
  resetKey = null,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingPointRef = useRef<NormalizedPoint | null>(null);
  const renderedRemoteStrokeIdsRef = useRef(new Set<number>());
  const strokesRef = useRef<LocalStrokeSegment[]>([]);
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;

    drawingPointRef.current = null;
    renderedRemoteStrokeIdsRef.current.clear();
    strokesRef.current = [];

    if (canvas === null) {
      return;
    }

    const context = canvas.getContext("2d");

    if (context === null) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    context.clearRect(0, 0, bounds.width, bounds.height);
  }, [resetKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    const resizeCanvas = () => {
      const context = canvas.getContext("2d");
      if (context === null) {
        return;
      }

      const bounds = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;

      canvas.width = Math.round(bounds.width * ratio);
      canvas.height = Math.round(bounds.height * ratio);

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);

      for (const stroke of strokesRef.current) {
        drawStrokeSegment(context, stroke, bounds);
      }

      setCanvasReady(true);
    };

    if (typeof ResizeObserver === "undefined") {
      resizeCanvas();
      return;
    }

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);
    resizeCanvas();

    return () => resizeObserver.disconnect();
  }, []);

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    drawingPointRef.current = pointerEventToNormalizedPoint(event);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || drawingPointRef.current === null) {
      return;
    }

    const nextPoint = pointerEventToNormalizedPoint(event);
    const stroke: LocalStrokeSegment = {
      brushSize: isErasing ? brushSize * 2.5 : brushSize,
      color,
      from: drawingPointRef.current,
      to: nextPoint,
    };

    strokesRef.current.push(stroke);
    renderStroke(stroke);
    onStroke?.(localSegmentToDrawStroke(stroke));
    drawingPointRef.current = nextPoint;
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLCanvasElement>) {
    drawingPointRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function renderStroke(stroke: LocalStrokeSegment) {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    const context = canvas.getContext("2d");
    if (context === null) {
      return;
    }

    drawStrokeSegment(context, stroke, canvas.getBoundingClientRect());
  }

  useEffect(() => {
    for (const remoteStroke of remoteStrokes) {
      if (renderedRemoteStrokeIdsRef.current.has(remoteStroke.id)) {
        continue;
      }

      renderedRemoteStrokeIdsRef.current.add(remoteStroke.id);
      const stroke = drawStrokeToLocalSegment(remoteStroke.stroke);
      strokesRef.current.push(stroke);
      renderStroke(stroke);
    }
  }, [remoteStrokes]);

  return (
    <div
      className={cn(
        "relative min-h-[22rem] flex-1 overflow-hidden rounded-xl border bg-white shadow-inner",
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        aria-label="Drawing canvas"
        className={cn(
          "h-full min-h-[22rem] w-full touch-none",
          disabled
            ? "cursor-default"
            : isErasing
              ? "cursor-cell"
              : "cursor-crosshair",
        )}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
      />

      {disabled && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border bg-background/85 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
          Viewing only
        </div>
      )}

      {!canvasReady && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Preparing canvas…
        </div>
      )}
    </div>
  );
}

function pointerEventToNormalizedPoint(
  event: React.PointerEvent<HTMLCanvasElement>,
): NormalizedPoint {
  const bounds = event.currentTarget.getBoundingClientRect();

  return normalizeCanvasPoint(
    {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    },
    bounds,
  );
}

function drawStrokeSegment(
  context: CanvasRenderingContext2D,
  stroke: LocalStrokeSegment,
  bounds: Pick<DOMRect, "height" | "width">,
) {
  context.strokeStyle = stroke.color;
  context.lineWidth = brushSizePixels(stroke.brushSize, bounds);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(stroke.from.x * bounds.width, stroke.from.y * bounds.height);
  context.lineTo(stroke.to.x * bounds.width, stroke.to.y * bounds.height);
  context.stroke();
}

function localSegmentToDrawStroke(stroke: LocalStrokeSegment): DrawStroke {
  return {
    brush_size: stroke.brushSize,
    color: stroke.color,
    from_x: stroke.from.x,
    from_y: stroke.from.y,
    to_x: stroke.to.x,
    to_y: stroke.to.y,
  };
}

function drawStrokeToLocalSegment(stroke: DrawStroke): LocalStrokeSegment {
  return {
    brushSize: stroke.brush_size,
    color: stroke.color,
    from: {
      x: stroke.from_x,
      y: stroke.from_y,
    },
    to: {
      x: stroke.to_x,
      y: stroke.to_y,
    },
  };
}
