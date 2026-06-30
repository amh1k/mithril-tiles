package realtime

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
)
var (
	ErrGameStartInProgress = errors.New("game start is already in progress")
	ErrGameAlreadyStarted  = errors.New("game has already started")
	ErrNotEnoughPlayers    = errors.New("cannot start a game with fewer than two players")
	ErrOnlyHostCanStart    = errors.New("only the room host can start the game")
	ErrRoomClosed          = errors.New("room is closed")
)

type GameStartRequest struct {
	RequestedBy      uuid.UUID
	WordPackID       uuid.UUID
	SettingsSnapshot json.RawMessage
}

type GameStartResult struct {
	Game         *data.Game
	Participants []*data.GameParticipant
	Round        *data.GameRound
	Err          error
}

type gameStartCommand struct {
	ctx     context.Context
	request GameStartRequest
	result  chan GameStartResult
}

type gameStartCompletion struct {
	command     gameStartCommand
	persistence *GamePersistenceResult
	drawer      *Player
	players     []*Player
	err         error
}

func (r *Room) StartGame(
	ctx context.Context,
	request GameStartRequest,
) (*GameStartResult, error) {
	command := gameStartCommand{
		ctx:     ctx,
		request: request,
		result:  make(chan GameStartResult, 1),
	}
	select {
	case r.startGame <- command:
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-r.done:
		return nil, ErrRoomClosed
	}
	select {
	case result := <-command.result:
		if result.Err != nil {
			return nil, result.Err
		}
		return &result, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-r.done:
		return nil, ErrRoomClosed
	}
}
