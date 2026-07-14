package main

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/julienschmidt/httprouter"
	"mithrilTiles.abdulmoiz.net/internal/realtime"
)

// ```text
// GET    /v1/bot-profiles
// POST   /v1/rooms/:roomCode/bots
// DELETE /v1/rooms/:roomCode/bots/:botProfileID
// ```
func (app *application) listActiveBotProfiles(w http.ResponseWriter, r *http.Request) {
	botProfiles, err := app.models.BotProfile.ListActive()
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	app.writeJSON(w, http.StatusOK, envelope{
		"bot_profiles": botProfiles,
	}, nil)
}

func (app *application) insertBotToRoom(w http.ResponseWriter, r *http.Request) {
	params := httprouter.ParamsFromContext(r.Context())
	roomID := params.ByName("roomID")
	if roomID == "" {
		app.badRequestResponse(w, r, errors.New("missing room id"))
		return
	}
	room, err := app.roomManager.GetOrCreateRoom(roomID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	var input struct {
		ID uuid.UUID `json:"id"`
		// Name          string    `json:"name"`
		// Difficulty    string    `json:"difficulty"`
		// BehaviorStyle string    `json:"behavior_style"`
		// AvatarURL     *string   `json:"avatar_url,omitempty"`
		// IsActive      bool      `json:"is_active"`
		// CreatedAt     time.Time `json:"created_at"`
		// UpdatedAt     time.Time `json:"updated_at"`

	}
	requestedBy := app.contextGetPrincipal(r).ID()
	err = app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	botProfile, err := app.models.BotProfile.GetActive(input.ID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	errorChan := make(chan error, 10)
	addBotCommand := realtime.AddBotCommand{
		RequestedBy: requestedBy,
		Profile:     *botProfile,
		Result:      errorChan,
	}
	if err := room.AddToAddBotChannel(r.Context(), addBotCommand); err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	select {
	case errMsg := <-addBotCommand.Result:
		if errMsg != nil {
			app.serverErrorResponse(w, r, errMsg)
			return
		}
	case <-r.Context().Done():
		return
	}
	app.writeJSON(w, http.StatusOK, envelope{
		"bot_profile": botProfile,
	}, nil)
}

func (app *application) deleteBotFromRoom(w http.ResponseWriter, r *http.Request) {
	params := httprouter.ParamsFromContext(r.Context())
	roomID := params.ByName("roomID")
	if roomID == "" {
		app.badRequestResponse(w, r, errors.New("missing room id"))
		return
	}
	room, err := app.roomManager.GetOrCreateRoom(roomID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	var input struct {
		ID uuid.UUID `json:"id"`
	}
	requestedBy := app.contextGetPrincipal(r).ID()
	err = app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	botProfile, err := app.models.BotProfile.Get(input.ID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	errorChan := make(chan error, 10)
	removeBotCommand := realtime.RemoveBotCommand{
		RequestedBy: requestedBy,
		BotID:       botProfile.ID,
		Result:      errorChan,
	}
	if err := room.AddToRemoveBotChannel(r.Context(), removeBotCommand); err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	select {
	case errMsg := <-removeBotCommand.Result:
		if errMsg != nil {
			app.serverErrorResponse(w, r, errMsg)
			return
		}
	case <-r.Context().Done():
		return
	}
	app.writeJSON(w, http.StatusOK, envelope{
		"bot_profile": botProfile,
	}, nil)

}
