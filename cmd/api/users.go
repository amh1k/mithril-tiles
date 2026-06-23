package main

import (
	"net/http"
)
func(app *application)registerUserHandler(w http.ResponseWriter, r *http.Request) {
	var input struct {
		displayName string
		handle string
    	email string
		password string
	}
	err := app.readJSON(w,r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

}