package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"mithrilTiles.abdulmoiz.net/internal/data"
	"mithrilTiles.abdulmoiz.net/internal/realtime"
)

func GetAuthenticatedGuest(server *httptest.Server, no int) (*string, error) {
	playerName := fmt.Sprintf("player%d", no)
	body := map[string]any{
		"display_name": playerName,
	}
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(
		http.MethodPost,
		server.URL+"/v1/guest-sessions",
		bytes.NewBuffer(jsonBody),
	)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := server.Client().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("create guest session: unexpected status %s", resp.Status)
	}

	var input struct {
		GuestSession        data.GuestSession `json:"guest_session"`
		AuthenticationToken data.Token        `json:"authentication_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&input); err != nil {
		return nil, err
	}

	return &input.AuthenticationToken.Plaintext, nil
}

func TestChat(t *testing.T) {
	_, server := NewTestApplicationE2E(t)
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/v1/rooms/1234/ws"

	token, err := GetAuthenticatedGuest(server, 1)
	if err != nil {
		t.Fatal(err)
	}
	player1 := realtime.StartPlayer(wsURL, *token)
	t.Cleanup(player1.Cancel)
	token, err = GetAuthenticatedGuest(server, 2)
	if err != nil {
		t.Fatal(err)
	}
	player2 := realtime.StartPlayer(wsURL, *token)
	t.Cleanup(player2.Cancel)
	for _, player := range []*realtime.TestPlayer{player1, player2} {
		select {
		case <-player.Ready:
		case err := <-player.Errors:
			t.Fatal(err)
		case <-time.After(3 * time.Second):
			t.Fatal("timed out waiting for player connection")
		}
	}

	player1.Send <- "Player1 here"
}
