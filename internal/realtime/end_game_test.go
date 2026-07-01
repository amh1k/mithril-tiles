package realtime

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

type endGameLifecycleStub struct {
	endGame func(context.Context, GameEndRequest) (*GameEndResult, error)
}

func (s *endGameLifecycleStub) StartGame(
	context.Context,
	GamePersistenceRequest,
) (*GamePersistenceResult, error) {
	return nil, errors.New("unexpected StartGame call")
}

func (s *endGameLifecycleStub) StartRound(
	context.Context,
	RoundStartRequest,
) (*RoundStartResult, error) {
	return nil, errors.New("unexpected StartRound call")
}

func (s *endGameLifecycleStub) EndRound(context.Context, RoundEndRequest) error {
	return errors.New("unexpected EndRound call")
}

func (s *endGameLifecycleStub) EndGame(
	ctx context.Context,
	request GameEndRequest,
) (*GameEndResult, error) {
	return s.endGame(ctx, request)
}

func TestPersistEndGameUsesFreshContextForRetry(t *testing.T) {
	var attempts atomic.Int32
	gameID := uuid.New()
	lifecycle := &endGameLifecycleStub{
		endGame: func(ctx context.Context, _ GameEndRequest) (*GameEndResult, error) {
			if attempts.Add(1) == 1 {
				<-ctx.Done()
				return nil, ctx.Err()
			}
			if err := ctx.Err(); err != nil {
				return nil, fmt.Errorf("retry received expired context: %w", err)
			}
			return &GameEndResult{GameID: gameID}, nil
		},
	}
	room, err := NewRoom("retry-context", lifecycle, func(string) {})
	if err != nil {
		t.Fatal(err)
	}
	room.endGameRetry = endGameRetryPolicy{
		MaxAttempts:    2,
		AttemptTimeout: 10 * time.Millisecond,
		InitialBackoff: time.Millisecond,
		MaxBackoff:     time.Millisecond,
	}

	result, err := room.persistEndGame(GameEndRequest{
		GameID:   gameID,
		RoomCode: "retry-context",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.GameID != gameID {
		t.Fatalf("expected game ID %s, got %s", gameID, result.GameID)
	}
	if attempts.Load() != 2 {
		t.Fatalf("expected two attempts, got %d", attempts.Load())
	}
}

func TestPersistEndGameStopsOnNonRetryableError(t *testing.T) {
	var attempts atomic.Int32
	lifecycle := &endGameLifecycleStub{
		endGame: func(context.Context, GameEndRequest) (*GameEndResult, error) {
			attempts.Add(1)
			return nil, fmt.Errorf("%w: invalid final scores", ErrGameEndNotRetryable)
		},
	}
	room, err := NewRoom("permanent-error", lifecycle, func(string) {})
	if err != nil {
		t.Fatal(err)
	}
	room.endGameRetry = endGameRetryPolicy{
		MaxAttempts:    4,
		AttemptTimeout: time.Second,
		InitialBackoff: time.Millisecond,
		MaxBackoff:     time.Millisecond,
	}

	_, err = room.persistEndGame(GameEndRequest{GameID: uuid.New(), RoomCode: "permanent-error"})
	if !errors.Is(err, ErrGameEndNotRetryable) {
		t.Fatalf("expected non-retryable error, got %v", err)
	}
	if attempts.Load() != 1 {
		t.Fatalf("expected one attempt, got %d", attempts.Load())
	}
}

func TestPersistEndGameStopsAfterMaximumAttempts(t *testing.T) {
	var attempts atomic.Int32
	lifecycle := &endGameLifecycleStub{
		endGame: func(context.Context, GameEndRequest) (*GameEndResult, error) {
			attempts.Add(1)
			return nil, errors.New("temporary database failure")
		},
	}
	room, err := NewRoom("retry-limit", lifecycle, func(string) {})
	if err != nil {
		t.Fatal(err)
	}
	room.endGameRetry = endGameRetryPolicy{
		MaxAttempts:    3,
		AttemptTimeout: time.Second,
		InitialBackoff: time.Millisecond,
		MaxBackoff:     2 * time.Millisecond,
	}

	_, err = room.persistEndGame(GameEndRequest{GameID: uuid.New(), RoomCode: "retry-limit"})
	if !errors.Is(err, ErrGameEndRetriesExhausted) {
		t.Fatalf("expected exhausted retry error, got %v", err)
	}
	if attempts.Load() != 3 {
		t.Fatalf("expected three attempts, got %d", attempts.Load())
	}
}

func TestPersistEndGameStopsDuringBackoffWhenRoomCloses(t *testing.T) {
	attempted := make(chan struct{})
	lifecycle := &endGameLifecycleStub{
		endGame: func(context.Context, GameEndRequest) (*GameEndResult, error) {
			close(attempted)
			return nil, errors.New("temporary database failure")
		},
	}
	room, err := NewRoom("shutdown-retry", lifecycle, func(string) {})
	if err != nil {
		t.Fatal(err)
	}
	room.endGameRetry = endGameRetryPolicy{
		MaxAttempts:    3,
		AttemptTimeout: time.Second,
		InitialBackoff: time.Hour,
		MaxBackoff:     time.Hour,
	}

	result := make(chan error, 1)
	go func() {
		_, err := room.persistEndGame(GameEndRequest{
			GameID:   uuid.New(),
			RoomCode: "shutdown-retry",
		})
		result <- err
	}()
	<-attempted
	room.close()

	select {
	case err := <-result:
		if !errors.Is(err, ErrRoomClosed) {
			t.Fatalf("expected room-closed error, got %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("retry did not stop when room closed")
	}
}

func TestHandleEndGameMovesToFailedState(t *testing.T) {
	lifecycle := &endGameLifecycleStub{
		endGame: func(context.Context, GameEndRequest) (*GameEndResult, error) {
			return nil, fmt.Errorf("%w: invalid final scores", ErrGameEndNotRetryable)
		},
	}
	room, err := NewRoom("failed-end", lifecycle, func(string) {})
	if err != nil {
		t.Fatal(err)
	}
	room.broadcast = make(chan string, 1)
	room.gameState = GameStateStarted
	room.gameID = uuid.New()

	room.handleEndGame()

	if room.gameState != GameStateEndFailed {
		t.Fatalf("expected game state %q, got %q", GameStateEndFailed, room.gameState)
	}
	select {
	case <-room.broadcast:
	default:
		t.Fatal("expected clients to receive a completion-failure message")
	}
}

func TestConcurrentHandleEndGamePersistsOnlyOnce(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	var attempts atomic.Int32
	gameID := uuid.New()
	lifecycle := &endGameLifecycleStub{
		endGame: func(context.Context, GameEndRequest) (*GameEndResult, error) {
			if attempts.Add(1) == 1 {
				close(started)
			}
			<-release
			return &GameEndResult{GameID: gameID}, nil
		},
	}
	deleted := make(chan string, 1)
	room, err := NewRoom("concurrent-end", lifecycle, func(roomCode string) {
		deleted <- roomCode
	})
	if err != nil {
		t.Fatal(err)
	}
	room.broadcast = make(chan string, 1)
	room.gameState = GameStateStarted
	room.gameID = gameID

	var handlers sync.WaitGroup
	handlers.Add(2)
	go func() {
		defer handlers.Done()
		room.handleEndGame()
	}()
	go func() {
		defer handlers.Done()
		room.handleEndGame()
	}()

	<-started
	close(release)
	handlers.Wait()

	if attempts.Load() != 1 {
		t.Fatalf("expected one persistence call, got %d", attempts.Load())
	}
	if room.gameState != GameStateCompleted {
		t.Fatalf("expected game state %q, got %q", GameStateCompleted, room.gameState)
	}
	select {
	case roomCode := <-deleted:
		if roomCode != "concurrent-end" {
			t.Fatalf("unexpected deleted room %q", roomCode)
		}
	default:
		t.Fatal("expected completed room to be deleted")
	}
	select {
	case <-room.done:
	default:
		t.Fatal("expected completed room to close")
	}
}

func TestFinalScoreKeySeparatesPrincipalTypes(t *testing.T) {
	id := uuid.New()
	user := data.Principal{
		Type: data.PrincipalUser,
		User: &data.User{ID: id},
	}
	guest := data.Principal{
		Type:         data.PrincipalGuest,
		GuestSession: &data.GuestSession{ID: id},
	}

	if newPrincipalScoreKey(user) == newPrincipalScoreKey(guest) {
		t.Fatal("user and guest score identities must remain distinct")
	}
}
