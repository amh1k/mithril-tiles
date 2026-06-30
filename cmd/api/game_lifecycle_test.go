package main

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
	"mithrilTiles.abdulmoiz.net/internal/realtime"
)

func TestStartGameTransaction(t *testing.T) {
	app, server := NewTestApplicationE2E(t)

	token1, err := GetAuthenticatedGuest(server, 1)
	if err != nil {
		t.Fatal(err)
	}
	token2, err := GetAuthenticatedGuest(server, 2)
	if err != nil {
		t.Fatal(err)
	}
	guest1, err := app.models.GuestSessions.GetForToken(data.ScopeGuest, *token1)
	if err != nil {
		t.Fatal(err)
	}
	guest2, err := app.models.GuestSessions.GetForToken(data.ScopeGuest, *token2)
	if err != nil {
		t.Fatal(err)
	}
	host := data.NewGuestPrincipal(guest1)
	otherPlayer := data.NewGuestPrincipal(guest2)
	participants := []data.Principal{*host, *otherPlayer}

	wordPack := &data.WordPack{
		Name:        "Transactional Start Words",
		Slug:        "transactional-start-words",
		Description: "Words for atomic game-start testing",
		IsActive:    true,
	}
	if err := app.models.WordPacks.Insert(wordPack); err != nil {
		t.Fatal(err)
	}
	word := &data.Word{
		WordPackID: wordPack.ID,
		Text:       "castle",
		Difficulty: "easy",
	}
	if err := app.models.Words.Insert(word); err != nil {
		t.Fatal(err)
	}

	service := newGameLifecycleService(app.models)
	result, err := service.StartGame(context.Background(), realtime.GamePersistenceRequest{
		RoomCode:         "atomic-success",
		WordPackID:       wordPack.ID,
		SettingsSnapshot: json.RawMessage(`{"mode":"test"}`),
		Host:             *host,
		Participants:     participants,
		Drawer:           *otherPlayer,
		DurationSeconds:  30,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Game.Status != "started" {
		t.Fatalf("expected started game, got %q", result.Game.Status)
	}
	if len(result.Participants) != 2 {
		t.Fatalf("expected 2 participants, got %d", len(result.Participants))
	}
	if result.Round.RoundNumber != 1 {
		t.Fatalf("expected round 1, got %d", result.Round.RoundNumber)
	}
	if result.Round.WordID != word.ID {
		t.Fatalf("expected word %s, got %s", word.ID, result.Round.WordID)
	}
	if result.Round.DrawerParticipantID == uuid.Nil {
		t.Fatal("expected a persisted drawer participant")
	}

	emptyPack := &data.WordPack{
		Name:        "Empty Transactional Pack",
		Slug:        "empty-transactional-pack",
		Description: "Pack used to verify rollback",
		IsActive:    true,
	}
	if err := app.models.WordPacks.Insert(emptyPack); err != nil {
		t.Fatal(err)
	}
	_, err = service.StartGame(context.Background(), realtime.GamePersistenceRequest{
		RoomCode:        "atomic-rollback",
		WordPackID:      emptyPack.ID,
		Host:            *host,
		Participants:    participants,
		Drawer:          *host,
		DurationSeconds: 30,
	})
	if err == nil {
		t.Fatal("expected empty word pack to fail game start")
	}

	var gameCount int
	err = app.models.Games.DB.QueryRow(
		context.Background(),
		`SELECT count(*) FROM games WHERE room_code = $1`,
		"atomic-rollback",
	).Scan(&gameCount)
	if err != nil {
		t.Fatal(err)
	}
	if gameCount != 0 {
		t.Fatalf("expected rollback to leave 0 games, got %d", gameCount)
	}
}
