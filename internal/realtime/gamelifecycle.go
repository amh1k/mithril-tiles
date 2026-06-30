package realtime

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
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

type GameLifecycle interface {
	StartGame(context.Context, GamePersistenceRequest) (*GamePersistenceResult, error)
	StartRound(context.Context, RoundStartRequest) (*RoundStartResult, error)
	EndRound(context.Context, RoundEndRequest) error
}
