package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"mithrilTiles.abdulmoiz.net/internal/data"
)

func (app *application) createGameHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		RoomCode          string          `json:"room_code"`
		HostParticipantID uuid.UUID       `json:"host_participant_id"`
		WordPackID        uuid.UUID       `json:"word_pack_id"`
		Status            string          `json:"status"`
		SettingsSnapshot  json.RawMessage `json:"settings_snapshot"`
		StartedAt         time.Time       `json:"started_at"`
		EndedAt           *time.Time      `json:"ended_at"`
	}

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if input.Status == "" {
		input.Status = "started"
	}
	if len(input.SettingsSnapshot) == 0 {
		input.SettingsSnapshot = json.RawMessage(`{}`)
	}
	if input.StartedAt.IsZero() {
		input.StartedAt = time.Now()
	}
	game := &data.Game{
		RoomCode:          input.RoomCode,
		HostParticipantID: input.HostParticipantID,
		WordPackID:        input.WordPackID,
		Status:            input.Status,
		SettingsSnapshot:  input.SettingsSnapshot,
		StartedAt:         input.StartedAt,
		EndedAt:           input.EndedAt,
	}
	game, err = app.models.Games.Insert(game)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	
	err = app.writeJSON(w, http.StatusCreated, envelope{"game": game}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
