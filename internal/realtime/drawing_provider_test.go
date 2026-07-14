package realtime

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"mithrilTiles.abdulmoiz.net/internal/data"
)

func TestTemplateDrawingProviderPlansDrawerWord(t *testing.T) {
	provider := TemplateDrawingProvider{}
	strokes, err := provider.Plan(context.Background(), DrawingInput{
		Word:    "tree",
		Profile: data.BotProfile{Name: "Drawer Bot"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(strokes) != len(drawingTemplates["tree"]) {
		t.Fatalf("expected tree drawing plan, got %d strokes", len(strokes))
	}
}

func TestGeminiDrawingProviderParsesNormalizedStrokePlan(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-goog-api-key") != "test-key" {
			t.Error("expected Gemini API key header")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"candidates":[{"content":{"parts":[{"text":"{\"strokes\":[{\"from_x\":0.1,\"from_y\":0.2,\"to_x\":0.3,\"to_y\":0.4}]}"}]}}]}`))
	}))
	defer server.Close()

	provider := GeminiDrawingProvider{APIKey: "test-key", BaseURL: server.URL}
	strokes, err := provider.Plan(context.Background(), DrawingInput{Word: "secret-word"})
	if err != nil {
		t.Fatal(err)
	}
	if len(strokes) != 1 || strokes[0].Color != "#000000" || strokes[0].BrushSize != 5 {
		t.Fatalf("unexpected Gemini drawing plan: %+v", strokes)
	}
}
