package main

import (
	"net/http"

	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

func (app *application) createGameFinalScoreHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		GameID        uuid.UUID `json:"game_id"`
		ParticipantID uuid.UUID `json:"participant_id"`
		FinalScore    int       `json:"final_score"`
		FinalRank     int       `json:"final_rank"`
		IsWinner      bool      `json:"is_winner"`
	}
	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	gameFinalScore := &data.GameFinalScore{
		GameID:        input.GameID,
		ParticipantID: input.ParticipantID,
		FinalScore:    input.FinalScore,
		FinalRank:     input.FinalRank,
		IsWinner:      input.IsWinner,
	}
	gameFinalScore, err = app.models.GameFinalScores.Insert(gameFinalScore)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	err = app.writeJSON(w, http.StatusCreated, envelope{"game_final_score": gameFinalScore}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
