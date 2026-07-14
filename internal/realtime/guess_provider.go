package realtime

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

type GuessInput struct {
	RoundNo         int
	MaskedWord      string
	Strokes         []DrawStroke
	PreviousGuesses []string
}

type GuessProvider interface {
	Guess(ctx context.Context, input GuessInput) (string, error)
}
type DeterministicGuessProvider struct{}

func (DeterministicGuessProvider) Guess(ctx context.Context, input GuessInput) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}

	attempted := make(map[string]struct{}, len(input.PreviousGuesses))
	for _, guess := range input.PreviousGuesses {
		attempted[strings.ToLower(strings.TrimSpace(guess))] = struct{}{}
	}
	return deterministicTemplateGuess(input.MaskedWord, attempted), nil
}

const defaultGeminiGuessModel = "gemini-2.5-flash"
const defaultGrokGuessModel = "grok-4.3"

type GeminiGuessProvider struct {
	APIKey  string
	BaseURL string
	Client  *http.Client
	Model   string
	Timeout time.Duration
}

func (p GeminiGuessProvider) Guess(ctx context.Context, input GuessInput) (string, error) {
	if strings.TrimSpace(p.APIKey) == "" {
		return "", fmt.Errorf("gemini API key is not configured")
	}

	requestContext, cancel := context.WithTimeout(ctx, p.timeout())
	defer cancel()

	payload, err := json.Marshal(geminiGenerateContentRequest{
		Contents: []geminiContent{{
			Parts: []geminiPart{{Text: geminiGuessPrompt(input)}},
		}},
		GenerationConfig: geminiGenerationConfig{
			Temperature:      0.2,
			MaxOutputTokens:  16,
			ResponseMIMEType: "text/plain",
		},
	})
	if err != nil {
		return "", fmt.Errorf("marshal Gemini guess request: %w", err)
	}

	request, err := http.NewRequestWithContext(
		requestContext,
		http.MethodPost,
		fmt.Sprintf("%s/v1beta/models/%s:generateContent", p.baseURL(), p.model()),
		bytes.NewReader(payload),
	)
	if err != nil {
		return "", fmt.Errorf("create Gemini guess request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("x-goog-api-key", p.APIKey)

	response, err := p.client().Do(request)
	if err != nil {
		return "", fmt.Errorf("call Gemini guess provider: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("Gemini guess provider returned status %d", response.StatusCode)
	}

	var result geminiGenerateContentResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&result); err != nil {
		return "", fmt.Errorf("decode Gemini guess response: %w", err)
	}
	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("Gemini guess provider returned no candidate")
	}
	fmt.Println(strings.TrimSpace(result.Candidates[0].Content.Parts[0].Text), nil)

	return strings.TrimSpace(result.Candidates[0].Content.Parts[0].Text), nil
}

type geminiGenerateContentRequest struct {
	Contents         []geminiContent        `json:"contents"`
	GenerationConfig geminiGenerationConfig `json:"generationConfig"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiGenerationConfig struct {
	Temperature      float64 `json:"temperature"`
	MaxOutputTokens  int     `json:"maxOutputTokens"`
	ResponseMIMEType string  `json:"responseMimeType"`
}

type geminiGenerateContentResponse struct {
	Candidates []struct {
		Content geminiContent `json:"content"`
	} `json:"candidates"`
}

func (p GeminiGuessProvider) baseURL() string {
	if p.BaseURL != "" {
		return strings.TrimRight(p.BaseURL, "/")
	}
	return "https://generativelanguage.googleapis.com"
}

func (p GeminiGuessProvider) client() *http.Client {
	if p.Client != nil {
		return p.Client
	}
	return http.DefaultClient
}

func (p GeminiGuessProvider) model() string {
	if p.Model != "" {
		return p.Model
	}
	return defaultGeminiGuessModel
}

func (p GeminiGuessProvider) timeout() time.Duration {
	if p.Timeout > 0 {
		return p.Timeout
	}
	return 2 * time.Second
}

// GrokGuessProvider implements GuessProvider using xAI's OpenAI-compatible API.
type GrokGuessProvider struct {
	APIKey  string
	BaseURL string
	Client  *http.Client
	Model   string
	Timeout time.Duration
}

func (p GrokGuessProvider) Guess(ctx context.Context, input GuessInput) (string, error) {
	if strings.TrimSpace(p.APIKey) == "" {
		return "", fmt.Errorf("Grok API key is not configured")
	}

	requestContext, cancel := context.WithTimeout(ctx, p.timeout())
	defer cancel()
	payload, err := json.Marshal(grokChatCompletionRequest{
		Model:       p.model(),
		Messages:    []grokChatMessage{{Role: "user", Content: geminiGuessPrompt(input)}},
		Temperature: 0.2,
		MaxTokens:   16,
	})
	if err != nil {
		return "", fmt.Errorf("marshal Grok guess request: %w", err)
	}

	request, err := http.NewRequestWithContext(
		requestContext,
		http.MethodPost,
		p.baseURL()+"/chat/completions",
		bytes.NewReader(payload),
	)
	if err != nil {
		return "", fmt.Errorf("create Grok guess request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+p.APIKey)

	response, err := p.client().Do(request)
	if err != nil {
		return "", fmt.Errorf("call Grok guess provider: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("Grok guess provider returned status %d", response.StatusCode)
	}

	var result grokChatCompletionResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&result); err != nil {
		return "", fmt.Errorf("decode Grok guess response: %w", err)
	}
	if len(result.Choices) == 0 || strings.TrimSpace(result.Choices[0].Message.Content) == "" {
		return "", fmt.Errorf("Grok guess provider returned no candidate")
	}

	return strings.TrimSpace(result.Choices[0].Message.Content), nil
}

type grokChatCompletionRequest struct {
	Model          string              `json:"model"`
	Messages       []grokChatMessage   `json:"messages"`
	Temperature    float64             `json:"temperature"`
	MaxTokens      int                 `json:"max_tokens"`
	ResponseFormat *grokResponseFormat `json:"response_format,omitempty"`
}

type grokChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type grokResponseFormat struct {
	Type       string             `json:"type"`
	JSONSchema grokJSONSchemaSpec `json:"json_schema"`
}

type grokJSONSchemaSpec struct {
	Name   string         `json:"name"`
	Strict bool           `json:"strict"`
	Schema map[string]any `json:"schema"`
}

type grokChatCompletionResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (p GrokGuessProvider) baseURL() string {
	if p.BaseURL != "" {
		return strings.TrimRight(p.BaseURL, "/")
	}
	return "https://api.x.ai/v1"
}

func (p GrokGuessProvider) client() *http.Client {
	if p.Client != nil {
		return p.Client
	}
	return http.DefaultClient
}

func (p GrokGuessProvider) model() string {
	if p.Model != "" {
		return p.Model
	}
	return defaultGrokGuessModel
}

func (p GrokGuessProvider) timeout() time.Duration {
	if p.Timeout > 0 {
		return p.Timeout
	}
	return 2 * time.Second
}

func geminiGuessPrompt(input GuessInput) string {
	strokes := input.Strokes
	if len(strokes) > 64 {
		strokes = strokes[len(strokes)-64:]
	}

	var prompt strings.Builder
	prompt.WriteString("You are guessing a drawing-game word. Return only one candidate word or phrase that matches the masked word. Do not explain.\n")
	fmt.Fprintf(&prompt, "Masked word: %s\n", input.MaskedWord)
	if len(input.PreviousGuesses) > 0 {
		fmt.Fprintf(&prompt, "Already guessed: %s\n", strings.Join(input.PreviousGuesses, ", "))
	}
	prompt.WriteString("Recent public drawing strokes:\n")
	for _, stroke := range strokes {
		fmt.Fprintf(&prompt, "%.2f,%.2f -> %.2f,%.2f\n", stroke.FromX, stroke.FromY, stroke.ToX, stroke.ToY)
	}
	return prompt.String()
}

func attemptedGuesses(attempted map[string]struct{}) []string {
	guesses := make([]string, 0, len(attempted))
	for guess := range attempted {
		guesses = append(guesses, guess)
	}
	sort.Strings(guesses)
	return guesses
}

func validProviderGuess(maskedWord, guess string, attempted map[string]struct{}) string {
	guess = strings.ToLower(strings.TrimSpace(guess))
	maskedWord = strings.ToLower(strings.TrimSpace(maskedWord))
	if guess == "" || len(guess) != len(maskedWord) {
		return ""
	}
	if _, alreadyTried := attempted[guess]; alreadyTried {
		return ""
	}
	for i := range guess {
		if maskedWord[i] != '_' && maskedWord[i] != guess[i] {
			return ""
		}
	}
	return guess
}

func templateCandidates() []string {
	candidates := make([]string, 0, len(drawingTemplates))
	for candidate := range drawingTemplates {
		candidates = append(candidates, candidate)
	}
	sort.Strings(candidates)
	return candidates
}
