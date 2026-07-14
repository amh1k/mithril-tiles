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
	roomTest.close()

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
		ActorID:   uuid.MustParse("11111111-1111-1111-1111-111111111111"),
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
	roomTest.close()
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

func TestSnapshotIncludesBotTypeAndNullAvatar(t *testing.T) {
	room, err := NewRoomUnitTest("bot-snapshot")
	if err != nil {
		t.Fatal(err)
	}

	viewer := &Player{Outgoing: make(chan string, 1)}
	bot := &Player{Type: botPlayer, Principal: *data.NewBotPrincipal(&data.BotProfile{ID: uuid.New(), Name: "Snapshot Bot"})}
	room.players[viewer] = true
	room.players[bot] = true
	room.handleSnapshotRequest()

	var payload struct {
		Data struct {
			Players []struct {
				Type      string  `json:"type"`
				AvatarURL *string `json:"avatar_url"`
			} `json:"players"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(<-viewer.Outgoing), &payload); err != nil {
		t.Fatal(err)
	}
	for _, player := range payload.Data.Players {
		if player.Type == "bot" && player.AvatarURL != nil {
			t.Fatalf("expected null bot avatar, got %q", *player.AvatarURL)
		}
	}
}

func TestCorrectGuessPublishesStructuredResult(t *testing.T) {
	room, err := NewRoomUnitTest("guess-result")
	if err != nil {
		t.Fatal(err)
	}
	player := &Player{Principal: data.Principal{Type: data.PrincipalUser, User: &data.User{ID: uuid.New(), DisplayName: "Guesser"}}, Outgoing: make(chan string, 2)}
	room.players[player] = true
	room.scores[player] = 0
	room.startTime = time.Now()

	room.handleCorrectGuess(player)
	for range 2 {
		message := <-player.Outgoing
		if !strings.Contains(message, `"type":"guess_result"`) {
			continue
		}
		if strings.Contains(message, `"word"`) || !strings.Contains(message, `"correct":true`) {
			t.Fatalf("unexpected guess result payload: %s", message)
		}
		return
	}
	t.Fatal("expected structured guess result event")
}

func TestBehaviorPolicyUsesDifficultyAndStyleWithinLimits(t *testing.T) {
	policy := behaviorPolicyFor(data.BotProfile{Difficulty: "hard", BehaviorStyle: "minimalist"})
	if policy.GuessDelay != 400*time.Millisecond || policy.MaxGuessAttempts != 5 || policy.MinRevealedLetters != 1 {
		t.Fatalf("unexpected hard guess policy: %+v", policy)
	}
	if policy.MaxDrawingStrokes != 3 || policy.DrawStrokeDelay != 80*time.Millisecond {
		t.Fatalf("unexpected minimalist drawing policy: %+v", policy)
	}

	unknown := behaviorPolicyFor(data.BotProfile{Difficulty: "unknown", BehaviorStyle: "unknown"})
	if unknown.MaxGuessAttempts != 3 || unknown.MaxDrawingStrokes != 64 {
		t.Fatalf("unexpected fallback policy: %+v", unknown)
	}
}

func TestLimitDrawingStrokesPreservesPlanEndpoints(t *testing.T) {
	strokes := []DrawStroke{stroke(0, 0, 0.1, 0.1), stroke(0.1, 0.1, 0.2, 0.2), stroke(0.2, 0.2, 0.3, 0.3), stroke(0.3, 0.3, 0.4, 0.4)}
	limited := limitDrawingStrokes(strokes, 2)
	if len(limited) != 2 || limited[0] != strokes[0] || limited[1] != strokes[3] {
		t.Fatalf("unexpected limited strokes: %+v", limited)
	}
}

func TestBotDrawerCompletionBroadcastsStroke(t *testing.T) {
	room, err := NewRoomUnitTest("bot-draw")
	if err != nil {
		t.Fatal(err)
	}

	botID := uuid.New()
	bot := &Player{
		Type: botPlayer,
		Principal: *data.NewBotPrincipal(&data.BotProfile{
			ID:   botID,
			Name: "Sketch Bot",
		}),
	}
	human := &Player{
		Type: humanPlayer,
		Principal: data.Principal{Type: data.PrincipalUser, User: &data.User{
			ID:          uuid.New(),
			DisplayName: "Viewer",
		}},
		Outgoing: make(chan string, 1),
	}
	gameID := uuid.New()
	room.players[bot] = true
	room.players[human] = true
	room.currentDrawer = bot
	room.gameID = gameID
	room.currentRoundNo = 1
	room.RoundState = RoundStateStarted
	room.botRuntimes[botID] = &BotRuntime{BotID: botID}

	room.handleBotActionCompletion(botActionCompletion{
		Metadata: BotActionMetadata{GameID: gameID, RoundNo: 1, BotID: botID},
		Kind:     botActionDraw,
		Strokes:  []DrawStroke{stroke(0.1, 0.2, 0.3, 0.4)},
	})

	message := <-human.Outgoing
	if !strings.Contains(message, `"actor_id":"`+botID.String()+`"`) {
		t.Fatalf("expected bot actor ID in stroke payload: %s", message)
	}
}

func TestNonDrawerBotCompletionIsRejected(t *testing.T) {
	room, err := NewRoomUnitTest("bot-draw")
	if err != nil {
		t.Fatal(err)
	}

	drawerID := uuid.New()
	guesserID := uuid.New()
	drawer := &Player{Type: botPlayer, Principal: *data.NewBotPrincipal(&data.BotProfile{ID: drawerID, Name: "Drawer"})}
	guesser := &Player{Type: botPlayer, Principal: *data.NewBotPrincipal(&data.BotProfile{ID: guesserID, Name: "Guesser"})}
	human := &Player{Outgoing: make(chan string, 1)}
	gameID := uuid.New()
	room.players[drawer] = true
	room.players[guesser] = true
	room.players[human] = true
	room.currentDrawer = drawer
	room.gameID = gameID
	room.currentRoundNo = 1
	room.RoundState = RoundStateStarted
	room.botRuntimes[guesserID] = &BotRuntime{BotID: guesserID}

	room.handleBotActionCompletion(botActionCompletion{
		Metadata: BotActionMetadata{GameID: gameID, RoundNo: 1, BotID: guesserID},
		Kind:     botActionDraw,
		Strokes:  []DrawStroke{stroke(0.1, 0.2, 0.3, 0.4)},
	})

	select {
	case message := <-human.Outgoing:
		t.Fatalf("non-drawer bot broadcast a stroke: %s", message)
	default:
	}
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

func TestBeginEndGameTransitionsOnlyOnce(t *testing.T) {
	room, err := NewRoomUnitTest("abc")
	if err != nil {
		t.Fatal(err)
	}
	room.gameState = GameStateStarted
	room.RoundState = RoundStateStarted

	if !room.beginEndGame() {
		t.Fatal("expected started game to begin ending")
	}
	if room.gameState != GameStateEnding {
		t.Fatalf("expected game state %q, got %q", GameStateEnding, room.gameState)
	}
	if room.RoundState != RoundStateIdle {
		t.Fatalf("expected round state %q, got %q", RoundStateIdle, room.RoundState)
	}
	if room.beginEndGame() {
		t.Fatal("expected duplicate end-game transition to be rejected")
	}
}

func TestFinalScoreSnapshotUsesPrincipalIdentity(t *testing.T) {
	room, err := NewRoomUnitTest("abc")
	if err != nil {
		t.Fatal(err)
	}
	principal := data.Principal{
		Type: data.PrincipalUser,
		User: &data.User{
			ID:          uuid.New(),
			DisplayName: "Test User",
		},
	}
	firstPlayer := &Player{
		Principal: principal,
		Outgoing:  make(chan string, 10),
	}
	room.handleJoin(joinRequest{
		player: firstPlayer,
		result: make(chan error, 1),
	})

	key := newPrincipalScoreKey(principal)
	score := room.globalScores[key]
	score.Points = 2
	room.globalScores[key] = score
	room.handleLeave(firstPlayer)
	if room.globalScores[key].Points != 2 {
		t.Fatal("leaving removed the principal's final score")
	}

	reconnectedPlayer := &Player{
		Principal: principal,
		Outgoing:  make(chan string, 10),
	}
	room.handleJoin(joinRequest{
		player: reconnectedPlayer,
		result: make(chan error, 1),
	})

	if len(room.globalScores) != 1 {
		t.Fatalf("expected one score identity, got %d", len(room.globalScores))
	}
	if room.globalScores[key].Points != 2 {
		t.Fatal("rejoining reset the principal's score")
	}

	snapshot := room.finalScoreSnapshot()
	score = room.globalScores[key]
	score.Points = 3
	room.globalScores[key] = score
	if snapshot[0].Points != 2 {
		t.Fatal("final score snapshot changed with live room state")
	}
}

func TestStartGameReturnsActorValidationError(t *testing.T) {
	room, err := NewRoomUnitTest("abc")
	if err != nil {
		t.Fatal(err)
	}
	go room.Run()
	t.Cleanup(func() {
		room.close()
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
