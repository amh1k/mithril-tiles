package main

import (
	"context"
	"net/http"
	"time"

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

func (app *application)getGameFinalScoresByGameId(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.badRequestResponse(w, r, err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	gameFinalScore, err := app.models.GameFinalScores.GetAllForGame(ctx, id)
	if err != nil {
		app.serverErrorResponse(w, r, err)

	}
	app.writeJSON(w, http.StatusOK, envelope {
		"game-final-score": gameFinalScore,
	}, nil)

}
