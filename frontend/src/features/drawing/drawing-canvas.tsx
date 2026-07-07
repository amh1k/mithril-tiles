"use client";

import { useEffect, useRef, useState } from "react";

import {
  brushSizePixels,
  normalizeCanvasPoint,
  type NormalizedPoint,
} from "@/features/drawing/geometry";
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
};

export function DrawingCanvas({
  brushSize = 0.012,
  className,
  color = "#111827",
  disabled = false,
  isErasing = false,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingPointRef = useRef<NormalizedPoint | null>(null);
  const strokesRef = useRef<LocalStrokeSegment[]>([]);
  const [canvasReady, setCanvasReady] = useState(false);

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

  return (
    <div
      className={cn(
        "relative min-h-[22rem] flex-1 overflow-hidden rounded-xl border bg-white shadow-inner",
        disabled && "bg-muted/30",
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        aria-label="Drawing canvas"
        className={cn(
          "h-full min-h-[22rem] w-full touch-none",
          disabled
            ? "cursor-not-allowed"
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
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 text-center text-sm text-muted-foreground">
          Drawing controls are disabled until it is your turn.
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
