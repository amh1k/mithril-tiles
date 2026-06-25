package data

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type GameFinalScoreModel struct {
	DB *pgx.Conn
}

type GameFinalScore struct {
	ID            uuid.UUID `json:"id"`
	GameID        uuid.UUID `json:"game_id"`
	ParticipantID uuid.UUID `json:"participant_id"`
	FinalScore    int       `json:"final_score"`
	FinalRank     int       `json:"final_rank"`
	IsWinner      bool      `json:"is_winner"`
	CreatedAt     time.Time `json:"created_at"`
}

func (m *GameFinalScoreModel) Insert(gameFinalScore *GameFinalScore) (*GameFinalScore, error) {
	query := `
	INSERT INTO game_final_scores (
		game_id,
		participant_id,
		final_score,
		final_rank,
		is_winner
	)
	VALUES ($1, $2, $3, $4, $5)
	RETURNING
		id,
		game_id,
		participant_id,
		final_score,
		final_rank,
		is_winner,
		created_at`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	args := []any{
		gameFinalScore.GameID,
		gameFinalScore.ParticipantID,
		gameFinalScore.FinalScore,
		gameFinalScore.FinalRank,
		gameFinalScore.IsWinner,
	}

	err := m.DB.QueryRow(ctx, query, args...).Scan(
		&gameFinalScore.ID,
		&gameFinalScore.GameID,
		&gameFinalScore.ParticipantID,
		&gameFinalScore.FinalScore,
		&gameFinalScore.FinalRank,
		&gameFinalScore.IsWinner,
		&gameFinalScore.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	return gameFinalScore, nil
}
