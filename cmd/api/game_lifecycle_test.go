package main

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
	"mithrilTiles.abdulmoiz.net/internal/realtime"
)

func TestEndGameValidationErrorIsNotRetryable(t *testing.T) {
	service := newGameLifecycleService(data.Models{})

	_, err := service.EndGame(context.Background(), realtime.GameEndRequest{})
	if !errors.Is(err, realtime.ErrGameEndNotRetryable) {
		t.Fatalf("expected non-retryable validation error, got %v", err)
	}
}

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

func TestEndGameIsIdempotent(t *testing.T) {
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

	wordPack := &data.WordPack{
		Name:        "Idempotent End Game Words",
		Slug:        "idempotent-end-game-words",
		Description: "Words for idempotent game-end testing",
		IsActive:    true,
	}
	if err := app.models.WordPacks.Insert(wordPack); err != nil {
		t.Fatal(err)
	}
	if err := app.models.Words.Insert(&data.Word{
		WordPackID: wordPack.ID,
		Text:       "castle",
		Difficulty: "easy",
	}); err != nil {
		t.Fatal(err)
	}

	service := newGameLifecycleService(app.models)
	started, err := service.StartGame(context.Background(), realtime.GamePersistenceRequest{
		RoomCode:         "idempotent-end",
		WordPackID:       wordPack.ID,
		SettingsSnapshot: json.RawMessage(`{"mode":"test"}`),
		Host:             *host,
		Participants:     []data.Principal{*host, *otherPlayer},
		Drawer:           *host,
		DurationSeconds:  30,
	})
	if err != nil {
		t.Fatal(err)
	}

	request := realtime.GameEndRequest{
		GameID:   started.Game.ID,
		RoomCode: started.Game.RoomCode,
		Scores: []realtime.PlayerFinalScore{
			{Principal: *host, Points: 10},
			{Principal: *otherPlayer, Points: 5},
		},
	}
	type endGameCallResult struct {
		result *realtime.GameEndResult
		err    error
	}
	startCalls := make(chan struct{})
	callResults := make(chan endGameCallResult, 2)
	for range 2 {
		go func() {
			<-startCalls
			result, err := service.EndGame(context.Background(), request)
			callResults <- endGameCallResult{result: result, err: err}
		}()
	}
	close(startCalls)

	calls := make([]*realtime.GameEndResult, 0, 2)
	for range 2 {
		call := <-callResults
		if call.err != nil {
			t.Fatal(call.err)
		}
		calls = append(calls, call.result)
	}
	first, second := calls[0], calls[1]

	if len(first.FinalScores) != 2 || len(second.FinalScores) != 2 {
		t.Fatalf(
			"expected two final scores from both calls, got %d and %d",
			len(first.FinalScores),
			len(second.FinalScores),
		)
	}
	for i := range first.FinalScores {
		if first.FinalScores[i].ID != second.FinalScores[i].ID {
			t.Fatal("idempotent call returned different final-score rows")
		}
	}

	var (
		status     string
		endedAt    time.Time
		finalCount int
	)
	err = app.models.Games.DB.QueryRow(
		context.Background(),
		`SELECT status, ended_at FROM games WHERE id = $1`,
		started.Game.ID,
	).Scan(&status, &endedAt)
	if err != nil {
		t.Fatal(err)
	}
	if status != "completed" || endedAt.IsZero() {
		t.Fatalf("expected completed game with ended_at, got status %q", status)
	}
	err = app.models.GameFinalScores.DB.QueryRow(
		context.Background(),
		`SELECT count(*) FROM game_final_scores WHERE game_id = $1`,
		started.Game.ID,
	).Scan(&finalCount)
	if err != nil {
		t.Fatal(err)
	}
	if finalCount != 2 {
		t.Fatalf("expected two persisted final scores, got %d", finalCount)
	}
}
