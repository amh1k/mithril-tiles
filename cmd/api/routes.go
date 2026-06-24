package main

import (
	"net/http"

	"github.com/julienschmidt/httprouter"
)
func(app *application)routes()http.Handler {
	router := httprouter.New()
	router.HandlerFunc(http.MethodGet, "/v1/healthcheck", app.healthcheckHandler)
	router.HandlerFunc(http.MethodPost, "/v1/users/register", app.registerUserHandler)
	router.HandlerFunc(http.MethodPost, "/v1/users/login", app.loginUserHandler)
	router.HandlerFunc(http.MethodDelete, "/v1/users/:id", app.requireAuthenticatedUser(app.deleteUserHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/users/:id", app.requireAuthenticatedUser(app.updateUserHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/users/avatar", app.requireAuthenticatedUser(app.uploadAvatarHandler))
	return app.recoverPanic(app.authenticate(router))
}