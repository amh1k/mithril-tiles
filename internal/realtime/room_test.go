package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

func TestBroadcast(t *testing.T) {
	roomTest, err := NewRoomUnitTest("abc")
	if err != nil {

	}
	go roomTest.Run()
	principal1 := data.Principal{
		Type: data.PrincipalUser,
		User: &data.User{
			ID:            uuid.MustParse("11111111-1111-1111-1111-111111111111"),
			DisplayName:   "Test User",
			AccountStatus: "active",
			Handle:        "test-user",
			Email:         "test-user@example.com",
			Activated:     true,
		},
		GuestSession: nil,
	}
	player1 := &Player{
		Principal: principal1,
		Outgoing:  make(chan string, 10),
	}
	principal2 := data.Principal{
		Type: data.PrincipalGuest,
		GuestSession: &data.GuestSession{
			ID:          uuid.MustParse("22222222-2222-2222-2222-222222222222"),
			DisplayName: "Test Guest",
			CreatedAt:   time.Now(),
		},
		User: nil,
	}
	player2 := &Player{
		Principal: principal2,
		Outgoing:  make(chan string, 10),
	}
	select {
	case roomTest.join <- joinRequest{player: player1, result: make(chan error, 1)}:
	}
	select {
	case roomTest.join <- joinRequest{player: player2, result: make(chan error, 1)}:
	}

	time.Sleep(100 * time.Millisecond)
	select {
	case roomTest.broadcast <- "Hi there bros":
	}
	waitForMessage(t, player1.Outgoing, "Hi there bros")
	waitForMessage(t, player2.Outgoing, "Hi there bros")
	close(roomTest.done)

}
func waitForMessage(t *testing.T, outgoing <-chan string, expected string) {
	t.Helper()
	timeout := time.After(time.Second)
	for {
		select {
		case msg := <-outgoing:
			if strings.Contains(msg, expected) {
				return
			}
		case <-timeout:
			t.Fatalf("did not receive message containing %q", expected)
		}
	}
}

func TestDrawStroke(t *testing.T) {
	roomTest, err := NewRoomUnitTest("abc")
	if err != nil {

	}
	go roomTest.Run()
	drawStrokeTest := DrawStroke{
		From:      "Test User",
		RoomCode:  "abc",
		FromX:     10,
		FromY:     20,
		ToX:       30,
		ToY:       40,
		Color:     "#000000",
		BrushSize: 5,
	}
	principal1 := data.Principal{
		Type: data.PrincipalUser,
		User: &data.User{
			ID:            uuid.MustParse("11111111-1111-1111-1111-111111111111"),
			DisplayName:   "Test User",
			AccountStatus: "active",
			Handle:        "test-user",
			Email:         "test-user@example.com",
			Activated:     true,
		},
		GuestSession: nil,
	}
	player1 := &Player{
		Principal: principal1,
		Outgoing:  make(chan string, 10),
	}
	principal2 := data.Principal{
		Type: data.PrincipalGuest,
		GuestSession: &data.GuestSession{
			ID:          uuid.MustParse("22222222-2222-2222-2222-222222222222"),
			DisplayName: "Test Guest",
			CreatedAt:   time.Now(),
		},
		User: nil,
	}
	player2 := &Player{
		Principal: principal2,
		Outgoing:  make(chan string, 10),
	}
	payload := struct {
		Type string     `json:"type"`
		Data DrawStroke `json:"data"`
	}{
		Type: "draw_stroke",
		Data: drawStrokeTest,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	roomTest.mu.Lock()
	roomTest.currentDrawer = player1
	roomTest.mu.Unlock()
	roomTest.join <- joinRequest{player: player1, result: make(chan error, 1)}
	roomTest.join <- joinRequest{player: player2, result: make(chan error, 1)}
	roomTest.drawStroke <- drawStrokeTest
	waitForMessage(t, player1.Outgoing, string(data))
	// waitForMessage(t, player2.Outgoing, string(data))
	close(roomTest.done)
}
func TestDrawStrokeBeforeRoundDoesNotPanic(t *testing.T) {
	room, err := NewRoomUnitTest("abc")
	if err != nil {
		t.Fatal(err)
	}

	room.handleDrawStroke(DrawStroke{
		From: "Test User",
	})
}

func TestNewRoomStartsWithIdleGameState(t *testing.T) {
	room, err := NewRoomUnitTest("abc")
	if err != nil {
		t.Fatal(err)
	}

	if room.gameState != GameStateIdle {
		t.Fatalf("expected game state %q, got %q", GameStateIdle, room.gameState)
	}
}

func TestHandleJoinRejectsPlayerWhenRoomIsFull(t *testing.T) {
	room, err := NewRoomUnitTest("abc")
	if err != nil {
		t.Fatal(err)
	}
	for range MaxPlayers {
		room.players[&Player{}] = true
	}

	player := &Player{}
	result := make(chan error, 1)
	room.handleJoin(joinRequest{player: player, result: result})

	if err := <-result; err == nil {
		t.Fatal("expected full room to reject player")
	}
	if room.players[player] {
		t.Fatal("rejected player was added to room")
	}
}

func TestStartGameReturnsActorValidationError(t *testing.T) {
	room, err := NewRoomUnitTest("abc")
	if err != nil {
		t.Fatal(err)
	}
	go room.Run()
	t.Cleanup(func() {
		close(room.done)
	})

	_, err = room.StartGame(context.Background(), GameStartRequest{
		RequestedBy: uuid.New(),
		WordPackID:  uuid.New(),
	})
	if !errors.Is(err, ErrNotEnoughPlayers) {
		t.Fatalf("expected %v, got %v", ErrNotEnoughPlayers, err)
	}
	if room.gameState != GameStateIdle {
		t.Fatalf("expected game state %q, got %q", GameStateIdle, room.gameState)
	}
}
