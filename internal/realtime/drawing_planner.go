package realtime

import (
	"strings"

	"mithrilTiles.abdulmoiz.net/internal/data"
)

// DrawingPlanner produces normalized canvas strokes without accessing room state.
type DrawingPlanner interface {
	Plan(word string, profile data.BotProfile) []DrawStroke
}

type TemplateDrawingPlanner struct{}

func (TemplateDrawingPlanner) Plan(word string, _ data.BotProfile) []DrawStroke {
	strokes, ok := drawingTemplates[strings.ToLower(strings.TrimSpace(word))]
	if !ok {
		strokes = fallbackDrawing
	}

	result := make([]DrawStroke, len(strokes))
	copy(result, strokes)
	return result
}

var drawingTemplates = map[string][]DrawStroke{
	"house": {
		stroke(0.30, 0.70, 0.70, 0.70),
		stroke(0.70, 0.70, 0.70, 0.40),
		stroke(0.70, 0.40, 0.30, 0.40),
		stroke(0.30, 0.40, 0.30, 0.70),
		stroke(0.30, 0.40, 0.50, 0.20),
		stroke(0.50, 0.20, 0.70, 0.40),
	},
	"tree": {
		stroke(0.50, 0.75, 0.50, 0.50),
		stroke(0.50, 0.20, 0.30, 0.55),
		stroke(0.30, 0.55, 0.70, 0.55),
		stroke(0.70, 0.55, 0.50, 0.20),
	},
}

var fallbackDrawing = []DrawStroke{
	stroke(0.35, 0.35, 0.65, 0.35),
	stroke(0.65, 0.35, 0.65, 0.65),
	stroke(0.65, 0.65, 0.35, 0.65),
	stroke(0.35, 0.65, 0.35, 0.35),
}

func stroke(fromX, fromY, toX, toY float64) DrawStroke {
	return DrawStroke{
		FromX:     fromX,
		FromY:     fromY,
		ToX:       toX,
		ToY:       toY,
		Color:     "#000000",
		BrushSize: 5,
	}
}
