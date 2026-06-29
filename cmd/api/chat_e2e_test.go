package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

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

	app, server := NewTestApplicationE2E(t)
	//req, _ := http.NewRequest(http.MethodGet, "/v1/rooms/:roomID/ws", nil)
	// req.Header.Set("Authorization", "Bearer "+token)
	// resp, err := server.Client().Do(req)
	// if err != nil {
	// 	t.Fatal(err)
	// }
	token, err := GetAuthenticatedGuest(server, 1)
	if err != nil {
		t.Fatal(err)
	}
	go realtime.StartPlayer("/v1/rooms/:roomID/ws", *token)
	token, err = GetAuthenticatedGuest(server, 2)
	if err != nil {
		t.Fatal(err)
	}
	go realtime.StartPlayer("/v1/rooms/:roomID/ws", *token)




}
