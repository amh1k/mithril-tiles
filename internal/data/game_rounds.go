package data

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type GameRoundModel struct {
	DB *pgxpool.Pool
}

type GameRound struct {
	ID                  uuid.UUID  `json:"id"`
	GameID              uuid.UUID  `json:"game_id"`
	RoundNumber         int        `json:"round_number"`
	DrawerParticipantID uuid.UUID  `json:"drawer_participant_id"`
	WordID              uuid.UUID  `json:"word_id"`
	WordTextSnapshot    string     `json:"word_text_snapshot"`
	Status              string     `json:"status"`
	DurationSeconds     int        `json:"duration_seconds"`
	StartedAt           time.Time  `json:"started_at"`
	EndedAt             *time.Time `json:"ended_at"`
}

func (m *GameRoundModel) InsertWithTx(
	ctx context.Context,
	tx pgx.Tx,
	gameRound *GameRound,
) (*GameRound, error) {
	query := `
	INSERT INTO game_rounds (
		game_id,
		round_number,
		drawer_participant_id,
		word_id,
		word_text_snapshot,
		status,
		duration_seconds,
		started_at,
		ended_at
	)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	RETURNING
		id,
		game_id,
		round_number,
		drawer_participant_id,
		word_id,
		word_text_snapshot,
		status,
		duration_seconds,
		started_at,
		ended_at`

	err := tx.QueryRow(
		ctx,
		query,
		gameRound.GameID,
		gameRound.RoundNumber,
		gameRound.DrawerParticipantID,
		gameRound.WordID,
		gameRound.WordTextSnapshot,
		gameRound.Status,
		gameRound.DurationSeconds,
		gameRound.StartedAt,
		gameRound.EndedAt,
	).Scan(
		&gameRound.ID,
		&gameRound.GameID,
		&gameRound.RoundNumber,
		&gameRound.DrawerParticipantID,
		&gameRound.WordID,
		&gameRound.WordTextSnapshot,
		&gameRound.Status,
		&gameRound.DurationSeconds,
		&gameRound.StartedAt,
		&gameRound.EndedAt,
	)
	if err != nil {
		return nil, err
	}

	return gameRound, nil
}

func (m *GameRoundModel) GetByGameAndRoundNumber(
	gameID uuid.UUID,
	roundNumber int,
) (*GameRound, error) {
	query := `
	SELECT
		id,
		game_id,
		round_number,
		drawer_participant_id,
		word_id,
		word_text_snapshot,
		status,
		duration_seconds,
		started_at,
		ended_at
	FROM game_rounds
	WHERE game_id = $1 AND round_number = $2`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	gameRound := &GameRound{}
	err := m.DB.QueryRow(ctx, query, gameID, roundNumber).Scan(
		&gameRound.ID,
		&gameRound.GameID,
		&gameRound.RoundNumber,
		&gameRound.DrawerParticipantID,
		&gameRound.WordID,
		&gameRound.WordTextSnapshot,
		&gameRound.Status,
		&gameRound.DurationSeconds,
		&gameRound.StartedAt,
		&gameRound.EndedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRecordNotFound
	}
	if err != nil {
		return nil, err
	}

	return gameRound, nil
}

func (m *GameRoundModel) CompleteActiveForRoom(
	ctx context.Context,
	tx pgx.Tx,
	roomCode string,
	endedAt time.Time,
) (*GameRound, error) {
	query := `
	UPDATE game_rounds
	SET status = 'completed',
		ended_at = $1
	WHERE id = (
		SELECT gr.id
		FROM game_rounds AS gr
		INNER JOIN games AS g ON g.id = gr.game_id
		WHERE g.room_code = $2
			AND g.status = 'started'
			AND gr.status = 'started'
		ORDER BY gr.started_at DESC
		LIMIT 1
		FOR UPDATE
	)
	RETURNING
		id,
		game_id,
		round_number,
		drawer_participant_id,
		word_id,
		word_text_snapshot,
		status,
		duration_seconds,
		started_at,
		ended_at`

	gameRound := &GameRound{}
	err := tx.QueryRow(ctx, query, endedAt, roomCode).Scan(
		&gameRound.ID,
		&gameRound.GameID,
		&gameRound.RoundNumber,
		&gameRound.DrawerParticipantID,
		&gameRound.WordID,
		&gameRound.WordTextSnapshot,
		&gameRound.Status,
		&gameRound.DurationSeconds,
		&gameRound.StartedAt,
		&gameRound.EndedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRecordNotFound
	}
	if err != nil {
		return nil, err
	}

	return gameRound, nil
}

func (m *GameRoundModel) Insert(gameRound *GameRound) (*GameRound, error) {
	query := `
	INSERT INTO game_rounds (
		game_id,
		round_number,
		drawer_participant_id,
		word_id,
		word_text_snapshot,
		status,
		duration_seconds,
		started_at,
		ended_at
	)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	RETURNING
		id,
		game_id,
		round_number,
		drawer_participant_id,
		word_id,
		word_text_snapshot,
		status,
		duration_seconds,
		started_at,
		ended_at`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	args := []any{
		gameRound.GameID,
		gameRound.RoundNumber,
		gameRound.DrawerParticipantID,
		gameRound.WordID,
		gameRound.WordTextSnapshot,
		gameRound.Status,
		gameRound.DurationSeconds,
		gameRound.StartedAt,
		gameRound.EndedAt,
	}

	err := m.DB.QueryRow(ctx, query, args...).Scan(
		&gameRound.ID,
		&gameRound.GameID,
		&gameRound.RoundNumber,
		&gameRound.DrawerParticipantID,
		&gameRound.WordID,
		&gameRound.WordTextSnapshot,
		&gameRound.Status,
		&gameRound.DurationSeconds,
		&gameRound.StartedAt,
		&gameRound.EndedAt,
	)
	if err != nil {
		return nil, err
	}

	return gameRound, nil
}
