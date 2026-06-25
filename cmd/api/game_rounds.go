package main

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

func (app *application) createGameRoundHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
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

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if input.Status == "" {
		input.Status = "started"
	}
	if input.StartedAt.IsZero() {
		input.StartedAt = time.Now()
	}
	gameRound := &data.GameRound{
		GameID:              input.GameID,
		RoundNumber:         input.RoundNumber,
		DrawerParticipantID: input.DrawerParticipantID,
		WordID:              input.WordID,
		WordTextSnapshot:    input.WordTextSnapshot,
		Status:              input.Status,
		DurationSeconds:     input.DurationSeconds,
		StartedAt:           input.StartedAt,
		EndedAt:             input.EndedAt,
	}
	gameRound, err = app.models.GameRounds.Insert(gameRound)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	err = app.writeJSON(w, http.StatusCreated, envelope{"game_round": gameRound}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
