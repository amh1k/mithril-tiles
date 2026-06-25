package main

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

func (app *application) createRoundScoreHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		RoundID       uuid.UUID `json:"round_id"`
		ParticipantID uuid.UUID `json:"participant_id"`
		PointsEarned  int       `json:"points_earned"`
		ScoreReason   string    `json:"score_reason"`
		AwardedAt     time.Time `json:"awarded_at"`
	}

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if input.AwardedAt.IsZero() {
		input.AwardedAt = time.Now()
	}
	roundScore := &data.RoundScore{
		RoundID:       input.RoundID,
		ParticipantID: input.ParticipantID,
		PointsEarned:  input.PointsEarned,
		ScoreReason:   input.ScoreReason,
		AwardedAt:     input.AwardedAt,
	}
	roundScore, err = app.models.RoundScores.Insert(roundScore)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	err = app.writeJSON(w, http.StatusCreated, envelope{"round_score": roundScore}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
