package main

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/julienschmidt/httprouter"
	"mithrilTiles.abdulmoiz.net/internal/data"
	"mithrilTiles.abdulmoiz.net/internal/validator"
)

func (app *application) registerUserHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		DisplayName string `json:"display_name"`
		Handle      string `json:"handle"`
		Email       string `json:"email"`
		Password    string `json:"password"`
		AvatarURL   string `json:"avatar_url"`
	}
	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	v := validator.New()
	data.ValidateDisplayName(v, input.DisplayName)
	data.Validatehandle(v, input.Handle)
	data.ValidateEmail(v, input.Email)
	data.ValidatePasswordPlaintext(v, input.Password)
	if !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	user := &data.User{
		DisplayName: input.DisplayName,
		Handle:      input.Handle,
		Email:       input.Email,
		AvatarURL:   input.AvatarURL,
	}
	err = user.Password.Set(input.Password)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	err = app.models.Users.Insert(user)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrDuplicateEmail):
			v.AddError("email", "a user with this email address already exists")
			app.failedValidationResponse(w, r, v.Errors)
		case errors.Is(err, data.ErrDuplicateHandle):
			v.AddError("handle", "a user with this handle already exists")
			app.failedValidationResponse(w, r, v.Errors)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	token, err := app.models.Tokens.New(user.ID, 3*24*time.Hour, data.ScopeAuthentication)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	err = app.writeJSON(w, http.StatusCreated, envelope{
		"user":                 user,
		"authentication_token": token,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) loginUserHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return

	}
	user, err := app.models.Users.GetByEmail(input.Email)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.invalidCredentialsResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}
	match, err := user.Password.Matches(input.Password)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	if !match {
		app.invalidCredentialsResponse(w, r)
		return
	}
	token, err := app.models.Tokens.New(user.ID, 3*24*time.Hour, data.ScopeAuthentication)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	err = app.writeJSON(w, http.StatusCreated, envelope{
		"user":                 user,
		"authentication_token": token,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) deleteUserHandler(w http.ResponseWriter, r *http.Request) {
	id := app.contextGetPrincipal(r).ID()
	err := app.models.Users.Delete(id)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}
	err = app.writeJSON(w, http.StatusOK, envelope{"message": "user successfully deleted"}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}

}

func (app *application) updateUserHandler(w http.ResponseWriter, r *http.Request) {
	id := app.contextGetPrincipal(r).ID()
	user, err := app.models.Users.Get(id)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:

			app.serverErrorResponse(w, r, err)
		}
		return
	}
	var input struct {
		DisplayName *string `json:"display_name"`
		Handle      *string `json:"handle"`
		Email       *string `json:"email"`
		Password    *string `json:"password"`
		AvatarURL   *string `json:"avatar_url"`
	}
	err = app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if input.DisplayName != nil {
		user.DisplayName = *input.DisplayName
	}
	if input.Handle != nil {
		user.Handle = *input.Handle
	}
	if input.Email != nil {
		user.Email = *input.Email
	}
	if input.AvatarURL != nil {
		user.AvatarURL = *input.AvatarURL
	}

	v := validator.New()
	data.ValidateDisplayName(v, user.DisplayName)
	data.Validatehandle(v, user.Handle)
	data.ValidateEmail(v, user.Email)
	if input.Password != nil {
		data.ValidatePasswordPlaintext(v, *input.Password)
	}
	if !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	if input.Password != nil {
		err = user.Password.Set(*input.Password)
		if err != nil {
			app.serverErrorResponse(w, r, err)
			return
		}
	}

	err = app.models.Users.Update(user)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrDuplicateEmail):
			v.AddError("email", "a user with this email address already exists")
			app.failedValidationResponse(w, r, v.Errors)
		case errors.Is(err, data.ErrDuplicateHandle):
			v.AddError("handle", "a user with this handle already exists")
			app.failedValidationResponse(w, r, v.Errors)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"user": user}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) uploadAvatarHandler(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 5<<20)

	err := r.ParseMultipartForm(5 << 20)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	file, header, err := r.FormFile("avatar")
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	defer file.Close()
	fmt.Println("uploaded file:", header.Filename)
	fmt.Println("file size:", header.Size)
	avatarURL, err := app.uploadToCloudinary(r.Context(), file, header)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	userID := app.contextGetPrincipal(r).User.ID
	err = app.models.Users.UpdateAvatar(r.Context(), userID, avatarURL)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	err = app.writeJSON(w, http.StatusOK, envelope{
		"avatar_url": avatarURL,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) getPrincipalByGameAndParticipant(
	w http.ResponseWriter,
	r *http.Request,
) {
	params := httprouter.ParamsFromContext(r.Context())
	gameID, err := uuid.Parse(params.ByName("gameID"))
	if err != nil {
		app.badRequestResponse(w, r, errors.New("invalid game ID"))
		return
	}
	participantID, err := uuid.Parse(params.ByName("participantID"))
	if err != nil {
		app.badRequestResponse(w, r, errors.New("invalid participant ID"))
		return
	}

	principal, err := app.models.GameParticipants.GetPrincipal(
		r.Context(),
		gameID,
		participantID,
	)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	err = app.writeJSON(
		w,
		http.StatusOK,
		envelope{"principal": principal},
		nil,
	)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
