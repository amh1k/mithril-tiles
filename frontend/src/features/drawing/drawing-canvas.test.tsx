import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { DrawingCanvas } from "@/features/drawing/drawing-canvas";

const canvasContext = vi.hoisted(() => ({
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  lineTo: vi.fn(),
  lineCap: "butt",
  lineJoin: "miter",
  lineWidth: 1,
  moveTo: vi.fn(),
  setTransform: vi.fn(),
  stroke: vi.fn(),
  strokeStyle: "#000000",
}));

describe("DrawingCanvas", () => {
  beforeEach(() => {
    Object.defineProperties(HTMLCanvasElement.prototype, {
      hasPointerCapture: {
        configurable: true,
        value: vi.fn(() => true),
      },
      releasePointerCapture: {
        configurable: true,
        value: vi.fn(),
      },
      setPointerCapture: {
        configurable: true,
        value: vi.fn(),
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      canvasContext as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 200,
      height: 200,
      left: 0,
      right: 400,
      top: 0,
      width: 400,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("draws local strokes with pointer events", async () => {
    const user = userEvent.setup();
    render(<DrawingCanvas />);

    const canvas = screen.getByLabelText("Drawing canvas");

    await user.pointer([
      {
        coords: {
          clientX: 40,
          clientY: 40,
        },
        keys: "[MouseLeft>]",
        target: canvas,
      },
      {
        coords: {
          clientX: 120,
          clientY: 80,
        },
        pointerName: "mouse",
        target: canvas,
      },
      {
        keys: "[/MouseLeft]",
        target: canvas,
      },
    ]);

    expect(canvasContext.beginPath).toHaveBeenCalled();
    expect(canvasContext.moveTo).toHaveBeenCalledWith(40, 40);
    expect(canvasContext.lineTo).toHaveBeenCalledWith(120, 80);
    expect(canvasContext.stroke).toHaveBeenCalled();
  });

  it("draws with the selected color", async () => {
    const user = userEvent.setup();
    render(<DrawingCanvas color="#ef4444" />);

    const canvas = screen.getByLabelText("Drawing canvas");

    await user.pointer([
      {
        coords: {
          clientX: 40,
          clientY: 40,
        },
        keys: "[MouseLeft>]",
        target: canvas,
      },
      {
        coords: {
          clientX: 120,
          clientY: 80,
        },
        pointerName: "mouse",
        target: canvas,
      },
      {
        keys: "[/MouseLeft]",
        target: canvas,
      },
    ]);

    expect(canvasContext.strokeStyle).toBe("#ef4444");
  });

  it("uses a wider white stroke when erasing", async () => {
    const user = userEvent.setup();
    render(<DrawingCanvas color="#ffffff" isErasing />);

    const canvas = screen.getByLabelText("Drawing canvas");

    await user.pointer([
      {
        coords: {
          clientX: 40,
          clientY: 40,
        },
        keys: "[MouseLeft>]",
        target: canvas,
      },
      {
        coords: {
          clientX: 120,
          clientY: 80,
        },
        pointerName: "mouse",
        target: canvas,
      },
      {
        keys: "[/MouseLeft]",
        target: canvas,
      },
    ]);

    expect(canvasContext.strokeStyle).toBe("#ffffff");
    expect(canvasContext.lineWidth).toBe(6);
  });

  it("does not draw when disabled", async () => {
    const user = userEvent.setup();
    render(<DrawingCanvas disabled />);

    const canvas = screen.getByLabelText("Drawing canvas");

    await user.pointer([
      {
        coords: {
          clientX: 40,
          clientY: 40,
        },
        keys: "[MouseLeft>]",
        target: canvas,
      },
      {
        coords: {
          clientX: 120,
          clientY: 80,
        },
        pointerName: "mouse",
        target: canvas,
      },
      {
        keys: "[/MouseLeft]",
        target: canvas,
      },
    ]);

    expect(canvasContext.lineTo).not.toHaveBeenCalled();
    expect(
      screen.getByText("Drawing controls are disabled until it is your turn."),
    ).toBeInTheDocument();
  });
});
