package realtime

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDeterministicGuessProviderUsesPublicMaskAndPreviousGuesses(t *testing.T) {
	provider := DeterministicGuessProvider{}
	guess, err := provider.Guess(context.Background(), GuessInput{
		RoundNo:         1,
		MaskedWord:      "____",
		Strokes:         []DrawStroke{stroke(0.1, 0.1, 0.2, 0.2)},
		PreviousGuesses: []string{"tree"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if guess != "house" {
		t.Fatalf("expected remaining public template candidate, got %q", guess)
	}
}

func TestGeminiGuessProviderSendsOnlyPublicGuessInput(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-goog-api-key") != "test-key" {
			t.Error("expected Gemini API key header")
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read provider request: %v", err)
			return
		}
		if strings.Contains(string(body), "secret-word") {
			t.Error("provider request exposed a secret word")
		}
		if !strings.Contains(string(body), "Masked word: ____") {
			t.Fatalf("provider request did not include masked word: %s", body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"candidates":[{"content":{"parts":[{"text":"tree"}]}}]}`))
	}))
	defer server.Close()

	provider := GeminiGuessProvider{APIKey: "test-key", BaseURL: server.URL}
	guess, err := provider.Guess(context.Background(), GuessInput{
		RoundNo:    1,
		MaskedWord: "____",
		Strokes:    []DrawStroke{stroke(0.1, 0.1, 0.2, 0.2)},
	})
	if err != nil {
		t.Fatal(err)
	}
	if guess != "tree" {
		t.Fatalf("expected Gemini guess %q, got %q", "tree", guess)
	}
}

func TestGrokGuessProviderUsesBearerAuthentication(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Fatalf("unexpected request path %q", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Error("expected Grok Bearer API key header")
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read provider request: %v", err)
			return
		}
		if strings.Contains(string(body), "secret-word") {
			t.Error("provider request exposed a secret word")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"tree"}}]}`))
	}))
	defer server.Close()

	provider := GrokGuessProvider{APIKey: "test-key", BaseURL: server.URL}
	guess, err := provider.Guess(context.Background(), GuessInput{MaskedWord: "____"})
	if err != nil {
		t.Fatal(err)
	}
	if guess != "tree" {
		t.Fatalf("expected Grok guess %q, got %q", "tree", guess)
	}
}

func TestGroqGuessProviderUsesBearerAuthentication(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Fatalf("unexpected request path %q", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Error("expected Groq Bearer API key header")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"tree"}}]}`))
	}))
	defer server.Close()

	provider := GroqGuessProvider{APIKey: "test-key", BaseURL: server.URL}
	guess, err := provider.Guess(context.Background(), GuessInput{MaskedWord: "____"})
	if err != nil {
		t.Fatal(err)
	}
	if guess != "tree" {
		t.Fatalf("expected Groq guess %q, got %q", "tree", guess)
	}
}
