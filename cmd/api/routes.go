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
	router.HandlerFunc(http.MethodDelete, "/v1/users/delete", app.requireRegisteredUser(app.deleteUserHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/users/update", app.requireRegisteredUser(app.updateUserHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/users/avatar", app.requireRegisteredUser(app.uploadAvatarHandler))
	router.HandlerFunc(http.MethodPost, "/v1/word-packs", app.requireRegisteredUser(app.createWordPackHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/word-packs/:id", app.requireRegisteredUser(app.updateWordPackHandler))
	router.HandlerFunc(http.MethodDelete, "/v1/word-packs/:id", app.requireRegisteredUser(app.deleteWordPackHandler))
	router.HandlerFunc(http.MethodPost, "/v1/word-packs/:id/words", app.requireRegisteredUser(app.createWordHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/words/:id", app.requireRegisteredUser(app.updateWordHandler))
	router.HandlerFunc(http.MethodDelete, "/v1/words/:id", app.requireRegisteredUser(app.deleteWordHandler))
	router.HandlerFunc(http.MethodPost, "/v1/rooms/:id", app.requireAuthenticatedPrincipal(app.createGameHandler))
	router.HandlerFunc(http.MethodPost, "/v1/rooms/:roomID/start", app.requireAuthenticatedPrincipal(app.handleStartGame))
	router.HandlerFunc(http.MethodGet, "/v1/rooms/:roomID/ws", app.requireAuthenticatedPrincipal(app.handleWebSocket))
	return app.recoverPanic(app.authenticate(router))
}
