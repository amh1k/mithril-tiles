package main

import (
	"net/http"

	"github.com/julienschmidt/httprouter"
)

func (app *application) routes() http.Handler {
	router := httprouter.New()
	router.HandlerFunc(http.MethodGet, "/v1/healthcheck", app.healthcheckHandler)
	router.HandlerFunc(http.MethodPost, "/v1/guest-sessions", app.createGuestSessionHandler)
	router.HandlerFunc(http.MethodPost, "/v1/users/register", app.registerUserHandler)
	router.HandlerFunc(http.MethodPost, "/v1/users/login", app.loginUserHandler)
	router.HandlerFunc(http.MethodDelete, "/v1/users/delete", app.requireAuthenticatedUser(app.deleteUserHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/users/update", app.requireAuthenticatedUser(app.updateUserHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/users/avatar", app.requireAuthenticatedUser(app.uploadAvatarHandler))
	router.HandlerFunc(http.MethodPost, "/v1/word-packs", app.requireAuthenticatedUser(app.createWordPackHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/word-packs/:id", app.requireAuthenticatedUser(app.updateWordPackHandler))
	router.HandlerFunc(http.MethodDelete, "/v1/word-packs/:id", app.requireAuthenticatedUser(app.deleteWordPackHandler))
	router.HandlerFunc(http.MethodPost, "/v1/word-packs/:id/words", app.requireAuthenticatedUser(app.createWordHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/words/:id", app.requireAuthenticatedUser(app.updateWordHandler))
	router.HandlerFunc(http.MethodDelete, "/v1/words/:id", app.requireAuthenticatedUser(app.deleteWordHandler))
	return app.recoverPanic(app.authenticate(router))
}
