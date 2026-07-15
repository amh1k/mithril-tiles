package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/julienschmidt/httprouter"
	"mithrilTiles.abdulmoiz.net/internal/data"
	"mithrilTiles.abdulmoiz.net/internal/realtime"
	"mithrilTiles.abdulmoiz.net/internal/validator"
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

func (app *application) listBotProfilesHandler(w http.ResponseWriter, r *http.Request) {
	botProfiles, err := app.models.BotProfile.List()
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	app.writeJSON(w, http.StatusOK, envelope{"bot_profiles": botProfiles}, nil)
}

func (app *application) createBotProfileHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name          string  `json:"name"`
		Difficulty    string  `json:"difficulty"`
		BehaviorStyle string  `json:"behavior_style"`
		AvatarURL     *string `json:"avatar_url"`
		IsActive      *bool   `json:"is_active"`
	}
	if err := app.readJSON(w, r, &input); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	botProfile := &data.BotProfile{
		Name:          strings.TrimSpace(input.Name),
		Difficulty:    strings.ToLower(strings.TrimSpace(input.Difficulty)),
		BehaviorStyle: strings.TrimSpace(input.BehaviorStyle),
		AvatarURL:     input.AvatarURL,
		IsActive:      true,
	}
	if input.IsActive != nil {
		botProfile.IsActive = *input.IsActive
	}
	if !validateBotProfileInput(app, w, r, botProfile) {
		return
	}
	if err := app.models.BotProfile.Insert(botProfile); err != nil {
		if errors.Is(err, data.ErrDuplicateBotProfileName) {
			app.failedValidationResponse(w, r, map[string]string{"name": "a bot profile with this name already exists"})
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}
	app.writeJSON(w, http.StatusCreated, envelope{"bot_profile": botProfile}, nil)
}

func (app *application) updateBotProfileHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}
	botProfile, err := app.models.BotProfile.Get(id)
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	var input struct {
		Name          *string         `json:"name"`
		Difficulty    *string         `json:"difficulty"`
		BehaviorStyle *string         `json:"behavior_style"`
		AvatarURL     json.RawMessage `json:"avatar_url"`
		IsActive      *bool           `json:"is_active"`
	}
	if err := app.readJSON(w, r, &input); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if input.Name != nil {
		botProfile.Name = strings.TrimSpace(*input.Name)
	}
	if input.Difficulty != nil {
		botProfile.Difficulty = strings.ToLower(strings.TrimSpace(*input.Difficulty))
	}
	if input.BehaviorStyle != nil {
		botProfile.BehaviorStyle = strings.TrimSpace(*input.BehaviorStyle)
	}
	if len(input.AvatarURL) > 0 {
		if strings.TrimSpace(string(input.AvatarURL)) == "null" {
			botProfile.AvatarURL = nil
		} else {
			var avatarURL string
			if err := json.Unmarshal(input.AvatarURL, &avatarURL); err != nil {
				app.badRequestResponse(w, r, err)
				return
			}
			botProfile.AvatarURL = &avatarURL
		}
	}
	if input.IsActive != nil {
		botProfile.IsActive = *input.IsActive
	}
	if !validateBotProfileInput(app, w, r, botProfile) {
		return
	}
	if err := app.models.BotProfile.Update(botProfile); err != nil {
		if errors.Is(err, data.ErrDuplicateBotProfileName) {
			app.failedValidationResponse(w, r, map[string]string{"name": "a bot profile with this name already exists"})
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}
	app.writeJSON(w, http.StatusOK, envelope{"bot_profile": botProfile}, nil)
}

func (app *application) deleteBotProfileHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}
	if err := app.models.BotProfile.Delete(id); err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		if errors.Is(err, data.ErrBotProfileInUse) {
			app.errorResponse(w, r, http.StatusConflict, "bot profile cannot be deleted because it is referenced by game history")
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}
	app.writeJSON(w, http.StatusOK, envelope{"message": "bot profile successfully deleted"}, nil)
}

func validateBotProfileInput(app *application, w http.ResponseWriter, r *http.Request, botProfile *data.BotProfile) bool {
	v := validator.New()
	data.ValidateBotProfile(v, botProfile)
	if v.Valid() {
		return true
	}
	app.failedValidationResponse(w, r, v.Errors)
	return false
}

func (app *application) insertBotToRoom(w http.ResponseWriter, r *http.Request) {
	params := httprouter.ParamsFromContext(r.Context())
	roomID := params.ByName("roomID")
	if roomID == "" {
		app.badRequestResponse(w, r, errors.New("missing room id"))
		return
	}
	if !app.ensureRoomCodePlayable(w, r, roomID) {
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
	if !app.ensureRoomCodePlayable(w, r, roomID) {
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
