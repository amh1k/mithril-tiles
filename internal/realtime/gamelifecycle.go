package realtime

import (
	"context"
	"time"

	"mithrilTiles.abdulmoiz.net/internal/data"
)

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
	StartRound(context.Context, RoundStartRequest) (*RoundStartResult, error)
	EndRound(context.Context, RoundEndRequest) error
}
