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
	router.HandlerFunc(http.MethodPost, "/v1/word-packs", app.requireRegisteredUser(app.requireAdminUser(app.createWordPackHandler)))
	router.HandlerFunc(http.MethodPatch, "/v1/word-packs/:id", app.requireRegisteredUser(app.requireAdminUser(app.updateWordPackHandler)))
	router.HandlerFunc(http.MethodDelete, "/v1/word-packs/:id", app.requireRegisteredUser(app.requireAdminUser(app.deleteWordPackHandler)))
	router.HandlerFunc(http.MethodPost, "/v1/word-packs/:id/words", app.requireRegisteredUser(app.createWordHandler))
	router.HandlerFunc(http.MethodGet, "/v1/word-packs-getall", app.requireAuthenticatedPrincipal(app.getAllWordPacks))
	router.HandlerFunc(http.MethodGet, "/v1/word-packs/:id", app.requireRegisteredUser(app.getWordPackById))
	router.HandlerFunc(http.MethodPatch, "/v1/words/:id", app.requireRegisteredUser(app.updateWordHandler))
	router.HandlerFunc(http.MethodPost, "/v1/words/:id", app.requireRegisteredUser(app.createWordHandler))
	router.HandlerFunc(http.MethodDelete, "/v1/words/:id", app.requireRegisteredUser(app.deleteWordHandler))
	router.HandlerFunc(http.MethodPost, "/v1/rooms/:roomID", app.requireAuthenticatedPrincipal(app.createGameHandler))
	router.HandlerFunc(http.MethodPost, "/v1/rooms/:roomID/start", app.requireAuthenticatedPrincipal(app.handleStartGame))
	router.HandlerFunc(http.MethodPost, "/v1/rooms/:roomID/ws-ticket", app.requireAuthenticatedPrincipal(app.createWebSocketTicketHandler))
	router.HandlerFunc(http.MethodGet, "/v1.rooms/gameFinalScore/:id", app.requireAuthenticatedPrincipal(app.getGameFinalScoresByGameId))
	router.HandlerFunc(http.MethodGet, "/v1/games/:gameID/participants/:participantID/principal", app.requireAuthenticatedPrincipal(app.getPrincipalByGameAndParticipant))

	router.HandlerFunc(http.MethodGet, "/v1/bot-profiles", app.requireAuthenticatedPrincipal(app.listActiveBotProfiles))
	router.HandlerFunc(http.MethodGet, "/v1/admin/bot-profiles", app.requireRegisteredUser(app.requireAdminUser(app.listBotProfilesHandler)))
	router.HandlerFunc(http.MethodPost, "/v1/admin/bot-profiles", app.requireRegisteredUser(app.requireAdminUser(app.createBotProfileHandler)))
	router.HandlerFunc(http.MethodPatch, "/v1/admin/bot-profiles/:id", app.requireRegisteredUser(app.requireAdminUser(app.updateBotProfileHandler)))
	router.HandlerFunc(http.MethodDelete, "/v1/admin/bot-profiles/:id", app.requireRegisteredUser(app.requireAdminUser(app.deleteBotProfileHandler)))
	router.HandlerFunc(http.MethodPost, "/v1/rooms/:roomID/bots", app.requireAuthenticatedPrincipal(app.insertBotToRoom))
	router.HandlerFunc(http.MethodDelete, "/v1/rooms/:roomID/bots", app.requireAuthenticatedPrincipal(app.deleteBotFromRoom))
	router.HandlerFunc(http.MethodGet, "/v1/rooms/:roomID/ws", app.handleWebSocket)
	return app.recoverPanic(app.enableCORS(app.authenticate(router)))
}
