package data

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type GameModel struct {
	DB *pgxpool.Pool
}

type Game struct {
	ID                uuid.UUID       `json:"id"`
	RoomCode          string          `json:"room_code"`
	HostParticipantID uuid.UUID       `json:"host_participant_id"`
	WordPackID        uuid.UUID       `json:"word_pack_id"`
	Status            string          `json:"status"`
	SettingsSnapshot  json.RawMessage `json:"settings_snapshot"`
	StartedAt         time.Time       `json:"started_at"`
	EndedAt           *time.Time      `json:"ended_at"`
	CreatedAt         time.Time       `json:"created_at"`
}

// HasAnyForRoom reports whether a room code has ever been used for a game.
// Room codes are single-use because completed games cannot be reopened.
func (m *GameModel) HasAnyForRoom(ctx context.Context, roomCode string) (bool, error) {
	const query = `SELECT EXISTS (SELECT 1 FROM games WHERE room_code = $1)`

	var exists bool
	if err := m.DB.QueryRow(ctx, query, roomCode).Scan(&exists); err != nil {
		return false, err
	}

	return exists, nil
}

// HasClosedForRoom reports whether a room's game reached a terminal state.
func (m *GameModel) HasClosedForRoom(ctx context.Context, roomCode string) (bool, error) {
	const query = `
		SELECT EXISTS (
			SELECT 1
			FROM games
			WHERE room_code = $1
				AND status IN ('completed', 'abandoned', 'cancelled')
		)`

	var exists bool
	if err := m.DB.QueryRow(ctx, query, roomCode).Scan(&exists); err != nil {
		return false, err
	}

	return exists, nil
}

func (m *GameModel) GetByIDForUpdate(
	ctx context.Context,
	tx pgx.Tx,
	gameID uuid.UUID,
) (*Game, error) {
	query := `
	SELECT
		id,
		room_code,
		host_participant_id,
		word_pack_id,
		status,
		settings_snapshot,
		started_at,
		ended_at,
		created_at
	FROM games
	WHERE id = $1
	FOR UPDATE`

	game := &Game{}
	err := tx.QueryRow(ctx, query, gameID).Scan(
		&game.ID,
		&game.RoomCode,
		&game.HostParticipantID,
		&game.WordPackID,
		&game.Status,
		&game.SettingsSnapshot,
		&game.StartedAt,
		&game.EndedAt,
		&game.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRecordNotFound
	}
	if err != nil {
		return nil, err
	}

	return game, nil
}

func (m *GameModel) CompleteWithTx(
	ctx context.Context,
	tx pgx.Tx,
	gameID uuid.UUID,
	endedAt time.Time,
) (*Game, error) {
	query := `
	UPDATE games
	SET status = 'completed',
		ended_at = $1
	WHERE id = $2
		AND status = 'started'
	RETURNING
		id,
		room_code,
		host_participant_id,
		word_pack_id,
		status,
		settings_snapshot,
		started_at,
		ended_at,
		created_at`

	game := &Game{}
	err := tx.QueryRow(ctx, query, endedAt, gameID).Scan(
		&game.ID,
		&game.RoomCode,
		&game.HostParticipantID,
		&game.WordPackID,
		&game.Status,
		&game.SettingsSnapshot,
		&game.StartedAt,
		&game.EndedAt,
		&game.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRecordNotFound
	}
	if err != nil {
		return nil, err
	}

	return game, nil
}

func (m *GameModel) GetActiveForRoomWithTx(
	ctx context.Context,
	tx pgx.Tx,
	roomCode string,
) (*Game, error) {
	query := `
	SELECT
		id,
		room_code,
		host_participant_id,
		word_pack_id,
		status,
		settings_snapshot,
		started_at,
		ended_at,
		created_at
	FROM games
	WHERE room_code = $1 AND status = 'started'
	ORDER BY started_at DESC
	LIMIT 1`

	game := &Game{}
	err := tx.QueryRow(ctx, query, roomCode).Scan(
		&game.ID,
		&game.RoomCode,
		&game.HostParticipantID,
		&game.WordPackID,
		&game.Status,
		&game.SettingsSnapshot,
		&game.StartedAt,
		&game.EndedAt,
		&game.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRecordNotFound
	}
	if err != nil {
		return nil, err
	}

	return game, nil
}

func (m *GameModel) InsertWithTx(
	ctx context.Context,
	tx pgx.Tx,
	game *Game,
) (*Game, error) {
	query := `
	INSERT INTO games (
		id,
		room_code,
		host_participant_id,
		word_pack_id,
		status,
		settings_snapshot,
		started_at,
		ended_at
	)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	RETURNING
		id,
		room_code,
		host_participant_id,
		word_pack_id,
		status,
		settings_snapshot,
		started_at,
		ended_at,
		created_at`

	err := tx.QueryRow(
		ctx,
		query,
		game.ID,
		game.RoomCode,
		game.HostParticipantID,
		game.WordPackID,
		game.Status,
		game.SettingsSnapshot,
		game.StartedAt,
		game.EndedAt,
	).Scan(
		&game.ID,
		&game.RoomCode,
		&game.HostParticipantID,
		&game.WordPackID,
		&game.Status,
		&game.SettingsSnapshot,
		&game.StartedAt,
		&game.EndedAt,
		&game.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	return game, nil
}

func (m *GameModel) Insert(game *Game) (*Game, error) {
	query := `
	INSERT INTO games (
		room_code,
		host_participant_id,
		word_pack_id,
		status,
		settings_snapshot,
		started_at,
		ended_at
	)
	VALUES ($1, $2, $3, $4, $5, $6, $7)
	RETURNING
		id,
		room_code,
		host_participant_id,
		word_pack_id,
		status,
		settings_snapshot,
		started_at,
		ended_at,
		created_at`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	args := []any{
		game.RoomCode,
		game.HostParticipantID,
		game.WordPackID,
		game.Status,
		game.SettingsSnapshot,
		game.StartedAt,
		game.EndedAt,
	}

	err := m.DB.QueryRow(ctx, query, args...).Scan(
		&game.ID,
		&game.RoomCode,
		&game.HostParticipantID,
		&game.WordPackID,
		&game.Status,
		&game.SettingsSnapshot,
		&game.StartedAt,
		&game.EndedAt,
		&game.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	return game, nil
}
