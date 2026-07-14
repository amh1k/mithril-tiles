package realtime

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"mithrilTiles.abdulmoiz.net/internal/data"
)

// DrawingInput is only created for the active drawer bot.
type DrawingInput struct {
	Word    string
	Profile data.BotProfile
}

type DrawingProvider interface {
	Plan(ctx context.Context, input DrawingInput) ([]DrawStroke, error)
}

// TemplateDrawingProvider is the safe fallback when no external provider is configured.
type TemplateDrawingProvider struct{}

func (TemplateDrawingProvider) Plan(ctx context.Context, input DrawingInput) ([]DrawStroke, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	strokes, ok := drawingTemplates[strings.ToLower(strings.TrimSpace(input.Word))]
	if !ok {
		strokes = fallbackDrawing
	}

	result := make([]DrawStroke, len(strokes))
	copy(result, strokes)
	return result, nil
}

const defaultGeminiDrawingModel = "gemini-2.5-flash"

type GeminiDrawingProvider struct {
	APIKey  string
	BaseURL string
	Client  *http.Client
	Model   string
	Timeout time.Duration
}

func (p GeminiDrawingProvider) Plan(ctx context.Context, input DrawingInput) ([]DrawStroke, error) {
	if strings.TrimSpace(p.APIKey) == "" {
		return nil, fmt.Errorf("gemini API key is not configured")
	}

	requestContext, cancel := context.WithTimeout(ctx, p.timeout())
	defer cancel()
	payload, err := json.Marshal(geminiDrawingRequest{
		Contents: []geminiContent{{Parts: []geminiPart{{Text: geminiDrawingPrompt(input)}}}},
		GenerationConfig: geminiDrawingConfig{
			Temperature:      0.4,
			MaxOutputTokens:  2048,
			ResponseMIMEType: "application/json",
			ResponseSchema:   geminiDrawingSchema(),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("marshal Gemini drawing request: %w", err)
	}

	request, err := http.NewRequestWithContext(
		requestContext,
		http.MethodPost,
		fmt.Sprintf("%s/v1beta/models/%s:generateContent", p.baseURL(), p.model()),
		bytes.NewReader(payload),
	)
	if err != nil {
		return nil, fmt.Errorf("create Gemini drawing request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("x-goog-api-key", p.APIKey)

	response, err := p.client().Do(request)
	if err != nil {
		return nil, fmt.Errorf("call Gemini drawing provider: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("Gemini drawing provider returned status %d", response.StatusCode)
	}

	var result geminiGenerateContentResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode Gemini drawing response: %w", err)
	}
	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("Gemini drawing provider returned no candidate")
	}

	var plan geminiDrawingPlan
	if err := json.Unmarshal([]byte(result.Candidates[0].Content.Parts[0].Text), &plan); err != nil {
		return nil, fmt.Errorf("decode Gemini drawing plan: %w", err)
	}
	if len(plan.Strokes) == 0 || len(plan.Strokes) > 64 {
		return nil, fmt.Errorf("Gemini drawing plan has %d strokes", len(plan.Strokes))
	}

	strokes := make([]DrawStroke, len(plan.Strokes))
	for i, stroke := range plan.Strokes {
		if !normalizedCoordinate(stroke.FromX) || !normalizedCoordinate(stroke.FromY) ||
			!normalizedCoordinate(stroke.ToX) || !normalizedCoordinate(stroke.ToY) {
			return nil, fmt.Errorf("Gemini drawing plan has invalid coordinates")
		}
		strokes[i] = DrawStroke{
			FromX:     stroke.FromX,
			FromY:     stroke.FromY,
			ToX:       stroke.ToX,
			ToY:       stroke.ToY,
			Color:     "#000000",
			BrushSize: 5,
		}
	}
	return strokes, nil
}

type geminiDrawingRequest struct {
	Contents         []geminiContent     `json:"contents"`
	GenerationConfig geminiDrawingConfig `json:"generationConfig"`
}

type geminiDrawingConfig struct {
	Temperature      float64        `json:"temperature"`
	MaxOutputTokens  int            `json:"maxOutputTokens"`
	ResponseMIMEType string         `json:"responseMimeType"`
	ResponseSchema   map[string]any `json:"responseSchema"`
}

type geminiDrawingPlan struct {
	Strokes []geminiDrawingStroke `json:"strokes"`
}

type geminiDrawingStroke struct {
	FromX float64 `json:"from_x"`
	FromY float64 `json:"from_y"`
	ToX   float64 `json:"to_x"`
	ToY   float64 `json:"to_y"`
}

func (p GeminiDrawingProvider) baseURL() string {
	if p.BaseURL != "" {
		return strings.TrimRight(p.BaseURL, "/")
	}
	return "https://generativelanguage.googleapis.com"
}

func (p GeminiDrawingProvider) client() *http.Client {
	if p.Client != nil {
		return p.Client
	}
	return http.DefaultClient
}

func (p GeminiDrawingProvider) model() string {
	if p.Model != "" {
		return p.Model
	}
	return defaultGeminiDrawingModel
}

func (p GeminiDrawingProvider) timeout() time.Duration {
	if p.Timeout > 0 {
		return p.Timeout
	}
	return 3 * time.Second
}

func geminiDrawingPrompt(input DrawingInput) string {
	return fmt.Sprintf(
		"Draw the word %q as 1 to 64 simple black line segments on a normalized 0 to 1 canvas. Return only the required JSON. The drawer style is %q and difficulty is %q.",
		input.Word,
		input.Profile.BehaviorStyle,
		input.Profile.Difficulty,
	)
}

func geminiDrawingSchema() map[string]any {
	coordinate := map[string]any{"type": "number", "minimum": 0, "maximum": 1}
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"strokes": map[string]any{
				"type": "array", "minItems": 1, "maxItems": 64,
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"from_x": coordinate, "from_y": coordinate,
						"to_x": coordinate, "to_y": coordinate,
					},
					"required": []string{"from_x", "from_y", "to_x", "to_y"},
				},
			},
		},
		"required": []string{"strokes"},
	}
}

func normalizedCoordinate(value float64) bool {
	return value >= 0 && value <= 1
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
