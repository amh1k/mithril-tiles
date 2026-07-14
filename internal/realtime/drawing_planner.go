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
const defaultGrokDrawingModel = "grok-4.3"
const defaultGroqDrawingModel = "llama-3.3-70b-versatile"
const defaultGroqDrawingTimeout = 15 * time.Second

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

	return strokesFromDrawingPlan(plan, "Gemini")
}

// GrokDrawingProvider implements DrawingProvider using xAI's OpenAI-compatible API.
type GrokDrawingProvider struct {
	APIKey  string
	BaseURL string
	Client  *http.Client
	Model   string
	Timeout time.Duration
}

func (p GrokDrawingProvider) Plan(ctx context.Context, input DrawingInput) ([]DrawStroke, error) {
	if strings.TrimSpace(p.APIKey) == "" {
		return nil, fmt.Errorf("Grok API key is not configured")
	}

	requestContext, cancel := context.WithTimeout(ctx, p.timeout())
	defer cancel()
	payload, err := json.Marshal(grokChatCompletionRequest{
		Model:       p.model(),
		Messages:    []grokChatMessage{{Role: "user", Content: geminiDrawingPrompt(input)}},
		Temperature: 0.4,
		MaxTokens:   2048,
		ResponseFormat: &grokResponseFormat{
			Type: "json_schema",
			JSONSchema: grokJSONSchemaSpec{
				Name:   "drawing_plan",
				Strict: true,
				Schema: geminiDrawingSchema(),
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("marshal Grok drawing request: %w", err)
	}

	request, err := http.NewRequestWithContext(
		requestContext,
		http.MethodPost,
		p.baseURL()+"/chat/completions",
		bytes.NewReader(payload),
	)
	if err != nil {
		return nil, fmt.Errorf("create Grok drawing request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+p.APIKey)

	response, err := p.client().Do(request)
	if err != nil {
		return nil, fmt.Errorf("call Grok drawing provider: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 8<<10))
		return nil, fmt.Errorf(
			"Grok drawing provider returned status %d: %s",
			response.StatusCode,
			strings.TrimSpace(string(body)),
		)
	}

	var result grokChatCompletionResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode Grok drawing response: %w", err)
	}
	if len(result.Choices) == 0 || strings.TrimSpace(result.Choices[0].Message.Content) == "" {
		return nil, fmt.Errorf("Grok drawing provider returned no candidate")
	}

	var plan geminiDrawingPlan
	if err := json.Unmarshal([]byte(result.Choices[0].Message.Content), &plan); err != nil {
		return nil, fmt.Errorf("decode Grok drawing plan: %w", err)
	}
	return strokesFromDrawingPlan(plan, "Grok")
}

func strokesFromDrawingPlan(plan geminiDrawingPlan, provider string) ([]DrawStroke, error) {
	if len(plan.Strokes) == 0 || len(plan.Strokes) > 64 {
		return nil, fmt.Errorf("%s drawing plan has %d strokes", provider, len(plan.Strokes))
	}

	strokes := make([]DrawStroke, len(plan.Strokes))
	for i, stroke := range plan.Strokes {
		if !normalizedCoordinate(stroke.FromX) || !normalizedCoordinate(stroke.FromY) ||
			!normalizedCoordinate(stroke.ToX) || !normalizedCoordinate(stroke.ToY) {
			return nil, fmt.Errorf("%s drawing plan has invalid coordinates", provider)
		}
		strokes[i] = DrawStroke{FromX: stroke.FromX, FromY: stroke.FromY, ToX: stroke.ToX, ToY: stroke.ToY, Color: "#000000", BrushSize: 0.012}
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

func (p GrokDrawingProvider) baseURL() string {
	if p.BaseURL != "" {
		return strings.TrimRight(p.BaseURL, "/")
	}
	return "https://api.x.ai/v1"
}

func (p GrokDrawingProvider) client() *http.Client {
	if p.Client != nil {
		return p.Client
	}
	return http.DefaultClient
}

func (p GrokDrawingProvider) model() string {
	if p.Model != "" {
		return p.Model
	}
	return defaultGrokDrawingModel
}

func (p GrokDrawingProvider) timeout() time.Duration {
	if p.Timeout > 0 {
		return p.Timeout
	}
	return 3 * time.Second
}

// GroqDrawingProvider implements DrawingProvider using Groq's OpenAI-compatible API.
type GroqDrawingProvider struct {
	APIKey  string
	BaseURL string
	Client  *http.Client
	Model   string
	Timeout time.Duration
}

func (p GroqDrawingProvider) Plan(ctx context.Context, input DrawingInput) ([]DrawStroke, error) {
	if strings.TrimSpace(p.APIKey) == "" {
		return nil, fmt.Errorf("Groq API key is not configured")
	}

	requestContext, cancel := context.WithTimeout(ctx, p.timeout())
	defer cancel()
	prompt := groqDrawingPrompt(input)
	payload, err := json.Marshal(grokChatCompletionRequest{
		Model:       p.model(),
		Messages:    []grokChatMessage{{Role: "user", Content: prompt}},
		Temperature: 0.4,
		MaxTokens:   2048,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal Groq drawing request: %w", err)
	}

	request, err := http.NewRequestWithContext(requestContext, http.MethodPost, p.baseURL()+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create Groq drawing request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+p.APIKey)

	response, err := p.client().Do(request)
	if err != nil {
		return nil, fmt.Errorf("call Groq drawing provider: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 8<<10))
		return nil, fmt.Errorf("Groq drawing provider returned status %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}

	var result grokChatCompletionResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode Groq drawing response: %w", err)
	}
	if len(result.Choices) == 0 || strings.TrimSpace(result.Choices[0].Message.Content) == "" {
		return nil, fmt.Errorf("Groq drawing provider returned no candidate")
	}

	plan, err := decodeGroqDrawingPlan(result.Choices[0].Message.Content)
	if err != nil {
		return nil, err
	}
	return strokesFromDrawingPlan(plan, "Groq")
}

func decodeGroqDrawingPlan(content string) (geminiDrawingPlan, error) {
	content = strings.TrimSpace(content)
	if strings.HasPrefix(content, "```") {
		firstLineEnd := strings.IndexByte(content, '\n')
		if firstLineEnd == -1 {
			return geminiDrawingPlan{}, fmt.Errorf("decode Groq drawing plan: incomplete Markdown code fence")
		}
		content = strings.TrimSpace(content[firstLineEnd+1:])
		if !strings.HasSuffix(content, "```") {
			return geminiDrawingPlan{}, fmt.Errorf("decode Groq drawing plan: unterminated Markdown code fence")
		}
		content = strings.TrimSpace(strings.TrimSuffix(content, "```"))
	}

	var plan geminiDrawingPlan
	if err := json.Unmarshal([]byte(content), &plan); err != nil {
		return geminiDrawingPlan{}, fmt.Errorf("decode Groq drawing plan: %w", err)
	}
	return plan, nil
}

func (p GroqDrawingProvider) baseURL() string {
	if p.BaseURL != "" {
		return strings.TrimRight(p.BaseURL, "/")
	}
	return "https://api.groq.com/openai/v1"
}

func (p GroqDrawingProvider) client() *http.Client {
	if p.Client != nil {
		return p.Client
	}
	return http.DefaultClient
}

func (p GroqDrawingProvider) model() string {
	if p.Model != "" {
		return p.Model
	}
	return defaultGroqDrawingModel
}

func (p GroqDrawingProvider) timeout() time.Duration {
	if p.Timeout > 0 {
		return p.Timeout
	}
	return defaultGroqDrawingTimeout
}

func groqDrawingPrompt(input DrawingInput) string {
	return fmt.Sprintf(
		"You are drawing a Pictionary clue. Create a recognizable pictogram for the word %q. "+
			"Plan 8 to 24 black line segments on a normalized 0 to 1 canvas. Use the visual features a human would recognize first and compose the object near the center. "+
			"Do not write letters, spell the word, draw a border, draw a grid, or add decorative or repeated filler lines. "+
			"The drawer style is %q and difficulty is %q. Return only a JSON object in this exact shape: {\"strokes\":[{\"from_x\":0.0,\"from_y\":0.0,\"to_x\":0.0,\"to_y\":0.0}]}",
		input.Word,
		input.Profile.BehaviorStyle,
		input.Profile.Difficulty,
	)
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
		BrushSize: 0.012,
	}
}
