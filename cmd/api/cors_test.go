package main

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
)

func TestParseTrustedOrigins(t *testing.T) {
	origins, err := parseTrustedOrigins(
		"http://localhost:3000, https://app.example.com",
	)
	if err != nil {
		t.Fatal(err)
	}

	want := []string{"http://localhost:3000", "https://app.example.com"}
	if !reflect.DeepEqual(origins, want) {
		t.Fatalf("got %v, want %v", origins, want)
	}

	if _, err := parseTrustedOrigins("https://app.example.com/path"); err == nil {
		t.Fatal("expected an origin containing a path to be rejected")
	}
}

func TestCORS(t *testing.T) {
	app := &application{
		config: config{
			cors: struct {
				trustedOrigins []string
			}{
				trustedOrigins: []string{"https://app.example.com"},
			},
		},
	}

	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := app.enableCORS(next)

	t.Run("trusted origin preflight", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodOptions, "/v1/rooms/room/ws-ticket", nil)
		request.Header.Set("Origin", "https://app.example.com")
		request.Header.Set("Access-Control-Request-Method", http.MethodPost)
		request.Header.Set("Access-Control-Request-Headers", "authorization")
		response := httptest.NewRecorder()

		handler.ServeHTTP(response, request)

		if response.Code != http.StatusNoContent {
			t.Fatalf("expected status 204, got %d", response.Code)
		}
		if got := response.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
			t.Fatalf("unexpected allowed origin %q", got)
		}
		if got := response.Header().Get("Access-Control-Allow-Headers"); got != "Authorization, Content-Type" {
			t.Fatalf("unexpected allowed headers %q", got)
		}
	})

	t.Run("untrusted origin is not allowed", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodOptions, "/v1/rooms/room/ws-ticket", nil)
		request.Header.Set("Origin", "https://evil.example.com")
		request.Header.Set("Access-Control-Request-Method", http.MethodPost)
		response := httptest.NewRecorder()

		handler.ServeHTTP(response, request)

		if got := response.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Fatalf("unexpected allowed origin %q", got)
		}
	})
}
