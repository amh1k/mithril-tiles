package main

import (
	"errors"
	"net/http"
	"time"

	"mithrilTiles.abdulmoiz.net/internal/data"
	"mithrilTiles.abdulmoiz.net/internal/validator"
)
func(app *application)registerUserHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		displayName string
		handle string
    	email string
		password string
		avatarURL string
	}
	err := app.readJSON(w,r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	user := &data.User{
		DisplayName: input.displayName,
		Handle: input.handle,
		Email: input.email,
		AvatarURL: input.avatarURL,
	}
	err = user.Password.Set(input.password)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	v := validator.New()
	err = app.models.Users.Insert(user)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrDuplicateEmail):
			v.AddError("email", "a user with this email address already exists")
			app.failedValidationResponse(w, r, v.Errors)
		default:
			app.serverErrorResponse(w, r, err)

		}
		
		
	}
}
	// token, err := app.models.Tokens.New(user.ID, 3*24*time.Hour, data.ScopeAuthentication)
	// if err != nil {
	// 	app.serverErrorResponse(w, r, err)
	// 	return
	// }


	func(app *application)loginUserHandler(w http.ResponseWriter, r *http.Request) {
		var input struct {
			email string
			password string

		}
		err := app.readJSON(w,r, &input)
		if err != nil {
			app.badRequestResponse(w, r, err)
			return

		}
		user, err := app.models.Users.GetByEmail(input.email)
		if err != nil {


		}
		match, err := user.Password.Matches(input.password)
		if err != nil {
			app.serverErrorResponse(w, r, err)
			return
		}
		if !match {
			app.invalidCredentialsResponse(w, r)
			return
		}
		token, err := app.models.Tokens.New(user.ID,3*24*time.Hour, data.ScopeAuthentication)
		if err != nil {
			app.serverErrorResponse(w,r,err)
		}
		app.writeJSON(w, http.StatusCreated, envelope{"authentication_token": token}, nil)
		if err != nil {
		app.serverErrorResponse(w, r, err)
		}




	}








