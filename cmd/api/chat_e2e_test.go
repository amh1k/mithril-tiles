package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
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

func waitForPlayerMessage(t *testing.T, player *realtime.TestPlayer, expected string) {
	t.Helper()

	timeout := time.NewTimer(10 * time.Second)
	defer timeout.Stop()

	for {
		select {
		case message, ok := <-player.Receive:
			if !ok {
				t.Fatal("player message channel closed")
			}
			if strings.Contains(message, expected) {
				return
			}
		case err := <-player.Errors:
			t.Fatal(err)
		case <-timeout.C:
			t.Fatalf("timed out waiting for message containing %q", expected)
		}
	}
}

func TestChat(t *testing.T) {
	app, server := NewTestApplicationE2E(t)
	fmt.Println(server.URL)
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/v1/rooms/1234/ws"
	token1, err := GetAuthenticatedGuest(server, 1)
	if err != nil {
		t.Fatal(err)
	}
	token2, err := GetAuthenticatedGuest(server, 2)
	if err != nil {
		t.Fatal(err)
	}
	player1 := realtime.StartPlayer(wsURL, *token1)
	t.Cleanup(player1.Cancel)
	waitForPlayerMessage(t, player1, "*** player1 joined the room ***")

	player2 := realtime.StartPlayer(wsURL, *token2)
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
	msg1 := "Player1 here"
	player1.Send <- msg1
	waitForPlayerMessage(t, player2, msg1)
	msg2 := "Player2 here"
	player2.Send <- msg2
	waitForPlayerMessage(t, player1, msg2)

	// now we start the game
	wordPack := &data.WordPack{
		Name:        "E2E Test Words",
		Slug:        "e2e-test-words",
		Description: "Word pack for the chat E2E test",
		IsActive:    true,
	}
	if err := app.models.WordPacks.Insert(wordPack); err != nil {
		t.Fatal(err)
	}
	word := &data.Word{
		WordPackID: wordPack.ID,
		Text:       "apple",
		Difficulty: "easy",
	}
	if err := app.models.Words.Insert(word); err != nil {
		t.Fatal(err)
	}

	var settingsSnapshot json.RawMessage
	startGameInput := struct {
		WordPackID       uuid.UUID       `json:"word_pack_id"`
		SettingsSnapshot json.RawMessage `json:"settings_snapshot,omitempty"`
	}{
		WordPackID:       wordPack.ID,
		SettingsSnapshot: settingsSnapshot,
	}
	requestBody, err := json.Marshal(startGameInput)
	if err != nil {
		t.Fatal(err)
	}

	startGameURL := server.URL + "/v1/rooms/1234/start"
	req, err := http.NewRequest(
		http.MethodPost,
		startGameURL,
		bytes.NewReader(requestBody),
	)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+*token1)
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	var input struct {
		Game             data.Game              `json:"game"`
		GameParticipants []data.GameParticipant `json:"game_participants"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&input); err != nil {
		t.Fatal(err)
	}

	if input.Game.RoomCode != "1234" {
		t.Fatalf("expected room code %q, got %q", "1234", input.Game.RoomCode)
	}
	if input.Game.Status != "started" {
		t.Fatalf("expected game status %q, got %q", "started", input.Game.Status)
	}
	if input.Game.WordPackID != wordPack.ID {
		t.Fatalf("expected word pack ID %s, got %s", wordPack.ID, input.Game.WordPackID)
	}
	if string(input.Game.SettingsSnapshot) != "{}" {
		t.Fatalf("expected default settings snapshot {}, got %s", input.Game.SettingsSnapshot)
	}
	if len(input.GameParticipants) != 2 {
		t.Fatalf("expected 2 game participants, got %d", len(input.GameParticipants))
	}

	hostFound := false
	for _, participant := range input.GameParticipants {
		if participant.GameID != input.Game.ID {
			t.Fatalf(
				"expected participant game ID %s, got %s",
				input.Game.ID,
				participant.GameID,
			)
		}
		if participant.IsHost && participant.ID == input.Game.HostParticipantID {
			hostFound = true
		}
	}
	if !hostFound {
		t.Fatal("game host was not present in game participants")
	}
	waitForPlayerMessage(t, player1, "Round1 has started")
	// below this is the place where the round has been started
	gameRound, err := app.models.GameRounds.GetByGameAndRoundNumber(input.Game.ID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if gameRound.ID == uuid.Nil {
		t.Fatal("expected persisted game round ID")
	}
	if gameRound.GameID != input.Game.ID {
		t.Fatalf("expected game ID %s, got %s", input.Game.ID, gameRound.GameID)
	}
	if gameRound.RoundNumber != 1 {
		t.Fatalf("expected round number 1, got %d", gameRound.RoundNumber)
	}
	if gameRound.Status != "started" {
		t.Fatalf("expected round status %q, got %q", "started", gameRound.Status)
	}
	if gameRound.WordID != word.ID {
		t.Fatalf("expected word ID %s, got %s", word.ID, gameRound.WordID)
	}
	if gameRound.WordTextSnapshot != word.Text {
		t.Fatalf("expected word snapshot %q, got %q", word.Text, gameRound.WordTextSnapshot)
	}
	if gameRound.DurationSeconds != 5 {
		t.Fatalf("expected round duration 5, got %d", gameRound.DurationSeconds)
	}
	if gameRound.StartedAt.IsZero() {
		t.Fatal("expected round start time")
	}
	if gameRound.EndedAt != nil {
		t.Fatal("expected active round to have no end time")
	}

	drawerFound := false
	for _, participant := range input.GameParticipants {
		if participant.ID == gameRound.DrawerParticipantID {
			drawerFound = true
			break
		}
	}
	if !drawerFound {
		t.Fatal("round drawer was not present in game participants")
	}

	player1.Send <- "/guess apple"
	waitForPlayerMessage(t, player1, "Correct Guess! Congrats")
	waitForPlayerMessage(t, player1, "Round1 has ended")

	completedRound, err := app.models.GameRounds.GetByGameAndRoundNumber(input.Game.ID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if completedRound.ID != gameRound.ID {
		t.Fatalf("expected completed round ID %s, got %s", gameRound.ID, completedRound.ID)
	}
	if completedRound.Status != "completed" {
		t.Fatalf("expected round status %q, got %q", "completed", completedRound.Status)
	}
	if completedRound.EndedAt == nil {
		t.Fatal("expected completed round end time")
	}
	if completedRound.EndedAt.Before(completedRound.StartedAt) {
		t.Fatal("round ended before it started")
	}

	roundScores, err := app.models.RoundScores.GetAllForRound(completedRound.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(roundScores) != 2 {
		t.Fatalf("expected 2 round scores, got %d", len(roundScores))
	}
	expectedScores := make(map[uuid.UUID]int, len(input.GameParticipants))
	for _, participant := range input.GameParticipants {
		switch participant.DisplayNameSnapshot {
		case "player1":
			expectedScores[participant.ID] = 1
		case "player2":
			expectedScores[participant.ID] = 0
		}
	}
	if len(expectedScores) != 2 {
		t.Fatal("expected game participants for player1 and player2")
	}

	seenScores := make(map[uuid.UUID]bool, len(roundScores))
	for _, roundScore := range roundScores {
		expectedPoints, ok := expectedScores[roundScore.ParticipantID]
		if !ok {
			t.Fatalf("unexpected score participant %s", roundScore.ParticipantID)
		}
		if roundScore.RoundID != completedRound.ID {
			t.Fatalf("expected score round ID %s, got %s", completedRound.ID, roundScore.RoundID)
		}
		if roundScore.PointsEarned != expectedPoints {
			t.Fatalf(
				"expected participant %s to earn %d point(s), got %d",
				roundScore.ParticipantID,
				expectedPoints,
				roundScore.PointsEarned,
			)
		}
		if roundScore.ScoreReason != "correct_guess" {
			t.Fatalf("expected score reason %q, got %q", "correct_guess", roundScore.ScoreReason)
		}
		if roundScore.AwardedAt.IsZero() {
			t.Fatal("expected score award time")
		}
		seenScores[roundScore.ParticipantID] = true
	}
	if len(seenScores) != len(expectedScores) {
		t.Fatal("not all participant scores were persisted")
	}
	waitForPlayerMessage(t, player1, "Round2 has started")
	player1.Send <- "/guess apple"
	waitForPlayerMessage(t, player1, "Correct Guess! Congrats")
	waitForPlayerMessage(t, player1, "Round2 has ended")

	var (
		gameStatus string
		endedAt    *time.Time
	)
	completionDeadline := time.Now().Add(5 * time.Second)
	for {
		err = app.models.Games.DB.QueryRow(
			context.Background(),
			`SELECT status, ended_at FROM games WHERE id = $1`,
			input.Game.ID,
		).Scan(&gameStatus, &endedAt)
		if err != nil {
			t.Fatal(err)
		}
		if gameStatus == "completed" && endedAt != nil {
			break
		}
		if time.Now().After(completionDeadline) {
			t.Fatalf(
				"game did not complete: status=%q ended_at=%v",
				gameStatus,
				endedAt,
			)
		}
		time.Sleep(25 * time.Millisecond)
	}
	if endedAt.Before(input.Game.StartedAt) {
		t.Fatal("game ended before it started")
	}

	finalScores, err := app.models.GameFinalScores.GetAllForGame(
		context.Background(),
		input.Game.ID,
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(finalScores) != 2 {
		t.Fatalf("expected 2 final scores, got %d", len(finalScores))
	}

	type expectedFinalScore struct {
		points   int
		rank     int
		isWinner bool
	}
	expectedFinalScores := make(
		map[uuid.UUID]expectedFinalScore,
		len(input.GameParticipants),
	)
	for _, participant := range input.GameParticipants {
		switch participant.DisplayNameSnapshot {
		case "player1":
			expectedFinalScores[participant.ID] = expectedFinalScore{
				points:   2,
				rank:     1,
				isWinner: true,
			}
		case "player2":
			expectedFinalScores[participant.ID] = expectedFinalScore{
				points:   0,
				rank:     2,
				isWinner: false,
			}
		}
	}

	for _, finalScore := range finalScores {
		expected, ok := expectedFinalScores[finalScore.ParticipantID]
		if !ok {
			t.Fatalf("unexpected final-score participant %s", finalScore.ParticipantID)
		}
		if finalScore.GameID != input.Game.ID {
			t.Fatalf(
				"expected final-score game ID %s, got %s",
				input.Game.ID,
				finalScore.GameID,
			)
		}
		if finalScore.FinalScore != expected.points {
			t.Fatalf(
				"expected participant %s to finish with %d point(s), got %d",
				finalScore.ParticipantID,
				expected.points,
				finalScore.FinalScore,
			)
		}
		if finalScore.FinalRank != expected.rank {
			t.Fatalf(
				"expected participant %s to rank %d, got %d",
				finalScore.ParticipantID,
				expected.rank,
				finalScore.FinalRank,
			)
		}
		if finalScore.IsWinner != expected.isWinner {
			t.Fatalf(
				"expected participant %s winner=%t, got %t",
				finalScore.ParticipantID,
				expected.isWinner,
				finalScore.IsWinner,
			)
		}
		if finalScore.CreatedAt.IsZero() {
			t.Fatal("expected final score creation time")
		}
		delete(expectedFinalScores, finalScore.ParticipantID)
	}
	if len(expectedFinalScores) != 0 {
		t.Fatal("not all participant final scores were persisted")
	}
}
