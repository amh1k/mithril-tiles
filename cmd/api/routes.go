package main

import (
	"net/http"

	"github.com/julienschmidt/httprouter"
)

func (app *application) routes() http.Handler {
	router := httprouter.New()
	router.HandlerFunc(http.MethodGet, "/v1/healthcheck", app.healthcheckHandler)
	router.HandlerFunc(http.MethodGet, "/v1/session", app.handleGetSession)
	router.HandlerFunc(http.MethodPost, "/v1/guest-sessions", app.rateLimit(app.createGuestSessionHandler))
	router.HandlerFunc(http.MethodPost, "/v1/users/register", app.rateLimit(app.registerUserHandler))
	router.HandlerFunc(http.MethodPost, "/v1/users/login", app.rateLimit(app.loginUserHandler))
	router.HandlerFunc(http.MethodDelete, "/v1/users/delete", app.requireRegisteredUser(app.deleteUserHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/users/update", app.requireRegisteredUser(app.updateUserHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/users/avatar", app.requireRegisteredUser(app.uploadAvatarHandler))
	router.HandlerFunc(http.MethodPost, "/v1/word-packs", app.requireRegisteredUser(app.createWordPackHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/word-packs/:id", app.requireRegisteredUser(app.updateWordPackHandler))
	router.HandlerFunc(http.MethodDelete, "/v1/word-packs/:id", app.requireRegisteredUser(app.deleteWordPackHandler))
	router.HandlerFunc(http.MethodPost, "/v1/word-packs/:id/words", app.requireRegisteredUser(app.createWordHandler))
	router.HandlerFunc(http.MethodPatch, "/v1/words/:id", app.requireRegisteredUser(app.updateWordHandler))
	router.HandlerFunc(http.MethodDelete, "/v1/words/:id", app.requireRegisteredUser(app.deleteWordHandler))
	router.HandlerFunc(http.MethodPost, "/v1/rooms/:roomID", app.requireAuthenticatedPrincipal(app.createGameHandler))
	router.HandlerFunc(http.MethodPost, "/v1/rooms/:roomID/start", app.requireAuthenticatedPrincipal(app.handleStartGame))
	router.HandlerFunc(http.MethodPost, "/v1/rooms/:roomID/ws-ticket", app.requireAuthenticatedPrincipal(app.createWebSocketTicketHandler))
	router.HandlerFunc(http.MethodGet, "/v1/rooms/:roomID/ws", app.handleWebSocket)
	return app.recoverPanic(app.enableCORS(app.authenticate(router)))
}
