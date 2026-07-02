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

	timeout := time.NewTimer(3 * time.Second)
	defer timeout.Stop()

	for {
		select {
		case message := <-player.Receive:
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
	token2, err := GetAuthenticatedGuest(server, 2)
	if err != nil {
		t.Fatal(err)
	}
	if err != nil {
		t.Fatal(err)
	}
	player1 := realtime.StartPlayer(wsURL, *token1)
	t.Cleanup(player1.Cancel)
L1:
	for msg := range player1.Receive {
		if msg == "*** player1 joined the room ***" {
			break L1
		}
	}

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
	for msg := range player1.Receive {
		if msg == "Round1 has started" {
			break
		}
	}
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
	msg := <-player1.Receive
	if msg != "Correct Guess! Congrats" {
		fmt.Println(msg)
		
		t.Fatal("Guess should be correct")
	}
	// this will block
	for msg := range player1.Receive {
		if msg == "Round1 has ended" {
			break
		}
	}

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
	for msg :=  range player1.Receive {
		if msg == "Round2 has started" {
			break
		}
	}
	guess2 := "/guess apple"
	player1.Send <- guess2
	msg = <-player1.Receive
	if msg != "Correct Guess! Congrats" {
		t.Fatal("Guess should be correct")
	}
	// this will block
	for msg := range player1.Receive {
		if msg == "Round2 has ended" {
			break
		}
	}



}
