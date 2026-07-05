package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/coder/websocket"
	"github.com/google/uuid"
	"github.com/julienschmidt/httprouter"
	"mithrilTiles.abdulmoiz.net/internal/data"
	"mithrilTiles.abdulmoiz.net/internal/realtime"
)

func (app *application) createWebSocketTicketHandler(w http.ResponseWriter, r *http.Request) {
	params := httprouter.ParamsFromContext(r.Context())
	roomID := params.ByName("roomID")
	if roomID == "" {
		app.badRequestResponse(w, r, errors.New("missing room id"))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	ticket, err := app.models.WebSocketTickets.Issue(
		ctx,
		app.contextGetPrincipal(r),
		roomID,
		data.DefaultWebSocketTicketTTL,
	)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	if err := app.writeJSON(w, http.StatusCreated, envelope{
		"websocket_ticket": ticket,
	}, nil); err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	params := httprouter.ParamsFromContext(r.Context())
	roomID := params.ByName("roomID")
	if roomID == "" {
		app.badRequestResponse(w, r, errors.New("missing room id"))
		return
	}

	principal := app.contextGetPrincipal(r)
	if !principal.IsAuthenticated() {
		ticket := r.URL.Query().Get("ticket")
		if ticket == "" {
			app.authenticationRequiredResponse(w, r)
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		ticketPrincipal, err := app.models.WebSocketTickets.Consume(ctx, ticket, roomID)
		if errors.Is(err, data.ErrRecordNotFound) {
			app.invalidWebSocketTicketResponse(w, r)
			return
		}
		if err != nil {
			app.serverErrorResponse(w, r, err)
			return
		}
		principal = ticketPrincipal
		r = app.contextSetPrincipal(r, principal)
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"},
	})
	if err != nil {
		app.logger.Error("websocket accept failed", "error", err)
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "connection closed")

	room, err := app.roomManager.GetOrCreateRoom(roomID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	ctx := r.Context()
	realtime.HandlePlayer(conn, room, principal, ctx)
}

func (app *application) handleStartGame(w http.ResponseWriter, r *http.Request) {
	// fmt.Println("We are ehre boys")
	params := httprouter.ParamsFromContext(r.Context())
	roomCode := params.ByName("roomID")
	if roomCode == "" {
		app.badRequestResponse(w, r, errors.New("missing room id"))
		return
	}
	var input struct {
		WordPackID       uuid.UUID       `json:"word_pack_id"`
		SettingsSnapshot json.RawMessage `json:"settings_snapshot"`
	}
	err := app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	if input.WordPackID == uuid.Nil {
		app.badRequestResponse(w, r, errors.New("word_pack_id must be provided"))
		return
	}
	if len(input.SettingsSnapshot) == 0 {
		input.SettingsSnapshot = json.RawMessage(`{}`)
	}
	room, err := app.roomManager.GetOrCreateRoom(roomCode)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}

	principal := app.contextGetPrincipal(r)

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	result, err := room.StartGame(ctx, realtime.GameStartRequest{
		RequestedBy:      principal.ID(),
		WordPackID:       input.WordPackID,
		SettingsSnapshot: input.SettingsSnapshot,
	})
	if err != nil {
		switch {
		case errors.Is(err, realtime.ErrOnlyHostCanStart):
			app.errorResponse(w, r, http.StatusForbidden, err.Error())
		case errors.Is(err, realtime.ErrNotEnoughPlayers):
			app.badRequestResponse(w, r, err)
		case errors.Is(err, realtime.ErrGameStartInProgress),
			errors.Is(err, realtime.ErrGameAlreadyStarted),
			errors.Is(err, realtime.ErrRoomClosed):
			app.errorResponse(w, r, http.StatusConflict, err.Error())
		case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
			return
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}
	err = app.writeJSON(w, http.StatusCreated, envelope{
		"game":              result.Game,
		"game_participants": result.Participants,
		"round":             result.Round,
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
