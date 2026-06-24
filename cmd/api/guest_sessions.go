package main

import (
	"net/http"
	"time"

	"mithrilTiles.abdulmoiz.net/internal/data"
	"mithrilTiles.abdulmoiz.net/internal/validator"
)

func (app *application) createGuestSessionHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		DisplayName string `json:"display_name"`
	}

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	v := validator.New()
	data.ValidateDisplayName(v, input.DisplayName)
	if !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	guestSession := &data.GuestSession{
		DisplayName: input.DisplayName,
	}
	session, err := app.models.GuestSessions.Insert(guestSession)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	token, err := app.models.Tokens.NewForGuest(session.ID, 3*24*time.Hour)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusCreated, envelope{
		"guest_session":        session,
		"authentication_token": token,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
