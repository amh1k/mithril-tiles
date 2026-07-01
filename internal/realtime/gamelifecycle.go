package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

var (
	ErrGameEndNotRetryable     = errors.New("game end error is not retryable")
	ErrGameEndRetriesExhausted = errors.New("game end retries exhausted")
)

type GamePersistenceRequest struct {
	RoomCode         string
	WordPackID       uuid.UUID
	SettingsSnapshot json.RawMessage
	Host             data.Principal
	Participants     []data.Principal
	Drawer           data.Principal
	DurationSeconds  int
}

type GamePersistenceResult struct {
	Game         *data.Game
	Participants []*data.GameParticipant
	Round        *data.GameRound
	Word         string
}

type RoundStartRequest struct {
	RoomCode        string
	RoundNumber     int
	Drawer          data.Principal
	Participants    []data.Principal
	DurationSeconds int
}

type RoundStartResult struct {
	Word      string
	StartedAt time.Time
}

type PlayerRoundScore struct {
	Principal data.Principal
	Points    int
}

type RoundEndRequest struct {
	RoomCode string
	EndedAt  time.Time
	Scores   []PlayerRoundScore
}

type PlayerFinalScore struct {
	Principal data.Principal
	Points    int
}

type principalScoreKey struct {
	Type data.PrincipalType
	ID   uuid.UUID
}

func newPrincipalScoreKey(principal data.Principal) principalScoreKey {
	return principalScoreKey{
		Type: principal.Type,
		ID:   principal.ID(),
	}
}

type GameEndRequest struct {
	GameID   uuid.UUID
	RoomCode string
	Scores   []PlayerFinalScore
}

type GameEndResult struct {
	GameID      uuid.UUID
	FinalScores []*data.GameFinalScore
}

type GameLifecycle interface {
	StartGame(context.Context, GamePersistenceRequest) (*GamePersistenceResult, error)
	StartRound(context.Context, RoundStartRequest) (*RoundStartResult, error)
	EndRound(context.Context, RoundEndRequest) error
	EndGame(context.Context, GameEndRequest) (*GameEndResult, error)
}
