package data

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type RoundScoreModel struct {
	DB *pgx.Conn
}

type RoundScore struct {
	ID            uuid.UUID `json:"id"`
	RoundID       uuid.UUID `json:"round_id"`
	ParticipantID uuid.UUID `json:"participant_id"`
	PointsEarned  int       `json:"points_earned"`
	ScoreReason   string    `json:"score_reason"`
	AwardedAt     time.Time `json:"awarded_at"`
}

func (m *RoundScoreModel) InsertWithTx(
	ctx context.Context,
	tx pgx.Tx,
	roundScore *RoundScore,
) (*RoundScore, error) {
	query := `
	INSERT INTO round_scores (
		round_id,
		participant_id,
		points_earned,
		score_reason,
		awarded_at
	)
	VALUES ($1, $2, $3, $4, $5)
	RETURNING
		id,
		round_id,
		participant_id,
		points_earned,
		score_reason,
		awarded_at`

	err := tx.QueryRow(
		ctx,
		query,
		roundScore.RoundID,
		roundScore.ParticipantID,
		roundScore.PointsEarned,
		roundScore.ScoreReason,
		roundScore.AwardedAt,
	).Scan(
		&roundScore.ID,
		&roundScore.RoundID,
		&roundScore.ParticipantID,
		&roundScore.PointsEarned,
		&roundScore.ScoreReason,
		&roundScore.AwardedAt,
	)
	if err != nil {
		return nil, err
	}

	return roundScore, nil
}

func (m *RoundScoreModel) Insert(roundScore *RoundScore) (*RoundScore, error) {
	query := `
	INSERT INTO round_scores (
		round_id,
		participant_id,
		points_earned,
		score_reason,
		awarded_at
	)
	VALUES ($1, $2, $3, $4, $5)
	RETURNING
		id,
		round_id,
		participant_id,
		points_earned,
		score_reason,
		awarded_at`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	args := []any{
		roundScore.RoundID,
		roundScore.ParticipantID,
		roundScore.PointsEarned,
		roundScore.ScoreReason,
		roundScore.AwardedAt,
	}

	err := m.DB.QueryRow(ctx, query, args...).Scan(
		&roundScore.ID,
		&roundScore.RoundID,
		&roundScore.ParticipantID,
		&roundScore.PointsEarned,
		&roundScore.ScoreReason,
		&roundScore.AwardedAt,
	)
	if err != nil {
		return nil, err
	}

	return roundScore, nil
}
