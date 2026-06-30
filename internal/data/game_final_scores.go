package data

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type GameFinalScoreModel struct {
	DB *pgxpool.Pool
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

const insertGameFinalScoreQuery = `
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

func (m *GameFinalScoreModel) InsertWithTx(
	ctx context.Context,
	tx pgx.Tx,
	gameFinalScore *GameFinalScore,
) (*GameFinalScore, error) {
	err := tx.QueryRow(
		ctx,
		insertGameFinalScoreQuery,
		gameFinalScore.GameID,
		gameFinalScore.ParticipantID,
		gameFinalScore.FinalScore,
		gameFinalScore.FinalRank,
		gameFinalScore.IsWinner,
	).Scan(
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

func (m *GameFinalScoreModel) InsertManyWithTx(
	ctx context.Context,
	tx pgx.Tx,
	gameFinalScores []*GameFinalScore,
) ([]*GameFinalScore, error) {
	inserted := make([]*GameFinalScore, 0, len(gameFinalScores))
	for _, gameFinalScore := range gameFinalScores {
		score, err := m.InsertWithTx(ctx, tx, gameFinalScore)
		if err != nil {
			return nil, err
		}
		inserted = append(inserted, score)
	}

	return inserted, nil
}

func (m *GameFinalScoreModel) Insert(gameFinalScore *GameFinalScore) (*GameFinalScore, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := m.DB.QueryRow(
		ctx,
		insertGameFinalScoreQuery,
		gameFinalScore.GameID,
		gameFinalScore.ParticipantID,
		gameFinalScore.FinalScore,
		gameFinalScore.FinalRank,
		gameFinalScore.IsWinner,
	).Scan(
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

func (m *GameFinalScoreModel) GetAllForGame(
	ctx context.Context,
	gameID uuid.UUID,
) ([]*GameFinalScore, error) {
	query := `
	SELECT
		id,
		game_id,
		participant_id,
		final_score,
		final_rank,
		is_winner,
		created_at
	FROM game_final_scores
	WHERE game_id = $1
	ORDER BY final_rank`

	rows, err := m.DB.Query(ctx, query, gameID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	gameFinalScores := make([]*GameFinalScore, 0)
	for rows.Next() {
		gameFinalScore := &GameFinalScore{}
		if err := rows.Scan(
			&gameFinalScore.ID,
			&gameFinalScore.GameID,
			&gameFinalScore.ParticipantID,
			&gameFinalScore.FinalScore,
			&gameFinalScore.FinalRank,
			&gameFinalScore.IsWinner,
			&gameFinalScore.CreatedAt,
		); err != nil {
			return nil, err
		}
		gameFinalScores = append(gameFinalScores, gameFinalScore)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return gameFinalScores, nil
}
