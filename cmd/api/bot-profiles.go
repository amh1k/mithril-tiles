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
func(app *application)insertBotToRoom(w http.ResponseWriter, r *http.Request) {
	params := httprouter.ParamsFromContext(r.Context())
	roomID := params.ByName("roomID")
	if roomID == "" {
		app.badRequestResponse(w, r, errors.New("missing room id"))
		return
	}
	room, err := app.roomManager.GetOrCreateRoom(roomID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
	var input struct {
	RequestedBy   uuid.UUID	`json:"requested_by"`
	ID            uuid.UUID `json:"id"`
	// Name          string    `json:"name"`
	// Difficulty    string    `json:"difficulty"`
	// BehaviorStyle string    `json:"behavior_style"`
	// AvatarURL     *string   `json:"avatar_url,omitempty"`
	// IsActive      bool      `json:"is_active"`
	// CreatedAt     time.Time `json:"created_at"`
	// UpdatedAt     time.Time `json:"updated_at"`

	}
	err = app.readJSON(w,r,&input)
	if err != nil {
		app.badRequestResponse(w,r, err)
	}
	botProfile, err := app.models.BotProfile.Get(input.ID)
	if err != nil {
		app.serverErrorResponse(w,r,err)
	}
	errorChan := make(chan error, 10)
	addBotCommand := realtime.AddBotCommand{
		RequestedBy: input.RequestedBy,
		Profile: *botProfile,
		Result: errorChan,
	}
	room.AddBotPlayer(addBotCommand)
	select {
	case errMsg := <- addBotCommand.Result:
		app.serverErrorResponse(w,r, errMsg)
	default:

	}
	app.writeJSON(w,http.StatusOK,envelope{
		"bot_profile":botProfile,
	}, nil)
}