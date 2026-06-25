package data

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type GameRoundModel struct {
	DB *pgx.Conn
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
