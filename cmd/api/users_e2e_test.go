package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"

	"mithrilTiles.abdulmoiz.net/internal/data"
)

func userRequest(t *testing.T, serverURL, method, path, token string, body any) *http.Response {
	t.Helper()

	var requestBody bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&requestBody).Encode(body); err != nil {
			t.Fatal(err)
		}
	}

	req, err := http.NewRequest(method, serverURL+path, &requestBody)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return resp
}

func TestUserLifecycle(t *testing.T) {
	_, server := NewTestApplicationE2E(t)

	invalid := userRequest(
		t,
		server.URL,
		http.MethodPost,
		"/v1/users/register",
		"",
		map[string]string{},
	)
	defer invalid.Body.Close()
	if invalid.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf(
			"invalid registration: expected status %d, got %d",
			http.StatusUnprocessableEntity,
			invalid.StatusCode,
		)
	}

	registration := map[string]string{
		"display_name": "Test Player",
		"handle":       "test-player",
		"email":        "player@example.com",
		"password":     "correct horse battery staple",
	}
	resp := userRequest(
		t,
		server.URL,
		http.MethodPost,
		"/v1/users/register",
		"",
		registration,
	)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("register: expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	var registered struct {
		User                data.User  `json:"user"`
		AuthenticationToken data.Token `json:"authentication_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&registered); err != nil {
		t.Fatal(err)
	}
	if registered.User.ID.String() == "00000000-0000-0000-0000-000000000000" {
		t.Fatal("register: expected a created user")
	}
	if registered.User.AccountStatus != "active" {
		t.Fatalf("register: expected active account, got %q", registered.User.AccountStatus)
	}
	if registered.AuthenticationToken.Plaintext == "" {
		t.Fatal("register: expected an authentication token")
	}

	duplicateHandle := userRequest(
		t,
		server.URL,
		http.MethodPost,
		"/v1/users/register",
		"",
		map[string]string{
			"display_name": "Another Player",
			"handle":       registration["handle"],
			"email":        "another@example.com",
			"password":     "correct horse battery staple",
		},
	)
	defer duplicateHandle.Body.Close()
	if duplicateHandle.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf(
			"duplicate handle: expected status %d, got %d",
			http.StatusUnprocessableEntity,
			duplicateHandle.StatusCode,
		)
	}

	duplicateEmail := userRequest(
		t,
		server.URL,
		http.MethodPost,
		"/v1/users/register",
		"",
		map[string]string{
			"display_name": "Another Player",
			"handle":       "another-player",
			"email":        registration["email"],
			"password":     "correct horse battery staple",
		},
	)
	defer duplicateEmail.Body.Close()
	if duplicateEmail.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf(
			"duplicate email: expected status %d, got %d",
			http.StatusUnprocessableEntity,
			duplicateEmail.StatusCode,
		)
	}

	token := registered.AuthenticationToken.Plaintext
	update := userRequest(
		t,
		server.URL,
		http.MethodPatch,
		"/v1/users/update",
		token,
		map[string]string{"display_name": "Updated Player"},
	)
	defer update.Body.Close()
	if update.StatusCode != http.StatusOK {
		t.Fatalf("update: expected status %d, got %d", http.StatusOK, update.StatusCode)
	}

	remove := userRequest(
		t,
		server.URL,
		http.MethodDelete,
		"/v1/users/delete",
		token,
		nil,
	)
	defer remove.Body.Close()
	if remove.StatusCode != http.StatusOK {
		t.Fatalf("delete: expected status %d, got %d", http.StatusOK, remove.StatusCode)
	}
}
